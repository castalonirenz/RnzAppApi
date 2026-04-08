const app = require('../src/app');
const { connectDatabase } = require('../src/config/database');

module.exports = async (req, res) => {
  try {
    await connectDatabase();
    return app(req, res);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Database connection failed.',
      details: [error.message]
    });
  }
};
