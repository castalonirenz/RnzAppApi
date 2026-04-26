const asyncHandler = require('../utils/asyncHandler');
const AuthService = require('../services/authService');

exports.register = asyncHandler(async (req, res) => {
  const result = await AuthService.register(req.body);

  res.status(201).json({
    success: true,
    status: 'success',
    message: 'User registered successfully.',
    data: result
  });
});

exports.login = asyncHandler(async (req, res) => {
  const result = await AuthService.login(req.body);

  res.json({
    success: true,
    status: 'success',
    message: 'Login successful.',
    data: result
  });
});

exports.logout = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    status: 'success',
    message: 'Logout successful. Remove the token on the client side.'
  });
});

exports.getUser = asyncHandler(async (req, res) => {
  const result = await AuthService.getProfile(req.user.id);

  res.json({
    success: true,
    status: 'success',
    data: result
  });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const result = await AuthService.requestPasswordReset(req.body);

  const payload = {
    success: true,
    status: 'success',
    message: result.message
  };

  if (result.data) {
    payload.data = result.data;
  }

  res.json(payload);
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const result = await AuthService.resetPassword(req.body);

  res.json({
    success: true,
    status: 'success',
    message: result.message
  });
});
