/**
 * @fileoverview Example usage of the validation module
 * Demonstrates Zod-based validation for API requests, pipeline inputs,
 * and inter-agent data contracts.
 * 
 * Run from project root: node examples/validation_example.js
 */

import {
  // Validation functions
  validatePipelineInput,
  safeParsePipelineInput,
  validateReview,
  validateReviews,
  validateAnalyzedReview,
  validateVideo,
  validatePipelineStatus,
  validatePermissionStatus,
  validate,
  safeParse,
  
  // Schemas (for custom validation or middleware)
  pipelineInputSchema,
  reviewSchema,
  analyzedReviewSchema,
  videoSchema,
  
  // Error class
  ValidationError,
  
  // Middleware factories
  validateBody,
  validateQuery,
} from '../src/utils/validation.js';

// ============================================================================
// Example 1: Validate Pipeline Input
// ============================================================================
console.log('=== Example 1: Pipeline Input Validation ===\n');

/**
 * Validates pipeline input for starting a review processing job
 * @param {Object} input - Raw input from API request
 * @param {string} input.companyName - Required company name (1-200 chars)
 * @param {string} [input.targetAudience] - Optional audience description
 * @param {number} [input.maxReviews] - Optional max reviews (1-1000)
 * @param {string[]} [input.platforms] - Optional platforms: google, yelp, facebook, trustpilot, other
 * @returns {Object} Validated and trimmed input data
 */
function processPipelineRequest(input) {
  try {
    const validInput = validatePipelineInput(input);
    console.log('✅ Valid pipeline input:', validInput);
    return validInput;
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('❌ Validation failed:', error.getSummary());
      console.error('   Schema:', error.schemaName);
      console.error('   Details:', JSON.stringify(error.details, null, 2));
    }
    throw error;
  }
}

// Valid input example
processPipelineRequest({
  companyName: 'Acme Corporation',
  targetAudience: 'Small business owners',
  maxReviews: 100,
  platforms: ['google', 'yelp'],
  webhookUrl: 'https://example.com/webhook',
});

// Invalid input example (using safe parse to avoid throwing)
const invalidResult = safeParsePipelineInput({
  companyName: '', // Empty - will fail
  maxReviews: -5,  // Negative - will fail
});

if (!invalidResult.success) {
  console.log('\n❌ Safe parse caught error:', invalidResult.error.getSummary());
}

// ============================================================================
// Example 2: Validate Reviews
// ============================================================================
console.log('\n=== Example 2: Review Validation ===\n');

/**
 * Validates a single review from external scraping source
 * @param {Object} review - Raw review data
 * @param {string} review.platform - Source platform (google, yelp, etc.)
 * @param {string} review.author - Reviewer name (max 100 chars)
 * @param {number} review.rating - Rating from 1 to 5
 * @param {string} review.text - Review content (max 10000 chars)
 * @param {string} review.date - ISO 8601 date string
 * @param {Object} [review.metadata] - Optional metadata (sourceUrl, verified, etc.)
 * @returns {Object} Validated review with normalized platform name
 */
function processReview(review) {
  const validated = validateReview(review);
  console.log('✅ Valid review from:', validated.platform, 'by', validated.author);
  return validated;
}

// Single review validation
const review = processReview({
  platform: 'Google',  // Will be lowercased
  author: 'John Doe',
  rating: 5,
  text: 'Excellent service! Would highly recommend to anyone.',
  date: '2024-01-15T10:30:00Z',
  metadata: {
    sourceUrl: 'https://google.com/review/123',
    verified: true,
    helpfulVotes: 42,
    language: 'en',
  },
});

// Batch review validation
const reviews = validateReviews([
  {
    platform: 'yelp',
    author: 'Jane Smith',
    rating: 4,
    text: 'Great experience overall.',
    date: '2024-02-20T14:00:00Z',
  },
  {
    platform: 'facebook',
    author: 'Bob Wilson',
    rating: 5,
    text: 'Best in town!',
    date: '2024-03-01T09:15:00Z',
  },
]);
console.log(`✅ Validated ${reviews.length} reviews`);

// ============================================================================
// Example 3: Validate Analyzed Reviews
// ============================================================================
console.log('\n=== Example 3: Analyzed Review Validation ===\n');

/**
 * Validates an analyzed review after AI processing
 * @param {Object} analyzedReview - Review with analysis data
 * @param {number} analyzedReview.sentimentScore - Sentiment from 0 to 1
 * @param {string[]} analyzedReview.extractedQuotes - Notable quotes from review
 * @param {number} analyzedReview.conversionPotential - Potential score 0 to 10
 * @param {string[]} [analyzedReview.themes] - Identified topics
 * @param {string} [analyzedReview.summary] - AI summary (max 500 chars)
 * @returns {Object} Validated analyzed review
 */
function processAnalyzedReview(analyzedReview) {
  const validated = validateAnalyzedReview(analyzedReview);
  console.log('✅ Analyzed review - Sentiment:', validated.sentimentScore.toFixed(2),
              'Conversion:', validated.conversionPotential);
  return validated;
}

processAnalyzedReview({
  // Base review fields
  platform: 'google',
  author: 'Sarah Johnson',
  rating: 5,
  text: 'The team went above and beyond. Their attention to detail was remarkable.',
  date: '2024-01-20T16:45:00Z',
  // Analysis fields
  sentimentScore: 0.95,
  extractedQuotes: ['went above and beyond', 'attention to detail was remarkable'],
  conversionPotential: 8.5,
  themes: ['customer service', 'quality'],
  summary: 'Highly positive review praising exceptional service quality.',
  analyzedAt: '2024-01-20T17:00:00Z',
});

// ============================================================================
// Example 4: Validate Video Data
// ============================================================================
console.log('\n=== Example 4: Video Validation ===\n');

/**
 * Validates video metadata after generation
 * @param {Object} video - Video data
 * @param {string} video.id - UUID or unique identifier
 * @param {string} video.scriptId - Associated script ID
 * @param {string} video.filePath - Path to video file
 * @param {number} video.duration - Duration in seconds (max 3600)
 * @param {string} video.status - Status: pending, in-progress, completed, error
 * @param {string} video.createdAt - ISO 8601 timestamp
 * @returns {Object} Validated video data
 */
function processVideoData(video) {
  const validated = validateVideo(video);
  console.log('✅ Video validated - Status:', validated.status,
              'Duration:', validated.duration + 's');
  return validated;
}

processVideoData({
  id: '550e8400-e29b-41d4-a716-446655440000',
  scriptId: 'script-001',
  filePath: '/videos/output/testimonial-001.mp4',
  duration: 45.5,
  status: 'completed',
  createdAt: '2024-01-21T12:00:00Z',
  format: 'mp4',
  resolution: { width: 1920, height: 1080 },
  fileSize: 15728640,
});

// ============================================================================
// Example 5: Validate Pipeline Status
// ============================================================================
console.log('\n=== Example 5: Pipeline Status Validation ===\n');

/**
 * Validates pipeline status updates
 * @param {Object} status - Pipeline status data
 * @param {number} status.runId - Unique run identifier
 * @param {string} status.status - Current status enum
 * @param {string} status.currentStage - Active stage name
 * @param {number} status.progress - Progress percentage 0-100
 * @param {string} [status.error] - Error message (required if status is 'error')
 * @param {Array} [status.stages] - Individual stage statuses
 * @returns {Object} Validated status data
 */
function updatePipelineStatus(status) {
  const validated = validatePipelineStatus(status);
  console.log('✅ Pipeline status - Run:', validated.runId,
              'Stage:', validated.currentStage,
              'Progress:', validated.progress + '%');
  return validated;
}

updatePipelineStatus({
  runId: 12345,
  status: 'in-progress',
  currentStage: 'analyzing-reviews',
  progress: 65,
  startedAt: '2024-01-21T10:00:00Z',
  stages: [
    { name: 'scraping', status: 'completed', duration: 15000 },
    { name: 'analyzing-reviews', status: 'in-progress' },
    { name: 'generating-scripts', status: 'pending' },
  ],
});

// Error status requires error message
updatePipelineStatus({
  runId: 12346,
  status: 'error',
  currentStage: 'scraping',
  progress: 10,
  error: 'Failed to connect to review source API',
});

// ============================================================================
// Example 6: Validate Permission Status
// ============================================================================
console.log('\n=== Example 6: Permission Status Validation ===\n');

/**
 * Validates permission/consent tracking data
 * @param {Object} permission - Permission status data
 * @param {string} permission.reviewId - Associated review ID
 * @param {string} permission.status - Status: pending, approved, denied, expired
 * @param {string} permission.consentToken - Token (min 16 chars)
 * @param {string} [permission.phoneNumber] - E.164 format phone
 * @param {string} [permission.email] - Contact email
 * @returns {Object} Validated permission data
 */
function trackPermission(permission) {
  const validated = validatePermissionStatus(permission);
  console.log('✅ Permission tracked - Review:', validated.reviewId,
              'Status:', validated.status);
  return validated;
}

trackPermission({
  reviewId: 'review-abc-123',
  status: 'pending',
  consentToken: 'secure-token-1234567890',
  email: 'customer@example.com',
  phoneNumber: '+14155551234',
  requestedAt: '2024-01-21T11:00:00Z',
  expiresAt: '2024-02-21T11:00:00Z',
});

// ============================================================================
// Example 7: Generic Validation with Custom Schemas
// ============================================================================
console.log('\n=== Example 7: Generic Validation ===\n');

import { z } from 'zod';

// Define a custom schema
const webhookPayloadSchema = z.object({
  event: z.enum(['review.created', 'video.completed', 'pipeline.finished']),
  timestamp: z.string().datetime(),
  payload: z.record(z.unknown()),
});

/**
 * Generic validation function for any Zod schema
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {unknown} data - Input data to validate
 * @param {string} schemaName - Name for error reporting
 * @returns {Object} Validated data matching schema type
 */
const webhookData = validate(
  webhookPayloadSchema,
  {
    event: 'video.completed',
    timestamp: '2024-01-21T12:30:00Z',
    payload: { videoId: 'vid-001', duration: 45 },
  },
  'WebhookPayload'
);
console.log('✅ Custom schema validated:', webhookData.event);

// Safe parse without throwing
const parseResult = safeParse(
  webhookPayloadSchema,
  { event: 'invalid-event' },
  'WebhookPayload'
);

if (!parseResult.success) {
  console.log('❌ Safe parse error:', parseResult.error.message);
}

// ============================================================================
// Example 8: Express Middleware Usage
// ============================================================================
console.log('\n=== Example 8: Express Middleware (Demo) ===\n');

/**
 * Demonstrates middleware factory usage with Express
 * 
 * validateBody(schema, schemaName) - Creates body validation middleware
 *   - Validates req.body against schema
 *   - Sets req.validatedBody on success
 *   - Returns 400 JSON response on failure
 * 
 * validateQuery(schema, schemaName) - Creates query validation middleware
 *   - Validates req.query against schema
 *   - Sets req.validatedQuery on success
 */

// Example middleware setup (not executed - for demonstration)
const middlewareExample = `
import express from 'express';
import { validateBody, pipelineInputSchema } from '../src/utils/validation.js';

const app = express();
app.use(express.json());

// Apply validation middleware to route
app.post('/api/pipeline', 
  validateBody(pipelineInputSchema, 'PipelineInput'),
  (req, res) => {
    // req.validatedBody contains validated data
    const { companyName, maxReviews } = req.validatedBody;
    res.json({ message: 'Pipeline started', companyName });
  }
);
`;

console.log('Middleware example code:');
console.log(middlewareExample);

// ============================================================================
// Example 9: Error Handling Patterns
// ============================================================================
console.log('=== Example 9: Error Handling ===\n');

/**
 * Demonstrates comprehensive error handling with ValidationError
 * 
 * ValidationError properties:
 * - message: Error description
 * - schemaName: Schema that failed validation
 * - details: Array of {path, message, code, received}
 * - timestamp: ISO timestamp of error
 * 
 * ValidationError methods:
 * - getSummary(): Returns "field: message; field2: message2" string
 * - toJSON(): Returns serializable error object
 */
try {
  validatePipelineInput({
    companyName: '', // Empty - required
    maxReviews: 'not-a-number', // Wrong type
    platforms: ['invalid-platform'], // Invalid enum
  });
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Error Name:', error.name);
    console.log('Schema:', error.schemaName);
    console.log('Timestamp:', error.timestamp);
    console.log('Summary:', error.getSummary());
    console.log('JSON:', JSON.stringify(error.toJSON(), null, 2));
  }
}

console.log('\n✅ All examples completed successfully!');