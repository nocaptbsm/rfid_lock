require('dotenv').config();

const apiKeyValidator = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const masterKey = process.env.MASTER_API_KEY || 'rfid_secret_123';

  if (!apiKey || apiKey !== masterKey) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid or missing API key in X-API-KEY header' 
    });
  }

  next();
};

module.exports = { apiKeyValidator };
