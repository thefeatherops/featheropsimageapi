const rateLimit = require('express-rate-limit');
const supabase = require('../config/db');

/**
 * Creates a rate limiter middleware based on the API key's allowed rate limit
 */
const createDynamicRateLimiter = () => {
  return async (req, res, next) => {
    try {
      // Skip if there's no API key (should be caught by auth middleware)
      if (!req.apiKey || !req.apiKey.id) {
        return next();
      }
      
      const keyId = req.apiKey.id;
      const now = new Date();
      const resetTime = new Date();
      resetTime.setHours(0, 0, 0, 0); // Reset at midnight
      
      // Get rate limit data for this key
      const { data, error } = await supabase
        .from('rate_limits')
        .select('*')
        .eq('key_id', keyId)
        .single();
      
      // If no rate limit entry exists or it's a new day, create/reset it
      if (error || !data || new Date(data.last_reset) < resetTime) {
        // Create or reset the rate limit counter
        await supabase
          .from('rate_limits')
          .upsert({
            key_id: keyId,
            requests_count: 1,
            last_reset: now.toISOString(),
            max_requests: req.apiKey.rateLimit || 100 // Default to 100 if not specified
          })
          .eq('key_id', keyId);
          
        return next();
      }
      
      // Check if rate limit is exceeded
      if (data.requests_count >= data.max_requests) {
        return res.status(429).json({
          error: {
            message: 'Rate limit exceeded. Please try again later.',
            type: 'rate_limit_error',
            param: null,
            code: 'rate_limit_exceeded'
          }
        });
      }
      
      // Increment the request count
      await supabase
        .from('rate_limits')
        .update({
          requests_count: data.requests_count + 1
        })
        .eq('key_id', keyId);
      
      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', data.max_requests);
      res.setHeader('X-RateLimit-Remaining', data.max_requests - data.requests_count - 1);
      res.setHeader('X-RateLimit-Reset', resetTime.getTime() / 1000 + 86400); // Reset time in seconds
      
      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      next(); // Continue even on error to avoid blocking requests
    }
  };
};

/**
 * Global rate limiter for unauthenticated requests
 */
const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: {
      message: 'Too many requests, please try again later.',
      type: 'rate_limit_error',
      param: null,
      code: 'rate_limit_exceeded'
    }
  }
});

module.exports = { createDynamicRateLimiter, globalRateLimiter }; 