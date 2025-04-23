const crypto = require('crypto');

/**
 * Generate a random API key with the format "feather-ops-apikey-[random]"
 * @returns {string} Generated API key
 */
const generateRandomApiKey = () => {
  const randomPart = crypto.randomBytes(16).toString('hex');
  return `feather-ops-apikey-${randomPart}`;
};

module.exports = {
  generateRandomApiKey
}; 