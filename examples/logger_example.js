/**
 * Logger Module Usage Example
 *
 * This example demonstrates how to use the logger module for structured logging
 * throughout an application. The logger provides consistent logging patterns with
 * module context, correlation IDs for request tracing, and helper methods for
 * common logging scenarios.
 *
 * Features demonstrated:
 * - Creating logger instances with module context
 * - Logging at different levels (error, warn, info, debug)
 * - Adding metadata to log entries
 * - Request tracing with correlation IDs
 * - Error logging with full context extraction
 * - API call logging with timing
 * - Operation timing helpers
 *
 * Output locations:
 * - Console: Colorized output for development
 * - logs/error.log: Error-level logs only (JSON format)
 * - logs/combined.log: All log levels (JSON format)
 *
 * @example
 * Run this example:
 *   LOG_LEVEL=debug node logger_example.js
 *
 * Environment variables:
 *   NODE_ENV   - Set to 'production' for info-level default
 *   LOG_LEVEL  - Override log level (error, warn, info, debug)
 */

// Import the createLogger function from the logger module
// Path is relative to the examples directory
const { createLogger } = require('../src/utils/logger');

// ============================================================================
// Basic Logger Usage
// ============================================================================

/**
 * Create a logger instance for this module.
 * The module name appears in all log entries for easy filtering.
 *
 * @param {string} moduleName - Identifies the source of log entries
 * @returns {Object} Logger instance with logging methods
 */
const logger = createLogger('ExampleModule');

console.log('\n=== Basic Logging ===\n');

// Info level - general operational messages
// @param {string} message - The log message
// @param {Object} [metadata] - Optional key-value pairs for context
logger.info('Application started successfully');
logger.info('User logged in', { userId: 'user-123', role: 'admin' });

// Debug level - detailed information for troubleshooting
// Only visible when LOG_LEVEL=debug or NODE_ENV !== 'production'
logger.debug('Processing configuration', {
  configPath: '/etc/app/config.json',
  loadedModules: ['auth', 'database', 'cache']
});

// Warn level - potential issues that don't stop execution
logger.warn('Cache miss detected', { key: 'user-session-456', fallback: 'database' });
logger.warn('Rate limit approaching', { current: 95, max: 100, resetIn: '5m' });

// Error level - failures requiring attention
logger.error('Failed to connect to service', {
  service: 'payment-gateway',
  retryCount: 3,
  lastError: 'Connection timeout'
});

// ============================================================================
// Correlation ID for Request Tracing
// ============================================================================

console.log('\n=== Correlation ID Tracing ===\n');

/**
 * Create a child logger with correlation ID for tracking a request
 * through multiple operations. All logs from this logger include
 * the correlation ID automatically.
 *
 * @param {string} correlationId - Unique identifier (e.g., from request headers)
 * @returns {Object} Logger instance with correlationId in all entries
 */
function handleRequest(correlationId) {
  // Create a request-scoped logger with correlation ID
  const reqLogger = logger.withCorrelationId(correlationId);

  // All these logs will include the correlation ID
  reqLogger.info('Request received', { endpoint: '/api/users', method: 'GET' });
  reqLogger.debug('Validating authentication token');
  reqLogger.debug('Fetching user data from database');
  reqLogger.info('Request completed', { statusCode: 200, responseTime: 45 });
}

// Simulate handling a request with a correlation ID
handleRequest('req-abc-123-xyz');

// ============================================================================
// Error Logging Helper
// ============================================================================

console.log('\n=== Error Logging Helper ===\n');

/**
 * logError() extracts useful information from Error objects automatically:
 * - errorName: Error type (TypeError, RangeError, custom errors)
 * - errorMessage: The error message
 * - errorCode: Error code if present (e.g., ENOENT, ECONNREFUSED)
 * - errorStack: Full stack trace
 *
 * @param {Error} err - The Error object to log
 * @param {Object} [context] - Additional context about where/why the error occurred
 */
function demonstrateErrorLogging() {
  // Example 1: Basic error
  try {
    throw new Error('Database connection failed');
  } catch (err) {
    logger.logError(err, {
      operation: 'databaseConnect',
      host: 'db.example.com',
      port: 5432
    });
  }

  // Example 2: Error with code (like Node.js system errors)
  const systemError = new Error('File not found');
  systemError.code = 'ENOENT';
  logger.logError(systemError, {
    operation: 'readConfig',
    filePath: '/etc/app/config.json'
  });

  // Example 3: Custom error type
  class ValidationError extends Error {
    constructor(message, field) {
      super(message);
      this.name = 'ValidationError';
      this.field = field;
    }
  }

  const validationErr = new ValidationError('Email format invalid', 'email');
  logger.logError(validationErr, {
    operation: 'userRegistration',
    inputValue: 'invalid-email'
  });
}

demonstrateErrorLogging();

// ============================================================================
// API Call Logging Helper
// ============================================================================

console.log('\n=== API Call Logging ===\n');

/**
 * logAPICall() logs HTTP requests with timing information.
 * Automatically flags slow requests (>5000ms) with warn level.
 *
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param {string} url - The request URL
 * @param {number} duration - Request duration in milliseconds
 * @param {Object} [context] - Additional context (status, response size, etc.)
 */
async function demonstrateAPILogging() {
  // Simulate a normal API call
  const startTime1 = Date.now();
  // ... simulated API call ...
  await simulateDelay(150);
  const duration1 = Date.now() - startTime1;

  logger.logAPICall('GET', 'https://api.example.com/users', duration1, {
    status: 200,
    responseSize: '2.4KB',
    cached: false
  });

  // Simulate a POST request
  const startTime2 = Date.now();
  await simulateDelay(250);
  const duration2 = Date.now() - startTime2;

  logger.logAPICall('POST', 'https://api.example.com/orders', duration2, {
    status: 201,
    orderId: 'ord-789',
    itemCount: 3
  });

  // Note: Calls taking >5000ms are automatically logged as warnings
  // logger.logAPICall('GET', '/slow-endpoint', 6500, { status: 200 });
}

// ============================================================================
// Operation Timing Helpers
// ============================================================================

console.log('\n=== Operation Timing ===\n');

/**
 * logOperationStart() and logOperationEnd() help track operation duration.
 * Useful for performance monitoring and debugging slow operations.
 *
 * @method logOperationStart
 * @param {string} operation - Name of the operation being timed
 * @param {Object} [metadata] - Additional context about the operation
 *
 * @method logOperationEnd
 * @param {string} operation - Name of the operation (should match start)
 * @param {number} startTime - The timestamp from Date.now() at start
 * @param {Object} [metadata] - Additional context (e.g., result summary)
 */
async function processDataBatch(batchId, items) {
  const startTime = Date.now();

  logger.logOperationStart('processDataBatch', {
    batchId,
    itemCount: items.length
  });

  // Simulate processing
  await simulateDelay(100);

  logger.logOperationEnd('processDataBatch', startTime, {
    batchId,
    processedCount: items.length,
    successCount: items.length - 1,
    failureCount: 1
  });
}

// ============================================================================
// Real-World Usage Pattern: Service Class
// ============================================================================

console.log('\n=== Service Class Pattern ===\n');

/**
 * Example of using the logger in a service class.
 * Each service creates its own logger with appropriate module name.
 */
class UserService {
  constructor() {
    // Create a dedicated logger for this service
    this.logger = createLogger('UserService');
  }

  /**
   * Fetch a user by ID with full logging.
   * @param {string} userId - The user ID to fetch
   * @param {string} correlationId - Request correlation ID for tracing
   * @returns {Object|null} User object or null if not found
   */
  async getUser(userId, correlationId) {
    const reqLogger = this.logger.withCorrelationId(correlationId);
    const startTime = Date.now();

    reqLogger.debug('Fetching user', { userId });

    try {
      // Simulate database lookup
      await simulateDelay(50);

      const user = { id: userId, name: 'John Doe', email: 'john@example.com' };

      reqLogger.info('User fetched successfully', {
        userId,
        durationMs: Date.now() - startTime
      });

      return user;
    } catch (err) {
      this.logger.logError(err, {
        operation: 'getUser',
        userId,
        correlationId
      });
      return null;
    }
  }
}

// ============================================================================
// Run All Examples
// ============================================================================

/**
 * Helper function to simulate async delays
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>} Promise that resolves after delay
 */
function simulateDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main function to run all demonstrations
 * @returns {Promise<void>}
 */
async function main() {
  // Run API logging demo
  await demonstrateAPILogging();

  // Run operation timing demo
  await processDataBatch('batch-001', ['item1', 'item2', 'item3']);

  // Run service class demo
  const userService = new UserService();
  await userService.getUser('user-456', 'req-demo-789');

  console.log('\n=== Example Complete ===\n');
  console.log('Check the logs/ directory for:');
  console.log('  - combined.log: All log entries in JSON format');
  console.log('  - error.log: Error-level entries only');
  console.log('\nSet LOG_LEVEL=debug to see all debug messages.');
}

// Execute the example
main().catch(err => {
  logger.logError(err, { context: 'main execution' });
  process.exit(1);
});