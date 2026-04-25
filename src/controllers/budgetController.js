const asyncHandler = require('../utils/asyncHandler');
const BudgetService = require('../services/budgetService');

exports.listBudgets = asyncHandler(async (req, res) => {
  const budgets = await BudgetService.listBudgets(req.user.id);
  res.json({ success: true, status: 'success', data: budgets });
});

exports.createBudget = asyncHandler(async (req, res) => {
  const budget = await BudgetService.createBudget(req.user.id, req.body);
  res.status(201).json({
    success: true,
    status: 'success',
    message: 'Budget created successfully.',
    data: budget
  });
});

exports.updateBudget = asyncHandler(async (req, res) => {
  const budget = await BudgetService.updateBudget(req.user.id, req.params.id, req.body);
  res.json({
    success: true,
    status: 'success',
    message: 'Budget updated successfully.',
    data: budget
  });
});

exports.deleteBudget = asyncHandler(async (req, res) => {
  await BudgetService.deleteBudget(req.user.id, req.params.id);
  res.json({
    success: true,
    status: 'success',
    message: 'Budget deleted successfully.'
  });
});

exports.exportBudget = asyncHandler(async (req, res) => {
  const report = await BudgetService.exportBudget(req.user.id, req.params.id, req.query.format);

  res.setHeader('Content-Type', report.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
  res.setHeader('Content-Length', report.content.length);
  res.status(200).send(report.content);
});
