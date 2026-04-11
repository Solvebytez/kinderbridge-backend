const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const {
  successResponse,
  errorResponse,
  notFoundResponse,
  unauthorizedResponse,
  forbiddenResponse,
} = require("../utils/responseHelper");
const {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} = require("../services/emailService");

// JWT Secrets (from environment variables)
const JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ||
  "your-super-secret-jwt-access-key-change-in-production";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ||
  "your-super-secret-jwt-refresh-key-change-in-production";
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "30d";

/**
 * Generate Access Token (short-lived, 15 minutes)
 * @param {Object} user - User object
 * @returns {string} JWT access token
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user._id || user.id,
      email: user.email,
      userType: user.userType,
      type: "access",
    },
    JWT_ACCESS_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRES_IN }
  );
};

/**
 * Generate Refresh Token (long-lived, 30 days)
 * @param {Object} user - User object
 * @returns {string} JWT refresh token
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      userId: user._id || user.id,
      email: user.email,
      userType: user.userType,
      type: "refresh",
    },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );
};

/**
 * Verify Access Token
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, JWT_ACCESS_SECRET);
};

/**
 * Verify Refresh Token
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, JWT_REFRESH_SECRET);
};

/**
 * Auth Controller
 * Handles all authentication business logic
 */
class AuthController {
  constructor(db) {
    this.db = db;
    // Ensure Mongoose is connected (models will handle initialization)
    const User = require("../models/User");
    this.userModel = new User(db);
  }

  /**
   * User registration
   * @param {Object} userData - User registration data
   * @returns {Object} Response with user and token
   */
  async register(userData) {
    try {
      console.log("🔵 [REGISTER] Starting registration process...");
      console.log("🔵 [REGISTER] Received userData:", {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        userType: userData.userType,
        hasPassword: !!userData.password,
        hasCommunicationPreferences: !!userData.communicationPreferences,
      });

      // Check if email already exists FIRST (before validation)
      const email = userData.email?.toLowerCase().trim();
      if (!email) {
        console.log("❌ [REGISTER] Email is missing");
        return errorResponse("Email is required", 400);
      }

      console.log("🔵 [REGISTER] Checking if email exists:", email);
      const emailExists = await this.userModel.emailExists(email);
      if (emailExists) {
        console.log("❌ [REGISTER] Email already exists:", email);
        return errorResponse(
          "Email already registered. Please use a different email or try logging in.",
          409
        );
      }
      console.log("✅ [REGISTER] Email is available:", email);

      // Validate user data
      console.log("🔵 [REGISTER] Validating user data...");
      const validationErrors = this.userModel.validateUserData(userData);
      if (validationErrors.length > 0) {
        console.log("❌ [REGISTER] Validation errors:", validationErrors);
        return errorResponse("Validation failed", 400, validationErrors);
      }
      console.log("✅ [REGISTER] Validation passed");

      // Create user
      console.log("🔵 [REGISTER] Creating user in database...");
      const user = await this.userModel.createUser(userData);

      // Verify user was actually created in database
      if (!user || (!user._id && !user.id)) {
        console.error(
          "❌ [REGISTER] User creation failed - no user ID returned"
        );
        return errorResponse(
          "Failed to create user in database. Please try again.",
          500
        );
      }

      console.log("✅ [REGISTER] User created successfully in database:", {
        id: user._id || user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });

      // Verify user exists in database by fetching it
      try {
        const verifyUser = await this.userModel.getUserById(
          user._id || user.id
        );
        if (!verifyUser) {
          console.error(
            "❌ [REGISTER] User verification failed - user not found in database"
          );
          return errorResponse(
            "User was created but verification failed. Please contact support.",
            500
          );
        }
        console.log("✅ [REGISTER] User verified in database");
      } catch (verifyError) {
        console.error(
          "❌ [REGISTER] Error verifying user in database:",
          verifyError
        );
        return errorResponse(
          "User was created but verification failed. Please contact support.",
          500
        );
      }

      // Generate email verification token
      console.log("🔵 [REGISTER] Generating email verification token...");
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const verificationExpires = new Date();
      verificationExpires.setHours(verificationExpires.getHours() + 24); // 24 hours expiry

      // Save verification token to user
      const User = require("../schemas/UserSchema");
      const userWithToken = await User.findByIdAndUpdate(
        user._id || user.id,
        {
          emailVerificationToken: verificationToken,
          emailVerificationExpires: verificationExpires,
          emailVerified: false, // User starts unverified
        },
        { new: true }
      );

      console.log("✅ [REGISTER] Verification token generated and saved");

      // Send verification email via SMTP (non-blocking - don't fail registration if email fails)
      console.log("🔵 [REGISTER] Sending verification email via SMTP...");
      try {
        const emailResult = await sendVerificationEmail(
          user.email,
          user.firstName || "User",
          verificationToken
        );
        if (emailResult.success) {
          console.log(
            "✅ [REGISTER] Verification email sent successfully via SMTP"
          );
        } else {
          console.warn(
            "⚠️ [REGISTER] Verification email failed to send:",
            emailResult.message || emailResult.error
          );
          // Continue with registration even if email fails
        }
      } catch (emailError) {
        console.error(
          "❌ [REGISTER] Error sending verification email:",
          emailError
        );
        // Continue with registration even if email fails
      }

      // Do NOT generate tokens - user must verify email before logging in
      console.log("✅ [REGISTER] Registration completed successfully");
      console.log("ℹ️ [REGISTER] User must verify email before logging in");

      // Return user data without tokens - user must verify email first
      return successResponse(
        {
          user: {
            ...user,
            emailVerified: false, // Explicitly show email is not verified
          },
          requiresEmailVerification: true,
        },
        "Registration successful! Please check your email to verify your account before logging in.",
        201
      );
    } catch (error) {
      console.error("❌ [REGISTER] Registration error:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        name: error.name,
      });

      // Provide more detailed error messages
      let errorMessage = error.message || "Registration failed";
      let statusCode = 400;
      let details = null;

      // Handle specific error types
      if (error.name === "ValidationError") {
        errorMessage = "Validation failed";
        if (error.errors) {
          details = Object.values(error.errors).map((e) => e.message);
        }
      } else if (error.code === 11000) {
        errorMessage =
          "Email already registered. Please use a different email or try logging in.";
        statusCode = 409;
      } else if (error.message.includes("already exists")) {
        errorMessage =
          "Email already registered. Please use a different email or try logging in.";
        statusCode = 409;
      } else if (error.message.includes("Communication preferences")) {
        errorMessage = error.message;
        statusCode = 400;
      } else if (error.message.includes("required")) {
        errorMessage = error.message;
        statusCode = 400;
      }

      return errorResponse(errorMessage, statusCode, details);
    }
  }

  /**
   * User login
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Object} Response with user and token
   */
  async login(email, password) {
    try {
      if (!email || !password) {
        return errorResponse("Email and password are required", 400);
      }

      // Authenticate user
      const user = await this.userModel.authenticateUser(email, password);

      // Check if email is verified
      if (!user.emailVerified) {
        console.log("❌ [LOGIN] Email not verified for user:", user.email);
        return errorResponse(
          "Please verify your email address before logging in. Check your inbox for the verification link.",
          403,
          {
            emailVerified: false,
            requiresVerification: true,
          }
        );
      }

      // Generate tokens
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      // Return user data only - tokens will be set as cookies by route handler
      return successResponse(
        { user, accessToken, refreshToken },
        "Login successful"
      );
    } catch (error) {
      console.error("Login error:", error);
      return unauthorizedResponse(error.message);
    }
  }

  /**
   * Get user profile
   * @param {string} userId - User ID
   * @returns {Object} Response with user data
   */
  async getProfile(userId) {
    try {
      const user = await this.userModel.getUserById(userId);
      return successResponse(user);
    } catch (error) {
      console.error("Profile fetch error:", error);
      return notFoundResponse(error.message);
    }
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} updateData - Profile update data
   * @returns {Object} Response with updated user data
   */
  async updateProfile(userId, updateData) {
    try {
      const updatedUser = await this.userModel.updateUser(userId, updateData);
      return successResponse(updatedUser, "Profile updated successfully");
    } catch (error) {
      console.error("Profile update error:", error);
      return errorResponse(error.message, 400);
    }
  }

  /**
   * Change password
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Object} Success response
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      if (!currentPassword || !newPassword) {
        return errorResponse(
          "Current password and new password are required",
          400
        );
      }

      if (newPassword.length < 6) {
        return errorResponse(
          "New password must be at least 6 characters long",
          400
        );
      }

      // Get user with password (need to select password field)
      const User = require("../schemas/UserSchema");
      const user = await User.findById(userId).select("+password");

      if (!user) {
        return notFoundResponse("User not found");
      }

      // Verify current password using model method
      const isCurrentPasswordValid = await user.comparePassword(
        currentPassword
      );
      if (!isCurrentPasswordValid) {
        return errorResponse("Current password is incorrect", 400);
      }

      // Update password (model will hash it)
      await this.userModel.updateUser(userId, { password: newPassword });

      return successResponse(null, "Password changed successfully");
    } catch (error) {
      console.error("Password change error:", error);
      return errorResponse(error.message, 400);
    }
  }

  /**
   * Verify token and return user info
   * @param {Object} tokenPayload - Decoded JWT token payload
   * @returns {Object} Response with user info from token
   */
  async verifyToken(tokenPayload) {
    try {
      return successResponse(
        {
          userId: tokenPayload.userId,
          email: tokenPayload.email,
          userType: tokenPayload.userType,
        },
        "Token is valid"
      );
    } catch (error) {
      console.error("Token verify error:", error);
      return unauthorizedResponse("Invalid token");
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token from cookie
   * @returns {Object} Response with new access token and user data
   */
  async refreshToken(refreshToken) {
    console.log("🔐 [AUTH_CONTROLLER] refreshToken() called");
    console.log(
      "🔐 [AUTH_CONTROLLER] Refresh token length:",
      refreshToken?.length || 0
    );

    try {
      if (!refreshToken) {
        console.log("❌ [AUTH_CONTROLLER] No refresh token provided");
        return unauthorizedResponse("Refresh token is required");
      }

      // Verify refresh token
      let decoded;
      try {
        console.log("🔐 [AUTH_CONTROLLER] Verifying refresh token...");
        decoded = verifyRefreshToken(refreshToken);
        console.log("✅ [AUTH_CONTROLLER] Token verified successfully:", {
          userId: decoded.userId,
          email: decoded.email,
          userType: decoded.userType,
          type: decoded.type,
        });
      } catch (error) {
        console.error(
          "❌ [AUTH_CONTROLLER] Invalid refresh token:",
          error.message
        );
        return unauthorizedResponse("Invalid or expired refresh token");
      }

      // Check token type
      if (decoded.type !== "refresh") {
        console.log("❌ [AUTH_CONTROLLER] Invalid token type:", decoded.type);
        return unauthorizedResponse("Invalid token type");
      }

      // Get user from database
      console.log(
        "🔐 [AUTH_CONTROLLER] Fetching user from database, userId:",
        decoded.userId
      );
      const user = await this.userModel.getUserById(decoded.userId);
      if (!user) {
        console.log(
          "❌ [AUTH_CONTROLLER] User not found in database, userId:",
          decoded.userId
        );
        return notFoundResponse("User not found");
      }

      console.log("✅ [AUTH_CONTROLLER] User found:", {
        _id: user._id,
        email: user.email,
        userType: user.userType,
        firstName: user.firstName,
      });

      // Generate new access token
      console.log("🔐 [AUTH_CONTROLLER] Generating new access token...");
      const newAccessToken = generateAccessToken(user);
      console.log(
        "✅ [AUTH_CONTROLLER] Access token generated, length:",
        newAccessToken.length
      );

      // Return new access token - will be set as cookie by route handler
      const response = successResponse(
        { user, accessToken: newAccessToken },
        "Token refreshed successfully"
      );

      console.log("✅ [AUTH_CONTROLLER] Refresh token response prepared:", {
        statusCode: response.statusCode,
        success: response.body.success,
        hasUser: !!response.body.data?.user,
        hasAccessToken: !!response.body.data?.accessToken,
      });

      return response;
    } catch (error) {
      console.error("❌ [AUTH_CONTROLLER] Token refresh error:", error);
      console.error("❌ [AUTH_CONTROLLER] Error stack:", error.stack);
      return errorResponse(error.message, 500);
    }
  }

  /**
   * Logout (client-side token removal)
   * @returns {Object} Success response
   */
  async logout() {
    // In a more advanced system, you might want to add the token to a blacklist
    // For now, we'll just return success since the client removes the token
    return successResponse(null, "Logged out successfully");
  }

  /**
   * Check if email exists
   * @param {string} email - Email to check
   * @returns {Object} Response with email existence status
   */
  async checkEmail(email) {
    try {
      if (!email || !email.includes("@")) {
        return errorResponse("Valid email is required", 400);
      }

      const exists = await this.userModel.emailExists(email);

      return successResponse({ email, exists });
    } catch (error) {
      console.error("Email check error:", error);
      return errorResponse(error.message, 500);
    }
  }

  /**
   * Get users by type (for admin/provider purposes)
   * @param {string} userType - Type of users to get
   * @param {number} limit - Maximum number of users to return
   * @param {string} requesterUserType - User type of the requester (for authorization)
   * @returns {Object} Response with users list
   */
  async getUsersByType(userType, limit = 50, requesterUserType = null) {
    try {
      // Only allow providers and admins to access user lists
      if (
        requesterUserType &&
        !["provider", "admin"].includes(requesterUserType)
      ) {
        return forbiddenResponse("Access denied");
      }

      const users = await this.userModel.getUsersByType(
        userType,
        parseInt(limit)
      );

      return successResponse(users);
    } catch (error) {
      console.error("Users fetch error:", error);
      return errorResponse(error.message, 500);
    }
  }

  /**
   * Search users (for admin/provider purposes)
   * @param {string} query - Search query
   * @param {string} userType - Filter by user type
   * @param {number} limit - Maximum number of results
   * @param {string} requesterUserType - User type of the requester (for authorization)
   * @returns {Object} Response with search results
   */
  async searchUsers(
    query,
    userType = null,
    limit = 20,
    requesterUserType = null
  ) {
    try {
      // Only allow providers and admins to search users
      if (
        requesterUserType &&
        !["provider", "admin"].includes(requesterUserType)
      ) {
        return forbiddenResponse("Access denied");
      }

      const users = await this.userModel.searchUsers(
        query,
        userType,
        parseInt(limit)
      );

      return successResponse(users);
    } catch (error) {
      console.error("User search error:", error);
      return errorResponse(error.message, 500);
    }
  }

  /**
   * Request password reset - generates token and sends email
   * @param {string} email - User email address
   * @returns {Object} Response indicating success (always returns success for security)
   */
  async requestPasswordReset(email) {
    try {
      console.log("🔐 [AUTH_CONTROLLER] requestPasswordReset() called");
      console.log("🔐 [AUTH_CONTROLLER] Email:", email);

      if (!email || typeof email !== "string" || !email.includes("@")) {
        console.log("❌ [AUTH_CONTROLLER] Invalid email provided");
        // Return success even for invalid email to prevent email enumeration
        return successResponse(
          null,
          "If an account exists with that email, a password reset link has been sent."
        );
      }

      // Find user by email (check active users only)
      const normalizedEmail = email.toLowerCase().trim();
      const User = require("../schemas/UserSchema");
      const user = await User.findOne({
        email: normalizedEmail,
        isActive: true,
      }).select("+resetPasswordToken");

      // Always return success to prevent email enumeration attacks
      // Even if user doesn't exist, return the same message
      if (!user) {
        console.log(
          "⚠️ [AUTH_CONTROLLER] User not found, but returning success for security"
        );
        return successResponse(
          null,
          "If an account exists with that email, a password reset link has been sent."
        );
      }

      // Generate cryptographically secure random token
      const resetToken = crypto.randomBytes(32).toString("hex");

      // Set token and expiration (1 hour from now)
      const resetExpires = new Date();
      resetExpires.setHours(resetExpires.getHours() + 1);

      // Save token to user
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = resetExpires;
      await user.save({ validateBeforeSave: false });

      console.log("✅ [AUTH_CONTROLLER] Reset token generated and saved");

      // Send password reset email (non-blocking - don't fail if email fails)
      try {
        const emailResult = await sendPasswordResetEmail(
          user.email,
          user.firstName || "User",
          resetToken
        );
        if (emailResult.success) {
          console.log(
            "✅ [AUTH_CONTROLLER] Password reset email sent successfully"
          );
        } else {
          console.warn(
            "⚠️ [AUTH_CONTROLLER] Password reset email failed to send:",
            emailResult.message || emailResult.error
          );
          // Clear token if email failed
          user.resetPasswordToken = null;
          user.resetPasswordExpires = null;
          await user.save({ validateBeforeSave: false });
        }
      } catch (emailError) {
        console.error(
          "❌ [AUTH_CONTROLLER] Error sending password reset email:",
          emailError
        );
        // Clear token if email failed
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save({ validateBeforeSave: false });
      }

      // Always return success message (security best practice)
      return successResponse(
        null,
        "If an account exists with that email, a password reset link has been sent."
      );
    } catch (error) {
      console.error(
        "❌ [AUTH_CONTROLLER] Password reset request error:",
        error
      );
      // Still return success to prevent information leakage
      return successResponse(
        null,
        "If an account exists with that email, a password reset link has been sent."
      );
    }
  }

  /**
   * Verify reset token validity
   * @param {string} token - Reset token
   * @returns {Object} Response with token validity status
   */
  async verifyResetToken(token) {
    try {
      console.log("🔐 [AUTH_CONTROLLER] verifyResetToken() called");
      console.log("🔐 [AUTH_CONTROLLER] Token length:", token?.length || 0);

      if (!token || typeof token !== "string") {
        console.log("❌ [AUTH_CONTROLLER] Invalid token provided");
        return errorResponse("Invalid or expired reset token", 400);
      }

      // Find user with this token and check expiration
      const User = require("../schemas/UserSchema");
      const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: new Date() }, // Token not expired
        isActive: true,
      }).select("+resetPasswordToken");

      if (!user) {
        console.log("❌ [AUTH_CONTROLLER] Invalid or expired token");
        return errorResponse("Invalid or expired reset token", 400);
      }

      console.log("✅ [AUTH_CONTROLLER] Token is valid");
      return successResponse(
        { email: user.email, valid: true },
        "Token is valid"
      );
    } catch (error) {
      console.error("❌ [AUTH_CONTROLLER] Token verification error:", error);
      return errorResponse("Invalid or expired reset token", 400);
    }
  }

  /**
   * Reset password using token
   * @param {string} token - Reset token
   * @param {string} newPassword - New password
   * @returns {Object} Response indicating success
   */
  async resetPassword(token, newPassword) {
    try {
      console.log("🔐 [AUTH_CONTROLLER] resetPassword() called");

      if (!token || typeof token !== "string") {
        return errorResponse("Invalid or expired reset token", 400);
      }

      if (!newPassword || newPassword.length < 6) {
        return errorResponse(
          "Password must be at least 6 characters long",
          400
        );
      }

      // Find user with this token and check expiration
      const User = require("../schemas/UserSchema");
      const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: new Date() }, // Token not expired
        isActive: true,
      }).select("+resetPasswordToken +password");

      if (!user) {
        console.log("❌ [AUTH_CONTROLLER] Invalid or expired token");
        return errorResponse("Invalid or expired reset token", 400);
      }

      // Update password (will be hashed by pre-save middleware)
      user.password = newPassword;
      // Clear reset token fields (single-use token)
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();

      console.log("✅ [AUTH_CONTROLLER] Password reset successfully");
      return successResponse(null, "Password has been reset successfully");
    } catch (error) {
      console.error("❌ [AUTH_CONTROLLER] Password reset error:", error);
      return errorResponse(error.message || "Failed to reset password", 500);
    }
  }

  /**
   * Verify email address using token
   * @param {string} token - Email verification token
   * @returns {Object} Response indicating success
   */
  async verifyEmail(token) {
    try {
      console.log("🔐 [AUTH_CONTROLLER] verifyEmail() called");
      console.log("🔐 [AUTH_CONTROLLER] Token length:", token?.length || 0);

      if (!token || typeof token !== "string") {
        console.log("❌ [AUTH_CONTROLLER] Invalid token provided");
        return errorResponse("Invalid or expired verification token", 400);
      }

      // Find user with this token and check expiration
      const User = require("../schemas/UserSchema");
      const user = await User.findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: new Date() }, // Token not expired
        isActive: true,
      }).select("+emailVerificationToken");

      if (!user) {
        console.log(
          "❌ [AUTH_CONTROLLER] Invalid or expired verification token"
        );
        return errorResponse("Invalid or expired verification token", 400);
      }

      // Check if already verified
      if (user.emailVerified) {
        console.log("⚠️ [AUTH_CONTROLLER] Email already verified");
        return successResponse(
          { email: user.email, alreadyVerified: true },
          "Email is already verified"
        );
      }

      // Mark email as verified and clear token
      user.emailVerified = true;
      user.emailVerificationToken = null;
      user.emailVerificationExpires = null;
      await user.save();

      console.log("✅ [AUTH_CONTROLLER] Email verified successfully");

      // Send welcome email after successful verification (non-blocking)
      console.log("🔵 [AUTH_CONTROLLER] Sending welcome email...");
      try {
        const emailResult = await sendWelcomeEmail(
          user.email,
          user.firstName || "User"
        );
        if (emailResult.success) {
          console.log("✅ [AUTH_CONTROLLER] Welcome email sent successfully");
        } else {
          console.warn(
            "⚠️ [AUTH_CONTROLLER] Welcome email failed to send:",
            emailResult.message || emailResult.error
          );
          // Continue even if email fails - verification is complete
        }
      } catch (emailError) {
        console.error(
          "❌ [AUTH_CONTROLLER] Error sending welcome email:",
          emailError
        );
        // Continue even if email fails - verification is complete
      }

      return successResponse(
        { email: user.email, verified: true },
        "Email verified successfully"
      );
    } catch (error) {
      console.error("❌ [AUTH_CONTROLLER] Email verification error:", error);
      return errorResponse(error.message || "Failed to verify email", 500);
    }
  }

  /**
   * Resend email verification
   * @param {string} email - User email address
   * @returns {Object} Response indicating success (always returns success for security)
   */
  async resendVerificationEmail(email) {
    try {
      console.log("🔐 [AUTH_CONTROLLER] resendVerificationEmail() called");
      console.log("🔐 [AUTH_CONTROLLER] Email:", email);

      if (!email || typeof email !== "string" || !email.includes("@")) {
        console.log("❌ [AUTH_CONTROLLER] Invalid email provided");
        // Return success even for invalid email to prevent email enumeration
        return successResponse(
          null,
          "If an account exists with that email, a verification email has been sent."
        );
      }

      // Find user by email (check active users only)
      const normalizedEmail = email.toLowerCase().trim();
      const User = require("../schemas/UserSchema");
      const user = await User.findOne({
        email: normalizedEmail,
        isActive: true,
      }).select("+emailVerificationToken");

      // Always return success to prevent email enumeration attacks
      if (!user) {
        console.log(
          "⚠️ [AUTH_CONTROLLER] User not found, but returning success for security"
        );
        return successResponse(
          null,
          "If an account exists with that email, a verification email has been sent."
        );
      }

      // Check if already verified
      if (user.emailVerified) {
        console.log("⚠️ [AUTH_CONTROLLER] Email already verified");
        return successResponse(
          null,
          "Email is already verified. You can log in normally."
        );
      }

      // Generate new verification token
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const verificationExpires = new Date();
      verificationExpires.setHours(verificationExpires.getHours() + 24); // 24 hours expiry

      // Save new token to user
      user.emailVerificationToken = verificationToken;
      user.emailVerificationExpires = verificationExpires;
      await user.save({ validateBeforeSave: false });

      console.log(
        "✅ [AUTH_CONTROLLER] New verification token generated and saved"
      );

      // Send verification email (non-blocking - don't fail if email fails)
      try {
        const emailResult = await sendVerificationEmail(
          user.email,
          user.firstName || "User",
          verificationToken
        );
        if (emailResult.success) {
          console.log(
            "✅ [AUTH_CONTROLLER] Verification email sent successfully"
          );
        } else {
          console.warn(
            "⚠️ [AUTH_CONTROLLER] Verification email failed to send:",
            emailResult.message || emailResult.error
          );
          // Clear token if email failed
          user.emailVerificationToken = null;
          user.emailVerificationExpires = null;
          await user.save({ validateBeforeSave: false });
        }
      } catch (emailError) {
        console.error(
          "❌ [AUTH_CONTROLLER] Error sending verification email:",
          emailError
        );
        // Clear token if email failed
        user.emailVerificationToken = null;
        user.emailVerificationExpires = null;
        await user.save({ validateBeforeSave: false });
      }

      // Always return success message (security best practice)
      return successResponse(
        null,
        "If an account exists with that email, a verification email has been sent."
      );
    } catch (error) {
      console.error(
        "❌ [AUTH_CONTROLLER] Resend verification email error:",
        error
      );
      // Still return success to prevent information leakage
      return successResponse(
        null,
        "If an account exists with that email, a verification email has been sent."
      );
    }
  }
}

module.exports = AuthController;
