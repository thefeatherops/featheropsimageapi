/**
 * Format an image generation response to match OpenAI's format
 * @param {Array} imageUrls - Array of image URLs
 * @param {string} responseFormat - Response format (url or b64_json)
 * @returns {Object} OpenAI-compatible response object
 */
const formatImageResponse = (imageUrls, responseFormat = 'url') => {
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Map the URLs to the correct format
  const data = imageUrls.map(url => {
    if (responseFormat === 'b64_json') {
      return { b64_json: url };
    } else {
      return { url };
    }
  });
  
  // Return in OpenAI format
  return {
    creator: 'featherops',
    created: timestamp,
    data
  };
};

/**
 * Format an error response to match OpenAI's format
 * @param {string} message - Error message
 * @param {string} type - Error type
 * @param {string} param - Parameter that caused the error
 * @param {string} code - Error code
 * @returns {Object} OpenAI-compatible error object
 */
const formatErrorResponse = (message, type = 'server_error', param = null, code = null) => {
  return {
    error: {
      message,
      type,
      param,
      code
    }
  };
};

module.exports = {
  formatImageResponse,
  formatErrorResponse
}; 