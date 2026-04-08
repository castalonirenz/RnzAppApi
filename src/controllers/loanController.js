const asyncHandler = require('../utils/asyncHandler');
const LoanService = require('../services/loanService');

exports.listLoans = asyncHandler(async (req, res) => {
  const loans = LoanService.listLoans(req.user.id);

  res.json({
    success: true,
    data: loans
  });
});

exports.createLoan = asyncHandler(async (req, res) => {
  const loan = LoanService.createLoan(req.user.id, req.body);

  res.status(201).json({
    success: true,
    message: 'Loan created successfully.',
    data: loan
  });
});

exports.getLoan = asyncHandler(async (req, res) => {
  const loan = LoanService.getLoan(req.user.id, Number(req.params.id));

  res.json({
    success: true,
    data: loan
  });
});

exports.updateLoan = asyncHandler(async (req, res) => {
  const loan = LoanService.updateLoan(req.user.id, Number(req.params.id), req.body);

  res.json({
    success: true,
    message: 'Loan updated successfully.',
    data: loan
  });
});

exports.updateLoanStatus = asyncHandler(async (req, res) => {
  const loan = LoanService.updateStatus(req.user.id, Number(req.params.id), req.body.status);

  res.json({
    success: true,
    message: 'Loan status updated successfully.',
    data: loan
  });
});

exports.deleteLoan = asyncHandler(async (req, res) => {
  LoanService.deleteLoan(req.user.id, Number(req.params.id));

  res.status(204).send();
});

exports.addPayment = asyncHandler(async (req, res) => {
  const result = LoanService.addPayment(req.user.id, Number(req.params.id), req.body.amount);

  res.status(201).json({
    success: true,
    message: 'Payment recorded successfully.',
    data: result
  });
});

exports.getLoanHistory = asyncHandler(async (req, res) => {
  const result = LoanService.getLoanHistory(req.user.id, Number(req.params.id));

  res.json({
    success: true,
    data: result
  });
});
