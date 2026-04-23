const Stripe = require("stripe");
const ApplicationController = require("./applicationController");
const Purchase = require("../schemas/PurchaseSchema");
const {
  successResponse,
  errorResponse,
  internalErrorResponse,
} = require("../utils/responseHelper");

class PaymentController {
  constructor(db) {
    this.db = db;
    this.applicationController = new ApplicationController(db);
    this.stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (this.stripeSecretKey) {
      this.stripe = new Stripe(this.stripeSecretKey);
    } else {
      this.stripe = null;
    }
  }

  getAutoApplyAmountCents() {
    const parsed = Number(process.env.STRIPE_AUTO_APPLY_AMOUNT_CENTS ?? 2900);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 2900;
  }

  getAutoApplyCredits() {
    const parsed = Number(process.env.STRIPE_AUTO_APPLY_CREDITS ?? 30);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 30;
  }

  ensureStripeConfigured() {
    if (!this.stripe) {
      return errorResponse("Stripe is not configured on the server", 503);
    }
    return null;
  }

  parseDaycareIds(payload) {
    return Array.isArray(payload?.daycareIds)
      ? [...new Set(payload.daycareIds.map((id) => String(id).trim()).filter(Boolean))]
      : [];
  }

  async listUserPurchases(userId, options = {}) {
    try {
      if (!userId) {
        return errorResponse("User ID is required", 401);
      }

      const limitRaw = Number(options?.limit ?? 50);
      const skipRaw = Number(options?.skip ?? 0);
      const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.trunc(limitRaw))) : 50;
      const skip = Number.isFinite(skipRaw) ? Math.max(0, Math.trunc(skipRaw)) : 0;
      const status =
        typeof options?.status === "string" && options.status.trim()
          ? options.status.trim()
          : null;

      const filter = { userId };
      if (status) {
        filter.status = status;
      }

      const purchases = await Purchase.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      return successResponse(purchases);
    } catch (error) {
      console.error("Error listing purchases:", error);
      return internalErrorResponse(error.message);
    }
  }

  async createPaymentIntent(userId, payload = {}) {
    try {
      if (!userId) {
        return errorResponse("User ID is required", 401);
      }

      const stripeConfigError = this.ensureStripeConfigured();
      if (stripeConfigError) return stripeConfigError;

      const daycareIds = this.parseDaycareIds(payload);
      if (daycareIds.length === 0) {
        return errorResponse("At least one daycare ID is required", 400);
      }

      const PACK = this.getAutoApplyCredits();
      const wallet = await this.applicationController.creditModel.collection
        .findOne({ userId })
        .lean();
      const remaining = Number(wallet?.remainingCredits ?? 0);
      const normalizedRemaining = Number.isFinite(remaining) ? Math.max(0, remaining) : 0;
      const creditsNeeded = daycareIds.length;

      if (normalizedRemaining >= creditsNeeded) {
        return errorResponse(
          "No payment required. You have enough credits to submit this checkout.",
          400,
          [{ remainingCredits: normalizedRemaining, creditsNeeded }]
        );
      }

      if (normalizedRemaining > 0) {
        return errorResponse(
          `You have ${normalizedRemaining} credits remaining. Please submit up to ${normalizedRemaining} daycares before purchasing another pack.`,
          400,
          [{ remainingCredits: normalizedRemaining, creditsNeeded, packSize: PACK }]
        );
      }

      const amountCents = this.getAutoApplyAmountCents();
      const creditsToGrant = this.getAutoApplyCredits();
      const currency = (process.env.STRIPE_CURRENCY || "cad").toLowerCase();

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountCents,
        currency,
        automatic_payment_methods: { enabled: true },
        metadata: {
          userId,
          daycareIdsCsv: daycareIds.join(","),
          creditsToGrant: String(creditsToGrant),
          paymentType: "auto_apply_credits",
        },
      });

      await Purchase.findOneAndUpdate(
        { stripePaymentId: paymentIntent.id },
        {
          $setOnInsert: {
            userId,
            amount: amountCents / 100,
            paymentMethod: "stripe",
            status: "pending",
            stripePaymentId: paymentIntent.id,
            paymentIntentId: paymentIntent.id,
            description: `Auto-apply credits purchase (${creditsToGrant} credits)`,
            paymentType: "auto_apply_credits",
            daycareIds,
            creditsGranted: 0,
          },
        },
        { upsert: true, new: true }
      );

      return successResponse({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amountCents,
        currency,
        creditsToGrant,
      });
    } catch (error) {
      console.error("Error creating payment intent:", error);
      return internalErrorResponse(error.message);
    }
  }

  async getPaymentStatus(userId, paymentIntentId) {
    try {
      if (!userId) {
        return errorResponse("User ID is required", 401);
      }
      if (!paymentIntentId || typeof paymentIntentId !== "string") {
        return errorResponse("paymentIntentId is required", 400);
      }

      const pid = paymentIntentId.trim();
      const purchase = await Purchase.findOne({
        userId,
        $or: [{ stripePaymentId: pid }, { paymentIntentId: pid }],
      }).lean();

      if (!purchase) {
        return errorResponse("Payment record not found", 404);
      }

      return successResponse({
        paymentIntentId: paymentIntentId.trim(),
        status: purchase.status,
        creditsGranted: purchase.creditsGranted || 0,
        processedAt: purchase.processedAt || null,
      });
    } catch (error) {
      console.error("Error fetching payment status:", error);
      return internalErrorResponse(error.message);
    }
  }

  async markPaymentFailed(paymentIntentId, reason) {
    if (!paymentIntentId) return;

    await Purchase.findOneAndUpdate(
      { stripePaymentId: paymentIntentId },
      {
        $set: {
          paymentIntentId,
          stripePaymentId: paymentIntentId,
          status: "failed",
          description: reason || "Payment failed",
          processedAt: new Date(),
        },
      },
      { new: true }
    );
  }

  async handlePaymentSucceeded(paymentIntent, eventId) {
    const paymentIntentId = paymentIntent?.id;
    if (!paymentIntentId) return;

    const existingCompleted = await Purchase.findOne({
      stripePaymentId: paymentIntentId,
      status: "completed",
      creditsGranted: { $gt: 0 },
    }).lean();

    if (existingCompleted) {
      return;
    }

    const metadata = paymentIntent.metadata || {};
    const userId = String(metadata.userId || "").trim();
    const creditsToGrant = Number(metadata.creditsToGrant || this.getAutoApplyCredits());
    const daycareIds = String(metadata.daycareIdsCsv || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (!userId) {
      await this.markPaymentFailed(paymentIntentId, "Missing userId in payment metadata");
      return;
    }

    const grantResult = await this.applicationController.grantAutoApplyCredits(userId, {
      credits: Number.isInteger(creditsToGrant) && creditsToGrant > 0 ? creditsToGrant : 30,
      paymentReference: paymentIntentId,
      note: "Stripe payment succeeded",
    });

    if (!grantResult?.body?.success) {
      const reason = grantResult?.body?.error || "Failed to grant credits";
      await this.markPaymentFailed(paymentIntentId, reason);
      return;
    }

    await Purchase.findOneAndUpdate(
      { stripePaymentId: paymentIntentId },
      {
        $set: {
          paymentIntentId,
          stripePaymentId: paymentIntentId,
          status: "completed",
          processedAt: new Date(),
          webhookEventId: eventId || null,
          paymentType: "auto_apply_credits",
          daycareIds,
          creditsGranted:
            grantResult?.body?.data?.grantedCredits ||
            (Number.isInteger(creditsToGrant) ? creditsToGrant : 30),
          description: "Auto-apply credits purchased via Stripe",
        },
      },
      { upsert: true, new: true }
    );
  }

  /**
   * After the client confirms payment, call this to grant credits if the webhook
   * has not run yet (typical in local dev). Idempotent: safe to call after webhook.
   */
  async reconcileAfterClientPayment(userId, paymentIntentId) {
    try {
      if (!userId) {
        return errorResponse("User ID is required", 401);
      }

      const stripeConfigError = this.ensureStripeConfigured();
      if (stripeConfigError) return stripeConfigError;

      const pid = String(paymentIntentId || "").trim();
      if (!pid) {
        return errorResponse("paymentIntentId is required", 400);
      }

      const pi = await this.stripe.paymentIntents.retrieve(pid);

      if (pi.status !== "succeeded") {
        return errorResponse(
          `Payment is not completed yet (status: ${pi.status})`,
          400
        );
      }

      const metaUserId = String(pi.metadata?.userId || "").trim();
      if (!metaUserId || metaUserId !== String(userId)) {
        return errorResponse("Payment does not belong to this account", 403);
      }

      await this.handlePaymentSucceeded(pi, null);

      return successResponse({
        reconciled: true,
        paymentIntentId: pid,
      });
    } catch (error) {
      console.error("Error reconciling payment:", error);
      return internalErrorResponse(error.message);
    }
  }

  async processWebhookEvent(signature, rawBodyBuffer) {
    try {
      const stripeConfigError = this.ensureStripeConfigured();
      if (stripeConfigError) return stripeConfigError;

      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        return errorResponse("Missing STRIPE_WEBHOOK_SECRET", 503);
      }

      if (!signature) {
        return errorResponse("Missing Stripe signature header", 400);
      }

      const event = this.stripe.webhooks.constructEvent(
        rawBodyBuffer,
        signature,
        webhookSecret
      );

      if (event.type === "payment_intent.succeeded") {
        await this.handlePaymentSucceeded(event.data.object, event.id);
      } else if (event.type === "payment_intent.payment_failed") {
        const paymentIntentId = event?.data?.object?.id;
        const reason =
          event?.data?.object?.last_payment_error?.message || "Payment failed";
        await this.markPaymentFailed(paymentIntentId, reason);
      }

      return successResponse({ received: true });
    } catch (error) {
      console.error("Error processing Stripe webhook:", error);
      return errorResponse(`Webhook Error: ${error.message}`, 400);
    }
  }
}

module.exports = PaymentController;
