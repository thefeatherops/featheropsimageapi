/**
 * Image generation providers and models configuration
 * Contains non-sensitive mappings and configuration
 */

// Available providers with their API endpoints
const PROVIDERS = {
  'dalle': {
    endpoint: '/ai-image/dalle',
    models: ['dalle']
  },
  'magicstudio': {
    endpoint: '/ai-image/magicstudio',
    models: ['magicstudio']
  },
  'sdxl': {
    endpoint: '/ai-image/sdxl-beta',
    models: ['sdxl-beta']
  },
  'flux': {
    endpoint: '/ai-image/flux',
    models: [
      'flux',
      'flux-schnell',
      'flux-realism',
      'flux-pro',
      'flux-1.1-pro',
      'flux-1.1-pro-ultra',
      'flux-1.1-pro-ultra-raw'
    ]
  }
};

// Map from frontend model selection to provider
const MODEL_PROVIDERS = {
  'dalle': 'dalle',
  'magicstudio': 'magicstudio',
  'sdxl-beta': 'sdxl',
  'flux': 'flux',
  'flux-schnell': 'flux',
  'flux-realism': 'flux',
  'flux-pro': 'flux',
  'flux-1.1-pro': 'flux',
  'flux-1.1-pro-ultra': 'flux',
  'flux-1.1-pro-ultra-raw': 'flux'
};

// Map sizes to flux model variants (only needed for flux provider)
const FLUX_SIZE_MAP = {
  '256x256': 'flux',
  '512x512': 'flux-schnell',
  '1024x1024': 'flux-realism', 
  '1792x1024': 'flux-pro',
  '1024x1792': 'flux-1.1-pro',
  '2048x2048': 'flux-1.1-pro-ultra',
  'hd': 'flux-1.1-pro-ultra-raw'
};

// List of all supported models (for validation)
const SUPPORTED_MODELS = [
  'dalle',
  'magicstudio',
  'sdxl-beta',
  'flux',
  'flux-schnell',
  'flux-realism',
  'flux-pro',
  'flux-1.1-pro',
  'flux-1.1-pro-ultra',
  'flux-1.1-pro-ultra-raw'
];

// For OpenAI compatibility
const OPENAI_MODEL_MAP = {
  'dall-e-3': 'dalle',
  'dall-e-2': 'magicstudio',
  'stable-diffusion-3': 'sdxl-beta',
  'stable-diffusion-2': 'flux-1.1-pro-ultra'
};

// Supported image sizes (for validation)
const SUPPORTED_SIZES = [
  '256x256',
  '512x512',
  '1024x1024',
  '1792x1024',
  '1024x1792',
  '2048x2048',
  'hd'
];

// Supported response formats
const SUPPORTED_FORMATS = [
  'url',
  'b64_json'
];

// Poll configuration
const POLL_CONFIG = {
  maxAttempts: 60,      // Maximum polling attempts
  interval: 10000       // Polling interval in milliseconds (10 seconds)
};

module.exports = {
  PROVIDERS,
  MODEL_PROVIDERS,
  FLUX_SIZE_MAP,
  SUPPORTED_MODELS,
  OPENAI_MODEL_MAP,
  SUPPORTED_SIZES,
  SUPPORTED_FORMATS,
  POLL_CONFIG
}; 