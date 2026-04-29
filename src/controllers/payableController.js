const asyncHandler = require('../utils/asyncHandler');
const PayableService = require('../services/payableService');

exports.listPayables = asyncHandler(async (req, res) => {
  const result = await PayableService.listPayables(req.user.id, req.query);

  res.json({
    success: true,
    status: 'success',
    message: 'Payables retrieved successfully',
    data: result
  });
});

exports.createPayable = asyncHandler(async (req, res) => {
  const result = await PayableService.createPayable(req.user.id, req.body);

  res.status(201).json({
    success: true,
    status: 'success',
    message: 'Payable created successfully',
    data: result
  });
});

exports.getPayableDetails = asyncHandler(async (req, res) => {
  const result = await PayableService.getPayableDetails(req.user.id, req.params.id);

  res.json({
    success: true,
    status: 'success',
    data: result
  });
});

exports.updatePayable = asyncHandler(async (req, res) => {
  const result = await PayableService.updatePayable(req.user.id, req.params.id, req.body);

  res.json({
    success: true,
    status: 'success',
    message: 'Payable updated successfully',
    data: result
  });
});

exports.recordPayment = asyncHandler(async (req, res) => {
  const result = await PayableService.recordPayment(req.user.id, req.params.id, req.body);

  res.json({
    success: true,
    status: 'success',
    message: 'Payment recorded successfully',
    data: result
  });
});

exports.getPaymentHistory = asyncHandler(async (req, res) => {
  const result = await PayableService.getPaymentHistory(req.user.id, req.params.id);

  res.json({
    success: true,
    status: 'success',
    data: result
  });
});

exports.deletePayable = asyncHandler(async (req, res) => {
  await PayableService.deletePayable(req.user.id, req.params.id);

  res.json({
    success: true,
    status: 'success',
    message: 'Payable deleted successfully'
  });
});
