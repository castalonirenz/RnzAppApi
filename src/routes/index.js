const express = require('express');
const authRoutes = require('./authRoutes');
const loanRoutes = require('./loanRoutes');
const expenseRoutes = require('./expenseRoutes');

const router = express.Router();

router.use('/api', authRoutes);
router.use('/api', loanRoutes);
router.use('/api', expenseRoutes);

module.exports = router;
