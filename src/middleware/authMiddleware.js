const jwt = require('jsonwebtoken');
const env = require('../config/env');
const UserModel = require('../models/userModel');
const HttpError = require('../utils/httpError');

module.exports = function authMiddleware(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return next(new HttpError(401, 'Authentication required.'));
  }

  const token = authorization.split(' ')[1];

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = UserModel.findById(payload.sub);

    if (!user) {
      return next(new HttpError(401, 'Invalid authentication token.'));
    }

    req.user = user;
    req.token = token;
    return next();
  } catch (error) {
    return next(new HttpError(401, 'Invalid or expired authentication token.'));
  }
};
