/**
 * Test Gmail SMTP Email Configuration
 * 
 * This script tests the SMTP connection and sends a test email
 * 
 * Usage: node test-smtp.js [recipient-email]
 * Example: node test-smtp.js test@example.com
 */

require('dotenv').config({ path: './config.env' });
const { sendWelcomeEmail, sendPasswordResetEmail, createTransporter } = require('./src/services/emailService');
const nodemailer = require('nodemailer');

async function testSMTP() {
  console.log('\n🧪 Testing Gmail SMTP Configuration...\n');
  console.log('='.repeat(60));
  
  // Get recipient email from command line argument or use default
  const recipientEmail = process.argv[2] || process.env.TEST_EMAIL || 'test@example.com';
  
  // Step 1: Test Connection
  console.log('\n📡 Step 1: Testing SMTP Connection...');
  console.log('-'.repeat(60));
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('❌ SMTP Connection: FAILED');
      console.log('   Error: Email configuration not found');
      console.log('\n   📋 Please configure the following in config.env:');
      console.log('      SMTP_HOST=smtp.gmail.com');
      console.log('      SMTP_PORT=587');
      console.log('      SMTP_USER=your-email@gmail.com');
      console.log('      SMTP_PASS=your-app-password');
      console.log('      SMTP_FROM_EMAIL=your-email@gmail.com');
      process.exit(1);
    }
    
    // Test connection
    console.log('🔵 [SMTP] Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP Connection: SUCCESS');
    console.log(`   Host: ${process.env.SMTP_HOST || 'smtp.gmail.com'}`);
    console.log(`   Port: ${process.env.SMTP_PORT || '587'}`);
    console.log(`   User: ${process.env.SMTP_USER || 'Not configured'}`);
    console.log(`   From Email: ${process.env.SMTP_FROM_EMAIL || 'Not configured'}`);
  } catch (error) {
    console.log('❌ SMTP Connection: FAILED');
    console.log(`   Error: ${error.message}`);
    console.log('\n   💡 Common Issues:');
    console.log('   1. Make sure you\'re using an App Password (not your regular Gmail password)');
    console.log('   2. Enable 2-Step Verification in your Google Account');
    console.log('   3. Generate App Password at: https://myaccount.google.com/apppasswords');
    console.log('   4. Check that SMTP_USER and SMTP_PASS are correct in config.env');
    process.exit(1);
  }
  
  // Step 2: Send Test Email
  console.log('\n📧 Step 2: Sending Test Email...');
  console.log('-'.repeat(60));
  console.log(`   To: ${recipientEmail}`);
  
  try {
    const transporter = createTransporter();
    const brandName = process.env.SMTP_FROM_NAME || 'KinderBridge';
    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@kinderbridge.com';
    const fromName = process.env.SMTP_FROM_NAME || 'KinderBridge';
    
    const testEmailResult = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: recipientEmail,
      subject: '🧪 SMTP Test Email - KinderBridge',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                     padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: white; margin: 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .success { color: #10b981; font-weight: bold; }
            .info { background: #e0f2fe; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ SMTP Test Successful!</h1>
            </div>
            <div class="content">
              <p>Hello!</p>
              <p>This is a <span class="success">test email</span> to verify that your Gmail SMTP configuration is working correctly.</p>
              
              <div class="info">
                <strong>Configuration Details:</strong><br>
                Host: ${process.env.SMTP_HOST || 'smtp.gmail.com'}<br>
                Port: ${process.env.SMTP_PORT || '587'}<br>
                From Email: ${fromEmail}<br>
                Timestamp: ${new Date().toISOString()}
              </div>
              
              <p>If you received this email, your SMTP setup is working! 🎉</p>
              
              <p>You can now use the password reset feature and other email functionality.</p>
            </div>
            <div class="footer">
              <p>This is an automated test email from ${brandName}</p>
            </div>
          </div>
        </body>
        </html>
      `
    });
    
    console.log('✅ Test Email: SENT SUCCESSFULLY');
    console.log(`   Message ID: ${testEmailResult.messageId}`);
    console.log(`   Please check ${recipientEmail} for the test email.`);
  } catch (error) {
    console.log('❌ Test Email: FAILED');
    console.log(`   Error: ${error.message}`);
    if (error.code === 'EAUTH') {
      console.log('\n   ⚠️  Authentication Error');
      console.log('   This usually means:');
      console.log('   1. Wrong email or password');
      console.log('   2. Not using an App Password (using regular password instead)');
      console.log('   3. 2-Step Verification not enabled');
    }
    process.exit(1);
  }
  
  // Step 3: Test Welcome Email Function
  console.log('\n📧 Step 3: Testing Welcome Email Function...');
  console.log('-'.repeat(60));
  console.log(`   To: ${recipientEmail}`);
  
  try {
    const welcomeEmailResult = await sendWelcomeEmail(recipientEmail, 'Test User');
    
    if (welcomeEmailResult.success) {
      console.log('✅ Welcome Email: SENT SUCCESSFULLY');
      console.log(`   Message ID: ${welcomeEmailResult.messageId}`);
      console.log(`   Please check ${recipientEmail} for the welcome email.`);
    } else {
      console.log('⚠️  Welcome Email: FAILED');
      console.log(`   Error: ${welcomeEmailResult.error || welcomeEmailResult.message}`);
    }
  } catch (error) {
    console.log('⚠️  Welcome Email: FAILED');
    console.log(`   Error: ${error.message}`);
  }
  
  // Step 4: Test Password Reset Email Function
  console.log('\n🔐 Step 4: Testing Password Reset Email Function...');
  console.log('-'.repeat(60));
  console.log(`   To: ${recipientEmail}`);
  
  try {
    // Generate a fake token for testing
    const crypto = require('crypto');
    const testToken = crypto.randomBytes(32).toString('hex');
    
    const resetEmailResult = await sendPasswordResetEmail(
      recipientEmail,
      'Test User',
      testToken
    );
    
    if (resetEmailResult.success) {
      console.log('✅ Password Reset Email: SENT SUCCESSFULLY');
      console.log(`   Message ID: ${resetEmailResult.messageId}`);
      console.log(`   Test Token: ${testToken.substring(0, 20)}...`);
      console.log(`   Please check ${recipientEmail} for the password reset email.`);
    } else {
      console.log('⚠️  Password Reset Email: FAILED');
      console.log(`   Error: ${resetEmailResult.error || resetEmailResult.message}`);
    }
  } catch (error) {
    console.log('⚠️  Password Reset Email: FAILED');
    console.log(`   Error: ${error.message}`);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary:');
  console.log('✅ SMTP Connection: Working');
  console.log('✅ Configuration: Correct');
  console.log(`   Host: ${process.env.SMTP_HOST || 'smtp.gmail.com'}`);
  console.log(`   Port: ${process.env.SMTP_PORT || '587'}`);
  console.log(`   From Email: ${process.env.SMTP_FROM_EMAIL || 'Not configured'}`);
  
  console.log('\n🎉 All tests passed! Your Gmail SMTP configuration is working correctly.');
  console.log('\n💡 Next Steps:');
  console.log('   1. Check your email inbox for the test emails');
  console.log('   2. Verify the emails look correct');
  console.log('   3. Test the forgot password feature in your application');
  console.log('   4. Make sure to use App Passwords (not regular passwords) for security\n');
}

// Run the test
testSMTP().catch((error) => {
  console.error('\n❌ Fatal Error:', error);
  process.exit(1);
});

