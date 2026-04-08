const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes');
const { connectDatabase } = require('./config/database');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'My Borrower API is running.'
  });
});

app.use(async (req, res, next) => {
  try {
    await connectDatabase();
    return next();
  } catch (error) {
    return next(error);
  }
});

app.use(routes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
