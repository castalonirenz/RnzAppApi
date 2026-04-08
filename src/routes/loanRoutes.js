const express = require('express');
const { body, param } = require('express-validator');
const loanController = require('../controllers/loanController');
const authMiddleware = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

const loanValidationRules = [
  body('borrower_name').trim().notEmpty().withMessage('Borrower name is required.'),
  body('borrower_contact').optional().isString().withMessage('Borrower contact must be text.'),
  body('borrower_address').optional().isString().withMessage('Borrower address must be text.'),
  body('principal').isFloat({ gt: 0 }).withMessage('Principal must be greater than zero.'),
  body('interest_rate').isFloat({ min: 0 }).withMessage('Interest rate must be zero or greater.'),
  body('interest_period')
    .optional()
    .isIn(['month', 'year', 'monthly', 'annum'])
    .withMessage('Interest period must be month or year.'),
  body('duration_months').isInt({ gt: 0 }).withMessage('Duration must be a positive integer.')
];

router.use(authMiddleware);

router.get('/loans', loanController.listLoans);

router.post('/loans', loanValidationRules, validateRequest, loanController.createLoan);

router.get(
  '/loans/:id',
  [param('id').isMongoId().withMessage('Loan id must be a valid Mongo ObjectId.')],
  validateRequest,
  loanController.getLoan
);

router.put(
  '/loans/:id',
  [
    param('id').isMongoId().withMessage('Loan id must be a valid Mongo ObjectId.'),
    ...loanValidationRules
  ],
  validateRequest,
  loanController.updateLoan
);

router.patch(
  '/loans/:id/status',
  [
    param('id').isMongoId().withMessage('Loan id must be a valid Mongo ObjectId.'),
    body('status')
      .isIn(['pending', 'ongoing', 'completed'])
      .withMessage('Status must be pending, ongoing, or completed.')
  ],
  validateRequest,
  loanController.updateLoanStatus
);

router.delete(
  '/loans/:id',
  [param('id').isMongoId().withMessage('Loan id must be a valid Mongo ObjectId.')],
  validateRequest,
  loanController.deleteLoan
);

router.post(
  '/loans/:id/payments',
  [
    param('id').isMongoId().withMessage('Loan id must be a valid Mongo ObjectId.'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than zero.'),
    body('paid_at').optional().isISO8601().withMessage('paid_at must be a valid ISO date.')
  ],
  validateRequest,
  loanController.addPayment
);

router.get(
  '/loans/:id/history',
  [param('id').isMongoId().withMessage('Loan id must be a valid Mongo ObjectId.')],
  validateRequest,
  loanController.getLoanHistory
);

module.exports = router;
