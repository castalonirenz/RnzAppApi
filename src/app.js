const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const { connectDatabase } = require('./config/database');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

const isAllowedVercelPreviewOrigin = (origin) => {
  if (!origin || !env.corsAllowVercelPreview) {
    return false;
  }

  try {
    const { hostname } = new URL(origin);
    return hostname.endsWith('.vercel.app');
  } catch (_error) {
    return false;
  }
};

const corsOptionsDelegate = (req, callback) => {
  const requestOrigin = req.header('Origin');
  const allowAll = env.corsOrigins.includes('*');
  const isExplicitlyAllowed = requestOrigin && env.corsOrigins.includes(requestOrigin);
  const isVercelPreviewAllowed = isAllowedVercelPreviewOrigin(requestOrigin);
  const isAllowed = !requestOrigin || allowAll || isExplicitlyAllowed || isVercelPreviewAllowed;

  callback(null, {
    origin: isAllowed ? requestOrigin || true : false,
    credentials: env.corsCredentials,
    optionsSuccessStatus: 204
  });
};

app.use(cors(corsOptionsDelegate));
app.options('*', cors(corsOptionsDelegate));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'success',
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
