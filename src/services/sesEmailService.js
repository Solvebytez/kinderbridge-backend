// Amazon SES Email Service for Sending Transactional Emails
// Using AWS SDK v3 for SES

const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

/**
 * Initialize SES Client with credentials from environment
 * @returns {SESClient} Configured SES client
 */
function createSESClient() {
  console.log("🔵 [SES] Creating SES client...");
  const region = process.env.AWS_REGION || "us-east-1";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  console.log(`🔵 [SES] Region: ${region}`);
  console.log(`🔵 [SES] Access Key ID: ${accessKeyId ? `${accessKeyId.substring(0, 8)}...` : "NOT SET"}`);
  console.log(`🔵 [SES] Secret Access Key: ${secretAccessKey ? "SET (hidden)" : "NOT SET"}`);

  if (!accessKeyId || !secretAccessKey) {
    console.error("❌ [SES] Missing AWS credentials");
    throw new Error(
      "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required"
    );
  }

  try {
    const client = new SESClient({
      region: region,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });
    console.log("✅ [SES] SES client created successfully");
    return client;
  } catch (error) {
    console.error("❌ [SES] Failed to create SES client:", error.message);
    throw error;
  }
}

/**
 * Send email via Amazon SES
 * @param {Object} options - Email options
 * @param {string|string[]} options.to - Recipient email address(es)
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content of the email
 * @param {string} [options.from] - Sender email (defaults to SES_FROM_EMAIL env var)
 * @param {string} [options.fromName] - Sender name (defaults to "Day Care")
 * @param {string} [options.replyTo] - Reply-to email address
 * @returns {Promise<Object>} Result object with success status
 */
async function sendEmail({
  to,
  subject,
  html,
  from = null,
  fromName = "Day Care",
  replyTo = null,
}) {
  try {
    console.log("🔵 [SES] sendEmail called");
    console.log(`🔵 [SES] Parameters:`, {
      to: typeof to === "string" ? to : Array.isArray(to) ? to.join(", ") : "INVALID",
      subject: subject ? `${subject.substring(0, 50)}...` : "MISSING",
      htmlLength: html ? html.length : 0,
      from: from || "Using env var",
      fromName: fromName,
      replyTo: replyTo || "Not set",
    });

    // Validate required parameters
    if (!to) {
      console.error("❌ [SES] Validation failed: Recipient email address is required");
      throw new Error("Recipient email address is required");
    }
    if (!subject || typeof subject !== "string" || !subject.trim()) {
      console.error("❌ [SES] Validation failed: Subject is invalid");
      throw new Error("Subject is required and must be a non-empty string");
    }
    if (!html || typeof html !== "string" || !html.trim()) {
      console.error("❌ [SES] Validation failed: HTML content is invalid");
      throw new Error("HTML content is required and must be a non-empty string");
    }

    // Get sender email from env or parameter (use email directly as recommended)
    const fromEmail = from || process.env.SES_FROM_EMAIL;
    console.log(`🔵 [SES] From email: ${fromEmail || "NOT SET"}`);
    if (!fromEmail) {
      console.error("❌ [SES] SES_FROM_EMAIL environment variable is not set");
      throw new Error(
        "SES_FROM_EMAIL environment variable or 'from' parameter is required"
      );
    }

    // Use email directly in Source (recommended approach)
    // SES will use the verified email address
    const sourceEmail = fromEmail.trim();

    // Convert single email to array for SES
    const toAddresses = Array.isArray(to) ? to : [to];

    console.log("🔵 [SES] Creating SES client...");
    // Create SES client
    const sesClient = createSESClient();

    // Prepare email command (matching recommended approach)
    const commandParams = {
      Source: sourceEmail,
      Destination: {
        ToAddresses: toAddresses,
      },
      Message: {
        Subject: {
          Data: subject.trim(),
          Charset: "UTF-8",
        },
        Body: {
          Html: {
            Data: html.trim(),
            Charset: "UTF-8",
          },
        },
      },
    };

    // Add reply-to if provided
    if (replyTo) {
      commandParams.ReplyToAddresses = Array.isArray(replyTo)
        ? replyTo
        : [replyTo];
      console.log(`🔵 [SES] Reply-To: ${commandParams.ReplyToAddresses.join(", ")}`);
    }

    console.log("🔵 [SES] Preparing email command...");
    console.log(`🔵 [SES] Source: ${sourceEmail}`);
    if (fromName) {
      console.log(`🔵 [SES] Display Name: ${fromName} (will appear in recipient's inbox)`);
    }
    console.log(`🔵 [SES] To: ${toAddresses.join(", ")}`);
    console.log(`🔵 [SES] Subject: ${subject.trim()}`);
    console.log(`🔵 [SES] HTML Content Length: ${html.trim().length} characters`);

    // Send email
    console.log("🔵 [SES] Sending email via SES API...");
    const command = new SendEmailCommand(commandParams);
    const response = await sesClient.send(command);

    console.log("✅ [SES] Email sent successfully!");
    console.log(`✅ [SES] Message ID: ${response.MessageId}`);
    console.log(`✅ [SES] Response:`, JSON.stringify(response, null, 2));

    return {
      success: true,
      messageId: response.MessageId,
      message: "Email sent successfully",
    };
  } catch (error) {
    console.error("❌ [SES] Error sending email:");
    console.error(`❌ [SES] Error Name: ${error.name || "Unknown"}`);
    console.error(`❌ [SES] Error Message: ${error.message || "Unknown error"}`);
    console.error(`❌ [SES] Error Code: ${error.Code || error.code || "N/A"}`);
    if (error.$metadata) {
      console.error(`❌ [SES] HTTP Status: ${error.$metadata.httpStatusCode || "N/A"}`);
      console.error(`❌ [SES] Request ID: ${error.$metadata.requestId || "N/A"}`);
    }
    if (error.stack) {
      console.error(`❌ [SES] Stack Trace:`, error.stack);
    }
    return {
      success: false,
      error: error.message || "Failed to send email",
      errorCode: error.Code || error.code || null,
      errorDetails: error.$metadata || null,
    };
  }
}

/**
 * Send welcome email after registration
 * @param {string} email - User email address
 * @param {string} firstName - User's first name
 * @returns {Promise<Object>} Result object with success status
 */
async function sendWelcomeEmail(email, firstName = "User") {
  try {
    console.log("🔵 [SES] sendWelcomeEmail called");
    console.log(`🔵 [SES] Email: ${email}`);
    console.log(`🔵 [SES] First Name: ${firstName}`);

    // Validate email
    if (!email || typeof email !== "string" || !email.includes("@")) {
      console.error("❌ [SES] Invalid email address provided:", email);
      return {
        success: false,
        message: "Invalid email address",
      };
    }

    const firstNameValue = firstName || "User";
    const subject = `Welcome to Day Care, ${firstNameValue}! 🎉`;
    console.log(`🔵 [SES] Welcome email subject: ${subject}`);

    // Custom HTML welcome email template
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Day Care</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f4f4f4;">
    <tr>
      <td style="padding: 20px 0;">
        <table role="presentation" style="width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Welcome to Day Care! 🎉</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px;">Hello, ${firstNameValue}!</h2>
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                Thank you for joining our Day Care community! We're thrilled to have you on board.
              </p>
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                Your account has been successfully created. You can now start exploring our platform and find the perfect daycare for your needs.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin: 30px 0;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL || process.env.FRONTEND_DEV_URL || 'https://kinderbridge.ca'}/dashboard" style="display: inline-block; padding: 14px 30px; background-color: #667eea; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Get Started</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                If you have any questions, feel free to reach out to our support team. We're here to help!
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px;">
                Best regards,<br>
                <strong style="color: #333333;">The Day Care Team</strong>
              </p>
              <p style="margin: 10px 0 0 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} Day Care. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    console.log("🔵 [SES] Calling sendEmail function...");
    const result = await sendEmail({
      to: email.trim(),
      subject: subject,
      html: htmlTemplate,
      fromName: "KinderBridge",
    });

    if (result.success) {
      console.log("✅ [SES] Welcome email sent successfully");
    } else {
      console.error("❌ [SES] Welcome email failed:", result.error);
    }

    return result;
  } catch (error) {
    console.error("❌ [SES] Exception in sendWelcomeEmail:");
    console.error(`❌ [SES] Error: ${error.message || "Unknown error"}`);
    console.error(`❌ [SES] Stack:`, error.stack);
    return {
      success: false,
      error: error.message || "Failed to send welcome email",
    };
  }
}

/**
 * Send password reset email
 * @param {string} email - User email address
 * @param {string} firstName - User's first name
 * @param {string} resetToken - Password reset token
 * @returns {Promise<Object>} Result object with success status
 */
async function sendPasswordResetEmail(email, firstName = "User", resetToken) {
  try {
    console.log("🔵 [SES] sendPasswordResetEmail called");
    console.log(`🔵 [SES] Email: ${email}`);
    console.log(`🔵 [SES] First Name: ${firstName}`);
    console.log(`🔵 [SES] Reset Token: ${resetToken ? "Present" : "Missing"}`);

    // Validate email
    if (!email || typeof email !== "string" || !email.includes("@")) {
      console.error("❌ [SES] Invalid email address provided:", email);
      return {
        success: false,
        message: "Invalid email address",
      };
    }

    // Validate reset token
    if (!resetToken || typeof resetToken !== "string") {
      console.error("❌ [SES] Invalid reset token provided");
      return {
        success: false,
        message: "Reset token is required",
      };
    }

    const firstNameValue = firstName || "User";
    const subject = `Reset Your Password - KinderBridge`;
    console.log(`🔵 [SES] Password reset email subject: ${subject}`);

    // Get frontend URL from environment
    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.FRONTEND_DEV_URL ||
      "https://kinderbridge.ca";
    const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(
      resetToken
    )}`;

    // Custom HTML password reset email template
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f4f4f4;">
    <tr>
      <td style="padding: 20px 0;">
        <table role="presentation" style="width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Reset Your Password</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px;">Hello, ${firstNameValue}!</h2>
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                We received a request to reset your password for your KinderBridge account.
              </p>
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                Click the button below to reset your password. This link will expire in 1 hour for security reasons.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin: 30px 0;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${resetUrl}" style="display: inline-block; padding: 14px 30px; background-color: #667eea; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Reset Password</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 10px 0 0 0; color: #667eea; font-size: 12px; line-height: 1.6; word-break: break-all;">
                ${resetUrl}
              </p>
              
              <p style="margin: 30px 0 0 0; color: #999999; font-size: 14px; line-height: 1.6;">
                If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px;">
                Best regards,<br>
                <strong style="color: #333333;">The KinderBridge Team</strong>
              </p>
              <p style="margin: 10px 0 0 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} KinderBridge. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    console.log("🔵 [SES] Calling sendEmail function...");
    const result = await sendEmail({
      to: email.trim(),
      subject: subject,
      html: htmlTemplate,
      fromName: "KinderBridge",
    });

    if (result.success) {
      console.log("✅ [SES] Password reset email sent successfully");
    } else {
      console.error("❌ [SES] Password reset email failed:", result.error);
    }

    return result;
  } catch (error) {
    console.error("❌ [SES] Exception in sendPasswordResetEmail:");
    console.error(`❌ [SES] Error: ${error.message || "Unknown error"}`);
    console.error(`❌ [SES] Stack:`, error.stack);
    return {
      success: false,
      error: error.message || "Failed to send password reset email",
    };
  }
}

/**
 * Send custom HTML email
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} htmlContent - Custom HTML content
 * @param {Object} [options] - Additional options (from, fromName, replyTo)
 * @returns {Promise<Object>} Result object with success status
 */
async function sendCustomEmail(to, subject, htmlContent, options = {}) {
  return await sendEmail({
    to: to,
    subject: subject,
    html: htmlContent,
    from: options.from || null,
    fromName: options.fromName || "KinderBridge",
    replyTo: options.replyTo || null,
  });
}

/**
 * Test SES connection and configuration
 * @returns {Promise<Object>} Result object with connection status
 */
async function testConnection() {
  try {
    console.log("🔵 [SES] Testing connection...");
    console.log("🔵 [SES] Checking environment variables...");
    console.log(`🔵 [SES] AWS_REGION: ${process.env.AWS_REGION || "NOT SET (using default: us-east-1)"}`);
    console.log(`🔵 [SES] AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? `${process.env.AWS_ACCESS_KEY_ID.substring(0, 8)}...` : "NOT SET"}`);
    console.log(`🔵 [SES] AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? "SET (hidden)" : "NOT SET"}`);
    console.log(`🔵 [SES] SES_FROM_EMAIL: ${process.env.SES_FROM_EMAIL || "NOT SET"}`);

    const sesClient = createSESClient();
    
    console.log("✅ [SES] SES client created successfully");
    console.log(`✅ [SES] Region: ${process.env.AWS_REGION || "us-east-1"}`);
    console.log(`✅ [SES] From Email: ${process.env.SES_FROM_EMAIL || "Not configured"}`);
    
    return {
      success: true,
      message: "SES client configured successfully",
      region: process.env.AWS_REGION || "us-east-1",
      fromEmail: process.env.SES_FROM_EMAIL || null,
    };
  } catch (error) {
    console.error("❌ [SES] Connection test failed:");
    console.error(`❌ [SES] Error Name: ${error.name || "Unknown"}`);
    console.error(`❌ [SES] Error Message: ${error.message || "Unknown error"}`);
    if (error.stack) {
      console.error(`❌ [SES] Stack Trace:`, error.stack);
    }
    return {
      success: false,
      error: error.message || "Failed to connect to SES",
    };
  }
}

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendCustomEmail,
  testConnection,
  createSESClient,
};

