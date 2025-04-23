const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/db');
const { ApiError } = require('../middleware/errorHandler');

/**
 * Generate a new API key with the format "feather-ops-apikey-[random]"
 * @param {string} email - Email of the key owner
 * @param {number} rateLimit - Number of requests allowed per day
 * @returns {Promise<Object>} - The generated API key data
 */
const generateApiKey = async (email, rateLimit = 100) => {
  try {
    if (!email) {
      throw new ApiError('Email is required', 400, 'invalid_request_error', 'email', 'param_required');
    }
    
    // Generate a random string for the API key
    const randomPart = crypto.randomBytes(16).toString('hex');
    const apiKey = `feather-ops-apikey-${randomPart}`;
    
    // Hash the key for storage
    const keyHash = crypto
      .createHash('sha256')
      .update(apiKey + process.env.KEY_SALT)
      .digest('hex');
    
    // Store the hashed key in the database
    const { data, error } = await supabase
      .from('keys')
      .insert({
        id: uuidv4(),
        key_hash: keyHash,
        owner_email: email,
        rate_limit: rateLimit,
        usage_count: 0,
        created_at: new Date().toISOString(),
        revoked: false
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error storing API key:', error);
      throw new ApiError(
        'Failed to generate API key',
        500,
        'server_error',
        null,
        'key_generation_failed'
      );
    }
    
    // Return the API key (only shown once)
    return {
      key: apiKey,
      id: data.id,
      owner_email: data.owner_email,
      rate_limit: data.rate_limit,
      created_at: data.created_at
    };
  } catch (error) {
    console.error('API Key generation error:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      error.message || 'Failed to generate API key',
      500,
      'server_error',
      null,
      'key_generation_error'
    );
  }
};

/**
 * List all API keys for a specific email (admin function)
 * @param {string} email - Email to filter keys by
 * @returns {Promise<Array>} - Array of API keys
 */
const listApiKeys = async (email) => {
  try {
    if (!email) {
      throw new ApiError('Email is required', 400, 'invalid_request_error', 'email', 'param_required');
    }
    
    // Get keys from database (without exposing the hash)
    const { data, error } = await supabase
      .from('keys')
      .select('id, owner_email, rate_limit, usage_count, created_at, revoked')
      .eq('owner_email', email);
    
    if (error) {
      console.error('Error listing API keys:', error);
      throw new ApiError(
        'Failed to list API keys',
        500,
        'server_error',
        null,
        'key_list_failed'
      );
    }
    
    return data;
  } catch (error) {
    console.error('API Key listing error:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      error.message || 'Failed to list API keys',
      500,
      'server_error',
      null,
      'key_list_error'
    );
  }
};

/**
 * Revoke an API key
 * @param {string} keyId - ID of the key to revoke
 * @returns {Promise<Object>} - Revocation status
 */
const revokeApiKey = async (keyId) => {
  try {
    if (!keyId) {
      throw new ApiError('Key ID is required', 400, 'invalid_request_error', 'keyId', 'param_required');
    }
    
    // Update key status in database
    const { data, error } = await supabase
      .from('keys')
      .update({ revoked: true })
      .eq('id', keyId)
      .select()
      .single();
    
    if (error) {
      console.error('Error revoking API key:', error);
      throw new ApiError(
        'Failed to revoke API key',
        500,
        'server_error',
        null,
        'key_revocation_failed'
      );
    }
    
    if (!data) {
      throw new ApiError(
        'API key not found',
        404,
        'invalid_request_error',
        'keyId',
        'key_not_found'
      );
    }
    
    return {
      id: data.id,
      revoked: data.revoked,
      owner_email: data.owner_email
    };
  } catch (error) {
    console.error('API Key revocation error:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      error.message || 'Failed to revoke API key',
      500,
      'server_error',
      null,
      'key_revocation_error'
    );
  }
};

module.exports = {
  generateApiKey,
  listApiKeys,
  revokeApiKey
}; 