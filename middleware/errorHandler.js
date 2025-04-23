/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(message, statusCode, type, param, code) {
    super(message);
    this.statusCode = statusCode;
    this.type = type;
    this.param = param;
    this.code = code;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error handler middleware
 * Formats errors like OpenAI API for consistency
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  // Determine if this is a known API error or an unexpected error
  const statusCode = err.statusCode || 500;
  const errorType = err.type || 'server_error';
  const errorParam = err.param || null;
  const errorCode = err.code || null;
  const message = err.message || 'An unexpected error occurred';
  
  // Format the error response like OpenAI
  res.status(statusCode).json({
    error: {
      message,
      type: errorType,
      param: errorParam,
      code: errorCode
    }
  });
};

/**
 * 404 error handler for routes that don't exist
 */
const notFoundHandler = (req, res, next) => {
  const err = new ApiError(
    `Route not found: ${req.method} ${req.originalUrl}`,
    404,
    'invalid_request_error',
    null,
    'route_not_found'
  );
  
  next(err);
};

module.exports = {
  ApiError,
  errorHandler,
  notFoundHandler
}; 