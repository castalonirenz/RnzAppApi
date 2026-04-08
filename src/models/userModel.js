const { mongoose } = require('../config/database');

const userSchema = new mongoose.Schema(
  {
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
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false }
  }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

function toUserDTO(userDoc, includePassword = false) {
  if (!userDoc) {
    return null;
  }

  const base = {
    id: String(userDoc._id),
    email: userDoc.email,
    created_at: new Date(userDoc.created_at).toISOString()
  };

  if (includePassword) {
    return {
      ...base,
      password: userDoc.password
    };
  }

  return base;
}

class UserModel {
  static async create({ email, password }) {
    const user = await User.create({ email, password });
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
}

module.exports = UserModel;
