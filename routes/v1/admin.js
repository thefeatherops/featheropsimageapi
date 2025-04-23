const express = require('express');
const router = express.Router();
const { authenticateApiKey } = require('../../middleware/auth');
const keepAliveService = require('../../utils/keepAlive');

/**
 * @route GET /v1/admin/keepalive/status
 * @desc Get the status of the keep-alive service
 * @access Private (API key required)
 */
router.get('/keepalive/status', authenticateApiKey, async (req, res) => {
  const status = keepAliveService.getStatus();
  res.status(200).json({
    status,
    message: 'Keep-alive service status'
  });
});

/**
 * @route GET /v1/admin/keepalive/logs
 * @desc Get the logs of the keep-alive service
 * @access Private (API key required)
 */
router.get('/keepalive/logs', authenticateApiKey, async (req, res) => {
  const logs = keepAliveService.getLogs();
  res.status(200).json({
    logs,
    count: logs.length,
    message: 'Keep-alive service logs'
  });
});

/**
 * @route POST /v1/admin/keepalive/start
 * @desc Start the keep-alive service
 * @access Private (API key required)
 */
router.post('/keepalive/start', authenticateApiKey, async (req, res) => {
  const { url, intervalMinutes } = req.body;
  
  // If not running, start the service
  if (!keepAliveService.isRunning) {
    keepAliveService.start(url, intervalMinutes);
  }
  
  res.status(200).json({
    status: keepAliveService.getStatus(),
    message: 'Keep-alive service started'
  });
});

/**
 * @route POST /v1/admin/keepalive/stop
 * @desc Stop the keep-alive service
 * @access Private (API key required)
 */
router.post('/keepalive/stop', authenticateApiKey, async (req, res) => {
  // If running, stop the service
  if (keepAliveService.isRunning) {
    keepAliveService.stop();
  }
  
  res.status(200).json({
    status: keepAliveService.getStatus(),
    message: 'Keep-alive service stopped'
  });
});

module.exports = router; 