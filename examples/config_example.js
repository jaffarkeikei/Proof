/**
 * @fileoverview Example usage of the config module
 * @description Demonstrates how to use the centralized configuration manager
 * to access validated environment variables and API keys.
 * 
 * Prerequisites:
 *   1. Create a .env file in the project root directory
 *   2. Add all required environment variables (see getRequiredEnvVars())
 *   3. Run from project root: node examples/config_example.js
 * 
 * @module examples/config_example
 */

// Import config module functions
// Path is relative to examples/ directory
import {
  getConfig,
  isConfigLoaded,
  getRequiredEnvVars,
  getDefaults
} from '../src/utils/config.js';

/**
 * Demonstrates basic configuration access.
 * 
 * Input: None (reads from environment via getConfig())
 * Output: Logs configuration values to console
 */
function demonstrateBasicUsage() {
  console.log('=== Basic Config Usage ===\n');
  
  // Check if configuration loaded successfully
  // Always true under normal operation (validation happens at import)
  if (isConfigLoaded()) {
    console.log('✓ Configuration loaded and validated\n');
  }
  
  // Get the immutable configuration object (singleton pattern)
  const config = getConfig();
  
  // Access optional settings with their defaults
  console.log('Environment:', config.NODE_ENV);      // 'development'
  console.log('Server Port:', config.PORT);          // 3001
  console.log('Database Path:', config.DATABASE_PATH); // './data/proof.db'
}

/**
 * Demonstrates safe API key access patterns.
 * 
 * Input: None
 * Output: Logs masked API keys to console for security
 */
function demonstrateApiKeyAccess() {
  console.log('\n=== API Key Access ===\n');
  
  const config = getConfig();
  
  // Helper to mask sensitive values for display
  const maskKey = (key) => 
    key ? `${key.substring(0, 4)}...${key.slice(-4)}` : 'N/A';
  
  // All API keys guaranteed to exist after validation
  console.log('Cerebras API Key:', maskKey(config.CEREBRAS_API_KEY));
  console.log('Grok API Key:', maskKey(config.GROK_API_KEY));
  console.log('ElevenLabs API Key:', maskKey(config.ELEVENLABS_API_KEY));
  console.log('Toolhouse API Key:', maskKey(config.TOOLHOUSE_API_KEY));
  console.log('Rtrvr API Key:', maskKey(config.RTRVR_API_KEY));
  
  // Twilio credentials
  console.log('\nTwilio Account SID:', maskKey(config.TWILIO_ACCOUNT_SID));
  console.log('Twilio Phone:', config.TWILIO_PHONE_NUMBER);
}

/**
 * Demonstrates destructuring for selective config access.
 * Use this pattern when you only need specific values.
 * 
 * Input: None
 * Output: Logs extracted config values
 */
function demonstrateDestructuring() {
  console.log('\n=== Using Destructuring ===\n');
  
  // Extract only the values you need
  const { PORT, NODE_ENV, DATABASE_PATH, CEREBRAS_API_KEY } = getConfig();
  
  console.log(`Server: port ${PORT} in ${NODE_ENV} mode`);
  console.log(`Database: ${DATABASE_PATH}`);
  console.log(`Cerebras configured: ${CEREBRAS_API_KEY ? 'Yes' : 'No'}`);
}

/**
 * Demonstrates utility functions for documentation/debugging.
 * 
 * Input: None
 * Output: Lists required variables and default values
 */
function demonstrateUtilityFunctions() {
  console.log('\n=== Utility Functions ===\n');
  
  // Get list of all required environment variables
  const requiredVars = getRequiredEnvVars();
  console.log('Required environment variables:');
  requiredVars.forEach((varName, i) => {
    console.log(`  ${i + 1}. ${varName}`);
  });
  
  // Get default values for optional settings
  const defaults = getDefaults();
  console.log('\nDefault values:');
  console.log(`  NODE_ENV: ${defaults.NODE_ENV}`);
  console.log(`  PORT: ${defaults.PORT}`);
  console.log(`  DATABASE_PATH: ${defaults.DATABASE_PATH}`);
}

/**
 * Example: Service initialization pattern.
 * Shows a common real-world usage scenario.
 * 
 * @returns {Object} Mock initialized service clients
 */
function initializeServicesExample() {
  console.log('\n=== Service Initialization Pattern ===\n');
  
  const config = getConfig();
  
  // Initialize API clients with config values
  // (In production, these would be actual SDK initializations)
  const services = {
    cerebras: { apiKey: config.CEREBRAS_API_KEY, ready: true },
    twilio: {
      accountSid: config.TWILIO_ACCOUNT_SID,
      authToken: config.TWILIO_AUTH_TOKEN,
      phone: config.TWILIO_PHONE_NUMBER,
      ready: true
    },
    elevenlabs: { apiKey: config.ELEVENLABS_API_KEY, ready: true }
  };
  
  console.log('Services initialized:');
  Object.keys(services).forEach(name => console.log(`  ✓ ${name}`));
  
  return services;
}

// Main execution
function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║       Config Module Usage Examples           ║');
  console.log('╚══════════════════════════════════════════════╝\n');
  
  try {
    demonstrateBasicUsage();
    demonstrateApiKeyAccess();
    demonstrateDestructuring();
    demonstrateUtilityFunctions();
    initializeServicesExample();
    
    console.log('\n✓ All examples completed successfully!');
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error('\nEnsure all required env vars are in .env file.');
    process.exit(1);
  }
}

main();