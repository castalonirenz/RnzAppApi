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
    body('expense_date').optional().isISO8601().withMessage('expense_date must be a valid ISO date.'),
    body('budget_id').optional({ nullable: true }).isMongoId().withMessage('budget_id must be a valid Mongo ObjectId.')
  ],
  validateRequest,
  expenseController.createExpense
);

router.patch(
  '/expenses/:id',
  [
    param('id').isMongoId().withMessage('Expense id must be a valid Mongo ObjectId.'),
    body('title').optional().trim().notEmpty().withMessage('Title is required.'),
    body('amount').optional().isFloat({ gt: 0 }).withMessage('Amount must be greater than zero.'),
    body('category').optional().isString().withMessage('Category must be text.'),
    body('notes').optional().isString().withMessage('Notes must be text.'),
    body('expense_date').optional().isISO8601().withMessage('expense_date must be a valid ISO date.'),
    body('budget_id').optional({ nullable: true }).isMongoId().withMessage('budget_id must be a valid Mongo ObjectId.'),
    body().custom((_, { req }) => {
      const updatableFields = ['title', 'amount', 'category', 'notes', 'expense_date', 'budget_id'];
      const hasUpdatableField = updatableFields.some((field) => Object.prototype.hasOwnProperty.call(req.body, field));

      if (!hasUpdatableField) {
        throw new Error('At least one updatable field is required.');
      }

      return true;
    })
  ],
  validateRequest,
  expenseController.updateExpense
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
