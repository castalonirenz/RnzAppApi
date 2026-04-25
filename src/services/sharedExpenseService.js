const SharedExpenseModel = require('../models/sharedExpenseModel');
const HttpError = require('../utils/httpError');
const { normalizeAmount, toCents, fromCents } = require('../utils/decimal');
const { buildPdfFromLines } = require('../utils/pdf');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const DEFAULT_OFFSET = 0;
const ALLOWED_SPLIT_MODES = ['equal', 'custom'];
const SHARE_SUM_TOLERANCE_CENTS = 1;

const SORT_FIELD_MAP = {
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  title: 'title'
};

function hasField(payload, field) {
  return Object.prototype.hasOwnProperty.call(payload || {}, field);
}

function sanitizeParticipants(participants) {
  if (!Array.isArray(participants)) {
    return [];
  }

  return participants
    .map((participant) => String(participant || '').trim())
    .filter((participant) => participant.length > 0);
}

function ensureUniqueParticipants(participants) {
  const unique = new Set(participants);

  if (unique.size !== participants.length) {
    throw new HttpError(422, 'participants must be unique.');
  }
}

function normalizeSplitMode(value, fallback = 'equal') {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const mode = String(value).toLowerCase();

  if (!ALLOWED_SPLIT_MODES.includes(mode)) {
    throw new HttpError(422, 'split_mode must be equal or custom.');
  }

  return mode;
}

function normalizeStoredSplitMode(value) {
  try {
    return normalizeSplitMode(value, 'equal');
  } catch (_error) {
    return 'equal';
  }
}

function normalizeParticipantSharesInput(participantShares) {
  if (!Array.isArray(participantShares)) {
    throw new HttpError(422, 'participant_shares must be an array.');
  }

  if (participantShares.length < 1) {
    throw new HttpError(422, 'participant_shares must contain at least one item.');
  }

  return participantShares.map((item) => {
    const name = String(item?.name || '').trim();

    if (!name) {
      throw new HttpError(422, 'participant_shares items must include a non-empty name.');
    }

    if (name.length > 100) {
      throw new HttpError(422, 'participant_shares name must be at most 100 characters.');
    }

    const amount = normalizeAmount(item?.amount);

    if (Number(amount) < 0) {
      throw new HttpError(422, 'participant_shares amount must be zero or greater.');
    }

    return {
      name,
      amount
    };
  });
}

function buildEqualParticipantShares(amount, participants) {
  if (participants.length < 1) {
    return [];
  }

  const totalCents = toCents(amount);
  const baseCents = Math.floor(totalCents / participants.length);
  let remainder = totalCents - baseCents * participants.length;

  return participants.map((participant) => {
    const cents = baseCents + (remainder > 0 ? 1 : 0);

    if (remainder > 0) {
      remainder -= 1;
    }

    return {
      name: participant,
      amount: fromCents(cents)
    };
  });
}

function validateParticipantShares(participants, participantShares, amount) {
  ensureUniqueParticipants(participants);

  const shareNames = participantShares.map((share) => share.name);
  const uniqueShareNames = new Set(shareNames);

  if (uniqueShareNames.size !== shareNames.length) {
    throw new HttpError(422, 'participant_shares names must be unique.');
  }

  if (participantShares.length !== participants.length) {
    throw new HttpError(422, 'participant_shares must match participants exactly.');
  }

  const participantSet = new Set(participants);

  for (const share of participantShares) {
    if (!participantSet.has(share.name)) {
      throw new HttpError(422, 'participant_shares names must match participants exactly.');
    }
  }

  const totalShareCents = participantShares.reduce((sum, share) => sum + toCents(share.amount), 0);
  const amountCents = toCents(amount);

  if (Math.abs(totalShareCents - amountCents) > SHARE_SUM_TOLERANCE_CENTS) {
    throw new HttpError(422, 'Sum of participant shares must equal amount.');
  }
}

function orderSharesByParticipants(participants, participantShares) {
  const shareMap = new Map(participantShares.map((share) => [share.name, share.amount]));
  return participants.map((participant) => ({
    name: participant,
    amount: shareMap.get(participant)
  }));
}

function calculateSharePerPerson(amount, participantCount) {
  if (!participantCount || participantCount < 1) {
    throw new HttpError(422, 'participants must contain at least one participant.');
  }

  return normalizeAmount(Number(amount) / participantCount);
}

function parseSort(sortValue) {
  const raw = String(sortValue || '-created_at').trim();
  const isDescending = raw.startsWith('-');
  const normalizedField = raw.replace(/^-/, '');
  const field = SORT_FIELD_MAP[normalizedField] || 'createdAt';

  return { [field]: isDescending ? -1 : 1, _id: -1 };
}

function resolvePagination({ limit, offset }) {
  const parsedLimit = Number(limit);
  const parsedOffset = Number(offset);

  const safeLimit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(Math.floor(parsedLimit), MAX_LIMIT)
      : DEFAULT_LIMIT;
  const safeOffset =
    Number.isFinite(parsedOffset) && parsedOffset >= 0 ? Math.floor(parsedOffset) : DEFAULT_OFFSET;

  return { limit: safeLimit, offset: safeOffset };
}

function escapeCsv(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function toDateStamp(dateValue) {
  const date = new Date(dateValue);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatParticipantShares(participantShares) {
  return participantShares
    .map((share) => `${share.name}:${Number(share.amount).toFixed(2)}`)
    .join('; ');
}

function buildCsvExport(rows) {
  const csvRows = [
    ['Title', 'Amount', 'Split Mode', 'Participants', 'Participant Shares', 'Created At'],
    ...rows.map((row) => [
      row.title,
      Number(row.amount).toFixed(2),
      row.split_mode,
      (row.participants || []).join(', '),
      formatParticipantShares(row.participant_shares || []),
      row.created_at
    ])
  ];

  return csvRows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function buildPdfExportLines(rows) {
  const lines = [
    'Shared Expenses Report',
    `Generated At: ${new Date().toISOString()}`,
    `Total Expenses: ${rows.length}`,
    `Total Amount: ${rows.reduce((sum, row) => sum + Number(row.amount || 0), 0).toFixed(2)}`,
    ''
  ];

  const maxRows = 30;
  const selected = rows.slice(0, maxRows);

  for (const row of selected) {
    lines.push(
      `${toDateStamp(row.created_at)} | ${row.title} | ${Number(row.amount).toFixed(2)} | ${row.split_mode}`
    );
    lines.push(`Shares: ${formatParticipantShares(row.participant_shares || [])}`);
  }

  if (rows.length > maxRows) {
    lines.push(`... ${rows.length - maxRows} more shared expense(s) not shown`);
  }

  return lines;
}

function normalizeStoredSplitDetails(rawDoc) {
  const participants = sanitizeParticipants(rawDoc?.participants);
  const amount = normalizeAmount(rawDoc?.amount || 0);
  const splitMode = normalizeStoredSplitMode(rawDoc?.splitMode);
  const hasStoredParticipantShares = Array.isArray(rawDoc?.participantShares) && rawDoc.participantShares.length > 0;

  if (!hasStoredParticipantShares || splitMode === 'equal') {
    return {
      participants,
      splitMode: 'equal',
      participantShares: buildEqualParticipantShares(amount, participants)
    };
  }

  try {
    const normalizedShares = normalizeParticipantSharesInput(rawDoc.participantShares);
    validateParticipantShares(participants, normalizedShares, amount);

    return {
      participants,
      splitMode: 'custom',
      participantShares: orderSharesByParticipants(participants, normalizedShares)
    };
  } catch (_error) {
    return {
      participants,
      splitMode: 'equal',
      participantShares: buildEqualParticipantShares(amount, participants)
    };
  }
}

function buildWritePayload(payload) {
  const title = String(payload.title || '').trim();
  const amount = normalizeAmount(payload.amount);
  const description = payload.description ? String(payload.description).trim() : '';
  const participants = sanitizeParticipants(payload.participants);
  const splitMode = hasField(payload, 'split_mode')
    ? normalizeSplitMode(payload.split_mode)
    : 'equal';

  if (!title) {
    throw new HttpError(422, 'title is required.');
  }

  if (participants.length < 1) {
    throw new HttpError(422, 'participants must contain at least one participant.');
  }

  ensureUniqueParticipants(participants);

  const hasParticipantShares = hasField(payload, 'participant_shares') && payload.participant_shares !== null;
  const providedShares = hasParticipantShares ? normalizeParticipantSharesInput(payload.participant_shares) : [];

  if (splitMode === 'custom' && !hasParticipantShares) {
    throw new HttpError(422, 'participant_shares is required when split_mode is custom.');
  }

  if (hasParticipantShares) {
    validateParticipantShares(participants, providedShares, amount);
  }

  const participantShares =
    splitMode === 'equal'
      ? buildEqualParticipantShares(amount, participants)
      : orderSharesByParticipants(participants, providedShares);

  const sharePerPerson = calculateSharePerPerson(amount, participants.length);

  return {
    title,
    amount,
    description,
    participants,
    splitMode,
    participantShares,
    sharePerPerson
  };
}

class SharedExpenseService {
  static async listSharedExpenses(userId, query) {
    const pagination = resolvePagination(query || {});
    const sort = parseSort(query?.sort);
    return SharedExpenseModel.findAllByUserId(userId, {
      ...pagination,
      sort
    });
  }

  static async getSharedExpense(userId, sharedExpenseId) {
    const expense = await SharedExpenseModel.findByIdAndUserId(sharedExpenseId, userId);

    if (!expense) {
      throw new HttpError(404, 'Shared expense not found.');
    }

    return expense;
  }

  static async createSharedExpense(userId, payload) {
    const normalized = buildWritePayload(payload);

    if (await SharedExpenseModel.existsByTitle(userId, normalized.title)) {
      throw new HttpError(409, 'A shared expense with this title already exists.');
    }

    try {
      return await SharedExpenseModel.create({
        userId,
        ...normalized
      });
    } catch (error) {
      if (error && error.code === 11000) {
        throw new HttpError(409, 'A shared expense with this title already exists.');
      }

      throw error;
    }
  }

  static async updateSharedExpense(userId, sharedExpenseId, payload) {
    const existing = await SharedExpenseModel.findRawByIdAndUserId(sharedExpenseId, userId);

    if (!existing) {
      const maybeExisting = await SharedExpenseModel.findRawById(sharedExpenseId);
      throw new HttpError(
        maybeExisting ? 403 : 404,
        maybeExisting ? "You don't have permission to update this expense" : 'Shared expense not found.'
      );
    }

    const normalized = buildWritePayload(payload);

    if (await SharedExpenseModel.existsByTitle(userId, normalized.title, sharedExpenseId)) {
      throw new HttpError(409, 'A shared expense with this title already exists.');
    }

    try {
      const updated = await SharedExpenseModel.updateByIdAndUserId(sharedExpenseId, userId, normalized);

      if (!updated) {
        throw new HttpError(404, 'Shared expense not found.');
      }

      return updated;
    } catch (error) {
      if (error && error.code === 11000) {
        throw new HttpError(409, 'A shared expense with this title already exists.');
      }

      throw error;
    }
  }

  static async deleteSharedExpense(userId, sharedExpenseId) {
    const existing = await SharedExpenseModel.findRawByIdAndUserId(sharedExpenseId, userId);

    if (!existing) {
      const maybeExisting = await SharedExpenseModel.findRawById(sharedExpenseId);
      throw new HttpError(
        maybeExisting ? 403 : 404,
        maybeExisting ? "You don't have permission to delete this expense" : 'Shared expense not found.'
      );
    }

    const deleted = await SharedExpenseModel.softDeleteByIdAndUserId(sharedExpenseId, userId);

    if (!deleted) {
      throw new HttpError(404, 'Shared expense not found.');
    }

    return {
      id: sharedExpenseId
    };
  }

  static async getSharedExpenseSummary(userId) {
    const docs = await SharedExpenseModel.findAllRawByUserId(userId);
    const participantSummary = {};

    for (const doc of docs) {
      const normalizedSplit = normalizeStoredSplitDetails(doc);

      for (const share of normalizedSplit.participantShares) {
        if (!participantSummary[share.name]) {
          participantSummary[share.name] = {
            count: 0,
            total_share: 0
          };
        }

        participantSummary[share.name].count += 1;
        participantSummary[share.name].total_share += Number(share.amount);
      }
    }

    for (const name of Object.keys(participantSummary)) {
      participantSummary[name].total_share = Number(normalizeAmount(participantSummary[name].total_share));
    }

    const totalExpenses = docs.length;
    const totalAmount = docs.reduce((sum, doc) => sum + Number(doc.amount || 0), 0);
    const averageAmount = totalExpenses > 0 ? totalAmount / totalExpenses : 0;

    return {
      total_expenses: totalExpenses,
      total_amount: Number(normalizeAmount(totalAmount)),
      average_amount: Number(normalizeAmount(averageAmount)),
      participant_summary: participantSummary
    };
  }

  static async getSettlementReport(userId) {
    const docs = await SharedExpenseModel.findAllRawByUserId(userId);
    const settlementMap = {};

    for (const doc of docs) {
      const normalizedSplit = normalizeStoredSplitDetails(doc);

      for (const share of normalizedSplit.participantShares) {
        if (!settlementMap[share.name]) {
          settlementMap[share.name] = {
            amount: 0,
            expenses: []
          };
        }

        settlementMap[share.name].amount += Number(share.amount);
        settlementMap[share.name].expenses.push({
          title: doc.title,
          share: Number(normalizeAmount(share.amount))
        });
      }
    }

    const settlements = Object.entries(settlementMap)
      .map(([participant, details]) => ({
        from: participant,
        to: 'You (Creator)',
        amount: Number(normalizeAmount(details.amount)),
        expenses: details.expenses
      }))
      .sort((a, b) => b.amount - a.amount);

    const totalPending = settlements.reduce((sum, entry) => sum + entry.amount, 0);

    return {
      settlements,
      total_pending: Number(normalizeAmount(totalPending))
    };
  }

  static async exportSharedExpenses(userId, format) {
    const normalizedFormat = String(format || '').toLowerCase();

    if (!['csv', 'pdf'].includes(normalizedFormat)) {
      throw new HttpError(400, 'format must be csv or pdf.');
    }

    const docs = await SharedExpenseModel.findAllRawByUserId(userId);
    const rows = docs.map((doc) => {
      const normalizedSplit = normalizeStoredSplitDetails(doc);

      return {
        title: doc.title,
        amount: Number(normalizeAmount(doc.amount || 0)),
        split_mode: normalizedSplit.splitMode,
        participants: normalizedSplit.participants,
        participant_shares: normalizedSplit.participantShares.map((share) => ({
          name: share.name,
          amount: Number(share.amount)
        })),
        created_at: new Date(doc.createdAt).toISOString()
      };
    });
    const dateStamp = toDateStamp(new Date());
    const filename = `shared-expenses-${dateStamp}.${normalizedFormat}`;

    if (normalizedFormat === 'csv') {
      const csv = buildCsvExport(rows);
      return {
        filename,
        mimeType: 'text/csv',
        content: Buffer.from(csv, 'utf8')
      };
    }

    const lines = buildPdfExportLines(rows);
    return {
      filename,
      mimeType: 'application/pdf',
      content: buildPdfFromLines(lines)
    };
  }
}

module.exports = SharedExpenseService;
