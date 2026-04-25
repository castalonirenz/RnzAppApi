const express = require('express');
const authRoutes = require('./authRoutes');
const loanRoutes = require('./loanRoutes');
const expenseRoutes = require('./expenseRoutes');
const budgetRoutes = require('./budgetRoutes');
const sharedExpenseRoutes = require('./sharedExpenseRoutes');

const router = express.Router();

router.use('/api', authRoutes);
router.use('/api', loanRoutes);
router.use('/api', expenseRoutes);
router.use('/api', budgetRoutes);
router.use('/api', sharedExpenseRoutes);

module.exports = router;
