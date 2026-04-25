function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    status: 'error',
    message: 'Route not found.'
  });
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;

  if (process.env.NODE_ENV !== 'test') {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    status: 'error',
    message: err.message || 'Internal server error.',
    ...(err.details ? { details: err.details } : {})
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
