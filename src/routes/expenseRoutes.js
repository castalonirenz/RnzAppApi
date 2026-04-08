const express = require('express');
const { body, param, query } = require('express-validator');
const expenseController = require('../controllers/expenseController');
const authMiddleware = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

router.use(authMiddleware);

router.get('/expenses', expenseController.listExpenses);

router.post(
  '/expenses',
  [
    body('title').trim().notEmpty().withMessage('Title is required.'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than zero.'),
    body('category').optional().isString().withMessage('Category must be text.'),
    body('notes').optional().isString().withMessage('Notes must be text.'),
    body('expense_date').optional().isISO8601().withMessage('expense_date must be a valid ISO date.')
  ],
  validateRequest,
  expenseController.createExpense
);

router.delete(
  '/expenses/:id',
  [param('id').isMongoId().withMessage('Expense id must be a valid Mongo ObjectId.')],
  validateRequest,
  expenseController.deleteExpense
);

router.get(
  '/expenses/summary',
  [query('period').optional().isIn(['daily', 'monthly', 'yearly']).withMessage('Invalid period.')],
  validateRequest,
  expenseController.summary
);

module.exports = router;
