const { mongoose } = require('../config/database');
const { normalizeAmount, toCents, fromCents } = require('../utils/decimal');

const ALLOWED_SPLIT_MODES = ['equal', 'custom'];
const SHARE_SUM_TOLERANCE_CENTS = 1;

function normalizeParticipantNames(participants) {
  if (!Array.isArray(participants)) {
    return [];
  }

  return participants
    .map((name) => String(name || '').trim())
    .filter((name) => name.length > 0);
}

function normalizeSplitMode(value) {
  const mode = String(value || 'equal').toLowerCase();
  return ALLOWED_SPLIT_MODES.includes(mode) ? mode : 'equal';
}

function buildEqualParticipantShares(amount, participants) {
  const names = normalizeParticipantNames(participants);

  if (names.length === 0) {
    return [];
  }

  const totalCents = toCents(amount);
  const baseCents = Math.floor(totalCents / names.length);
  let remainder = totalCents - baseCents * names.length;

  return names.map((name) => {
    const cents = baseCents + (remainder > 0 ? 1 : 0);

    if (remainder > 0) {
      remainder -= 1;
    }

    return {
      name,
      amount: fromCents(cents)
    };
  });
}

function sanitizeStoredParticipantShares(participantShares) {
  if (!Array.isArray(participantShares)) {
    return [];
  }

  return participantShares
    .map((item) => {
      const name = String(item?.name || '').trim();

      try {
        return {
          name,
          amount: normalizeAmount(item?.amount || 0)
        };
      } catch (_error) {
        return {
          name,
          amount: null
        };
      }
    })
    .filter((item) => item.name.length > 0 && item.amount !== null);
}

function sharesMatchParticipants(participants, participantShares) {
  if (participants.length !== participantShares.length) {
    return false;
  }

  const participantSet = new Set(participants);
  const shareNameSet = new Set(participantShares.map((item) => item.name));
  return participantSet.size === participants.length && shareNameSet.size === participantShares.length && participants.every((name) => shareNameSet.has(name));
}

function resolveStoredSplit(expenseDoc) {
  const participants = normalizeParticipantNames(expenseDoc.participants);
  const amount = normalizeAmount(expenseDoc.amount || 0);
  const requestedSplitMode = normalizeSplitMode(expenseDoc.splitMode);
  const storedShares = sanitizeStoredParticipantShares(expenseDoc.participantShares);
  const storedSharesTotalCents = storedShares.reduce((sum, share) => sum + toCents(share.amount), 0);
  const amountCents = toCents(amount);
  const sharesAreValid =
    sharesMatchParticipants(participants, storedShares) &&
    Math.abs(storedSharesTotalCents - amountCents) <= SHARE_SUM_TOLERANCE_CENTS;

  let splitMode = requestedSplitMode;
  let participantShares = storedShares;

  if (splitMode === 'equal' || !sharesAreValid) {
    splitMode = 'equal';
    participantShares = buildEqualParticipantShares(amount, participants);
  } else {
    const shareMap = new Map(participantShares.map((share) => [share.name, share.amount]));
    participantShares = participants.map((name) => ({
      name,
      amount: shareMap.get(name)
    }));
  }

  const sharePerPerson = participants.length > 0 ? normalizeAmount(Number(amount) / participants.length) : '0.00';

  return {
    amount,
    participants,
    splitMode,
    participantShares,
    sharePerPerson
  };
}

const sharedExpenseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    amount: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500
    },
    participants: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: 100
        }
      ],
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0 && value.length <= 20;
        },
        message: 'participants must contain between 1 and 20 items.'
      }
    },
    splitMode: {
      type: String,
      enum: ALLOWED_SPLIT_MODES,
      default: 'equal',
      required: true
    },
    participantShares: {
      type: [
        new mongoose.Schema(
          {
            name: {
              type: String,
              required: true,
              trim: true,
              maxlength: 100
            },
            amount: {
              type: String,
              required: true
            }
          },
          { _id: false }
        )
      ],
      default: []
    },
    sharePerPerson: {
      type: String,
      required: true
    },
    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
);

sharedExpenseSchema.index({ userId: 1, createdAt: -1 });
sharedExpenseSchema.index({ createdAt: -1 });
sharedExpenseSchema.index({ userId: 1, deletedAt: 1 });
sharedExpenseSchema.index(
  { userId: 1, title: 1, deletedAt: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);

const SharedExpense = mongoose.models.SharedExpense || mongoose.model('SharedExpense', sharedExpenseSchema);

function toSharedExpenseDTO(expenseDoc) {
  if (!expenseDoc) {
    return null;
  }

  const normalized = resolveStoredSplit(expenseDoc);

  return {
    id: String(expenseDoc._id),
    _id: String(expenseDoc._id),
    title: expenseDoc.title,
    amount: Number(normalized.amount),
    description: expenseDoc.description || '',
    participants: normalized.participants,
    split_mode: normalized.splitMode,
    participant_shares: normalized.participantShares.map((share) => ({
      name: share.name,
      amount: Number(share.amount)
    })),
    share_per_person: Number(normalized.sharePerPerson),
    created_by: String(expenseDoc.userId),
    created_at: new Date(expenseDoc.createdAt).toISOString(),
    updated_at: new Date(expenseDoc.updatedAt).toISOString()
  };
}

class SharedExpenseModel {
  static async findAllByUserId(userId, { limit = 50, offset = 0, sort = { createdAt: -1, _id: -1 } } = {}) {
    const query = { userId, deletedAt: null };

    const [docs, total] = await Promise.all([
      SharedExpense.find(query).sort(sort).skip(offset).limit(limit).lean(),
      SharedExpense.countDocuments(query)
    ]);

    return {
      rows: docs.map(toSharedExpenseDTO),
      total
    };
  }

  static async findByIdAndUserId(id, userId) {
    const doc = await SharedExpense.findOne({ _id: id, userId, deletedAt: null }).lean();
    return toSharedExpenseDTO(doc);
  }

  static async findRawByIdAndUserId(id, userId) {
    return SharedExpense.findOne({ _id: id, userId, deletedAt: null }).lean();
  }

  static async findRawById(id) {
    return SharedExpense.findOne({ _id: id, deletedAt: null }).lean();
  }

  static async findAllRawByUserId(userId) {
    return SharedExpense.find({ userId, deletedAt: null }).sort({ createdAt: -1, _id: -1 }).lean();
  }

  static async create({
    userId,
    title,
    amount,
    description,
    participants,
    splitMode,
    participantShares,
    sharePerPerson
  }) {
    const doc = await SharedExpense.create({
      userId,
      title,
      amount,
      description,
      participants,
      splitMode,
      participantShares,
      sharePerPerson
    });

    return toSharedExpenseDTO(doc);
  }

  static async updateByIdAndUserId(id, userId, payload) {
    await SharedExpense.findOneAndUpdate(
      { _id: id, userId, deletedAt: null },
      {
        title: payload.title,
        amount: payload.amount,
        description: payload.description,
        participants: payload.participants,
        splitMode: payload.splitMode,
        participantShares: payload.participantShares,
        sharePerPerson: payload.sharePerPerson
      },
      { runValidators: true }
    );

    return this.findByIdAndUserId(id, userId);
  }

  static async softDeleteByIdAndUserId(id, userId) {
    const doc = await SharedExpense.findOneAndUpdate(
      { _id: id, userId, deletedAt: null },
      { deletedAt: new Date() }
    ).lean();

    return Boolean(doc);
  }

  static async existsByTitle(userId, title, excludeId = null) {
    const query = { userId, title, deletedAt: null };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await SharedExpense.findOne(query).select('_id').lean();
    return Boolean(existing);
  }
}

module.exports = SharedExpenseModel;
