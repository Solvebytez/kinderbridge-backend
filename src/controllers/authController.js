const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const {
  successResponse,
  errorResponse,
  notFoundResponse,
  unauthorizedResponse,
  forbiddenResponse,
} = require("../utils/responseHelper");
const { sendWelcomeEmail, sendPasswordResetEmail } = require("../services/emailService");

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

      // Send welcome email via SMTP (non-blocking - don't fail registration if email fails)
      console.log("🔵 [REGISTER] Sending welcome email via SMTP...");
      try {
        const emailResult = await sendWelcomeEmail(
          user.email,
          user.firstName || "User"
        );
        if (emailResult.success) {
          console.log(
            "✅ [REGISTER] Welcome email sent successfully via SMTP"
          );
        } else {
          console.warn(
            "⚠️ [REGISTER] Welcome email failed to send:",
            emailResult.message || emailResult.error
          );
          // Continue with registration even if email fails
        }
      } catch (emailError) {
        console.error("❌ [REGISTER] Error sending welcome email:", emailError);
        // Continue with registration even if email fails
      }

      // Generate tokens
      console.log("🔵 [REGISTER] Generating JWT tokens...");
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);
      console.log("✅ [REGISTER] Tokens generated successfully");

      console.log("✅ [REGISTER] Registration completed successfully");
      // Return user data only - tokens will be set as cookies by route handler
      return successResponse(
        { user, accessToken, refreshToken },
        "User registered successfully",
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
}

module.exports = AuthController;
