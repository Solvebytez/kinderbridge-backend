/**
 * Test Welcome Email Function
 * 
 * This script tests the welcome email function directly
 * 
 * Usage: node test-welcome-email.js [recipient-email] [first-name]
 * Example: node test-welcome-email.js test@example.com John
 */

require('dotenv').config({ path: './config.env' });
const { sendWelcomeEmail } = require('./src/services/emailService');

async function testWelcomeEmail() {
  console.log('\n🧪 Testing Welcome Email Function...\n');
  console.log('='.repeat(60));
  
  // Get recipient email and name from command line arguments
  const recipientEmail = process.argv[2] || process.env.TEST_EMAIL || 'test@example.com';
  const firstName = process.argv[3] || 'Test User';
  
  console.log(`📧 Recipient: ${recipientEmail}`);
  console.log(`👤 First Name: ${firstName}`);
  console.log('-'.repeat(60));
  
  try {
    console.log('🔵 [TEST] Calling sendWelcomeEmail...');
    const result = await sendWelcomeEmail(recipientEmail, firstName);
    
    if (result.success) {
      console.log('\n✅ Welcome Email: SENT SUCCESSFULLY');
      console.log(`   Message ID: ${result.messageId}`);
      console.log(`   Please check ${recipientEmail} for the welcome email.`);
      console.log(`   📋 Don't forget to check your SPAM folder!`);
    } else {
      console.log('\n❌ Welcome Email: FAILED');
      console.log(`   Error: ${result.error || result.message}`);
      console.log('\n💡 Possible issues:');
      console.log('   1. SMTP configuration incorrect');
      console.log('   2. Email service not configured');
      console.log('   3. Network/connection issue');
      process.exit(1);
    }
  } catch (error) {
    console.log('\n❌ Welcome Email: ERROR');
    console.log(`   Error: ${error.message}`);
    if (error.stack) {
      console.log(`   Stack: ${error.stack}`);
    }
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Test completed!\n');
}

// Run the test
testWelcomeEmail().catch((error) => {
  console.error('\n❌ Fatal Error:', error);
  process.exit(1);
});





