const express = require('express');
const router = express.Router();
const { registerValidation, handleValidationErrors } = require('../validators/authValidator');
const { authenticateToken } = require('../middleware/auth');
const { setAccessTokenCookie, setRefreshTokenCookie, clearAuthCookies } = require('../utils/cookieHelper');

// User registration
router.post('/register', registerValidation, handleValidationErrors, async (req, res) => {
  console.log('🔵 [ROUTE] POST /register - Request received');
  console.log('🔵 [ROUTE] Request body keys:', Object.keys(req.body));
  console.log('🔵 [ROUTE] Email from request:', req.body.email);
  
  try {
    const AuthController = require('../controllers/authController');
    const authController = new AuthController(req.db);
    
    console.log('🔵 [ROUTE] Calling authController.register()...');
    const result = await authController.register(req.body);
    console.log('✅ [ROUTE] Registration result status:', result.statusCode);
    
    // Set tokens as httpOnly cookies
    if (result.body.success && result.body.data) {
      if (result.body.data.accessToken) {
        setAccessTokenCookie(res, result.body.data.accessToken);
      }
      if (result.body.data.refreshToken) {
        setRefreshTokenCookie(res, result.body.data.refreshToken);
      }
      // Remove tokens from response body for security
      delete result.body.data.accessToken;
      delete result.body.data.refreshToken;
    }
    
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('❌ [ROUTE] Registration route error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const AuthController = require('../controllers/authController');
    const authController = new AuthController(req.db);
    
    const result = await authController.login(email, password);
    
    // Set tokens as httpOnly cookies
    if (result.body.success && result.body.data) {
      if (result.body.data.accessToken) {
        setAccessTokenCookie(res, result.body.data.accessToken);
      }
      if (result.body.data.refreshToken) {
        setRefreshTokenCookie(res, result.body.data.refreshToken);
      }
      // Remove tokens from response body for security
      delete result.body.data.accessToken;
      delete result.body.data.refreshToken;
    }
    
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({
      success: false,
      error: error.message
    });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const AuthController = require('../controllers/authController');
    const authController = new AuthController(req.db);
    
    const result = await authController.getProfile(req.user.userId);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const AuthController = require('../controllers/authController');
    const authController = new AuthController(req.db);
    
    const result = await authController.updateProfile(req.user.userId, req.body);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const AuthController = require('../controllers/authController');
    const authController = new AuthController(req.db);
    
    const result = await authController.changePassword(req.user.userId, currentPassword, newPassword);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('Password change error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Logout (clear cookies)
router.post('/logout', async (req, res) => {
  try {
    const AuthController = require('../controllers/authController');
    const authController = new AuthController(req.db);
    
    const result = await authController.logout();
    
    // Clear authentication cookies
    clearAuthCookies(res);
    
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('Logout error:', error);
    // Still clear cookies even if there's an error
    clearAuthCookies(res);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Verify token validity (public endpoint - doesn't require auth)
// This endpoint checks if a valid token exists but doesn't require one
router.get('/verify', async (req, res) => {
  console.log('🔍 [VERIFY] Verify token request received');
  console.log('🔍 [VERIFY] Request method:', req.method);
  console.log('🔍 [VERIFY] Request URL:', req.originalUrl);
  console.log('🔍 [VERIFY] Request cookies:', {
    accessToken: req.cookies?.accessToken ? 'Present' : 'Missing',
    refreshToken: req.cookies?.refreshToken ? 'Present' : 'Missing',
    allCookies: Object.keys(req.cookies || {})
  });
  console.log('🔍 [VERIFY] Request headers:', {
    'authorization': req.headers['authorization'] ? 'Present' : 'Missing',
    'origin': req.headers.origin,
    'referer': req.headers.referer
  });
  
  try {
    // Try to get token from cookie or header
    let token = req.cookies?.accessToken;
    if (!token) {
      const authHeader = req.headers['authorization'];
      token = authHeader && authHeader.split(' ')[1];
      console.log('🔍 [VERIFY] Token from header:', token ? 'Found' : 'Not found');
    } else {
      console.log('🔍 [VERIFY] Token from cookie:', token ? 'Found' : 'Not found');
    }

    // If no token, return unauthenticated (but success response)
    if (!token) {
      console.log('⚠️ [VERIFY] No token provided');
      return res.status(200).json({
        success: false,
        message: 'No token provided',
        authenticated: false
      });
    }

    console.log('🔍 [VERIFY] Token found, length:', token.length);

    // Verify token (but don't require it)
    const jwt = require('jsonwebtoken');
    const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'your-super-secret-jwt-access-key-change-in-production';
    
    try {
      console.log('🔍 [VERIFY] Verifying token...');
      const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
      console.log('✅ [VERIFY] Token verified successfully:', {
        userId: decoded.userId,
        email: decoded.email,
        userType: decoded.userType
      });
      
      // Token is valid, get user data
      const AuthController = require('../controllers/authController');
      const authController = new AuthController(req.db);
      
      // Get full user data from database
      console.log('🔍 [VERIFY] Fetching user from database, userId:', decoded.userId);
      const user = await authController.userModel.getUserById(decoded.userId);
      if (user) {
        console.log('✅ [VERIFY] User found:', {
          _id: user._id,
          email: user.email,
          userType: user.userType
        });
        return res.status(200).json({
          success: true,
          message: 'Token is valid',
          authenticated: true,
          data: {
            _id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            userType: user.userType,
            phone: user.phone,
            address: user.address,
            profileComplete: user.profileComplete
          }
        });
      } else {
        console.log('❌ [VERIFY] User not found in database, userId:', decoded.userId);
        return res.status(200).json({
          success: false,
          message: 'User not found',
          authenticated: false
        });
      }
    } catch (jwtError) {
      // Token is invalid or expired - return success but unauthenticated
      console.log('❌ [VERIFY] Token verification failed:', jwtError.message);
      return res.status(200).json({
        success: false,
        message: 'Invalid or expired token',
        authenticated: false
      });
    }
  } catch (error) {
    console.error('❌ [VERIFY] Token verify error:', error);
    console.error('❌ [VERIFY] Error stack:', error.stack);
    res.status(200).json({
      success: false,
      error: error.message,
      authenticated: false
    });
  }
});

// Refresh access token using refresh token from cookie
router.post('/refresh', async (req, res) => {
  console.log('🔄 [REFRESH] Refresh token request received');
  console.log('🔄 [REFRESH] Request method:', req.method);
  console.log('🔄 [REFRESH] Request URL:', req.originalUrl);
  console.log('🔄 [REFRESH] Request headers:', {
    'content-type': req.headers['content-type'],
    'cookie': req.headers.cookie ? 'Present' : 'Missing',
    'origin': req.headers.origin,
    'referer': req.headers.referer
  });
  console.log('🔄 [REFRESH] Request cookies:', {
    refreshToken: req.cookies?.refreshToken ? 'Present' : 'Missing',
    accessToken: req.cookies?.accessToken ? 'Present' : 'Missing',
    allCookies: Object.keys(req.cookies || {})
  });
  
  try {
    const refreshToken = req.cookies?.refreshToken;
    
    if (!refreshToken) {
      console.log('❌ [REFRESH] No refresh token found in cookies');
      return res.status(401).json({
        success: false,
        error: 'Refresh token is required'
      });
    }
    
    console.log('✅ [REFRESH] Refresh token found, length:', refreshToken.length);
    
    const AuthController = require('../controllers/authController');
    const authController = new AuthController(req.db);
    
    console.log('🔄 [REFRESH] Calling authController.refreshToken()...');
    const result = await authController.refreshToken(refreshToken);
    
    console.log('🔄 [REFRESH] Refresh result:', {
      statusCode: result.statusCode,
      success: result.body.success,
      hasAccessToken: !!result.body.data?.accessToken,
      hasUser: !!result.body.data?.user,
      userType: result.body.data?.user?.userType,
      userEmail: result.body.data?.user?.email
    });
    
    // Set new access token as cookie
    if (result.body.success && result.body.data?.accessToken) {
      console.log('🍪 [REFRESH] Setting access token cookie...');
      setAccessTokenCookie(res, result.body.data.accessToken);
      // Remove token from response body for security
      delete result.body.data.accessToken;
      console.log('✅ [REFRESH] Access token cookie set successfully');
    } else {
      console.log('⚠️ [REFRESH] No access token to set in cookie');
    }
    
    console.log('📤 [REFRESH] Sending response:', {
      statusCode: result.statusCode,
      success: result.body.success,
      message: result.body.message,
      hasUser: !!result.body.data?.user
    });
    
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('❌ [REFRESH] Token refresh error:', error);
    console.error('❌ [REFRESH] Error stack:', error.stack);
    res.status(401).json({
      success: false,
      error: error.message || 'Token refresh failed'
    });
  }
});

// Check if email exists (for registration validation)
router.get('/check-email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const AuthController = require('../controllers/authController');
    const authController = new AuthController(req.db);
    
    const result = await authController.checkEmail(email);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('Email check error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get users by type (for admin/provider purposes)
router.get('/users/:userType', authenticateToken, async (req, res) => {
  try {
    const { userType } = req.params;
    const { limit = 50 } = req.query;
    
    const AuthController = require('../controllers/authController');
    const authController = new AuthController(req.db);
    
    const result = await authController.getUsersByType(userType, parseInt(limit), req.user.userType);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Search users (for admin/provider purposes)
router.get('/search-users', authenticateToken, async (req, res) => {
  try {
    const { query, userType, limit = 20 } = req.query;
    
    const AuthController = require('../controllers/authController');
    const authController = new AuthController(req.db);
    
    const result = await authController.searchUsers(query, userType, parseInt(limit), req.user.userType);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Request password reset (forgot password)
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }
    
    const AuthController = require('../controllers/authController');
    const authController = new AuthController(req.db);
    
    const result = await authController.requestPasswordReset(email);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('Forgot password error:', error);
    // Still return success to prevent email enumeration
    res.status(200).json({
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent.'
    });
  }
});

// Verify reset token (check if token is valid before showing reset form)
router.get('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Reset token is required'
      });
    }
    
    const AuthController = require('../controllers/authController');
    const authController = new AuthController(req.db);
    
    const result = await authController.verifyResetToken(token);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('Verify reset token error:', error);
    res.status(400).json({
      success: false,
      error: 'Invalid or expired reset token'
    });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Reset token is required'
      });
    }
    
    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required'
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }
    
    const AuthController = require('../controllers/authController');
    const authController = new AuthController(req.db);
    
    const result = await authController.resetPassword(token, password);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reset password'
    });
  }
});

// Verify email with token
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Verification token is required'
      });
    }
    
    const AuthController = require('../controllers/authController');
    const authController = new AuthController(req.db);
    
    const result = await authController.verifyEmail(token);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(400).json({
      success: false,
      error: 'Invalid or expired verification token'
    });
  }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }
    
    const AuthController = require('../controllers/authController');
    const authController = new AuthController(req.db);
    
    const result = await authController.resendVerificationEmail(email);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('Resend verification email error:', error);
    // Still return success to prevent email enumeration
    res.status(200).json({
      success: true,
      message: 'If an account exists with that email, a verification email has been sent.'
    });
  }
});

module.exports = router;
