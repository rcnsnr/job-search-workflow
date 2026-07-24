// utils/logger.js - Debug Logging Utility
// Log timestamps use UTC+03

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const LOG_STORAGE_KEY = 'debugLogs';
const MAX_LOG_ENTRIES = 200;

class Logger {
  constructor(context = 'Unknown') {
    this.context = context;
    this.enabled = true;
  }

  _getTimestamp() {
    const now = new Date();
    // UTC+3 offset
    const offsetTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
    return offsetTime.toISOString().replace('T', ' ').substring(0, 23);
  }

  _formatMessage(level, message, data) {
    const timestamp = this._getTimestamp();
    const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] [${this.context}] ${message}${dataStr}`;
  }

  _log(level, message, data) {
    if (!this.enabled) return;

    const formattedMsg = this._formatMessage(level, message, data);
    
    // Write to console
    switch (level) {
      case 'ERROR':
        console.error(formattedMsg);
        break;
      case 'WARN':
        console.warn(formattedMsg);
        break;
      case 'INFO':
        console.info(formattedMsg);
        break;
      default:
        console.log(formattedMsg);
    }

    // Save to storage
    this._saveToStorage(level, message, data);
  }

  _saveToStorage(level, message, data) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get([LOG_STORAGE_KEY], (result) => {
          let logs = result[LOG_STORAGE_KEY] || [];
          
          logs.push({
            timestamp: this._getTimestamp(),
            level,
            context: this.context,
            message,
            data: data || null
          });

          // Exceeding maximum log count
          if (logs.length > MAX_LOG_ENTRIES) {
            logs = logs.slice(-MAX_LOG_ENTRIES);
          }

          chrome.storage.local.set({ [LOG_STORAGE_KEY]: logs });
        });
      }
    } catch (error) {
      console.error('Log storage error:', error);
    }
  }

  debug(message, data) {
    this._log('DEBUG', message, data);
  }

  info(message, data) {
    this._log('INFO', message, data);
  }

  warn(message, data) {
    this._log('WARN', message, data);
  }

  error(message, data) {
    this._log('ERROR', message, data);
  }

  // Clear all logs
  static clearLogs() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.remove([LOG_STORAGE_KEY], () => {
        console.log('Debug logs cleared');
      });
    }
  }

  // Get all logs
  static async getLogs() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get([LOG_STORAGE_KEY], (result) => {
          resolve(result[LOG_STORAGE_KEY] || []);
        });
      } else {
        resolve([]);
      }
    });
  }

  // Export logs
  static async exportLogs() {
    const logs = await Logger.getLogs();
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `linkedin-job-filter-debug-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  }
}

// Global logger instances
if (typeof window !== 'undefined') {
  window.Logger = Logger;
}
