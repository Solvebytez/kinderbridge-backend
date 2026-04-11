// Email Service for Sending PDF Reports
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const { generateWelcomeGuidePDF } = require('./pdfGenerator');

// Load email configuration from environment or config file
function getEmailConfig() {
  // Try to get from environment variables first
  // Support both SMTP_PASS and SMTP_PASSWORD for backward compatibility
  const emailConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD || ''
    }
  };
  
  return emailConfig;
}

// Get email sender information
function getEmailFrom() {
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@kinderbridge.com';
  const fromName = process.env.SMTP_FROM_NAME || 'KinderBridge';
  // Use proper format: "Display Name" <email@domain.com>
  // This helps with email deliverability
  return `"${fromName}" <${fromEmail}>`;
}

// Create email transporter
function createTransporter() {
  const config = getEmailConfig();
  
  // If no email config, return null (email sending will be skipped)
  if (!config.auth.user || !config.auth.pass) {
    console.log('⚠️ Email configuration not found. Email sending will be skipped.');
    return null;
  }
  
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth
  });
}

// Send PDF report via email
async function sendPDFReport(email, pdfBuffer, userName = 'User') {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('⚠️ Email transporter not available. Skipping email send.');
      return {
        success: false,
        message: 'Email service not configured'
      };
    }
    
    const brandName = process.env.SMTP_FROM_NAME || 'Daycare Concierge';
    const frontendUrl = process.env.FRONTEND_URL || process.env.FRONTEND_DEV_URL || 'https://kinderbridge.ca';
    
    // Plain text version for better deliverability
    const textTemplate = `Your Daycare Full Report - ${brandName}

Dear ${userName},

Thank you for your purchase! Your comprehensive Daycare Full Report is attached to this email.

The report includes:
- Complete list of all daycares
- Detailed information for each daycare
- Ratings, pricing, and contact details
- Features and amenities
- Location and address information

We hope this report helps you find the perfect daycare for your child!

If you have any questions, please don't hesitate to contact us.

Best regards,
The ${brandName} Team

© ${new Date().getFullYear()} ${brandName}. All rights reserved.

This is an automated email. Please do not reply to this message.`;

    const mailOptions = {
      from: getEmailFrom(),
      to: email,
      subject: `Your Daycare Full Report - ${brandName}`,
      text: textTemplate, // Plain text version
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Your Daycare Report is Ready</h1>
            </div>
            <div class="content">
              <p>Dear ${userName},</p>
              
              <p>Thank you for your purchase! Your comprehensive Daycare Full Report is attached to this email.</p>
              
              <p>The report includes:</p>
              <ul>
                <li>Complete list of all daycares</li>
                <li>Detailed information for each daycare</li>
                <li>Ratings, pricing, and contact details</li>
                <li>Features and amenities</li>
                <li>Location and address information</li>
              </ul>
              
              <p>We hope this report helps you find the perfect daycare for your child!</p>
              
              <p>If you have any questions, please don't hesitate to contact us.</p>
              
              <p>Best regards,<br>
              <strong>The ${brandName} Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply to this message.</p>
              <p>&copy; ${new Date().getFullYear()} ${brandName}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      attachments: [
        {
          filename: `daycare-full-report-${new Date().toISOString().split('T')[0]}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ],
      // Add reply-to for better sender reputation
      replyTo: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email sent successfully:', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId,
      message: 'Email sent successfully'
    };
    
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Send registration welcome email
async function sendRegistrationEmail(userEmail, firstName = 'User') {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('⚠️ Email transporter not available. Skipping registration email.');
      return {
        success: false,
        message: 'Email service not configured'
      };
    }
    
    // Generate welcome guide PDF
    console.log('🔵 [EMAIL] Generating welcome guide PDF...');
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateWelcomeGuidePDF(firstName, userEmail);
      console.log('✅ [EMAIL] Welcome guide PDF generated successfully');
    } catch (pdfError) {
      console.warn('⚠️ [EMAIL] Failed to generate welcome guide PDF:', pdfError);
      // Continue without PDF if generation fails
    }
    
    const frontendUrl = process.env.FRONTEND_URL || process.env.FRONTEND_DEV_URL || 'http://localhost:3000';
    
    // Build attachments array
    const attachments = [];
    if (pdfBuffer) {
      attachments.push({
        filename: `welcome-guide-${new Date().toISOString().split('T')[0]}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      });
    }
    
    const mailOptions = {
      from: getEmailFrom(),
      to: userEmail,
      subject: `Welcome to ${process.env.SMTP_FROM_NAME || 'KinderBridge'}, ${firstName}!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              margin: 0; 
              padding: 0; 
              background-color: #f5f5f5;
            }
            .email-container { 
              max-width: 600px; 
              margin: 0 auto; 
              background-color: #ffffff;
            }
            .logo-section { 
              padding: 40px 30px 20px; 
              text-align: center; 
              border-bottom: 1px solid #e5e5e5;
            }
            .logo { 
              font-size: 24px; 
              font-weight: bold; 
              color: #2c3e50; 
              margin-bottom: 8px;
            }
            .tagline { 
              font-size: 14px; 
              color: #7f8c8d; 
              font-style: italic;
            }
            .content { 
              padding: 40px 30px; 
            }
            .greeting { 
              font-size: 18px; 
              margin-bottom: 20px; 
              color: #2c3e50;
            }
            .welcome-text { 
              font-size: 16px; 
              margin-bottom: 20px; 
              color: #34495e;
            }
            .story-section { 
              background-color: #f8f9fa; 
              padding: 20px; 
              border-radius: 8px; 
              margin: 25px 0; 
              border-left: 4px solid #3498db;
            }
            .story-text { 
              font-size: 15px; 
              color: #555; 
              line-height: 1.7;
            }
            .feedback-section { 
              background-color: #fff; 
              border: 2px solid #e5e5e5; 
              border-radius: 8px; 
              padding: 25px; 
              margin: 30px 0;
            }
            .feedback-title { 
              font-size: 18px; 
              font-weight: 600; 
              color: #2c3e50; 
              margin-bottom: 20px;
            }
            .feedback-option { 
              margin-bottom: 20px; 
              padding-bottom: 20px; 
              border-bottom: 1px solid #e5e5e5;
            }
            .feedback-option:last-child { 
              border-bottom: none; 
              margin-bottom: 0; 
              padding-bottom: 0;
            }
            .feedback-label { 
              font-weight: 600; 
              color: #2c3e50; 
              margin-bottom: 8px; 
              font-size: 16px;
            }
            .feedback-description { 
              color: #7f8c8d; 
              font-size: 14px; 
              line-height: 1.6;
            }
            .closing { 
              font-size: 16px; 
              color: #34495e; 
              margin: 25px 0;
            }
            .signature { 
              margin-top: 30px;
            }
            .signature-name { 
              font-weight: 600; 
              font-size: 16px; 
              color: #2c3e50; 
              margin-bottom: 5px;
            }
            .signature-title { 
              font-size: 14px; 
              color: #7f8c8d; 
              margin-bottom: 5px;
            }
            .signature-email { 
              font-size: 14px; 
              color: #3498db; 
              text-decoration: none;
            }
            .explore-section { 
              background-color: #f8f9fa; 
              padding: 25px; 
              border-radius: 8px; 
              margin: 30px 0; 
              text-align: center;
            }
            .explore-title { 
              font-size: 16px; 
              color: #2c3e50; 
              margin-bottom: 20px; 
              font-weight: 600;
            }
            .action-buttons { 
              display: flex; 
              gap: 15px; 
              justify-content: center; 
              flex-wrap: wrap;
            }
            .action-button { 
              display: inline-flex; 
              align-items: center; 
              gap: 8px; 
              padding: 12px 20px; 
              background-color: #3498db; 
              color: white; 
              text-decoration: none; 
              border-radius: 6px; 
              font-size: 14px; 
              font-weight: 500; 
              transition: background-color 0.3s;
            }
            .action-button:hover { 
              background-color: #2980b9;
            }
            .footer { 
              background-color: #2c3e50; 
              color: #ecf0f1; 
              padding: 30px; 
              text-align: center; 
              font-size: 12px;
            }
            .footer-logo { 
              font-size: 18px; 
              font-weight: bold; 
              margin-bottom: 15px;
            }
            .footer-tagline { 
              font-size: 13px; 
              color: #bdc3c7; 
              margin-bottom: 15px; 
              font-style: italic;
            }
            .footer-contact { 
              color: #95a5a6; 
              margin: 10px 0; 
              font-size: 12px;
            }
            .footer-links { 
              margin-top: 20px; 
              padding-top: 20px; 
              border-top: 1px solid #34495e;
            }
            .footer-link { 
              color: #95a5a6; 
              text-decoration: none; 
              margin: 0 10px; 
              font-size: 12px;
            }
            .footer-link:hover { 
              color: #ecf0f1;
            }
            .compliance { 
              margin-top: 15px; 
              padding-top: 15px; 
              border-top: 1px solid #34495e; 
              color: #7f8c8d; 
              font-size: 11px; 
              line-height: 1.5;
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <!-- Logo Section -->
            <div class="logo-section">
              <div class="logo">${process.env.SMTP_FROM_NAME || 'KinderBridge'}</div>
              <div class="tagline">Finding daycare with actual availability</div>
            </div>

            <!-- Main Content -->
            <div class="content">
              <div class="greeting">Hi ${firstName},</div>
              
              <div class="welcome-text">
                Welcome to ${process.env.SMTP_FROM_NAME || 'KinderBridge'}! I'm so glad you joined us.
              </div>

              <!-- Origin Story Section -->
              <div class="story-section">
                <div class="story-text">
                  We started this platform after experiencing the challenge of finding quality daycare with real availability. If you've ever felt that same frustration, you know how stressful it can be. Our hope is that ${process.env.SMTP_FROM_NAME || 'KinderBridge'} makes this process a whole lot easier for you.
                </div>
              </div>

              <!-- Feedback Section -->
              <div class="feedback-section">
                <div class="feedback-title">Share Your Feedback</div>
                
                <div class="feedback-option">
                  <div class="feedback-label">💬 Quick chat</div>
                  <div class="feedback-description">
                    I'd love to learn more about why you signed up and how we can make the app even better for families like yours. If you're open to a quick 5-10 minute call, just reply with a time that works for you.
                  </div>
                </div>
                
                <div class="feedback-option">
                  <div class="feedback-label">✉️ Send feedback</div>
                  <div class="feedback-description">
                    Have thoughts, suggestions, or questions? Just reply to this email—I read every message personally. Your feedback would mean a lot—it'll help shape the future of ${process.env.SMTP_FROM_NAME || 'KinderBridge'}.
                  </div>
                </div>
              </div>

              <div class="closing">
                Looking forward to hearing from you and building this together,
              </div>

              <!-- Signature -->
              <div class="signature">
                <div class="signature-name">The ${process.env.SMTP_FROM_NAME || 'KinderBridge'} Team</div>
                <div class="signature-title">Founder, ${process.env.SMTP_FROM_NAME || 'KinderBridge'}</div>
                <a href="mailto:${process.env.SMTP_FROM_EMAIL || 'noreply@kinderbridge.com'}" class="signature-email">${process.env.SMTP_FROM_EMAIL || 'noreply@kinderbridge.com'}</a>
              </div>

              <!-- Explore Platform Section -->
              <div class="explore-section">
                <div class="explore-title">While you're here, feel free to explore the platform:</div>
                <div class="action-buttons">
                  <a href="${frontendUrl}/search" class="action-button">
                    🔍 Search Daycares
                  </a>
                  <a href="${frontendUrl}/search" class="action-button">
                    🔔 Create Alert
                  </a>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="footer">
              <div class="footer-logo">${process.env.SMTP_FROM_NAME || 'KinderBridge'}</div>
              <div class="footer-tagline">Built by parents, for parents</div>
              <div class="footer-contact">
                ${process.env.SMTP_FROM_EMAIL || 'noreply@kinderbridge.com'} | Toronto, ON, Canada
              </div>
              <div class="footer-links">
                <a href="${frontendUrl}/unsubscribe" class="footer-link">Unsubscribe</a>
                <a href="${frontendUrl}/privacy" class="footer-link">Privacy Policy</a>
              </div>
              <div class="compliance">
                This welcome message complies with Canada's Anti-Spam Legislation (CASL). You received this because you confirmed your email address for a ${process.env.SMTP_FROM_NAME || 'KinderBridge'} account.
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      attachments: attachments.length > 0 ? attachments : undefined
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Registration email sent successfully:', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId,
      message: 'Registration email sent successfully'
    };
    
  } catch (error) {
    console.error('❌ Error sending registration email:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send OTP email for password reset (transactional email via SMTP)
 * @param {string} email - User email address
 * @param {string} otp - One-time password code
 * @returns {Promise<Object>} Result object with success status
 */
async function sendOTPEmail(email, otp) {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('⚠️ Email transporter not available. Cannot send OTP email.');
      return {
        success: false,
        message: 'Email service not configured'
      };
    }

    const brandName = process.env.SMTP_FROM_NAME || 'KinderBridge';
    const fromEmail = getEmailFrom();

    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: `Your Password Reset Code - ${brandName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              margin: 0; 
              padding: 0; 
              background-color: #f5f5f5;
            }
            .email-container { 
              max-width: 600px; 
              margin: 0 auto; 
              background-color: #ffffff;
            }
            .logo-section { 
              padding: 40px 30px 20px; 
              text-align: center; 
              border-bottom: 1px solid #e5e5e5;
            }
            .logo { 
              font-size: 24px; 
              font-weight: bold; 
              color: #2c3e50; 
              margin-bottom: 8px;
            }
            .content { 
              padding: 40px 30px; 
            }
            .otp-box { 
              background-color: #f8f9fa; 
              border: 2px solid #3498db; 
              border-radius: 8px; 
              padding: 30px; 
              text-align: center; 
              margin: 30px 0;
            }
            .otp-code { 
              font-size: 32px; 
              font-weight: bold; 
              color: #3498db; 
              letter-spacing: 8px; 
              font-family: 'Courier New', monospace;
            }
            .warning { 
              color: #e74c3c; 
              font-size: 14px; 
              margin-top: 20px;
            }
            .footer { 
              background-color: #2c3e50; 
              color: #ecf0f1; 
              padding: 30px; 
              text-align: center; 
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="logo-section">
              <div class="logo">${brandName}</div>
            </div>
            <div class="content">
              <h2>Password Reset Request</h2>
              <p>You requested to reset your password. Use the following OTP code to complete the process:</p>
              <div class="otp-box">
                <div class="otp-code">${otp}</div>
              </div>
              <p>This code will expire in 10 minutes.</p>
              <div class="warning">
                <strong>⚠️ Security Notice:</strong> If you didn't request this password reset, please ignore this email or contact support.
              </div>
            </div>
            <div class="footer">
              <div style="font-size: 18px; font-weight: bold; margin-bottom: 15px;">${brandName}</div>
              <div style="color: #95a5a6;">This is an automated security email. Please do not reply.</div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ OTP email sent successfully:', info.messageId);

    return {
      success: true,
      messageId: info.messageId,
      message: 'OTP email sent successfully'
    };
  } catch (error) {
    console.error('❌ Error sending OTP email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send OTP email'
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
    console.log("🔵 [EMAIL] sendWelcomeEmail called");
    console.log(`🔵 [EMAIL] Email: ${email}`);
    console.log(`🔵 [EMAIL] First Name: ${firstName}`);

    // Validate email
    if (!email || typeof email !== "string" || !email.includes("@")) {
      console.error("❌ [EMAIL] Invalid email address provided:", email);
      return {
        success: false,
        message: "Invalid email address",
      };
    }

    const transporter = createTransporter();
    
    if (!transporter) {
      console.log("⚠️ [EMAIL] Email transporter not available. Skipping welcome email.");
      return {
        success: false,
        message: "Email service not configured",
      };
    }

    const firstNameValue = firstName || "User";
    const brandName = process.env.SMTP_FROM_NAME || "KinderBridge";
    const frontendUrl = process.env.FRONTEND_URL || process.env.FRONTEND_DEV_URL || "https://kinderbridge.ca";
    const subject = `Welcome to the Family, ${firstNameValue}!`;

    // HTML welcome email template with branded design
    // Note: Gradient text may not work in all email clients (especially Outlook)
    // Fallback to solid color is provided
    const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to ${brandName}</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        .wrapper { width: 100%; table-layout: fixed; background-color: #f4f7f6; padding-bottom: 40px; }
        .main { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 600px; border-spacing: 0; color: #333333; border-radius: 8px; overflow: hidden; margin-top: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .header { background-color: #ffffff; padding: 30px; text-align: center; border-bottom: 1px solid #eeeeee; }
        .content { padding: 40px 30px; line-height: 1.6; font-size: 16px; }
        
        /* BRANDED GRADIENT BUTTON */
        .cta-button { 
            background: linear-gradient(90deg, #6a11cb 0%, #2575fc 100%); 
            background-color: #6a11cb; /* Fallback for older email clients */
            color: #ffffff !important; 
            padding: 15px 35px; 
            text-decoration: none; 
            border-radius: 50px; 
            font-weight: bold; 
            display: inline-block; 
            margin: 25px 0;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        /* BRANDED GRADIENT TEXT FOR NAME - with fallback */
        .name-highlight {
            background: linear-gradient(90deg, #6a11cb 0%, #2575fc 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            color: #6a11cb; /* Fallback for email clients that don't support gradient text */
            font-weight: bold;
            font-size: 28px;
        }

        .footer { padding: 20px; text-align: center; font-size: 12px; color: #999999; }
        h1 { color: #2c3e50; font-size: 24px; margin-top: 0; margin-bottom: 10px; }
        
        /* BRANDED FEATURE BOX */
        .feature-box { background-color: #f9f9fb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 5px solid #6a11cb; }
    </style>
</head>
<body>
    <center class="wrapper">
        <table class="main" width="100%" cellpadding="0" cellspacing="0">
            <!-- HEADER -->
            <tr>
                <td class="header">
                    <!-- Logo Image -->
                    <img src="${frontendUrl}/logo.png" alt="${brandName} Logo" width="200" style="display: block; margin: 0 auto; max-width: 200px; height: auto;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                    <!-- Text fallback if image doesn't load -->
                    <div style="font-size: 24px; font-weight: bold; color: #2c3e50; display: none; margin: 0 auto;">${brandName}</div>
                </td>
            </tr>
            <!-- CONTENT -->
            <tr>
                <td class="content">
                    <h1>Welcome to the Family,</h1>
                    <span class="name-highlight">${firstNameValue.toUpperCase()}!</span>
                    
                    <p style="margin-top: 20px;">We're so excited to have you on board. <strong>${brandName}</strong> was built with one goal in mind: to bridge the gap between parents and the perfect care for their little ones.</p>
                    
                    <div class="feature-box">
                        <strong style="color: #2c3e50;">What to expect from Phase 1:</strong><br>
                        <p style="margin: 5px 0 0 0;">Browse our complete directory of local daycares for free—no strings attached.</p>
                    </div>

                    <p>But wait, it gets better. Since you're one of our first subscribers, you've just secured a spot on the <strong>Priority Beta List</strong> for Phase 2: Our AI-Powered Daycare Assistant.</p>
                    
                    <center>
                        <a href="${frontendUrl}/search" class="cta-button">Start Your Search Now</a>
                    </center>

                    <p>Keep an eye out for our "Phase 2" sneak peek coming soon. You don't want to miss the automation that will change the way you search and find daycare for your kid!</p>
                    
                    <p style="margin-top: 30px;">Cheers,<br><strong>The ${brandName} Team</strong></p>
                </td>
            </tr>
            <!-- FOOTER -->
            <tr>
                <td class="footer">
                    &copy; ${new Date().getFullYear()} ${brandName} Inc. | Toronto, Ontario<br>
                    <a href="${frontendUrl}/contact" style="color: #999999; text-decoration: none;">Contact Us</a>
                </td>
            </tr>
        </table>
    </center>
</body>
</html>
    `;

    // Plain text version for better deliverability
    const textTemplate = `Welcome to the Family, ${firstNameValue.toUpperCase()}!

We're so excited to have you on board. ${brandName} was built with one goal in mind: to bridge the gap between parents and the perfect care for their little ones.

What to expect from Phase 1:
Browse our complete directory of local daycares for free—no strings attached.

But wait, it gets better. Since you're one of our first subscribers, you've just secured a spot on the Priority Beta List for Phase 2: Our AI-Powered Daycare Assistant.

Start your search now: ${frontendUrl}/search

Keep an eye out for our "Phase 2" sneak peek coming soon. You don't want to miss the automation that will change the way you search and find daycare for your kid!

Cheers,
The ${brandName} Team

© ${new Date().getFullYear()} ${brandName} Inc. | Toronto, Ontario`;

    const mailOptions = {
      from: getEmailFrom(),
      to: email.trim(),
      subject: subject,
      text: textTemplate, // Plain text version
      html: htmlTemplate,
      // Add reply-to for better sender reputation
      replyTo: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
    };

    console.log("🔵 [EMAIL] Sending welcome email...");
    const info = await transporter.sendMail(mailOptions);

    console.log("✅ [EMAIL] Welcome email sent successfully");
    console.log(`✅ [EMAIL] Message ID: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
      message: "Welcome email sent successfully",
    };
  } catch (error) {
    console.error("❌ [EMAIL] Exception in sendWelcomeEmail:");
    console.error(`❌ [EMAIL] Error: ${error.message || "Unknown error"}`);
    console.error(`❌ [EMAIL] Stack:`, error.stack);
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
    console.log("🔵 [EMAIL] sendPasswordResetEmail called");
    console.log(`🔵 [EMAIL] Email: ${email}`);
    console.log(`🔵 [EMAIL] First Name: ${firstName}`);
    console.log(`🔵 [EMAIL] Reset Token: ${resetToken ? "Present" : "Missing"}`);

    // Validate email
    if (!email || typeof email !== "string" || !email.includes("@")) {
      console.error("❌ [EMAIL] Invalid email address provided:", email);
      return {
        success: false,
        message: "Invalid email address",
      };
    }

    // Validate reset token
    if (!resetToken || typeof resetToken !== "string") {
      console.error("❌ [EMAIL] Invalid reset token provided");
      return {
        success: false,
        message: "Reset token is required",
      };
    }

    const transporter = createTransporter();
    
    if (!transporter) {
      console.log("⚠️ [EMAIL] Email transporter not available. Skipping password reset email.");
      return {
        success: false,
        message: "Email service not configured",
      };
    }

    const firstNameValue = firstName || "User";
    const brandName = process.env.SMTP_FROM_NAME || "KinderBridge";
    // Use production URL, fallback to dev URL for testing
    const frontendUrl = process.env.FRONTEND_URL || process.env.FRONTEND_DEV_URL || "https://kinderbridge.ca";
    const subject = `Reset Your Password - ${brandName}`;
    const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

    // HTML password reset email template
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
                We received a request to reset your password for your ${brandName} account.
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
                <strong style="color: #333333;">The ${brandName} Team</strong>
              </p>
              <p style="margin: 10px 0 0 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} ${brandName}. All rights reserved.
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

    // Plain text version for better deliverability
    const textTemplate = `Reset Your Password - ${brandName}

Hello, ${firstNameValue}!

We received a request to reset your password for your ${brandName} account.

Click the link below to reset your password. This link will expire in 1 hour for security reasons.

${resetUrl}

If the link doesn't work, copy and paste it into your browser.

If you didn't request a password reset, please ignore this email. Your password will remain unchanged.

Best regards,
The ${brandName} Team

© ${new Date().getFullYear()} ${brandName}. All rights reserved.`;

    const mailOptions = {
      from: getEmailFrom(),
      to: email.trim(),
      subject: subject,
      text: textTemplate, // Plain text version
      html: htmlTemplate,
      // Add reply-to for better sender reputation
      replyTo: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
    };

    console.log("🔵 [EMAIL] Sending password reset email...");
    const info = await transporter.sendMail(mailOptions);

    console.log("✅ [EMAIL] Password reset email sent successfully");
    console.log(`✅ [EMAIL] Message ID: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
      message: "Password reset email sent successfully",
    };
  } catch (error) {
    console.error("❌ [EMAIL] Exception in sendPasswordResetEmail:");
    console.error(`❌ [EMAIL] Error: ${error.message || "Unknown error"}`);
    console.error(`❌ [EMAIL] Stack:`, error.stack);
    return {
      success: false,
      error: error.message || "Failed to send password reset email",
    };
  }
}

/**
 * Send email verification email
 * @param {string} email - User email address
 * @param {string} firstName - User's first name
 * @param {string} verificationToken - Email verification token
 * @returns {Promise<Object>} Result object with success status
 */
async function sendVerificationEmail(email, firstName = "User", verificationToken) {
  try {
    console.log("🔵 [EMAIL] sendVerificationEmail called");
    console.log(`🔵 [EMAIL] Email: ${email}`);
    console.log(`🔵 [EMAIL] First Name: ${firstName}`);
    console.log(`🔵 [EMAIL] Verification Token: ${verificationToken ? "Present" : "Missing"}`);

    // Validate email
    if (!email || typeof email !== "string" || !email.includes("@")) {
      console.error("❌ [EMAIL] Invalid email address provided:", email);
      return {
        success: false,
        message: "Invalid email address",
      };
    }

    // Validate verification token
    if (!verificationToken || typeof verificationToken !== "string") {
      console.error("❌ [EMAIL] Invalid verification token provided");
      return {
        success: false,
        message: "Verification token is required",
      };
    }

    const transporter = createTransporter();
    
    if (!transporter) {
      console.log("⚠️ [EMAIL] Email transporter not available. Skipping verification email.");
      return {
        success: false,
        message: "Email service not configured",
      };
    }

    const firstNameValue = firstName || "User";
    const brandName = process.env.SMTP_FROM_NAME || "KinderBridge";
    const frontendUrl = process.env.FRONTEND_URL || process.env.FRONTEND_DEV_URL || "https://kinderbridge.ca";
    const subject = `Verify Your Email - ${brandName}`;
    const verificationUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(verificationToken)}`;

    // HTML email verification template
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f4f4f4;">
    <tr>
      <td style="padding: 20px 0;">
        <table role="presentation" style="width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Verify Your Email</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px;">Hello, ${firstNameValue}!</h2>
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                Thank you for registering with ${brandName}! To complete your registration, please verify your email address.
              </p>
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                Click the button below to verify your email address. This link will expire in 24 hours for security reasons.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin: 30px 0;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${verificationUrl}" style="display: inline-block; padding: 14px 30px; background-color: #667eea; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Verify Email</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 10px 0 0 0; color: #667eea; font-size: 12px; line-height: 1.6; word-break: break-all;">
                ${verificationUrl}
              </p>
              
              <p style="margin: 30px 0 0 0; color: #999999; font-size: 14px; line-height: 1.6;">
                If you didn't create an account with ${brandName}, please ignore this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px;">
                Best regards,<br>
                <strong style="color: #333333;">The ${brandName} Team</strong>
              </p>
              <p style="margin: 10px 0 0 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} ${brandName}. All rights reserved.
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

    // Plain text version for better deliverability
    const textTemplate = `Verify Your Email - ${brandName}

Hello, ${firstNameValue}!

Thank you for registering with ${brandName}! To complete your registration, please verify your email address.

Click the link below to verify your email address. This link will expire in 24 hours for security reasons.

${verificationUrl}

If the link doesn't work, copy and paste it into your browser.

If you didn't create an account with ${brandName}, please ignore this email.

Best regards,
The ${brandName} Team

© ${new Date().getFullYear()} ${brandName}. All rights reserved.`;

    const mailOptions = {
      from: getEmailFrom(),
      to: email.trim(),
      subject: subject,
      text: textTemplate, // Plain text version
      html: htmlTemplate,
      // Add reply-to for better sender reputation
      replyTo: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
    };

    console.log("🔵 [EMAIL] Sending verification email...");
    const info = await transporter.sendMail(mailOptions);

    console.log("✅ [EMAIL] Verification email sent successfully");
    console.log(`✅ [EMAIL] Message ID: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
      message: "Verification email sent successfully",
    };
  } catch (error) {
    console.error("❌ [EMAIL] Exception in sendVerificationEmail:");
    console.error(`❌ [EMAIL] Error: ${error.message || "Unknown error"}`);
    console.error(`❌ [EMAIL] Stack:`, error.stack);
    return {
      success: false,
      error: error.message || "Failed to send verification email",
    };
  }
}

module.exports = {
  sendPDFReport,
  sendRegistrationEmail,
  sendOTPEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  createTransporter
};

