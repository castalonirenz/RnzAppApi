const { mongoose } = require('../config/database');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    resetPasswordTokenHash: {
      type: String,
      default: null
    },
    resetPasswordExpiresAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false }
  }
);

userSchema.index({ resetPasswordTokenHash: 1 });

const User = mongoose.models.User || mongoose.model('User', userSchema);

function toUserDTO(userDoc, includePassword = false, includeResetFields = false) {
  if (!userDoc) {
    return null;
  }

  const base = {
    id: String(userDoc._id),
    name: userDoc.name,
    email: userDoc.email,
    created_at: new Date(userDoc.created_at).toISOString()
  };

  if (includePassword) {
    const withPassword = {
      ...base,
      password: userDoc.password
    };

    if (includeResetFields) {
      return {
        ...withPassword,
        reset_password_token_hash: userDoc.resetPasswordTokenHash || null,
        reset_password_expires_at: userDoc.resetPasswordExpiresAt
          ? new Date(userDoc.resetPasswordExpiresAt).toISOString()
          : null
      };
    }

    return withPassword;
  }

  return base;
}

class UserModel {
  static async create({ name, email, password }) {
    const user = await User.create({ name, email, password });
    return toUserDTO(user);
  }

  static async findByEmail(email) {
    const user = await User.findOne({ email: String(email).toLowerCase() }).lean();
    return toUserDTO(user, true);
  }

  static async findById(id) {
    const user = await User.findById(id).lean();
    return toUserDTO(user);
  }

  static async findByIdWithPassword(id) {
    const user = await User.findById(id).lean();
    return toUserDTO(user, true);
  }

  static async setPasswordResetTokenById(id, tokenHash, expiresAt) {
    await User.updateOne(
      { _id: id },
      {
        $set: {
          resetPasswordTokenHash: tokenHash,
          resetPasswordExpiresAt: expiresAt
        }
      }
    );
  }

  static async findByValidResetTokenHash(tokenHash) {
    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: { $gt: new Date() }
    }).lean();

    return toUserDTO(user, true, true);
  }

  static async updatePasswordById(id, hashedPassword) {
    await User.updateOne(
      { _id: id },
      {
        $set: {
          password: hashedPassword,
          resetPasswordTokenHash: null,
          resetPasswordExpiresAt: null
        }
      }
    );
  }
}

module.exports = UserModel;
