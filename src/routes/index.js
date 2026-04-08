const express = require('express');
const authRoutes = require('./authRoutes');
const loanRoutes = require('./loanRoutes');

const router = express.Router();

router.use('/api', authRoutes);
router.use('/api', loanRoutes);

module.exports = router;
