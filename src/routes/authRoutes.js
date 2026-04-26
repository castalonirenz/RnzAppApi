const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('email').isEmail().withMessage('A valid email is required.'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long.'),
    body('confirm_password')
      .notEmpty()
      .withMessage('confirm_password is required.')
      .custom((value, { req }) => value === req.body.password)
      .withMessage('Password and confirm_password must match.')
  ],
  validateRequest,
  authController.register
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('A valid email is required.'),
    body('password').notEmpty().withMessage('Password is required.')
  ],
  validateRequest,
  authController.login
);

router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('A valid email is required.')],
  validateRequest,
  authController.forgotPassword
);

router.post(
  '/reset-password',
  [
    body('token').trim().notEmpty().withMessage('Reset token is required.'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long.'),
    body('confirm_password')
      .notEmpty()
      .withMessage('confirm_password is required.')
      .custom((value, { req }) => value === req.body.password)
      .withMessage('Password and confirm_password must match.')
  ],
  validateRequest,
  authController.resetPassword
);

router.post('/logout', authMiddleware, authController.logout);
router.get('/user', authMiddleware, authController.getUser);

module.exports = router;
