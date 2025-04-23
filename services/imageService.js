const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { ApiError } = require('../middleware/errorHandler');
const supabase = require('../config/db');
const {
  PROVIDERS,
  MODEL_PROVIDERS,
  FLUX_SIZE_MAP,
  OPENAI_MODEL_MAP,
  POLL_CONFIG
} = require('../config/constants');

// External API base URL and storage bucket from environment variables
const API_BASE_URL = process.env.EXTERNAL_API_URL;
const STORAGE_BUCKET = process.env.STORAGE_BUCKET;

/**
 * Generate an image using the external API
 * @param {Object} params - Parameters for image generation
 * @returns {Promise<Object>} - The generated image data
 */
const generateImage = async (params) => {
  try {
    // Extract parameters
    const { prompt, n = 1, size = '1024x1024', model = 'dalle', response_format = 'url' } = params;
    
    if (!prompt) {
      throw new ApiError('Prompt is required', 400, 'invalid_request_error', 'prompt', 'param_required');
    }
    
    // Convert from OpenAI model name if needed
    const actualModel = OPENAI_MODEL_MAP[model] || model;
    
    // Get the provider for this model
    const providerName = MODEL_PROVIDERS[actualModel];
    if (!providerName) {
      throw new ApiError('Invalid model', 400, 'invalid_request_error', 'model', 'param_invalid');
    }
    
    const provider = PROVIDERS[providerName];
    const endpoint = provider.endpoint;
    
    // Build API URL
    let apiUrl = `${API_BASE_URL}${endpoint}?text=${encodeURIComponent(prompt)}`;
    
    // Add model param if using flux provider (which has multiple models)
    if (providerName === 'flux') {
      // If user specified an exact flux model, use that
      if (actualModel.startsWith('flux')) {
        apiUrl += `&model=${actualModel}`;
      } else {
        // Otherwise select by size
        const fluxModel = FLUX_SIZE_MAP[size] || 'flux-1.1-pro-ultra';
        apiUrl += `&model=${fluxModel}`;
      }
    }
    
    // Initial request to get job ID
    const jobResponse = await axios.get(apiUrl);
    
    if (!jobResponse.data.ok) {
      throw new ApiError(
        jobResponse.data.message || 'Failed to start image generation',
        400,
        'api_error',
        null,
        'generation_failed'
      );
    }
    
    // Get the task URL
    const taskUrl = jobResponse.data.task_url;
    
    // Poll for task completion
    const image = await pollTaskCompletion(taskUrl);
    
    // Upload to Supabase Storage and get new URL
    const imageUrl = await uploadToStorage(image.url, params.keyId, prompt, actualModel);
    
    // Log request in database
    try {
      await supabase.from('request_logs').insert({
        key_id: params.keyId,
        endpoint: endpoint,
        prompt: prompt,
        model: actualModel,
        status: 'success',
        created_at: new Date().toISOString()
      });
    } catch (logError) {
      console.error('Failed to log request:', logError);
      // Don't throw error, continue with response
    }
    
    // Format response like OpenAI
    const created = Math.floor(Date.now() / 1000);
    
    // Handle different response formats
    if (response_format === 'b64_json') {
      // Download image and convert to base64
      const imageBase64 = await imageToBase64(image.url);
      return {
        creator: 'featherops',
        created,
        data: Array(n).fill().map(() => ({ b64_json: imageBase64 }))
      };
    } else {
      // Default to URL response
      return {
        creator: 'featherops',
        created,
        data: Array(n).fill().map(() => ({ url: imageUrl }))
      };
    }
  } catch (error) {
    // Log error in database
    try {
      if (params.keyId) {
        await supabase.from('request_logs').insert({
          key_id: params.keyId,
          endpoint: error.config?.url || 'unknown',
          prompt: params.prompt || 'unknown',
          model: params.model || 'unknown',
          status: 'error',
          created_at: new Date().toISOString()
        });
      }
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
    console.error('Image generation error:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      error.message || 'Failed to generate image',
      error.response?.status || 500,
      'api_error',
      null,
      'generation_error'
    );
  }
};

/**
 * Poll the task URL until the image is ready
 * @param {string} taskUrl - URL to poll for task status
 * @returns {Promise<Object>} - The generated image data
 */
const pollTaskCompletion = async (taskUrl) => {
  const { maxAttempts, interval } = POLL_CONFIG;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await axios.get(taskUrl);
      const data = response.data;
      
      if (data.status === 'done' && data.url) {
        return {
          ok: true,
          status: 'done',
          url: data.url
        };
      } else if (data.status === 'error') {
        throw new ApiError(
          data.message || 'Image generation failed',
          400,
          'api_error',
          null,
          'generation_failed'
        );
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, interval));
    } catch (error) {
      console.error(`Polling attempt ${attempt + 1} failed:`, error);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  
  throw new ApiError(
    'Image generation timed out',
    408,
    'timeout_error',
    null,
    'generation_timeout'
  );
};

/**
 * Upload an image to Supabase Storage
 * @param {string} sourceUrl - The source image URL
 * @param {string} keyId - The API key ID for tracking
 * @param {string} prompt - The prompt that generated the image
 * @param {string} model - The model used to generate the image
 * @returns {Promise<string>} - The URL of the uploaded image
 */
const uploadToStorage = async (sourceUrl, keyId, prompt, model) => {
  try {
    // Create temp directory if it doesn't exist
    const tempDir = process.env.TEMP_IMAGE_DIR || './temp';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Generate a unique filename
    const fileId = uuidv4();
    // Determine file extension from URL or default to png
    const fileExt = sourceUrl.includes('.jpg') ? 'jpg' : 'png';
    const fileName = path.join(tempDir, `${fileId}.${fileExt}`);
    
    // Download the image
    const response = await axios({
      method: 'get',
      url: sourceUrl,
      responseType: 'stream'
    });
    
    // Save to temp file
    const writer = fs.createWriteStream(fileName);
    response.data.pipe(writer);
    
    // Wait for download to complete
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    // Read the file
    const fileBuffer = fs.readFileSync(fileName);
    
    // Path in storage
    const storagePath = `${keyId}/${fileId}.${fileExt}`;
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: fileExt === 'jpg' ? 'image/jpeg' : 'image/png',
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }
    
    // Generate a signed URL with 2-minute expiration instead of public URL
    const expirySeconds = 120; // 2 minutes
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, expirySeconds);
    
    if (signedUrlError) {
      throw new Error(`Failed to create signed URL: ${signedUrlError.message}`);
    }
    
    // Log the image in the database
    await supabase.from('images').insert({
      key_id: keyId,
      storage_path: storagePath,
      prompt: prompt,
      model: model,
      created_at: new Date().toISOString()
    });
    
    // Clean up temp file
    fs.unlinkSync(fileName);
    
    return signedUrlData.signedUrl;
  } catch (error) {
    console.error('Error uploading to storage:', error);
    
    // If storage fails, return the original URL as fallback
    return sourceUrl;
  }
};

/**
 * Convert an image URL to base64
 * @param {string} url - Image URL
 * @returns {Promise<string>} - Base64 encoded image
 */
const imageToBase64 = async (url) => {
  try {
    // Create temp directory if it doesn't exist
    const tempDir = process.env.TEMP_IMAGE_DIR || './temp';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Generate a unique filename
    const fileName = path.join(tempDir, `${uuidv4()}.png`);
    
    // Download the image
    const response = await axios({
      method: 'get',
      url,
      responseType: 'stream'
    });
    
    // Save the image to a file
    const writer = fs.createWriteStream(fileName);
    response.data.pipe(writer);
    
    // Wait for the file to be saved
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    // Read the file and convert to base64
    const imageBuffer = fs.readFileSync(fileName);
    const base64Image = imageBuffer.toString('base64');
    
    // Clean up the temporary file
    fs.unlinkSync(fileName);
    
    return base64Image;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw new ApiError(
      'Failed to process image',
      500,
      'processing_error',
      null,
      'image_processing_failed'
    );
  }
};

module.exports = {
  generateImage
}; 