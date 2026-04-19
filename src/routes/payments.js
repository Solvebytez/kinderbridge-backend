const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const PaymentController = require("../controllers/paymentController");

router.post("/create-intent", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const paymentController = new PaymentController(req.db);
    const result = await paymentController.createPaymentIntent(userId, req.body || {});
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

router.get("/status/:paymentIntentId", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { paymentIntentId } = req.params;
    const paymentController = new PaymentController(req.db);
    const result = await paymentController.getPaymentStatus(userId, paymentIntentId);
    res.set(
      "Cache-Control",
      "private, no-store, no-cache, must-revalidate, max-age=0"
    );
    res.set("Pragma", "no-cache");
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error getting payment status:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

router.post("/reconcile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const paymentIntentId = req.body?.paymentIntentId;
    const paymentController = new PaymentController(req.db);
    const result = await paymentController.reconcileAfterClientPayment(
      userId,
      paymentIntentId
    );
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error reconciling payment:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers["stripe-signature"];
    const paymentController = new PaymentController(req.db);
    const result = await paymentController.processWebhookEvent(signature, req.body);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error handling Stripe webhook:", error);
    res.status(400).json({
      success: false,
      error: "Webhook error",
      message: error.message,
    });
  }
};

module.exports = {
  router,
  handleWebhook,
};
