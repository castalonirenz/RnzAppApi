const { validationResult } = require('express-validator');
const HttpError = require('../utils/httpError');

module.exports = function validateRequest(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return next(new HttpError(422, 'Validation failed.', errors.array()));
  }

  return next();
};
