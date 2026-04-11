/* eslint-disable no-console */
const path = require("path");
const dotenv = require("dotenv");
const { sendWelcomeEmail, sendCustomEmail, testConnection } = require("../src/services/sesEmailService");

// Load backend env
dotenv.config({ path: path.resolve(__dirname, "..", "config.env") });

async function testSESEmail() {
  console.log("🧪 Testing Amazon SES Email Service");
  console.log("=".repeat(50));
  
  // Test 1: Connection Test
  console.log("\n📡 Test 1: Testing SES Connection...");
  const connectionTest = await testConnection();
  console.log("Result:", JSON.stringify(connectionTest, null, 2));
  
  if (!connectionTest.success) {
    console.error("\n❌ Connection test failed. Please check your AWS credentials.");
    process.exit(1);
  }
  
  console.log("\n✅ Connection test passed!");
  
  // Test 2: Welcome Email
  console.log("\n" + "=".repeat(50));
  console.log("📧 Test 2: Sending Welcome Email...");
  
  const testEmail = "sahinh013@gmail.com";
  const testFirstName = "Sahin";
  
  console.log(`📧 Sending test email to: ${testEmail}`);
  console.log(`👤 First Name: ${testFirstName}`);
  console.log("");
  
  try {
    const result = await sendWelcomeEmail(testEmail, testFirstName);
    
    console.log("");
    console.log("=".repeat(50));
    console.log("📊 Test Result:");
    console.log(JSON.stringify(result, null, 2));
    console.log("");
    
    if (result.success) {
      console.log("✅ Welcome email sent successfully!");
      console.log(`📨 Message ID: ${result.messageId || "N/A"}`);
      console.log(`💬 Message: ${result.message}`);
    } else {
      console.log("❌ Welcome email failed to send");
      console.log(`⚠️ Error: ${result.error || result.message}`);
    }
    
    console.log("");
    console.log("💡 Please check your inbox (and spam folder) for the test email.");
    console.log("=".repeat(50));
    
    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error("");
    console.error("❌ Test failed with error:");
    console.error(error);
    console.error("");
    process.exit(1);
  }
}

// Run the test
testSESEmail();



















