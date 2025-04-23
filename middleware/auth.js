const crypto = require('crypto');
const supabase = require('../config/db');

/**
 * Middleware to validate API keys
 * Expects Authorization header with format: "Bearer feather-ops-apikey-random123"
 */
const authenticateApiKey = async (req, res, next) => {
  try {
    // Get authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          message: 'Invalid API key provided',
          type: 'invalid_request_error',
          param: 'authorization',
          code: 'invalid_api_key'
        }
      });
    }
    
    // Extract the API key from the header
    const apiKey = authHeader.split(' ')[1];
    
    // Validate key format (should start with feather-ops-apikey-)
    if (!apiKey.startsWith('feather-ops-apikey-')) {
      return res.status(401).json({
        error: {
          message: 'Invalid API key format',
          type: 'invalid_request_error',
          param: 'authorization',
          code: 'invalid_api_key_format'
        }
      });
    }
    
    // Hash the API key for secure comparison
    const keyHash = crypto
      .createHash('sha256')
      .update(apiKey + process.env.KEY_SALT)
      .digest('hex');
    
    // Check if API key exists in database
    const { data, error } = await supabase
      .from('keys')
      .select('id, rate_limit, revoked')
      .eq('key_hash', keyHash)
      .single();
    
    if (error || !data) {
      return res.status(401).json({
        error: {
          message: 'Invalid API key',
          type: 'invalid_request_error',
          param: 'authorization',
          code: 'invalid_api_key'
        }
      });
    }
    
    // Check if the key has been revoked
    if (data.revoked) {
      return res.status(401).json({
        error: {
          message: 'API key has been revoked',
          type: 'invalid_request_error',
          param: 'authorization',
          code: 'revoked_api_key'
        }
      });
    }
    
    // Add key data to request object for later use
    req.apiKey = {
      id: data.id,
      rateLimit: data.rate_limit
    };
    
    // Record API key usage
    await supabase
      .from('keys')
      .update({ usage_count: data.usage_count + 1 })
      .eq('id', data.id);
    
    next();
  } catch (error) {
    console.error('API Key authentication error:', error);
    
    return res.status(500).json({
      error: {
        message: 'Authentication service error',
        type: 'server_error',
        param: null,
        code: 'authentication_error'
      }
    });
  }
};

module.exports = { authenticateApiKey }; 