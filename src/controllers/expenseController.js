const asyncHandler = require('../utils/asyncHandler');
const ExpenseService = require('../services/expenseService');

exports.listExpenses = asyncHandler(async (req, res) => {
  const expenses = await ExpenseService.listExpenses(req.user.id);
  res.json({ success: true, data: expenses });
});

exports.createExpense = asyncHandler(async (req, res) => {
  const expense = await ExpenseService.createExpense(req.user.id, req.body);
  res.status(201).json({
    success: true,
    message: 'Expense created successfully.',
    data: expense
  });
});

exports.deleteExpense = asyncHandler(async (req, res) => {
  await ExpenseService.deleteExpense(req.user.id, req.params.id);
  res.status(204).send();
});

exports.summary = asyncHandler(async (req, res) => {
  const rows = await ExpenseService.getSummary(req.user.id, req.query.period);
  res.json({ success: true, data: rows });
});
