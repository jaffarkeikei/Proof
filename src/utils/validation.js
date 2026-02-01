// src/utils/validation.js
// Zod-based validation module for API requests, pipeline inputs, and inter-agent data contracts

import { z } from 'zod';

// ============================================================================
// Custom Error Class
// ============================================================================

/**
 * Custom validation error with structured details
 * @extends Error
 */
export class ValidationError extends Error {
  /**
   * @param {string} message - Error message
   * @param {Array<Object>} details - Zod error details
   * @param {string} [schemaName] - Name of the schema that failed validation
   */
  constructor(message, details, schemaName = 'unknown') {
    super(message);
    this.name = 'ValidationError';
    this.schemaName = schemaName;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Get a user-friendly error summary
   * @returns {string}
   */
  getSummary() {
    return this.details
      .map(err => `${err.path.join('.')}: ${err.message}`)
      .join('; ');
  }

  /**
   * Convert to JSON-serializable object
   * @returns {Object}
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      schemaName: this.schemaName,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

// ============================================================================
// Enum Definitions
// ============================================================================

/**
 * @typedef {'pending' | 'in-progress' | 'completed' | 'error'} StatusEnum
 */
export const statusEnum = z.enum(['pending', 'in-progress', 'completed', 'error'], {
  errorMap: () => ({ message: 'Status must be one of: pending, in-progress, completed, error' }),
});

/**
 * @typedef {'pending' | 'approved' | 'denied' | 'expired'} PermissionStatusEnum
 */
export const permissionStatusEnum = z.enum(['pending', 'approved', 'denied', 'expired'], {
  errorMap: () => ({ message: 'Permission status must be one of: pending, approved, denied, expired' }),
});

/**
 * @typedef {'google' | 'yelp' | 'facebook' | 'trustpilot' | 'other'} PlatformEnum
 */
export const platformEnum = z.enum(['google', 'yelp', 'facebook', 'trustpilot', 'other'], {
  errorMap: () => ({ message: 'Platform must be one of: google, yelp, facebook, trustpilot, other' }),
});

// ============================================================================
// Reusable Field Validators
// ============================================================================

/**
 * E.164 phone number format regex
 * Format: +[country code][number] (e.g., +14155551234)
 */
const E164_PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

/**
 * ISO 8601 date string validator with custom error message
 */
const isoDateString = z.string().refine(
  (val) => {
    const date = new Date(val);
    return !isNaN(date.getTime()) && val.includes('T');
  },
  { message: 'Must be a valid ISO 8601 date string (e.g., 2024-01-15T10:30:00Z)' }
);

/**
 * URL string validator
 */
const urlString = z.string().url({ message: 'Must be a valid URL' });

/**
 * Email string validator
 */
const emailString = z.string().email({ message: 'Must be a valid email address' });

/**
 * E.164 phone number validator
 */
const phoneNumber = z.string().regex(E164_PHONE_REGEX, {
  message: 'Phone number must be in E.164 format (e.g., +14155551234)',
});

/**
 * Non-empty string validator factory
 * @param {string} fieldName - Name of the field for error message
 * @returns {z.ZodString}
 */
const nonEmptyString = (fieldName) =>
  z.string().min(1, { message: `${fieldName} is required and cannot be empty` });

/**
 * Bounded number validator factory
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {string} fieldName - Name of the field for error message
 * @returns {z.ZodNumber}
 */
const boundedNumber = (min, max, fieldName) =>
  z
    .number({ invalid_type_error: `${fieldName} must be a number` })
    .min(min, { message: `${fieldName} must be at least ${min}` })
    .max(max, { message: `${fieldName} must be at most ${max}` });

// ============================================================================
// Schema Definitions
// ============================================================================

// ----------------------------------------------------------------------------
// PipelineInput Schema
// ----------------------------------------------------------------------------

/**
 * @typedef {Object} PipelineInput
 * @property {string} companyName - Company name (min 1 character)
 * @property {string} [targetAudience] - Optional target audience description
 * @property {number} [maxReviews] - Optional maximum number of reviews to process
 * @property {string[]} [platforms] - Optional list of platforms to scrape
 */
export const pipelineInputSchema = z.object({
  companyName: nonEmptyString('Company name')
    .max(200, { message: 'Company name must be 200 characters or less' })
    .trim(),
  targetAudience: z.string().max(500).trim().optional(),
  maxReviews: z.coerce
    .number()
    .int({ message: 'Max reviews must be an integer' })
    .positive({ message: 'Max reviews must be positive' })
    .max(1000, { message: 'Max reviews cannot exceed 1000' })
    .optional(),
  platforms: z.array(platformEnum).optional(),
  webhookUrl: urlString.optional(),
  notificationEmail: emailString.optional(),
}).strict();

// ----------------------------------------------------------------------------
// Review Metadata Schema (nested object)
// ----------------------------------------------------------------------------

/**
 * @typedef {Object} ReviewMetadata
 * @property {string} [sourceUrl] - URL where the review was found
 * @property {boolean} [verified] - Whether the reviewer is verified
 * @property {number} [helpfulVotes] - Number of helpful votes
 * @property {string} [responseFromOwner] - Business owner's response
 * @property {string[]} [photos] - Array of photo URLs
 * @property {string} [language] - Detected language code
 */
export const reviewMetadataSchema = z.object({
  sourceUrl: urlString.optional(),
  verified: z.boolean().optional(),
  helpfulVotes: z
    .number()
    .int({ message: 'Helpful votes must be an integer' })
    .nonnegative({ message: 'Helpful votes cannot be negative' })
    .optional(),
  responseFromOwner: z.string().max(5000).optional(),
  photos: z.array(urlString).optional(),
  language: z.string().length(2, { message: 'Language must be a 2-letter ISO code' }).optional(),
}).passthrough(); // Allow additional metadata properties

// ----------------------------------------------------------------------------
// Review Schema
// ----------------------------------------------------------------------------

/**
 * @typedef {Object} Review
 * @property {string} platform - Review platform (google, yelp, etc.)
 * @property {string} author - Author name
 * @property {number} rating - Rating from 1 to 5
 * @property {string} text - Review text content
 * @property {string} date - ISO 8601 date string
 * @property {ReviewMetadata} [metadata] - Optional metadata object
 */
export const reviewSchema = z.object({
  platform: nonEmptyString('Platform').toLowerCase(),
  author: nonEmptyString('Author').max(100, { message: 'Author name must be 100 characters or less' }),
  rating: boundedNumber(1, 5, 'Rating'),
  text: nonEmptyString('Review text').max(10000, { message: 'Review text must be 10000 characters or less' }),
  date: isoDateString,
  metadata: reviewMetadataSchema.optional(),
});

/**
 * Schema for array of reviews
 */
export const reviewArraySchema = z.array(reviewSchema).min(1, {
  message: 'At least one review is required',
});

// ----------------------------------------------------------------------------
// AnalyzedReview Schema (extends Review)
// ----------------------------------------------------------------------------

/**
 * @typedef {Object} AnalyzedReview
 * @extends Review
 * @property {number} sentimentScore - Sentiment score from 0 to 1
 * @property {string[]} extractedQuotes - Array of extracted quotes
 * @property {number} conversionPotential - Conversion potential from 0 to 10
 * @property {string[]} [themes] - Identified themes/topics
 * @property {string} [summary] - AI-generated summary
 */
export const analyzedReviewSchema = reviewSchema.extend({
  sentimentScore: boundedNumber(0, 1, 'Sentiment score'),
  extractedQuotes: z
    .array(z.string().min(1, { message: 'Quote cannot be empty' }))
    .default([]),
  conversionPotential: boundedNumber(0, 10, 'Conversion potential'),
  themes: z.array(z.string()).optional(),
  summary: z.string().max(500).optional(),
  analyzedAt: isoDateString.optional(),
});

/**
 * Schema for array of analyzed reviews
 */
export const analyzedReviewArraySchema = z.array(analyzedReviewSchema);

// ----------------------------------------------------------------------------
// Video Schema
// ----------------------------------------------------------------------------

/**
 * @typedef {Object} Video
 * @property {string} id - Unique video identifier
 * @property {string} scriptId - Associated script identifier
 * @property {string} filePath - Path to video file
 * @property {number} duration - Video duration in seconds
 * @property {StatusEnum} status - Current video status
 * @property {string} createdAt - ISO 8601 creation timestamp
 * @property {string} [thumbnailPath] - Path to thumbnail image
 * @property {number} [fileSize] - File size in bytes
 * @property {string} [format] - Video format (mp4, webm, etc.)
 */
export const videoSchema = z.object({
  id: nonEmptyString('Video ID').uuid({ message: 'Video ID must be a valid UUID' }).or(nonEmptyString('Video ID')),
  scriptId: nonEmptyString('Script ID'),
  filePath: nonEmptyString('File path'),
  duration: z
    .number({ invalid_type_error: 'Duration must be a number' })
    .positive({ message: 'Duration must be positive' })
    .max(3600, { message: 'Duration cannot exceed 3600 seconds (1 hour)' }),
  status: statusEnum,
  createdAt: isoDateString,
  thumbnailPath: z.string().optional(),
  fileSize: z
    .number()
    .int()
    .positive({ message: 'File size must be positive' })
    .optional(),
  format: z.enum(['mp4', 'webm', 'mov', 'avi']).optional(),
  resolution: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }).optional(),
});

// ----------------------------------------------------------------------------
// PipelineStatus Schema
// ----------------------------------------------------------------------------

/**
 * @typedef {Object} PipelineStage
 * @property {string} name - Stage name
 * @property {StatusEnum} status - Stage status
 * @property {number} [duration] - Duration in milliseconds
 */
export const pipelineStageSchema = z.object({
  name: nonEmptyString('Stage name'),
  status: statusEnum,
  startedAt: isoDateString.optional(),
  completedAt: isoDateString.optional(),
  duration: z.number().nonnegative().optional(),
});

/**
 * @typedef {Object} PipelineStatus
 * @property {number} runId - Unique run identifier
 * @property {StatusEnum} status - Overall pipeline status
 * @property {string} currentStage - Current stage name
 * @property {number} progress - Progress percentage (0-100)
 * @property {string} [error] - Error message if status is 'error'
 * @property {PipelineStage[]} [stages] - Individual stage statuses
 */
export const pipelineStatusSchema = z.object({
  runId: z.coerce
    .number({ invalid_type_error: 'Run ID must be a number' })
    .int({ message: 'Run ID must be an integer' })
    .positive({ message: 'Run ID must be positive' }),
  status: statusEnum,
  currentStage: nonEmptyString('Current stage'),
  progress: boundedNumber(0, 100, 'Progress'),
  error: z.string().optional(),
  stages: z.array(pipelineStageSchema).optional(),
  startedAt: isoDateString.optional(),
  completedAt: isoDateString.optional(),
  metadata: z.record(z.unknown()).optional(),
}).refine(
  (data) => {
    // If status is 'error', error message should be provided
    if (data.status === 'error' && !data.error) {
      return false;
    }
    return true;
  },
  {
    message: 'Error message is required when status is "error"',
    path: ['error'],
  }
);

// ----------------------------------------------------------------------------
// PermissionStatus Schema
// ----------------------------------------------------------------------------

/**
 * @typedef {Object} PermissionStatus
 * @property {string} reviewId - Associated review identifier
 * @property {PermissionStatusEnum} status - Permission request status
 * @property {string} consentToken - Unique consent token
 * @property {string} [phoneNumber] - Phone number in E.164 format
 * @property {string} [email] - Contact email
 * @property {string} [expiresAt] - Token expiration date
 */
export const permissionStatusSchema = z.object({
  reviewId: nonEmptyString('Review ID'),
  status: permissionStatusEnum,
  consentToken: nonEmptyString('Consent token')
    .min(16, { message: 'Consent token must be at least 16 characters' }),
  phoneNumber: phoneNumber.optional(),
  email: emailString.optional(),
  requestedAt: isoDateString.optional(),
  respondedAt: isoDateString.optional(),
  expiresAt: isoDateString.optional(),
  notes: z.string().max(1000).optional(),
}).refine(
  (data) => data.phoneNumber || data.email,
  {
    message: 'Either phone number or email must be provided',
    path: ['phoneNumber'],
  }
);

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates pipeline input data
 * @param {unknown} input - Raw input data to validate
 * @returns {PipelineInput} Validated and parsed pipeline input
 * @throws {ValidationError} If validation fails
 * 
 * @example
 * try {
 *   const validInput = validatePipelineInput({ companyName: 'Acme Corp' });
 *   console.log(validInput.companyName); // 'Acme Corp'
 * } catch (error) {
 *   if (error instanceof ValidationError) {
 *     console.error(error.getSummary());
 *   }
 * }
 */
export function validatePipelineInput(input) {
  const result = pipelineInputSchema.safeParse(input);

  if (!result.success) {
    const formattedErrors = result.error.errors.map((err) => ({
      path: err.path,
      message: err.message,
      code: err.code,
      received: err.received,
    }));

    throw new ValidationError(
      `Pipeline input validation failed: ${formattedErrors.map(e => e.message).join(', ')}`,
      formattedErrors,
      'PipelineInput'
    );
  }

  return result.data;
}

/**
 * Safely validates pipeline input without throwing
 * @param {unknown} input - Raw input data to validate
 * @returns {{ success: true, data: PipelineInput } | { success: false, error: ValidationError }}
 * 
 * @example
 * const result = safeParsePipelineInput({ companyName: '' });
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error.details);
 * }
 */
export function safeParsePipelineInput(input) {
  try {
    const data = validatePipelineInput(input);
    return { success: true, data };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { success: false, error };
    }
    throw error;
  }
}

/**
 * Validates a single review
 * @param {unknown} input - Raw review data
 * @returns {Review} Validated review
 * @throws {ValidationError} If validation fails
 */
export function validateReview(input) {
  const result = reviewSchema.safeParse(input);

  if (!result.success) {
    throw new ValidationError(
      `Review validation failed: ${result.error.errors.map(e => e.message).join(', ')}`,
      result.error.errors,
      'Review'
    );
  }

  return result.data;
}

/**
 * Validates an array of reviews
 * @param {unknown} input - Raw reviews array
 * @returns {Review[]} Validated reviews array
 * @throws {ValidationError} If validation fails
 */
export function validateReviews(input) {
  const result = reviewArraySchema.safeParse(input);

  if (!result.success) {
    throw new ValidationError(
      `Reviews validation failed: ${result.error.errors.map(e => e.message).join(', ')}`,
      result.error.errors,
      'ReviewArray'
    );
  }

  return result.data;
}

/**
 * Validates an analyzed review
 * @param {unknown} input - Raw analyzed review data
 * @returns {AnalyzedReview} Validated analyzed review
 * @throws {ValidationError} If validation fails
 */
export function validateAnalyzedReview(input) {
  const result = analyzedReviewSchema.safeParse(input);

  if (!result.success) {
    throw new ValidationError(
      `Analyzed review validation failed: ${result.error.errors.map(e => e.message).join(', ')}`,
      result.error.errors,
      'AnalyzedReview'
    );
  }

  return result.data;
}

/**
 * Validates video data
 * @param {unknown} input - Raw video data
 * @returns {Video} Validated video
 * @throws {ValidationError} If validation fails
 */
export function validateVideo(input) {
  const result = videoSchema.safeParse(input);

  if (!result.success) {
    throw new ValidationError(
      `Video validation failed: ${result.error.errors.map(e => e.message).join(', ')}`,
      result.error.errors,
      'Video'
    );
  }

  return result.data;
}

/**
 * Validates pipeline status data
 * @param {unknown} input - Raw pipeline status data
 * @returns {PipelineStatus} Validated pipeline status
 * @throws {ValidationError} If validation fails
 */
export function validatePipelineStatus(input) {
  const result = pipelineStatusSchema.safeParse(input);

  if (!result.success) {
    throw new ValidationError(
      `Pipeline status validation failed: ${result.error.errors.map(e => e.message).join(', ')}`,
      result.error.errors,
      'PipelineStatus'
    );
  }

  return result.data;
}

/**
 * Validates permission status data
 * @param {unknown} input - Raw permission status data
 * @returns {PermissionStatus} Validated permission status
 * @throws {ValidationError} If validation fails
 */
export function validatePermissionStatus(input) {
  const result = permissionStatusSchema.safeParse(input);

  if (!result.success) {
    throw new ValidationError(
      `Permission status validation failed: ${result.error.errors.map(e => e.message).join(', ')}`,
      result.error.errors,
      'PermissionStatus'
    );
  }

  return result.data;
}

// ============================================================================
// Generic Validation Helper
// ============================================================================

/**
 * Generic validation function for any schema
 * @template T
 * @param {z.ZodSchema<T>} schema - Zod schema to validate against
 * @param {unknown} input - Input data to validate
 * @param {string} [schemaName='Unknown'] - Schema name for error reporting
 * @returns {T} Validated data
 * @throws {ValidationError} If validation fails
 * 
 * @example
 * const customSchema = z.object({ foo: z.string() });
 * const result = validate(customSchema, { foo: 'bar' }, 'CustomSchema');
 */
export function validate(schema, input, schemaName = 'Unknown') {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new ValidationError(
      `${schemaName} validation failed: ${result.error.errors.map(e => e.message).join(', ')}`,
      result.error.errors,
      schemaName
    );
  }

  return result.data;
}

/**
 * Generic safe parse function that doesn't throw
 * @template T
 * @param {z.ZodSchema<T>} schema - Zod schema to validate against
 * @param {unknown} input - Input data to validate
 * @param {string} [schemaName='Unknown'] - Schema name for error reporting
 * @returns {{ success: true, data: T } | { success: false, error: ValidationError }}
 */
export function safeParse(schema, input, schemaName = 'Unknown') {
  const result = schema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: new ValidationError(
      `${schemaName} validation failed`,
      result.error.errors,
      schemaName
    ),
  };
}

// ============================================================================
// Type Inference Exports (for TypeScript-like IDE support)
// ============================================================================

/**
 * @typedef {z.infer<typeof pipelineInputSchema>} PipelineInputType
 * @typedef {z.infer<typeof reviewSchema>} ReviewType
 * @typedef {z.infer<typeof analyzedReviewSchema>} AnalyzedReviewType
 * @typedef {z.infer<typeof videoSchema>} VideoType
 * @typedef {z.infer<typeof pipelineStatusSchema>} PipelineStatusType
 * @typedef {z.infer<typeof permissionStatusSchema>} PermissionStatusType
 * @typedef {z.infer<typeof reviewMetadataSchema>} ReviewMetadataType
 * @typedef {z.infer<typeof pipelineStageSchema>} PipelineStageType
 */

// ============================================================================
// Express Middleware Factory
// ============================================================================

/**
 * Creates Express middleware for request body validation
 * @param {z.ZodSchema} schema - Schema to validate against
 * @param {string} [schemaName] - Schema name for error reporting
 * @returns {function} Express middleware function
 * 
 * @example
 * app.post('/api/pipeline', validateBody(pipelineInputSchema, 'PipelineInput'), handler);
 */
export function validateBody(schema, schemaName = 'RequestBody') {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const error = new ValidationError(
        `${schemaName} validation failed`,
        result.error.errors,
        schemaName
      );

      return res.status(400).json({
        error: 'Validation Error',
        message: error.message,
        details: error.details,
      });
    }

    req.validatedBody = result.data;
    next();
  };
}

/**
 * Creates Express middleware for query parameter validation
 * @param {z.ZodSchema} schema - Schema to validate against
 * @param {string} [schemaName] - Schema name for error reporting
 * @returns {function} Express middleware function
 */
export function validateQuery(schema, schemaName = 'QueryParams') {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const error = new ValidationError(
        `${schemaName} validation failed`,
        result.error.errors,
        schemaName
      );

      return res.status(400).json({
        error: 'Validation Error',
        message: error.message,
        details: error.details,
      });
    }

    req.validatedQuery = result.data;
    next();
  };
}

// ============================================================================
// Default Export (for CommonJS compatibility)
// ============================================================================

export default {
  // Schemas
  pipelineInputSchema,
  reviewSchema,
  reviewArraySchema,
  analyzedReviewSchema,
  analyzedReviewArraySchema,
  videoSchema,
  pipelineStatusSchema,
  pipelineStageSchema,
  permissionStatusSchema,
  reviewMetadataSchema,
  
  // Enums
  statusEnum,
  permissionStatusEnum,
  platformEnum,
  
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
  
  // Middleware
  validateBody,
  validateQuery,
  
  // Error class
  ValidationError,
};