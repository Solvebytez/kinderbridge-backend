const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Schema
 */
const communicationPreferencesSchema = new mongoose.Schema({
  email: {
    type: Boolean,
    default: true,
    required: true
  },
  sms: {
    type: Boolean,
    default: false
  },
  promotional: {
    type: Boolean,
    default: false
  },
  acknowledgement: {
    type: Boolean,
    default: false,
    required: true
  }
}, { _id: false });

const childSchema = new mongoose.Schema({
  name: {
    type: String,
    required: false,
    default: '',
    trim: true
  },
  age: {
    type: Number,
    required: true,
    min: 1,
    max: 18
  },
  specialNeeds: {
    type: String,
    default: ''
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false // Don't return password by default
  },
  firstName: {
    type: String,
    required: false,
    default: 'User',
    trim: true,
    minlength: [2, 'First name must be at least 2 characters long']
  },
  lastName: {
    type: String,
    required: false,
    default: '',
    trim: true
  },
  userType: {
    type: String,
    required: false,
    default: 'parent',
    enum: {
      values: ['parent', 'provider', 'employer', 'employee'],
      message: 'User type must be one of: parent, provider, employer, employee'
    }
  },
  phone: {
    type: String,
    default: '',
    trim: true
  },
  address: {
    type: String,
    default: '',
    trim: true
  },
  children: {
    type: [childSchema],
    default: [],
    validate: {
      validator: function(children) {
        // If userType is parent (or default), children array should not be empty
        if (this.userType === 'parent' || !this.userType) {
          return children && children.length > 0;
        }
        return true;
      },
      message: 'At least one child is required for parent accounts'
    }
  },
  daycareId: {
    type: String,
    default: null,
    validate: {
      validator: function(daycareId) {
        // If userType is provider, daycareId should be provided
        if (this.userType === 'provider') {
          return daycareId && daycareId.trim().length > 0;
        }
        return true;
      },
      message: 'Daycare ID is required for provider accounts'
    }
  },
  role: {
    type: String,
    default: null,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  profileComplete: {
    type: Boolean,
    default: false
  },
  communicationPreferences: {
    type: communicationPreferencesSchema,
    default: () => ({
      email: true,
      sms: false,
      promotional: false,
      acknowledgement: false
    })
  },
  resetPasswordToken: {
    type: String,
    default: null,
    select: false // Don't return token by default
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    default: null,
    select: false // Don't return token by default
  },
  emailVerificationExpires: {
    type: Date,
    default: null
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  toJSON: {
    transform: function(doc, ret) {
      // Remove password from JSON output
      delete ret.password;
      return ret;
    }
  },
  toObject: {
    transform: function(doc, ret) {
      // Remove password from object output
      delete ret.password;
      return ret;
    }
  }
});

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ userType: 1 });
userSchema.index({ isActive: 1 });

// Pre-save middleware to hash password and update profileComplete
userSchema.pre('save', async function() {
  // Hash password if it's been modified (or is new)
  if (this.isModified('password')) {
    const saltRounds = 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
  }

  // Update profileComplete status
  // Default to 'parent' if userType is not set
  const userType = this.userType || 'parent';
  
  if (userType === 'parent') {
    this.profileComplete = this.children && this.children.length > 0;
  } else if (userType === 'provider') {
    this.profileComplete = !!this.daycareId;
  } else {
    this.profileComplete = true;
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check if profile is complete
userSchema.methods.checkProfileComplete = function() {
  if (this.userType === 'parent') {
    return this.children && this.children.length > 0;
  } else if (this.userType === 'provider') {
    return !!this.daycareId;
  }
  return true;
};

// Static method to find user by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase(), isActive: true });
};

// Static method to check if email exists (check ALL users, not just active ones)
userSchema.statics.emailExists = async function(email) {
  const normalizedEmail = email?.toLowerCase().trim();
  console.log('🔵 [SCHEMA] emailExists() - Searching for email:', normalizedEmail);
  // Check for ANY user with this email (active or inactive) since unique index prevents duplicates
  const user = await this.findOne({ email: normalizedEmail });
  const exists = !!user;
  console.log('🔵 [SCHEMA] emailExists() - Found user:', exists, user ? { 
    id: user._id, 
    email: user.email, 
    isActive: user.isActive 
  } : 'none');
  return exists;
};

// Export model (check if already compiled to avoid recompilation errors)
let User;
try {
  User = mongoose.model('User');
} catch (error) {
  User = mongoose.model('User', userSchema);
}

module.exports = User;

