const asyncHandler = require('../utils/asyncHandler');
const SharedExpenseService = require('../services/sharedExpenseService');

function sendSuccess(res, data, options = {}) {
  const payload = {
    success: true,
    status: 'success',
    data
  };

  if (options.message) {
    payload.message = options.message;
  }

  return res.status(options.statusCode || 200).json(payload);
}

exports.listSharedExpenses = asyncHandler(async (req, res) => {
  const { rows, total } = await SharedExpenseService.listSharedExpenses(req.user.id, req.query);

  res.setHeader('X-Total-Count', String(total));
  return sendSuccess(res, rows);
});

exports.getSharedExpense = asyncHandler(async (req, res) => {
  const expense = await SharedExpenseService.getSharedExpense(req.user.id, req.params.id);
  return sendSuccess(res, expense);
});

exports.createSharedExpense = asyncHandler(async (req, res) => {
  const expense = await SharedExpenseService.createSharedExpense(req.user.id, req.body);
  return sendSuccess(res, expense, { statusCode: 201 });
});

exports.updateSharedExpense = asyncHandler(async (req, res) => {
  const expense = await SharedExpenseService.updateSharedExpense(req.user.id, req.params.id, req.body);
  return sendSuccess(res, expense);
});

exports.deleteSharedExpense = asyncHandler(async (req, res) => {
  const result = await SharedExpenseService.deleteSharedExpense(req.user.id, req.params.id);
  return sendSuccess(res, result, { message: 'Expense deleted successfully' });
});

exports.getSharedExpenseSummary = asyncHandler(async (req, res) => {
  const summary = await SharedExpenseService.getSharedExpenseSummary(req.user.id);
  return sendSuccess(res, summary);
});

exports.getSettlementReport = asyncHandler(async (req, res) => {
  const report = await SharedExpenseService.getSettlementReport(req.user.id);
  return sendSuccess(res, report);
});

exports.exportSharedExpenses = asyncHandler(async (req, res) => {
  const report = await SharedExpenseService.exportSharedExpenses(req.user.id, req.query.format);

  res.setHeader('Content-Type', report.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
  res.setHeader('Content-Length', report.content.length);
  return res.status(200).send(report.content);
});
