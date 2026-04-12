const asyncHandler = require('../utils/asyncHandler');
const LoanService = require('../services/loanService');

exports.listLoans = asyncHandler(async (req, res) => {
  const loans = await LoanService.listLoans(req.user.id);

  res.json({
    success: true,
    data: loans
  });
});

exports.createLoan = asyncHandler(async (req, res) => {
  const loan = await LoanService.createLoan(req.user.id, req.body);

  res.status(201).json({
    success: true,
    message: 'Loan created successfully.',
    data: loan
  });
});

exports.getLoan = asyncHandler(async (req, res) => {
  const loan = await LoanService.getLoan(req.user.id, req.params.id);

  res.json({
    success: true,
    data: loan
  });
});

exports.updateLoan = asyncHandler(async (req, res) => {
  const loan = await LoanService.updateLoan(req.user.id, req.params.id, req.body);

  res.json({
    success: true,
    message: 'Loan updated successfully.',
    data: loan
  });
});

exports.updateLoanStatus = asyncHandler(async (req, res) => {
  const loan = await LoanService.updateStatus(req.user.id, req.params.id, req.body.status, req.body.releaseDate);

  res.json({
    success: true,
    message: 'Loan status updated successfully.',
    data: loan
  });
});

exports.deleteLoan = asyncHandler(async (req, res) => {
  await LoanService.deleteLoan(req.user.id, req.params.id);

  res.status(204).send();
});

exports.addPayment = asyncHandler(async (req, res) => {
  const result = await LoanService.addPayment(
    req.user.id,
    req.params.id,
    req.body.amount,
    req.body.paid_at
  );

  res.status(201).json({
    success: true,
    message: 'Payment recorded successfully.',
    data: result
  });
});

exports.getLoanHistory = asyncHandler(async (req, res) => {
  const result = await LoanService.getLoanHistory(req.user.id, req.params.id);

  res.json({
    success: true,
    data: result.history
  });
});
