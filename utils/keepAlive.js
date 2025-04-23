const axios = require('axios');
const process = require('process');

/**
 * Service to keep the Render deployment alive by pinging it regularly
 * This prevents the free tier from spinning down after 15 minutes of inactivity
 */
class KeepAliveService {
  constructor() {
    this.isRunning = false;
    this.interval = null;
    this.pingInterval = 5 * 60 * 1000; // 5 minutes in milliseconds
    this.pingUrl = null;
    this.logs = [];
    this.maxLogs = 100;
  }

  /**
   * Start the keep-alive service
   * @param {string} url - The URL to ping (defaults to the service's own health endpoint)
   * @param {number} intervalMinutes - Ping interval in minutes (default: 5)
   */
  start(url, intervalMinutes = 5) {
    if (this.isRunning) {
      console.log('Keep-alive service is already running');
      return;
    }

    // If no URL is provided, use the service's own health endpoint
    this.pingUrl = url || `http://localhost:${process.env.PORT || 80}/health`;
    this.pingInterval = intervalMinutes * 60 * 1000;
    
    console.log(`🔄 Starting keep-alive service...`);
    console.log(`📡 Pinging ${this.pingUrl} every ${intervalMinutes} minutes`);
    
    // Perform an initial ping
    this.ping();
    
    // Set up interval for regular pings
    this.interval = setInterval(() => this.ping(), this.pingInterval);
    this.isRunning = true;
  }

  /**
   * Stop the keep-alive service
   */
  stop() {
    if (!this.isRunning) {
      console.log('Keep-alive service is not running');
      return;
    }
    
    clearInterval(this.interval);
    this.isRunning = false;
    console.log('Keep-alive service stopped');
  }

  /**
   * Ping the URL
   */
  async ping() {
    try {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] Pinging ${this.pingUrl}...`);
      
      const startTime = Date.now();
      const response = await axios.get(this.pingUrl, { timeout: 10000 });
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      const status = response.status;
      const logEntry = {
        timestamp,
        url: this.pingUrl,
        status,
        responseTime: `${responseTime}ms`,
        success: true
      };
      
      this.addLog(logEntry);
      console.log(`[${timestamp}] Ping successful - Status: ${status}, Response time: ${responseTime}ms`);
    } catch (error) {
      const timestamp = new Date().toISOString();
      const errorMessage = error.response ? 
        `Status: ${error.response.status}` : 
        `Error: ${error.message}`;
      
      const logEntry = {
        timestamp,
        url: this.pingUrl,
        status: error.response ? error.response.status : 'ERROR',
        error: error.message,
        success: false
      };
      
      this.addLog(logEntry);
      console.error(`[${timestamp}] Ping failed - ${errorMessage}`);
    }
  }

  /**
   * Add a log entry
   * @param {Object} entry - Log entry
   */
  addLog(entry) {
    this.logs.unshift(entry);
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
  }

  /**
   * Get the logs
   * @returns {Array} - Log entries
   */
  getLogs() {
    return this.logs;
  }

  /**
   * Get the service status
   * @returns {Object} - Service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      pingUrl: this.pingUrl,
      pingInterval: `${this.pingInterval / 60000} minutes`,
      lastPings: this.logs.slice(0, 5)
    };
  }
}

module.exports = new KeepAliveService(); 