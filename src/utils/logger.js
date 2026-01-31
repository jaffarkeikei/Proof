/**
 * Logger Module
 * 
 * Provides structured logging capabilities using Winston for debugging
 * and monitoring agent execution throughout the application.
 * 
 * Features:
 * - JSON format for structured logging
 * - Multiple log levels (error, warn, info, debug)
 * - Console transport with colorized output
 * - File transports (error.log, combined.log)
 * - Request correlation ID support for tracing
 * - Module context in all log entries
 * - Automatic log rotation
 * 
 * @module utils/logger
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// ============================================================================
// Configuration
// ============================================================================

const LOGS_DIR = path.join(process.cwd(), 'logs');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 5;

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

// ============================================================================
// Directory Setup
// ============================================================================

/**
 * Ensures the logs directory exists
 * Creates it recursively if missing
 */
function ensureLogsDirectory() {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
  } catch (error) {
    console.error(`Failed to create logs directory: ${error.message}`);
    // Continue without file logging if directory creation fails
  }
}

ensureLogsDirectory();

// ============================================================================
// Custom Formats
// ============================================================================

/**
 * ISO 8601 timestamp format
 */
const timestampFormat = winston.format.timestamp({
  format: 'YYYY-MM-DDTHH:mm:ss.SSSZ'
});

/**
 * Format for adding structured metadata
 */
const metadataFormat = winston.format((info) => {
  // Ensure consistent field ordering
  const { timestamp, level, message, module, correlationId, ...rest } = info;
  
  return {
    timestamp,
    level,
    module,
    ...(correlationId && { correlationId }),
    message,
    ...(Object.keys(rest).length > 0 && { metadata: rest })
  };
})();

/**
 * JSON format for file output with structured fields
 */
const jsonFileFormat = winston.format.combine(
  timestampFormat,
  winston.format.errors({ stack: true }),
  metadataFormat,
  winston.format.json()
);

/**
 * Colorized format for console output
 * Provides human-readable logs during development
 */
const consoleFormat = winston.format.combine(
  timestampFormat,
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const {
      timestamp,
      level,
      message,
      module,
      correlationId,
      stack,
      ...meta
    } = info;

    // Build the log line components
    const parts = [timestamp, level];
    
    if (module) {
      parts.push(`[${module}]`);
    }
    
    if (correlationId) {
      parts.push(`[${correlationId}]`);
    }
    
    parts.push(message);

    // Add stack trace for errors
    let output = parts.join(' ');
    
    if (stack) {
      output += `\n${stack}`;
    }

    // Add metadata if present (excluding internal winston fields)
    const metaKeys = Object.keys(meta).filter(
      key => !['splat', 'label'].includes(key)
    );
    
    if (metaKeys.length > 0) {
      const metaObj = {};
      metaKeys.forEach(key => { metaObj[key] = meta[key]; });
      output += ` ${JSON.stringify(metaObj)}`;
    }

    return output;
  })
);

// ============================================================================
// Transport Configuration
// ============================================================================

/**
 * Shared transports used by all logger instances
 * This prevents file handle exhaustion when creating multiple loggers
 */
const sharedTransports = {
  /**
   * Console transport - enabled in all environments
   * Uses colorized output for better readability
   */
  console: new winston.transports.Console({
    format: consoleFormat,
    handleExceptions: true,
    handleRejections: true
  }),

  /**
   * Error file transport - captures only error level logs
   * Useful for monitoring and alerting on errors
   */
  errorFile: new winston.transports.File({
    filename: path.join(LOGS_DIR, 'error.log'),
    level: 'error',
    format: jsonFileFormat,
    maxsize: MAX_FILE_SIZE,
    maxFiles: MAX_FILES,
    tailable: true,
    handleExceptions: true,
    handleRejections: true
  }),

  /**
   * Combined file transport - captures all log levels
   * Useful for detailed debugging and audit trails
   */
  combinedFile: new winston.transports.File({
    filename: path.join(LOGS_DIR, 'combined.log'),
    format: jsonFileFormat,
    maxsize: MAX_FILE_SIZE,
    maxFiles: MAX_FILES,
    tailable: true
  })
};

// ============================================================================
// Logger Factory
// ============================================================================

/**
 * Creates a logger instance with module context
 * 
 * @param {string} moduleName - Name of the module/component using the logger
 * @returns {Object} Logger instance with logging methods and helpers
 * 
 * @example
 * const logger = createLogger('AgentOrchestrator');
 * 
 * // Basic logging
 * logger.info('Agent started');
 * logger.debug('Processing request', { requestId: '123' });
 * logger.warn('Rate limit approaching', { current: 95, max: 100 });
 * logger.error('Agent failed', { error: err.message });
 * 
 * // With correlation ID for request tracing
 * const requestLogger = logger.withCorrelationId('req-abc-123');
 * requestLogger.info('Processing user request');
 * 
 * // Error logging helper
 * logger.logError(new Error('Connection failed'), { service: 'database' });
 * 
 * // API call logging helper
 * logger.logAPICall('POST', '/api/agents', 150, { status: 200 });
 */
function createLogger(moduleName) {
  // Create Winston logger instance with module context
  const winstonLogger = winston.createLogger({
    level: logLevel,
    defaultMeta: { module: moduleName },
    transports: [
      sharedTransports.console,
      sharedTransports.errorFile,
      sharedTransports.combinedFile
    ],
    // Don't exit on handled exceptions
    exitOnError: false
  });

  /**
   * Log an error message
   * @param {string} message - Log message
   * @param {Object} [metadata={}] - Additional metadata
   */
  function error(message, metadata = {}) {
    winstonLogger.error(message, metadata);
  }

  /**
   * Log a warning message
   * @param {string} message - Log message
   * @param {Object} [metadata={}] - Additional metadata
   */
  function warn(message, metadata = {}) {
    winstonLogger.warn(message, metadata);
  }

  /**
   * Log an info message
   * @param {string} message - Log message
   * @param {Object} [metadata={}] - Additional metadata
   */
  function info(message, metadata = {}) {
    winstonLogger.info(message, metadata);
  }

  /**
   * Log a debug message
   * @param {string} message - Log message
   * @param {Object} [metadata={}] - Additional metadata
   */
  function debug(message, metadata = {}) {
    winstonLogger.debug(message, metadata);
  }

  /**
   * Creates a child logger with correlation ID for request tracing
   * Use this to track a request through multiple operations
   * 
   * @param {string} correlationId - Unique request/correlation ID
   * @returns {Object} Logger instance with correlation ID included in all entries
   * 
   * @example
   * const reqLogger = logger.withCorrelationId(req.headers['x-correlation-id']);
   * reqLogger.info('Request received');
   * reqLogger.debug('Processing data');
   * reqLogger.info('Request completed');
   */
  function withCorrelationId(correlationId) {
    return {
      error: (message, meta = {}) => error(message, { ...meta, correlationId }),
      warn: (message, meta = {}) => warn(message, { ...meta, correlationId }),
      info: (message, meta = {}) => info(message, { ...meta, correlationId }),
      debug: (message, meta = {}) => debug(message, { ...meta, correlationId })
    };
  }

  /**
   * Helper method for logging errors with full context
   * Extracts useful information from Error objects automatically
   * 
   * @param {Error} err - Error object to log
   * @param {Object} [context={}] - Additional context information
   * 
   * @example
   * try {
   *   await riskyOperation();
   * } catch (err) {
   *   logger.logError(err, { operation: 'riskyOperation', userId: '123' });
   * }
   */
  function logError(err, context = {}) {
    const errorDetails = {
      errorName: err.name || 'Error',
      errorMessage: err.message || 'Unknown error',
      errorCode: err.code || undefined,
      errorStack: err.stack || undefined,
      ...context
    };

    // Remove undefined values
    Object.keys(errorDetails).forEach(key => {
      if (errorDetails[key] === undefined) {
        delete errorDetails[key];
      }
    });

    winstonLogger.error(err.message || 'An error occurred', errorDetails);
  }

  /**
   * Helper method for logging API/HTTP calls with timing information
   * Useful for monitoring external service calls and performance
   * 
   * @param {string} method - HTTP method (GET, POST, PUT, DELETE, etc.)
   * @param {string} url - Request URL
   * @param {number} duration - Request duration in milliseconds
   * @param {Object} [context={}] - Additional context (status code, response size, etc.)
   * 
   * @example
   * const startTime = Date.now();
   * const response = await fetch(url);
   * const duration = Date.now() - startTime;
   * logger.logAPICall('GET', url, duration, { 
   *   status: response.status,
   *   contentLength: response.headers.get('content-length')
   * });
   */
  function logAPICall(method, url, duration, context = {}) {
    const apiDetails = {
      httpMethod: method.toUpperCase(),
      requestUrl: url,
      durationMs: duration,
      ...context
    };

    // Use different log levels based on duration thresholds
    const message = `${method.toUpperCase()} ${url} completed in ${duration}ms`;
    
    if (duration > 5000) {
      warn(message, { ...apiDetails, slow: true });
    } else {
      info(message, apiDetails);
    }
  }

  /**
   * Log the start of an operation (for timing/tracing)
   * @param {string} operation - Name of the operation
   * @param {Object} [metadata={}] - Additional metadata
   */
  function logOperationStart(operation, metadata = {}) {
    debug(`Starting: ${operation}`, { operation, phase: 'start', ...metadata });
  }

  /**
   * Log the end of an operation with duration
   * @param {string} operation - Name of the operation
   * @param {number} startTime - Start timestamp from Date.now()
   * @param {Object} [metadata={}] - Additional metadata
   */
  function logOperationEnd(operation, startTime, metadata = {}) {
    const duration = Date.now() - startTime;
    debug(`Completed: ${operation}`, { 
      operation, 
      phase: 'end', 
      durationMs: duration, 
      ...metadata 
    });
  }

  // Return the logger interface
  return {
    // Standard log methods
    error,
    warn,
    info,
    debug,

    // Correlation ID support
    withCorrelationId,

    // Helper methods
    logError,
    logAPICall,
    logOperationStart,
    logOperationEnd,

    // Access to underlying Winston logger for advanced use cases
    _winston: winstonLogger
  };
}

// ============================================================================
// Module Exports
// ============================================================================

module.exports = { createLogger };