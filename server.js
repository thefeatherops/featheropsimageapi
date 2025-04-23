require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

// Import routes
const imageRoutes = require('./routes/v1/images');
const adminRoutes = require('./routes/v1/admin');

// Import keep-alive service
const keepAliveService = require('./utils/keepAlive');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Create temp directory if it doesn't exist
const tempDir = process.env.TEMP_IMAGE_DIR || './temp';
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.use(morgan('combined')); // Logging

// Routes
app.use('/v1/images', imageRoutes);
app.use('/v1/admin', adminRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Service is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Format error response like OpenAI
  const status = err.statusCode || 500;
  res.status(status).json({
    error: {
      message: err.message || 'An unexpected error occurred',
      type: err.type || 'server_error',
      param: err.param || null,
      code: err.code || null
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start keep-alive service if not in development mode
  if (process.env.NODE_ENV !== 'development') {
    const publicUrl = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
    const pingUrl = `${publicUrl}/health`;
    
    // Start with 5-minute interval
    keepAliveService.start(pingUrl, 5);
    console.log(`Keep-alive service started for ${pingUrl}`);
  }
});

module.exports = app; // For testing 