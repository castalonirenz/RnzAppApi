const express = require('express');
const { body, param, query } = require('express-validator');
const budgetController = require('../controllers/budgetController');
const authMiddleware = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');
const { SUPPORTED_PERIOD_TYPES, buildPeriodTypeValidationMessage } = require('../utils/periodTypes');

const router = express.Router();
const periodTypeValidationMessage = buildPeriodTypeValidationMessage('period_type');

router.use(authMiddleware);

router.get('/budgets', budgetController.listBudgets);

router.post(
  '/budgets',
  [
    body('name').trim().notEmpty().withMessage('name is required.'),
    body('amount_limit').isFloat({ gt: 0 }).withMessage('amount_limit must be greater than zero.'),
    body('period_type')
      .trim()
      .isIn(SUPPORTED_PERIOD_TYPES)
      .withMessage(periodTypeValidationMessage)
  ],
  validateRequest,
  budgetController.createBudget
);

router.patch(
  '/budgets/:id',
  [
    param('id').isMongoId().withMessage('Budget id must be a valid Mongo ObjectId.'),
    body('name').optional().trim().notEmpty().withMessage('name is required.'),
    body('amount_limit').optional().isFloat({ gt: 0 }).withMessage('amount_limit must be greater than zero.'),
    body('period_type')
      .optional()
      .trim()
      .isIn(SUPPORTED_PERIOD_TYPES)
      .withMessage(periodTypeValidationMessage),
    body('start_date').optional().isISO8601().withMessage('start_date must be a valid ISO date.'),
    body('end_date').optional({ nullable: true }).isISO8601().withMessage('end_date must be a valid ISO date.'),
    body().custom((_, { req }) => {
      const updatableFields = ['name', 'amount_limit', 'period_type', 'start_date', 'end_date'];
      const hasUpdatableField = updatableFields.some((field) => Object.prototype.hasOwnProperty.call(req.body, field));

      if (!hasUpdatableField) {
        throw new Error('At least one updatable field is required.');
      }

      return true;
    })
  ],
  validateRequest,
  budgetController.updateBudget
);

router.delete(
  '/budgets/:id',
  [param('id').isMongoId().withMessage('Budget id must be a valid Mongo ObjectId.')],
  validateRequest,
  budgetController.deleteBudget
);

router.get(
  '/budgets/:id/export',
  [
    param('id').isMongoId().withMessage('Budget id must be a valid Mongo ObjectId.'),
    query('format').notEmpty().isIn(['csv', 'pdf']).withMessage('format must be csv or pdf.')
  ],
  validateRequest,
  budgetController.exportBudget
);

module.exports = router;
