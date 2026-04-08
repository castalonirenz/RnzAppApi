const express = require('express');
const { body, param } = require('express-validator');
const loanController = require('../controllers/loanController');
const authMiddleware = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

const loanValidationRules = [
  body('borrowerName').trim().notEmpty().withMessage('Borrower name is required.'),
  body('principal').isFloat({ gt: 0 }).withMessage('Principal must be greater than zero.'),
  body('interestRate').isFloat({ min: 0 }).withMessage('Interest rate must be zero or greater.'),
  body('durationMonths').isInt({ gt: 0 }).withMessage('Duration must be a positive integer.')
];

router.use(authMiddleware);

router.get('/loans', loanController.listLoans);

router.post('/loans', loanValidationRules, validateRequest, loanController.createLoan);

router.get(
  '/loans/:id',
  [param('id').isInt({ gt: 0 }).withMessage('Loan id must be a positive integer.')],
  validateRequest,
  loanController.getLoan
);

router.put(
  '/loans/:id',
  [
    param('id').isInt({ gt: 0 }).withMessage('Loan id must be a positive integer.'),
    ...loanValidationRules
  ],
  validateRequest,
  loanController.updateLoan
);

router.patch(
  '/loans/:id/status',
  [
    param('id').isInt({ gt: 0 }).withMessage('Loan id must be a positive integer.'),
    body('status')
      .isIn(['Pending', 'Ongoing', 'Completed'])
      .withMessage('Status must be Pending, Ongoing, or Completed.')
  ],
  validateRequest,
  loanController.updateLoanStatus
);

router.delete(
  '/loans/:id',
  [param('id').isInt({ gt: 0 }).withMessage('Loan id must be a positive integer.')],
  validateRequest,
  loanController.deleteLoan
);

router.post(
  '/loans/:id/payments',
  [
    param('id').isInt({ gt: 0 }).withMessage('Loan id must be a positive integer.'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than zero.')
  ],
  validateRequest,
  loanController.addPayment
);

router.get(
  '/loans/:id/history',
  [param('id').isInt({ gt: 0 }).withMessage('Loan id must be a positive integer.')],
  validateRequest,
  loanController.getLoanHistory
);

module.exports = router;
