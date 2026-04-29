const express = require('express');
const { body, param, query } = require('express-validator');
const payableController = require('../controllers/payableController');
const authMiddleware = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');
const {
  PAYABLE_STATUS_VALUES,
  PAYABLE_FREQUENCY_VALUES,
  PAYABLE_PAYMENT_METHOD_VALUES,
  formatList
} = require('../utils/payablesConstants');

const router = express.Router();

const frequencyListMessage = `frequency must be ${formatList(PAYABLE_FREQUENCY_VALUES)}.`;
const statusListMessage = `status must be ${formatList(PAYABLE_STATUS_VALUES)}.`;
const paymentMethodListMessage = `payment_method must be ${formatList(PAYABLE_PAYMENT_METHOD_VALUES)}.`;
const sortByValues = Object.freeze(['due_date', 'amount_paid', 'created_at']);
const sortByListMessage = `sort_by must be ${formatList(sortByValues)}.`;
const updateableFields = Object.freeze([
  'creditor_name',
  'description',
  'principal_amount',
  'due_date',
  'is_recurring',
  'frequency',
  'recurrence_end_date'
]);

router.use(authMiddleware);

router.get(
  '/payables',
  [
    query('status').optional().trim().isIn(PAYABLE_STATUS_VALUES).withMessage(statusListMessage),
    query('creditor_name').optional().isString().withMessage('creditor_name must be text.'),
    query('sort_by').optional().trim().isIn(sortByValues).withMessage(sortByListMessage)
  ],
  validateRequest,
  payableController.listPayables
);

router.post(
  '/payables',
  [
    body('creditor_name')
      .trim()
      .notEmpty()
      .withMessage('creditor_name is required.')
      .isLength({ max: 100 })
      .withMessage('creditor_name must be at most 100 characters.'),
    body('description')
      .optional()
      .isString()
      .withMessage('description must be text.')
      .isLength({ max: 500 })
      .withMessage('description must be at most 500 characters.'),
    body('principal_amount')
      .isFloat({ gt: 0 })
      .withMessage('principal_amount must be greater than zero.'),
    body('due_date').isISO8601().withMessage('due_date must be a valid ISO date.'),
    body('is_recurring').optional().isBoolean().withMessage('is_recurring must be a boolean value.'),
    body('frequency').optional().trim().isIn(PAYABLE_FREQUENCY_VALUES).withMessage(frequencyListMessage),
    body('recurrence_end_date')
      .optional({ nullable: true })
      .isISO8601()
      .withMessage('recurrence_end_date must be a valid ISO date.'),
    body().custom((_, { req }) => {
      if (req.body?.is_recurring === true && !Object.prototype.hasOwnProperty.call(req.body, 'frequency')) {
        throw new Error('frequency is required when is_recurring is true.');
      }

      if (req.body?.is_recurring === true && String(req.body?.frequency || '').toLowerCase() === 'once') {
        throw new Error('frequency must not be once when is_recurring is true.');
      }

      return true;
    })
  ],
  validateRequest,
  payableController.createPayable
);

router.get(
  '/payables/:id',
  [param('id').isMongoId().withMessage('Payable id must be a valid Mongo ObjectId.')],
  validateRequest,
  payableController.getPayableDetails
);

router.put(
  '/payables/:id',
  [
    param('id').isMongoId().withMessage('Payable id must be a valid Mongo ObjectId.'),
    body('creditor_name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('creditor_name is required.')
      .isLength({ max: 100 })
      .withMessage('creditor_name must be at most 100 characters.'),
    body('description')
      .optional()
      .isString()
      .withMessage('description must be text.')
      .isLength({ max: 500 })
      .withMessage('description must be at most 500 characters.'),
    body('principal_amount')
      .optional()
      .isFloat({ gt: 0 })
      .withMessage('principal_amount must be greater than zero.'),
    body('due_date').optional().isISO8601().withMessage('due_date must be a valid ISO date.'),
    body('is_recurring').optional().isBoolean().withMessage('is_recurring must be a boolean value.'),
    body('frequency').optional().trim().isIn(PAYABLE_FREQUENCY_VALUES).withMessage(frequencyListMessage),
    body('recurrence_end_date')
      .optional({ nullable: true })
      .isISO8601()
      .withMessage('recurrence_end_date must be a valid ISO date.'),
    body().custom((_, { req }) => {
      const hasUpdatableField = updateableFields.some((field) =>
        Object.prototype.hasOwnProperty.call(req.body, field)
      );

      if (!hasUpdatableField) {
        throw new Error('At least one updatable field is required.');
      }

      if (req.body?.is_recurring === true && String(req.body?.frequency || '').toLowerCase() === 'once') {
        throw new Error('frequency must not be once when is_recurring is true.');
      }

      return true;
    })
  ],
  validateRequest,
  payableController.updatePayable
);

router.post(
  '/payables/:id/payment',
  [
    param('id').isMongoId().withMessage('Payable id must be a valid Mongo ObjectId.'),
    body('amount_paid').isFloat({ gt: 0 }).withMessage('amount_paid must be greater than zero.'),
    body('payment_date').optional().isISO8601().withMessage('payment_date must be a valid ISO date.'),
    body('payment_method').optional().trim().isIn(PAYABLE_PAYMENT_METHOD_VALUES).withMessage(paymentMethodListMessage),
    body('notes')
      .optional()
      .isString()
      .withMessage('notes must be text.')
      .isLength({ max: 500 })
      .withMessage('notes must be at most 500 characters.')
  ],
  validateRequest,
  payableController.recordPayment
);

router.get(
  '/payables/:id/history',
  [param('id').isMongoId().withMessage('Payable id must be a valid Mongo ObjectId.')],
  validateRequest,
  payableController.getPaymentHistory
);

router.delete(
  '/payables/:id',
  [param('id').isMongoId().withMessage('Payable id must be a valid Mongo ObjectId.')],
  validateRequest,
  payableController.deletePayable
);

module.exports = router;
