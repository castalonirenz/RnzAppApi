const express = require('express');
const { body, param, query } = require('express-validator');
const sharedExpenseController = require('../controllers/sharedExpenseController');
const authMiddleware = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

router.use(authMiddleware);

const sharedExpenseWriteValidationRules = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('title is required.')
    .isLength({ max: 100 })
    .withMessage('title must be at most 100 characters.'),
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than zero.'),
  body('description')
    .optional()
    .isString()
    .withMessage('description must be text.')
    .isLength({ max: 500 })
    .withMessage('description must be at most 500 characters.'),
  body('participants')
    .isArray({ min: 1, max: 20 })
    .withMessage('participants must be an array with 1 to 20 items.'),
  body('participants.*')
    .isString()
    .withMessage('each participant must be text.')
    .trim()
    .notEmpty()
    .withMessage('participant names cannot be empty.')
    .isLength({ max: 100 })
    .withMessage('participant names must be at most 100 characters.')
];

router.get(
  '/expenses/shared',
  [
    query('limit').optional().isInt({ gt: 0 }).withMessage('limit must be a positive integer.'),
    query('offset').optional().isInt({ min: 0 }).withMessage('offset must be zero or greater.'),
    query('sort')
      .optional()
      .custom((value) => /^-?(created_at|updated_at|title)$/.test(String(value)))
      .withMessage('sort must be one of created_at, -created_at, updated_at, -updated_at, title, -title.')
  ],
  validateRequest,
  sharedExpenseController.listSharedExpenses
);

router.get('/expenses/shared/summary', sharedExpenseController.getSharedExpenseSummary);

router.get('/expenses/shared/settlement', sharedExpenseController.getSettlementReport);

router.get(
  '/expenses/shared/export',
  [query('format').notEmpty().isIn(['csv', 'pdf']).withMessage('format must be csv or pdf.')],
  validateRequest,
  sharedExpenseController.exportSharedExpenses
);

router.get(
  '/expenses/shared/:id',
  [param('id').isMongoId().withMessage('Shared expense id must be a valid Mongo ObjectId.')],
  validateRequest,
  sharedExpenseController.getSharedExpense
);

router.post(
  '/expenses/shared',
  sharedExpenseWriteValidationRules,
  validateRequest,
  sharedExpenseController.createSharedExpense
);

router.put(
  '/expenses/shared/:id',
  [
    param('id').isMongoId().withMessage('Shared expense id must be a valid Mongo ObjectId.'),
    ...sharedExpenseWriteValidationRules
  ],
  validateRequest,
  sharedExpenseController.updateSharedExpense
);

router.delete(
  '/expenses/shared/:id',
  [param('id').isMongoId().withMessage('Shared expense id must be a valid Mongo ObjectId.')],
  validateRequest,
  sharedExpenseController.deleteSharedExpense
);

module.exports = router;
