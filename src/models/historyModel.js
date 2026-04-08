const { mongoose } = require('../config/database');

const historySchema = new mongoose.Schema(
  {
    loanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Loan',
      required: true,
      index: true
    },
    action: {
      type: String,
      required: true
    },
    amountPaid: {
      type: String,
      default: null
    },
    balanceAfter: {
      type: String,
      default: null
    }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false }
  }
);

const History = mongoose.models.History || mongoose.model('History', historySchema);

function toHistoryDTO(historyDoc) {
  if (!historyDoc) {
    return null;
  }

  return {
    id: String(historyDoc._id),
    loan_id: String(historyDoc.loanId),
    action: historyDoc.action,
    amount_paid: historyDoc.amountPaid,
    balance_after: historyDoc.balanceAfter,
    created_at: new Date(historyDoc.createdAt).toISOString()
  };
}

class HistoryModel {
  static async create({ loanId, action, amountPaid = null, balanceAfter = null }) {
    const history = await History.create({
      loanId,
      action,
      amountPaid,
      balanceAfter
    });

    return toHistoryDTO(history);
  }

  static async findByLoanId(loanId) {
    const historyRows = await History.find({ loanId }).sort({ createdAt: 1, _id: 1 }).lean();
    return historyRows.map(toHistoryDTO);
  }
}

module.exports = HistoryModel;
