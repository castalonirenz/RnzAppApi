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
