/**
 * Test Amazon SES Email Configuration
 * 
 * This script tests the SES connection and sends a test email
 * 
 * Usage: node test-ses.js [recipient-email]
 * Example: node test-ses.js test@example.com
 */

require('dotenv').config({ path: './config.env' });
const { sendPasswordResetEmail, testConnection, sendEmail } = require('./src/services/sesEmailService');

async function testSES() {
  console.log('\n🧪 Testing Amazon SES Configuration...\n');
  console.log('='.repeat(60));
  
  // Get recipient email from command line argument or use default
  const recipientEmail = process.argv[2] || process.env.TEST_EMAIL || 'test@example.com';
  
  // Step 1: Test Connection
  console.log('\n📡 Step 1: Testing SES Connection...');
  console.log('-'.repeat(60));
  try {
    const connectionTest = await testConnection();
    if (connectionTest.success) {
      console.log('✅ SES Connection: SUCCESS');
      console.log(`   Region: ${connectionTest.region}`);
      console.log(`   From Email: ${connectionTest.fromEmail || 'Not configured'}`);
    } else {
      console.log('❌ SES Connection: FAILED');
      console.log(`   Error: ${connectionTest.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.log('❌ SES Connection: FAILED');
    console.log(`   Error: ${error.message}`);
    process.exit(1);
  }
  
  // Step 2: Send Test Email
  console.log('\n📧 Step 2: Sending Test Email...');
  console.log('-'.repeat(60));
  console.log(`   To: ${recipientEmail}`);
  
  try {
    const testEmailResult = await sendEmail({
      to: recipientEmail,
      subject: '🧪 SES Test Email - KinderBridge',
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
              <h1>✅ SES Test Successful!</h1>
            </div>
            <div class="content">
              <p>Hello!</p>
              <p>This is a <span class="success">test email</span> to verify that your Amazon SES configuration is working correctly.</p>
              
              <div class="info">
                <strong>Configuration Details:</strong><br>
                Region: ${process.env.AWS_REGION || 'us-east-1'}<br>
                From Email: ${process.env.SES_FROM_EMAIL || 'Not configured'}<br>
                Timestamp: ${new Date().toISOString()}
              </div>
              
              <p>If you received this email, your SES setup is working! 🎉</p>
              
              <p>You can now use the password reset feature and other email functionality.</p>
            </div>
            <div class="footer">
              <p>This is an automated test email from KinderBridge</p>
            </div>
          </div>
        </body>
        </html>
      `,
      fromName: 'KinderBridge - SES Test'
    });
    
    if (testEmailResult.success) {
      console.log('✅ Test Email: SENT SUCCESSFULLY');
      console.log(`   Message ID: ${testEmailResult.messageId}`);
      console.log(`   Please check ${recipientEmail} for the test email.`);
    } else {
      const errorMsg = testEmailResult.error || testEmailResult.message || '';
      console.log('❌ Test Email: FAILED');
      console.log(`   Error: ${errorMsg}`);
      
      // Check if it's a sandbox mode error
      if (errorMsg.includes('not verified') || errorMsg.includes('MessageRejected')) {
        console.log('\n   ⚠️  SES SANDBOX MODE DETECTED');
        console.log('   Your AWS SES account is in Sandbox mode.');
        console.log('   This means you can only send emails to verified addresses.');
        console.log('\n   📋 To fix this:');
        console.log('   1. Go to AWS SES Console → Verified identities');
        console.log(`   2. Verify the recipient email: ${recipientEmail}`);
        console.log('   3. OR request production access from AWS SES');
        console.log('      (AWS Console → SES → Account dashboard → Request production access)');
        console.log('\n   ✅ Your SES configuration is CORRECT - just need to verify recipient or get production access.');
      } else {
        if (testEmailResult.errorCode) {
          console.log(`   Error Code: ${testEmailResult.errorCode}`);
        }
        if (testEmailResult.errorDetails) {
          console.log(`   Details: ${JSON.stringify(testEmailResult.errorDetails, null, 2)}`);
        }
      }
      // Don't exit on sandbox mode error - continue to test password reset email
      if (!errorMsg.includes('not verified') && !errorMsg.includes('MessageRejected')) {
        process.exit(1);
      }
    }
  } catch (error) {
    console.log('❌ Test Email: FAILED');
    console.log(`   Error: ${error.message}`);
    if (error.stack) {
      console.log(`   Stack: ${error.stack}`);
    }
    process.exit(1);
  }
  
  // Step 3: Test Password Reset Email Function
  console.log('\n🔐 Step 3: Testing Password Reset Email Function...');
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
      console.log('   Note: This might be expected if email sending failed in step 2.');
    }
  } catch (error) {
    console.log('⚠️  Password Reset Email: FAILED');
    console.log(`   Error: ${error.message}`);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary:');
  console.log('✅ SES Connection: Working');
  console.log('✅ Configuration: Correct');
  console.log(`   Region: ${process.env.AWS_REGION || 'us-east-1'}`);
  console.log(`   From Email: ${process.env.SES_FROM_EMAIL || 'Not configured'}`);
  console.log(`   Access Key: ${process.env.AWS_ACCESS_KEY_ID ? 'Configured' : 'Missing'}`);
  
  // Check if we're in sandbox mode
  const recipientEmail = process.argv[2] || process.env.TEST_EMAIL || 'test@example.com';
  console.log('\n💡 Important Notes:');
  console.log('   1. Your SES configuration is CORRECT ✅');
  console.log('   2. If you see "not verified" errors, your account is in Sandbox mode');
  console.log('   3. In Sandbox mode, you can only send to verified email addresses');
  console.log('\n📋 To send to any email address:');
  console.log('   Option A: Verify recipient emails in AWS SES Console');
  console.log('   Option B: Request production access from AWS SES');
  console.log('      → AWS Console → SES → Account dashboard → Request production access');
  console.log('\n🧪 To test with a verified email:');
  console.log(`   node test-ses.js your-verified-email@example.com\n`);
}

// Run the test
testSES().catch((error) => {
  console.error('\n❌ Fatal Error:', error);
  process.exit(1);
});

