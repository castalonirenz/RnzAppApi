const SharedExpenseModel = require('../models/sharedExpenseModel');
const HttpError = require('../utils/httpError');
const { normalizeAmount } = require('../utils/decimal');
const { buildPdfFromLines } = require('../utils/pdf');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const DEFAULT_OFFSET = 0;

const SORT_FIELD_MAP = {
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  title: 'title'
};

function sanitizeParticipants(participants) {
  if (!Array.isArray(participants)) {
    return [];
  }

  return participants
    .map((participant) => String(participant || '').trim())
    .filter((participant) => participant.length > 0);
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

function buildCsvExport(docs) {
  const rows = [
    ['Title', 'Amount', 'Description', 'Participants', 'Share Per Person', 'Date'],
    ...docs.map((doc) => [
      doc.title,
      Number(doc.amount).toFixed(2),
      doc.description || '',
      (doc.participants || []).join(', '),
      Number(doc.sharePerPerson).toFixed(2),
      toDateStamp(doc.createdAt)
    ])
  ];

  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function buildPdfExportLines(docs) {
  const lines = [
    'Shared Expenses Report',
    `Generated At: ${new Date().toISOString()}`,
    `Total Expenses: ${docs.length}`,
    `Total Amount: ${docs.reduce((sum, doc) => sum + Number(doc.amount || 0), 0).toFixed(2)}`,
    ''
  ];

  const maxRows = 35;
  const selected = docs.slice(0, maxRows);

  for (const doc of selected) {
    lines.push(
      `${toDateStamp(doc.createdAt)} | ${doc.title} | ${Number(doc.amount).toFixed(2)} | Share: ${Number(
        doc.sharePerPerson
      ).toFixed(2)}`
    );
  }

  if (docs.length > maxRows) {
    lines.push(`... ${docs.length - maxRows} more shared expense(s) not shown`);
  }

  return lines;
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
    const title = String(payload.title || '').trim();
    const amount = normalizeAmount(payload.amount);
    const description = payload.description ? String(payload.description).trim() : '';
    const participants = sanitizeParticipants(payload.participants);

    if (!title) {
      throw new HttpError(422, 'title is required.');
    }

    if (participants.length < 1) {
      throw new HttpError(422, 'participants must contain at least one participant.');
    }

    if (await SharedExpenseModel.existsByTitle(userId, title)) {
      throw new HttpError(409, 'A shared expense with this title already exists.');
    }

    const sharePerPerson = calculateSharePerPerson(amount, participants.length);

    try {
      return await SharedExpenseModel.create({
        userId,
        title,
        amount,
        description,
        participants,
        sharePerPerson
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

    const title = String(payload.title || '').trim();
    const amount = normalizeAmount(payload.amount);
    const description = payload.description ? String(payload.description).trim() : '';
    const participants = sanitizeParticipants(payload.participants);

    if (!title) {
      throw new HttpError(422, 'title is required.');
    }

    if (participants.length < 1) {
      throw new HttpError(422, 'participants must contain at least one participant.');
    }

    if (await SharedExpenseModel.existsByTitle(userId, title, sharedExpenseId)) {
      throw new HttpError(409, 'A shared expense with this title already exists.');
    }

    const sharePerPerson = calculateSharePerPerson(amount, participants.length);

    try {
      const updated = await SharedExpenseModel.updateByIdAndUserId(sharedExpenseId, userId, {
        title,
        amount,
        description,
        participants,
        sharePerPerson
      });

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

    const totalExpenses = docs.length;
    const totalAmount = docs.reduce((sum, doc) => sum + Number(doc.amount || 0), 0);
    const averageAmount = totalExpenses > 0 ? totalAmount / totalExpenses : 0;
    const participantSummary = {};

    for (const doc of docs) {
      const share = Number(doc.sharePerPerson || calculateSharePerPerson(doc.amount, doc.participants.length));

      for (const participant of doc.participants || []) {
        if (!participantSummary[participant]) {
          participantSummary[participant] = {
            count: 0,
            total_share: 0
          };
        }

        participantSummary[participant].count += 1;
        participantSummary[participant].total_share += share;
      }
    }

    for (const participant of Object.keys(participantSummary)) {
      participantSummary[participant].total_share = Number(
        normalizeAmount(participantSummary[participant].total_share)
      );
    }

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
      const share = Number(doc.sharePerPerson || calculateSharePerPerson(doc.amount, doc.participants.length));

      for (const participant of doc.participants || []) {
        if (!settlementMap[participant]) {
          settlementMap[participant] = {
            amount: 0,
            expenses: []
          };
        }

        settlementMap[participant].amount += share;
        settlementMap[participant].expenses.push({
          title: doc.title,
          share: Number(normalizeAmount(share))
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
    const dateStamp = toDateStamp(new Date());
    const filename = `shared-expenses-${dateStamp}.${normalizedFormat}`;

    if (normalizedFormat === 'csv') {
      const csv = buildCsvExport(docs);
      return {
        filename,
        mimeType: 'text/csv',
        content: Buffer.from(csv, 'utf8')
      };
    }

    const lines = buildPdfExportLines(docs);
    return {
      filename,
      mimeType: 'application/pdf',
      content: buildPdfFromLines(lines)
    };
  }
}

module.exports = SharedExpenseService;
