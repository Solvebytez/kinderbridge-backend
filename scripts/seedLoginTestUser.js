/* eslint-disable no-console */
/**
 * Upserts a fixed test user for manual login / E2E flow testing.
 *
 * Requires backend/.env with MONGODB_URI.
 *
 * Run from the backend folder:
 *   node scripts/seedLoginTestUser.js
 *
 * Or: npm run seed:test-user
 */
const dotenv = require("dotenv");
const path = require("path");
const User = require("../src/schemas/UserSchema");
const { connectToMongoDB } = require("../src/config/database");
const mongoose = require("mongoose");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const TEST_EMAIL = "sahinh013@gmail.com";
const TEST_PASSWORD = "qwerty@1234";

async function main() {
  await connectToMongoDB();

  const email = TEST_EMAIL.toLowerCase().trim();
  let user = await User.findOne({ email }).select("+password");

  if (user) {
    user.password = TEST_PASSWORD;
    user.emailVerified = true;
    user.isActive = true;
    user.communicationPreferences = user.communicationPreferences || {};
    user.communicationPreferences.email = true;
    user.communicationPreferences.acknowledgement = true;
    await user.save();
    console.log("✅ Updated existing user:", email);
  } else {
    await User.create({
      email,
      password: TEST_PASSWORD,
      firstName: "Test",
      lastName: "Login",
      userType: "employer",
      phone: "",
      address: "",
      children: [],
      communicationPreferences: {
        email: true,
        sms: false,
        promotional: false,
        acknowledgement: true,
      },
      emailVerified: true,
      isActive: true,
    });
    console.log("✅ Created test user:", email);
  }

  console.log("\nYou can log in with:");
  console.log("  Email:", TEST_EMAIL);
  console.log("  Password:", TEST_PASSWORD);
}

main()
  .catch((err) => {
    console.error("❌ seedLoginTestUser failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
