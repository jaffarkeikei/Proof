/**
 * @module utils/config
 * @description Centralized configuration manager that loads environment variables
 * from .env file and validates required API keys for all external services.
 * 
 * This module implements a singleton pattern for accessing validated configuration
 * throughout the application, ensuring all required keys are present at startup.
 * 
 * @example
 * import { getConfig } from './utils/config.js';
 * 
 * const config = getConfig();
 * console.log(config.CEREBRAS_API_KEY);
 * console.log(config.PORT); // 3001 (default)
 */

import dotenv from 'dotenv';

// Load environment variables from .env file at module initialization
// The .env file is expected to be in the project root directory
const dotenvResult = dotenv.config();

if (dotenvResult.error) {
  console.warn(
    '[config] Warning: Could not load .env file. ' +
    'Falling back to existing environment variables.'
  );
}

/**
 * Configuration object type containing all required and optional settings
 * @typedef {Object} Config
 * @property {string} RTRVR_API_KEY - API key for Rtrvr service
 * @property {string} CEREBRAS_API_KEY - API key for Cerebras service
 * @property {string} ELEVENLABS_API_KEY - API key for ElevenLabs text-to-speech service
 * @property {string} GROK_API_KEY - API key for Grok AI service
 * @property {string} TWILIO_ACCOUNT_SID - Twilio Account SID for SMS/voice
 * @property {string} TWILIO_AUTH_TOKEN - Twilio authentication token
 * @property {string} TWILIO_PHONE_NUMBER - Twilio phone number for outbound calls/SMS
 * @property {string} TOOLHOUSE_API_KEY - API key for Toolhouse service
 * @property {string} NODE_ENV - Node environment ('development', 'production', 'test')
 * @property {number} PORT - HTTP server port
 * @property {string} DATABASE_PATH - Path to SQLite database file
 */

/**
 * List of all required environment variables that must be present
 * @constant {ReadonlyArray<string>}
 * @private
 */
const REQUIRED_ENV_VARS = Object.freeze([
  'RTRVR_API_KEY',
  'CEREBRAS_API_KEY',
  'ELEVENLABS_API_KEY',
  'GROK_API_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'TOOLHOUSE_API_KEY'
]);

/**
 * Default values for optional configuration settings
 * @constant {Object}
 * @private
 */
const DEFAULTS = Object.freeze({
  NODE_ENV: 'development',
  PORT: 3001,
  DATABASE_PATH: './data/proof.db'
});

/**
 * Cached configuration object (singleton instance)
 * @type {Config|null}
 * @private
 */
let cachedConfig = null;

/**
 * Tracks whether initial validation has been performed
 * @type {boolean}
 * @private
 */
let isValidated = false;

/**
 * Creates a formatted error message for missing environment variables.
 * 
 * @param {string[]} missingVars - Array of missing variable names
 * @returns {string} Formatted error message with instructions
 * @private
 */
function formatMissingVarsError(missingVars) {
  const border = '═'.repeat(68);
  const thinBorder = '─'.repeat(68);
  
  const lines = [
    '',
    border,
    '                      CONFIGURATION ERROR                           ',
    border,
    '',
    `  Missing ${missingVars.length} required environment variable${missingVars.length > 1 ? 's' : ''}:`,
    ''
  ];
  
  // List missing variables
  for (const varName of missingVars) {
    lines.push(`    ✗  ${varName}`);
  }
  
  lines.push(
    '',
    thinBorder,
    '',
    '  To fix this error, follow these steps:',
    '',
    '  1. Create a .env file in the project root directory (if it doesn\'t exist)',
    '',
    '  2. Add the missing environment variables to your .env file:',
    ''
  );
  
  // Show required format for each missing variable
  for (const varName of missingVars) {
    lines.push(`       ${varName}=<your-${varName.toLowerCase().replace(/_/g, '-')}>`);
  }
  
  lines.push(
    '',
    '  3. Restart the application',
    '',
    thinBorder,
    '',
    '  Complete .env file template:',
    ''
  );
  
  // Show full template
  for (const varName of REQUIRED_ENV_VARS) {
    const isMissing = missingVars.includes(varName);
    const prefix = isMissing ? '  → ' : '    ';
    lines.push(`  ${prefix}${varName}=your_api_key_here`);
  }
  
  lines.push(
    '',
    '    # Optional settings (with defaults shown)',
    `    NODE_ENV=${DEFAULTS.NODE_ENV}`,
    `    PORT=${DEFAULTS.PORT}`,
    `    DATABASE_PATH=${DEFAULTS.DATABASE_PATH}`,
    '',
    border,
    ''
  );
  
  return lines.join('\n');
}

/**
 * Validates that all required environment variables are present and non-empty.
 * 
 * @throws {Error} Detailed error message listing all missing environment variables
 *                 with instructions for creating the .env file
 * @private
 */
function validateRequiredEnvVars() {
  const missingVars = [];
  
  for (const varName of REQUIRED_ENV_VARS) {
    const value = process.env[varName];
    
    if (value === undefined || value === null || value.trim() === '') {
      missingVars.push(varName);
    }
  }
  
  if (missingVars.length > 0) {
    throw new Error(formatMissingVarsError(missingVars));
  }
}

/**
 * Parses the PORT environment variable with validation.
 * 
 * @returns {number} Parsed port number or default
 * @private
 */
function parsePort() {
  const portStr = process.env.PORT;
  
  if (!portStr) {
    return DEFAULTS.PORT;
  }
  
  const parsed = parseInt(portStr, 10);
  
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 65535) {
    console.warn(
      `[config] Warning: Invalid PORT value "${portStr}". ` +
      `Using default port ${DEFAULTS.PORT}.`
    );
    return DEFAULTS.PORT;
  }
  
  return parsed;
}

/**
 * Builds the configuration object from validated environment variables.
 * Applies default values for optional configuration settings.
 * The returned object is frozen to prevent modification.
 * 
 * @returns {Readonly<Config>} The immutable configuration object
 * @private
 */
function buildConfig() {
  return Object.freeze({
    // Required API keys (guaranteed to exist after validation)
    RTRVR_API_KEY: /** @type {string} */ (process.env.RTRVR_API_KEY),
    CEREBRAS_API_KEY: /** @type {string} */ (process.env.CEREBRAS_API_KEY),
    ELEVENLABS_API_KEY: /** @type {string} */ (process.env.ELEVENLABS_API_KEY),
    GROK_API_KEY: /** @type {string} */ (process.env.GROK_API_KEY),
    TWILIO_ACCOUNT_SID: /** @type {string} */ (process.env.TWILIO_ACCOUNT_SID),
    TWILIO_AUTH_TOKEN: /** @type {string} */ (process.env.TWILIO_AUTH_TOKEN),
    TWILIO_PHONE_NUMBER: /** @type {string} */ (process.env.TWILIO_PHONE_NUMBER),
    TOOLHOUSE_API_KEY: /** @type {string} */ (process.env.TOOLHOUSE_API_KEY),
    
    // Optional configuration with sensible defaults
    NODE_ENV: process.env.NODE_ENV || DEFAULTS.NODE_ENV,
    PORT: parsePort(),
    DATABASE_PATH: process.env.DATABASE_PATH || DEFAULTS.DATABASE_PATH
  });
}

/**
 * Initializes and validates the configuration.
 * This function is called automatically at module load time.
 * 
 * @throws {Error} If any required environment variables are missing
 * @private
 */
function initializeConfig() {
  if (isValidated) {
    return;
  }
  
  validateRequiredEnvVars();
  cachedConfig = buildConfig();
  isValidated = true;
  
  // Log successful initialization in non-production environments
  if (cachedConfig.NODE_ENV !== 'production') {
    console.log(
      `[config] Configuration loaded successfully (${cachedConfig.NODE_ENV} mode)`
    );
  }
}

// Perform validation at module initialization
// This ensures the application fails fast if configuration is invalid
initializeConfig();

/**
 * Returns the validated configuration object.
 * 
 * This function implements the singleton pattern - the configuration is validated
 * once at module load time and the same frozen object is returned on every call.
 * 
 * The returned configuration object is frozen (immutable) to prevent
 * accidental modification of configuration values during runtime.
 * 
 * @returns {Readonly<Config>} The validated, immutable configuration object
 * 
 * @example
 * // Basic usage
 * import { getConfig } from './utils/config.js';
 * 
 * const config = getConfig();
 * 
 * // Access API keys
 * const apiKey = config.CEREBRAS_API_KEY;
 * const twilioSid = config.TWILIO_ACCOUNT_SID;
 * 
 * // Access optional settings (uses defaults if not specified)
 * const port = config.PORT; // 3001
 * const env = config.NODE_ENV; // 'development'
 * const dbPath = config.DATABASE_PATH; // './data/proof.db'
 * 
 * @example
 * // Use with destructuring
 * const { GROK_API_KEY, TOOLHOUSE_API_KEY, PORT } = getConfig();
 */
function getConfig() {
  // Config is guaranteed to be initialized at this point due to
  // initializeConfig() call at module load time
  return /** @type {Readonly<Config>} */ (cachedConfig);
}

/**
 * Checks whether the configuration has been loaded and validated.
 * 
 * Note: Under normal operation, this will always return true because
 * validation occurs at module load time. This function is primarily
 * useful for debugging and testing scenarios.
 * 
 * @returns {boolean} True if configuration has been loaded, false otherwise
 * 
 * @example
 * import { isConfigLoaded, getConfig } from './utils/config.js';
 * 
 * if (isConfigLoaded()) {
 *   const config = getConfig();
 *   // ... use config
 * }
 */
function isConfigLoaded() {
  return isValidated && cachedConfig !== null;
}

/**
 * Resets the cached configuration, forcing re-validation on next access.
 * 
 * **⚠️ WARNING: This function is intended for testing purposes only.**
 * 
 * Using this in production code may cause:
 * - Inconsistent configuration state across modules
 * - Race conditions in concurrent code
 * - Unexpected validation errors after reset
 * 
 * After calling resetConfig(), the next call to getConfig() will:
 * 1. Re-validate all required environment variables
 * 2. Rebuild the configuration object
 * 3. Cache the new configuration
 * 
 * @returns {void}
 * 
 * @example
 * // In test files
 * import { resetConfig, getConfig } from './utils/config.js';
 * 
 * describe('MyModule', () => {
 *   beforeEach(() => {
 *     // Reset config and set test environment variables
 *     resetConfig();
 *     process.env.RTRVR_API_KEY = 'test-rtrvr-key';
 *     process.env.CEREBRAS_API_KEY = 'test-cerebras-key';
 *     // ... set all other required env vars
 *   });
 * 
 *   afterEach(() => {
 *     resetConfig();
 *   });
 * 
 *   it('should use config values', () => {
 *     initializeConfigForTest(); // Re-initialize after setting env vars
 *     const config = getConfig();
 *     expect(config.RTRVR_API_KEY).toBe('test-rtrvr-key');
 *   });
 * });
 */
function resetConfig() {
  cachedConfig = null;
  isValidated = false;
}

/**
 * Re-initializes the configuration after a reset.
 * 
 * **⚠️ WARNING: This function is intended for testing purposes only.**
 * 
 * This should be called after resetConfig() and after setting up
 * test environment variables to trigger re-validation.
 * 
 * @throws {Error} If any required environment variables are missing
 * @returns {void}
 * 
 * @example
 * // In test setup
 * resetConfig();
 * process.env.RTRVR_API_KEY = 'test-key';
 * // ... set other env vars
 * initializeConfigForTest();
 */
function initializeConfigForTest() {
  initializeConfig();
}

/**
 * Returns the list of required environment variable names.
 * Useful for documentation and validation utilities.
 * 
 * @returns {ReadonlyArray<string>} Array of required environment variable names
 * 
 * @example
 * import { getRequiredEnvVars } from './utils/config.js';
 * 
 * const required = getRequiredEnvVars();
 * console.log('Required environment variables:', required);
 * // ['RTRVR_API_KEY', 'CEREBRAS_API_KEY', ...]
 */
function getRequiredEnvVars() {
  return REQUIRED_ENV_VARS;
}

/**
 * Returns the default values for optional configuration settings.
 * Useful for documentation and understanding default behavior.
 * 
 * @returns {Readonly<{NODE_ENV: string, PORT: number, DATABASE_PATH: string}>}
 * 
 * @example
 * import { getDefaults } from './utils/config.js';
 * 
 * const defaults = getDefaults();
 * console.log('Default port:', defaults.PORT); // 3001
 */
function getDefaults() {
  return DEFAULTS;
}

export {
  getConfig,
  isConfigLoaded,
  resetConfig,
  initializeConfigForTest,
  getRequiredEnvVars,
  getDefaults
};