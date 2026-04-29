const PayableModel = require('../models/payableModel');
const PayablePaymentModel = require('../models/payablePaymentModel');
const HttpError = require('../utils/httpError');
const { normalizeAmount, toCents, fromCents, addAmounts } = require('../utils/decimal');
const {
  PAYABLE_STATUS_VALUES,
  PAYABLE_FREQUENCY_VALUES,
  PAYABLE_PAYMENT_METHOD_VALUES
} = require('../utils/payablesConstants');

const SORTABLE_FIELDS = Object.freeze(['due_date', 'amount_paid', 'created_at']);
const RECURRING_MONTH_STEP_BY_FREQUENCY = Object.freeze({
  monthly: 1,
  quarterly: 3,
  yearly: 12
});
const MAX_RECURRING_INSTANCES = 240;

function hasField(payload, field) {
  return Object.prototype.hasOwnProperty.call(payload || {}, field);
}

function normalizeBoolean(value, fieldName) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true' || value === '1' || value === 1) {
    return true;
  }

  if (value === 'false' || value === '0' || value === 0) {
    return false;
  }

  throw new HttpError(422, `${fieldName} must be a boolean value.`);
}

function normalizeFrequency(value) {
  const frequency = String(value || '').trim().toLowerCase();

  if (!PAYABLE_FREQUENCY_VALUES.includes(frequency)) {
    throw new HttpError(422, 'frequency is invalid.');
  }

  return frequency;
}

function normalizeStatusByAmounts(principalAmount, amountPaid) {
  const principalCents = toCents(principalAmount);
  const paidCents = toCents(amountPaid);

  if (paidCents <= 0) {
    return 'pending';
  }

  if (paidCents >= principalCents) {
    return 'completed';
  }

  return 'partially_paid';
}

function calculateBalance(principalAmount, amountPaid) {
  const principalCents = toCents(principalAmount);
  const paidCents = toCents(amountPaid);
  return fromCents(Math.max(principalCents - paidCents, 0));
}

function parseDateOnly(value, fieldName) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new HttpError(422, `${fieldName} must be a valid ISO date.`);
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function normalizeOptionalDateOnly(value, fieldName) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return parseDateOnly(value, fieldName);
}

function normalizePaymentMethod(value) {
  const method = String(value || 'other').trim().toLowerCase();

  if (!PAYABLE_PAYMENT_METHOD_VALUES.includes(method)) {
    throw new HttpError(422, 'payment_method is invalid.');
  }

  return method;
}

function clampDateToMonth(date, monthsToAdd) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(year, month + monthsToAdd, 1));
  const lastDayOfTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();

  return new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, lastDayOfTargetMonth))
  );
}

function generateRecurringDates({ dueDate, frequency, recurrenceEndDate }) {
  const dates = [new Date(dueDate)];

  if (!recurrenceEndDate || frequency === 'once') {
    return dates;
  }

  const monthStep = RECURRING_MONTH_STEP_BY_FREQUENCY[frequency];

  if (!monthStep) {
    return dates;
  }

  let cursor = new Date(dueDate);

  while (dates.length < MAX_RECURRING_INSTANCES) {
    cursor = clampDateToMonth(cursor, monthStep);

    if (cursor > recurrenceEndDate) {
      break;
    }

    dates.push(new Date(cursor));
  }

  return dates;
}

function normalizeSortField(value) {
  if (!value) {
    return 'due_date';
  }

  const normalized = String(value).trim().toLowerCase();

  if (!SORTABLE_FIELDS.includes(normalized)) {
    throw new HttpError(422, 'sort_by is invalid.');
  }

  return normalized;
}

function sortRawPayables(rows, sortBy) {
  const payables = [...rows];

  if (sortBy === 'amount_paid') {
    payables.sort((a, b) => {
      const amountDifference = Number(b.amountPaid || 0) - Number(a.amountPaid || 0);

      if (amountDifference !== 0) {
        return amountDifference;
      }

      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
    return payables;
  }

  if (sortBy === 'created_at') {
    payables.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return payables;
  }

  payables.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  return payables;
}

function summarizePayables(rows) {
  const summary = {
    total_payables: 0,
    total_paid: 0,
    total_balance: 0,
    pending_count: 0,
    completed_count: 0
  };

  for (const row of rows) {
    summary.total_payables += Number(row.principalAmount || 0);
    summary.total_paid += Number(row.amountPaid || 0);
    summary.total_balance += Number(row.balance || 0);

    if (row.status === 'pending') {
      summary.pending_count += 1;
    }

    if (row.status === 'completed') {
      summary.completed_count += 1;
    }
  }

  return {
    total_payables: Number(normalizeAmount(summary.total_payables)),
    total_paid: Number(normalizeAmount(summary.total_paid)),
    total_balance: Number(normalizeAmount(summary.total_balance)),
    pending_count: summary.pending_count,
    completed_count: summary.completed_count
  };
}

function normalizeCreateInput(payload) {
  const creditorName = String(payload.creditor_name || '').trim();
  const description = payload.description ? String(payload.description).trim() : '';
  const principalAmount = normalizeAmount(payload.principal_amount);
  const dueDate = parseDateOnly(payload.due_date, 'due_date');
  const isRecurring = hasField(payload, 'is_recurring') ? normalizeBoolean(payload.is_recurring, 'is_recurring') : false;
  const frequency = hasField(payload, 'frequency') ? normalizeFrequency(payload.frequency) : 'once';
  const recurrenceEndDate = normalizeOptionalDateOnly(payload.recurrence_end_date, 'recurrence_end_date');

  if (!creditorName) {
    throw new HttpError(422, 'creditor_name is required.');
  }

  if (creditorName.length > 100) {
    throw new HttpError(422, 'creditor_name must be at most 100 characters.');
  }

  if (toCents(principalAmount) <= 0) {
    throw new HttpError(422, 'principal_amount must be greater than zero.');
  }

  if (isRecurring && !hasField(payload, 'frequency')) {
    throw new HttpError(422, 'frequency is required when is_recurring is true.');
  }

  if (isRecurring && frequency === 'once') {
    throw new HttpError(422, 'frequency must not be once when is_recurring is true.');
  }

  if (!isRecurring && recurrenceEndDate) {
    throw new HttpError(422, 'recurrence_end_date can only be set when is_recurring is true.');
  }

  if (recurrenceEndDate && recurrenceEndDate < dueDate) {
    throw new HttpError(422, 'recurrence_end_date must be greater than or equal to due_date.');
  }

  return {
    creditorName,
    description,
    principalAmount,
    dueDate,
    isRecurring,
    recurrenceEndDate,
    frequency: isRecurring ? frequency : 'once'
  };
}

function normalizeUpdateInput(payload, currentPayable) {
  const creditorName = hasField(payload, 'creditor_name')
    ? String(payload.creditor_name || '').trim()
    : currentPayable.creditorName;
  const description = hasField(payload, 'description')
    ? String(payload.description || '').trim()
    : currentPayable.description || '';
  const principalAmount = hasField(payload, 'principal_amount')
    ? normalizeAmount(payload.principal_amount)
    : normalizeAmount(currentPayable.principalAmount);
  const dueDate = hasField(payload, 'due_date')
    ? parseDateOnly(payload.due_date, 'due_date')
    : new Date(currentPayable.dueDate);
  const isRecurring = hasField(payload, 'is_recurring')
    ? normalizeBoolean(payload.is_recurring, 'is_recurring')
    : Boolean(currentPayable.isRecurring);
  const frequency = hasField(payload, 'frequency')
    ? normalizeFrequency(payload.frequency)
    : String(currentPayable.frequency || 'once');
  const recurrenceEndDate = hasField(payload, 'recurrence_end_date')
    ? normalizeOptionalDateOnly(payload.recurrence_end_date, 'recurrence_end_date')
    : currentPayable.recurrenceEndDate
      ? new Date(currentPayable.recurrenceEndDate)
      : null;

  if (!creditorName) {
    throw new HttpError(422, 'creditor_name is required.');
  }

  if (creditorName.length > 100) {
    throw new HttpError(422, 'creditor_name must be at most 100 characters.');
  }

  if (toCents(principalAmount) <= 0) {
    throw new HttpError(422, 'principal_amount must be greater than zero.');
  }

  const currentAmountPaid = normalizeAmount(currentPayable.amountPaid || 0);

  if (toCents(principalAmount) < toCents(currentAmountPaid)) {
    throw new HttpError(422, 'principal_amount must be greater than or equal to amount already paid.');
  }

  if (isRecurring && frequency === 'once') {
    throw new HttpError(422, 'frequency must not be once when is_recurring is true.');
  }

  if (!isRecurring && recurrenceEndDate) {
    throw new HttpError(422, 'recurrence_end_date can only be set when is_recurring is true.');
  }

  if (recurrenceEndDate && recurrenceEndDate < dueDate) {
    throw new HttpError(422, 'recurrence_end_date must be greater than or equal to due_date.');
  }

  const status = normalizeStatusByAmounts(principalAmount, currentAmountPaid);
  const balance = calculateBalance(principalAmount, currentAmountPaid);

  return {
    creditorName,
    description,
    principalAmount,
    amountPaid: currentAmountPaid,
    balance,
    dueDate,
    isRecurring,
    recurrenceEndDate,
    frequency: isRecurring ? frequency : 'once',
    status
  };
}

class PayableService {
  static async listPayables(userId, query = {}) {
    const status = query.status ? String(query.status).toLowerCase() : null;
    const creditorName = query.creditor_name ? String(query.creditor_name).trim() : null;
    const sortBy = normalizeSortField(query.sort_by);

    if (status && !PAYABLE_STATUS_VALUES.includes(status)) {
      throw new HttpError(422, 'status is invalid.');
    }

    const rawRows = await PayableModel.findAllRawByUserId(userId, {
      status,
      creditorName
    });
    const sortedRows = sortRawPayables(rawRows, sortBy);

    return {
      payables: PayableModel.toDTOList(sortedRows),
      summary: summarizePayables(sortedRows)
    };
  }

  static async createPayable(userId, payload) {
    const normalized = normalizeCreateInput(payload);
    const recurrenceDates = generateRecurringDates({
      dueDate: normalized.dueDate,
      frequency: normalized.frequency,
      recurrenceEndDate: normalized.recurrenceEndDate
    });

    const rows = recurrenceDates.map((dueDate) => ({
      userId,
      creditorName: normalized.creditorName,
      description: normalized.description,
      principalAmount: normalized.principalAmount,
      amountPaid: '0.00',
      balance: normalized.principalAmount,
      dueDate,
      isRecurring: normalized.isRecurring,
      recurrenceEndDate: normalized.recurrenceEndDate,
      frequency: normalized.frequency,
      status: 'pending'
    }));

    const created = rows.length > 1 ? await PayableModel.createMany(rows) : [await PayableModel.create(rows[0])];

    return {
      payable: created[0],
      recurring_instances_created: created.length
    };
  }

  static async getPayableDetails(userId, payableId) {
    const payable = await PayableModel.findByIdAndUserId(payableId, userId);

    if (!payable) {
      throw new HttpError(404, 'Payable not found.');
    }

    const payments = await PayablePaymentModel.findByPayableIdAndUserId(payableId, userId);

    return {
      payable: {
        ...payable,
        payments
      }
    };
  }

  static async updatePayable(userId, payableId, payload) {
    const currentPayable = await PayableModel.findRawByIdAndUserId(payableId, userId);

    if (!currentPayable) {
      throw new HttpError(404, 'Payable not found.');
    }

    const normalized = normalizeUpdateInput(payload, currentPayable);
    const updated = await PayableModel.updateByIdAndUserId(payableId, userId, normalized);

    if (!updated) {
      throw new HttpError(404, 'Payable not found.');
    }

    return {
      payable: updated
    };
  }

  static async recordPayment(userId, payableId, payload) {
    const payable = await PayableModel.findRawByIdAndUserId(payableId, userId);

    if (!payable) {
      throw new HttpError(404, 'Payable not found.');
    }

    const amountPaid = normalizeAmount(payload.amount_paid);

    if (toCents(amountPaid) <= 0) {
      throw new HttpError(422, 'amount_paid must be greater than zero.');
    }

    if (toCents(amountPaid) > toCents(payable.balance || 0)) {
      throw new HttpError(422, 'amount_paid must not exceed remaining balance.');
    }

    const paymentDate = payload.payment_date
      ? parseDateOnly(payload.payment_date, 'payment_date')
      : new Date();
    const paymentMethod = normalizePaymentMethod(payload.payment_method);
    const notes = payload.notes ? String(payload.notes).trim() : '';

    await PayablePaymentModel.create({
      payableId,
      userId,
      amountPaid,
      paymentDate,
      paymentMethod,
      notes
    });

    const newAmountPaid = addAmounts(payable.amountPaid || 0, amountPaid);
    const principalAmount = normalizeAmount(payable.principalAmount || 0);
    const newBalance = calculateBalance(principalAmount, newAmountPaid);
    const nextStatus = normalizeStatusByAmounts(principalAmount, newAmountPaid);

    const updated = await PayableModel.updateByIdAndUserId(payableId, userId, {
      creditorName: payable.creditorName,
      description: payable.description || '',
      principalAmount,
      amountPaid: newAmountPaid,
      balance: newBalance,
      dueDate: new Date(payable.dueDate),
      isRecurring: Boolean(payable.isRecurring),
      recurrenceEndDate: payable.recurrenceEndDate ? new Date(payable.recurrenceEndDate) : null,
      frequency: payable.frequency,
      status: nextStatus
    });

    return {
      payable: updated
    };
  }

  static async getPaymentHistory(userId, payableId) {
    const payable = await PayableModel.findByIdAndUserId(payableId, userId);

    if (!payable) {
      throw new HttpError(404, 'Payable not found.');
    }

    const payments = await PayablePaymentModel.findByPayableIdAndUserId(payableId, userId);
    return { payments };
  }

  static async deletePayable(userId, payableId) {
    const payable = await PayableModel.findRawByIdAndUserId(payableId, userId);

    if (!payable) {
      throw new HttpError(404, 'Payable not found.');
    }

    if (String(payable.status) !== 'pending' || toCents(payable.amountPaid || 0) > 0) {
      throw new HttpError(409, 'Only pending payables with zero payments can be deleted.');
    }

    await PayablePaymentModel.deleteByPayableIdAndUserId(payableId, userId);
    await PayableModel.deleteByIdAndUserId(payableId, userId);
  }
}

module.exports = PayableService;
