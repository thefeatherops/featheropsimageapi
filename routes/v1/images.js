const express = require('express');
const router = express.Router();
const { authenticateApiKey } = require('../../middleware/auth');
const { createDynamicRateLimiter } = require('../../middleware/rateLimit');
const { ApiError } = require('../../middleware/errorHandler');
const { generateImage } = require('../../services/imageService');
const {
  SUPPORTED_MODELS,
  SUPPORTED_SIZES,
  SUPPORTED_FORMATS,
  PROVIDERS,
  OPENAI_MODEL_MAP
} = require('../../config/constants');

/**
 * @route POST /v1/images/generations
 * @desc Generate an image (OpenAI compatibility)
 * @access Private (API key required)
 */
router.post('/generations', authenticateApiKey, createDynamicRateLimiter(), async (req, res, next) => {
  try {
    const { prompt, n, size, response_format, model } = req.body;
    
    // Input validation
    if (!prompt) {
      throw new ApiError('Prompt is required', 400, 'invalid_request_error', 'prompt', 'param_required');
    }
    
    // OpenAI-compatible parameter validation
    const numImages = n ? parseInt(n) : 1;
    
    if (isNaN(numImages) || numImages < 1 || numImages > 10) {
      throw new ApiError('n must be between 1 and 10', 400, 'invalid_request_error', 'n', 'param_invalid');
    }
    
    // Validate size
    if (size && !SUPPORTED_SIZES.includes(size)) {
      throw new ApiError(
        `Invalid size. Must be one of: ${SUPPORTED_SIZES.join(', ')}`,
        400,
        'invalid_request_error',
        'size',
        'param_invalid'
      );
    }
    
    // Validate response format
    if (response_format && !SUPPORTED_FORMATS.includes(response_format)) {
      throw new ApiError(
        `Invalid response_format. Must be one of: ${SUPPORTED_FORMATS.join(', ')}`,
        400,
        'invalid_request_error',
        'response_format',
        'param_invalid'
      );
    }
    
    // Validate model - handle both native models and OpenAI naming
    let requestedModel = model;
    if (model && !SUPPORTED_MODELS.includes(model)) {
      // Check if it's a valid OpenAI model name
      if (!OPENAI_MODEL_MAP[model]) {
        throw new ApiError(
          `Invalid model. Must be one of: ${SUPPORTED_MODELS.join(', ')}`,
          400,
          'invalid_request_error',
          'model',
          'param_invalid'
        );
      }
      requestedModel = model; // Keep the OpenAI name, service will convert it
    }
    
    // Add API key ID for tracking
    const params = {
      prompt,
      n: numImages,
      size,
      model: requestedModel,
      response_format,
      keyId: req.apiKey.id
    };
    
    // Generate image and get response
    const result = await generateImage(params);
    
    // Return OpenAI-compatible response
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /v1/images/models
 * @desc Get available models (OpenAI compatibility)
 * @access Private (API key required)
 */
router.get('/models', authenticateApiKey, async (req, res, next) => {
  try {
    // Get current timestamp
    const now = Math.floor(Date.now() / 1000);
    
    // Build provider-specific models list
    const models = [];
    
    // Add all native models
    Object.keys(PROVIDERS).forEach(providerName => {
      const provider = PROVIDERS[providerName];
      provider.models.forEach(modelName => {
        models.push({
          id: modelName,
          object: 'model',
          created: now,
          owned_by: 'featherops',
          provider: providerName
        });
      });
    });
    
    // Add OpenAI compatibility models
    Object.keys(OPENAI_MODEL_MAP).forEach(openaiModel => {
      models.push({
        id: openaiModel,
        object: 'model',
        created: now,
        owned_by: 'featherops',
        provider: 'openai-compatible'
      });
    });
    
    // Return a list of available models
    res.status(200).json({
      data: models,
      object: 'list'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 