/**
 * @module agents/generation
 * @description Generation agent that creates video testimonials from approved customer reviews.
 * Uses ElevenLabs for text-to-speech voiceovers and Grok (xAI) for AI video generation.
 * Produces 3-5 video variations per review with different narrative angles
 * (problem-focused, solution-focused, transformation-focused).
 * 
 * @example
 * import { generateVideos } from './agents/generation.js';
 * 
 * const review = {
 *   id: 1,
 *   text: 'Amazing product! It solved all my problems...',
 *   author: 'John D.',
 *   rating: 5,
 *   platform: 'google'
 * };
 * 
 * const videos = await generateVideos(review);
 * console.log(`Generated ${videos.length} videos`);
 */

import { getConfig } from '../utils/config.js';
import { createLogger } from '../utils/logger.js';
import { saveVideo, updateVideo, getPermissions } from '../utils/database.js';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import crypto from 'crypto';

// ============================================================================
// Module Configuration
// ============================================================================

const logger = createLogger('GenerationAgent');

/**
 * Base URL for ElevenLabs API
 * @constant {string}
 */
const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io';

/**
 * Base URL for Grok (xAI) API
 * @constant {string}
 */
const GROK_API_BASE = 'https://api.x.ai';

/**
 * Default voice ID for ElevenLabs TTS
 * Using "Rachel" voice - a clear, professional female voice
 * @constant {string}
 */
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

/**
 * Default video duration in seconds
 * @constant {number}
 */
const DEFAULT_DURATION = 30;

/**
 * Video generation timeout in milliseconds (5 minutes)
 * @constant {number}
 */
const VIDEO_GENERATION_TIMEOUT = 5 * 60 * 1000;

/**
 * Polling interval for video generation status (10 seconds)
 * @constant {number}
 */
const POLLING_INTERVAL = 10 * 1000;

/**
 * Maximum retry attempts for API calls
 * @constant {number}
 */
const MAX_RETRIES = 3;

/**
 * Initial retry delay in milliseconds
 * @constant {number}
 */
const INITIAL_RETRY_DELAY = 1000;

/**
 * Storage directory for generated videos
 * @constant {string}
 */
const VIDEOS_STORAGE_DIR = path.join(process.cwd(), 'storage', 'videos');

/**
 * Temporary directory for audio files
 * @constant {string}
 */
const TEMP_AUDIO_DIR = path.join(process.cwd(), 'storage', 'temp', 'audio');

// ============================================================================
// Custom Error Classes
// ============================================================================

/**
 * Error class for ElevenLabs API failures
 * @extends Error
 */
export class ElevenLabsAPIError extends Error {
  /**
   * @param {string} message - Error message
   * @param {number} [statusCode] - HTTP status code
   * @param {Object} [response] - API response body
   */
  constructor(message, statusCode = null, response = null) {
    super(message);
    this.name = 'ElevenLabsAPIError';
    this.statusCode = statusCode;
    this.response = response;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Check if error is retryable
   * @returns {boolean}
   */
  isRetryable() {
    // Retry on rate limits (429) or server errors (5xx)
    return this.statusCode === 429 || (this.statusCode >= 500 && this.statusCode < 600);
  }
}

/**
 * Error class for Grok API failures
 * @extends Error
 */
export class GrokAPIError extends Error {
  /**
   * @param {string} message - Error message
   * @param {number} [statusCode] - HTTP status code
   * @param {Object} [response] - API response body
   */
  constructor(message, statusCode = null, response = null) {
    super(message);
    this.name = 'GrokAPIError';
    this.statusCode = statusCode;
    this.response = response;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Check if error is retryable
   * @returns {boolean}
   */
  isRetryable() {
    return this.statusCode === 429 || (this.statusCode >= 500 && this.statusCode < 600);
  }
}

/**
 * Error class for permission validation failures
 * @extends Error
 */
export class PermissionError extends Error {
  /**
   * @param {string} message - Error message
   * @param {number} reviewId - Review ID that lacks permission
   */
  constructor(message, reviewId) {
    super(message);
    this.name = 'PermissionError';
    this.reviewId = reviewId;
    this.timestamp = new Date().toISOString();
  }
}

// ============================================================================
// Narrative Angle Definitions
// ============================================================================

/**
 * Narrative angles for video testimonials
 * @typedef {'problem' | 'solution' | 'transformation'} NarrativeAngle
 */

/**
 * Configuration for each narrative angle
 * @type {Object.<NarrativeAngle, {name: string, description: string, template: Function}>}
 */
const NARRATIVE_ANGLES = {
  problem: {
    name: 'Problem-Focused',
    description: 'Focuses on the customer\'s pain points before using the product',
    /**
     * Generate problem-focused script from review
     * @param {Object} review - Review object
     * @returns {string} Script text
     */
    template: (review) => {
      const authorName = review.author || 'A valued customer';
      return `Before discovering this solution, ${authorName} was struggling. ${extractProblemContext(review.text)} Like many others, they felt frustrated and were looking for answers. Here's their story of what they were going through...

"${extractKeyQuote(review.text)}"

If you're facing similar challenges, you're not alone.`;
    }
  },
  solution: {
    name: 'Solution-Focused',
    description: 'Highlights how the product solved their problem',
    /**
     * Generate solution-focused script from review
     * @param {Object} review - Review object
     * @returns {string} Script text
     */
    template: (review) => {
      const authorName = review.author || 'A satisfied customer';
      return `${authorName} found exactly what they needed. ${extractSolutionContext(review.text)} The difference was immediate and noticeable.

"${extractKeyQuote(review.text)}"

This is how the right solution can change everything.`;
    }
  },
  transformation: {
    name: 'Transformation-Focused',
    description: 'Shows the before/after transformation and results',
    /**
     * Generate transformation-focused script from review
     * @param {Object} review - Review object
     * @returns {string} Script text
     */
    template: (review) => {
      const authorName = review.author || 'Our customer';
      const rating = review.rating ? `${review.rating} out of 5 stars` : 'highly rated';
      return `From struggle to success - ${authorName}'s transformation is remarkable. ${extractTransformationContext(review.text)}

"${extractKeyQuote(review.text)}"

Rated ${rating}. This could be your transformation too.`;
    }
  }
};

/**
 * Extended angles for additional variations (optional 4th and 5th videos)
 */
const EXTENDED_ANGLES = {
  emotional: {
    name: 'Emotional-Focused',
    description: 'Emphasizes the emotional journey and feelings',
    template: (review) => {
      const authorName = review.author || 'A customer';
      return `${authorName}'s experience was more than just a transaction - it was an emotional journey. ${extractEmotionalContext(review.text)}

"${extractKeyQuote(review.text)}"

Real experiences. Real emotions. Real results.`;
    }
  },
  trust: {
    name: 'Trust-Focused',
    description: 'Builds credibility through authentic testimonial',
    template: (review) => {
      const authorName = review.author || 'A verified customer';
      const platform = review.platform ? `from ${review.platform}` : '';
      return `Hear it directly ${platform ? platform : 'from a real customer'}. ${authorName} shares their honest experience.

"${extractKeyQuote(review.text)}"

Authentic reviews from real customers who've been there.`;
    }
  }
};

// ============================================================================
// Script Generation Helpers
// ============================================================================

/**
 * Extracts the most impactful quote from review text
 * @param {string} text - Review text
 * @returns {string} Extracted quote
 */
function extractKeyQuote(text) {
  if (!text || text.length === 0) {
    return 'Great experience!';
  }

  // Split into sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  // Find the most impactful sentence (typically contains emotional or superlative words)
  const impactWords = ['amazing', 'incredible', 'best', 'love', 'perfect', 'excellent', 
                       'fantastic', 'wonderful', 'great', 'highly', 'recommend', 'changed',
                       'transformed', 'solved', 'finally', 'exactly', 'everything'];
  
  let bestSentence = sentences[0];
  let bestScore = 0;
  
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    let score = impactWords.filter(word => lowerSentence.includes(word)).length;
    
    // Prefer medium-length sentences (not too short, not too long)
    if (sentence.length > 30 && sentence.length < 200) {
      score += 1;
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestSentence = sentence;
    }
  }
  
  return bestSentence.trim();
}

/**
 * Extracts problem context from review text
 * @param {string} text - Review text
 * @returns {string} Problem context
 */
function extractProblemContext(text) {
  const problemIndicators = ['before', 'used to', 'struggled', 'problem', 'issue', 
                            'frustrated', 'difficult', 'couldn\'t', 'wasn\'t'];
  
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    if (problemIndicators.some(indicator => lowerSentence.includes(indicator))) {
      return sentence.trim();
    }
  }
  
  return 'They faced challenges that many can relate to.';
}

/**
 * Extracts solution context from review text
 * @param {string} text - Review text
 * @returns {string} Solution context
 */
function extractSolutionContext(text) {
  const solutionIndicators = ['solved', 'fixed', 'helped', 'works', 'solution', 
                             'now', 'finally', 'perfect', 'exactly'];
  
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    if (solutionIndicators.some(indicator => lowerSentence.includes(indicator))) {
      return sentence.trim();
    }
  }
  
  return 'The solution exceeded all expectations.';
}

/**
 * Extracts transformation context from review text
 * @param {string} text - Review text
 * @returns {string} Transformation context
 */
function extractTransformationContext(text) {
  const transformIndicators = ['changed', 'transformed', 'different', 'now', 
                               'before and after', 'improvement', 'better'];
  
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    if (transformIndicators.some(indicator => lowerSentence.includes(indicator))) {
      return sentence.trim();
    }
  }
  
  return 'The results speak for themselves.';
}

/**
 * Extracts emotional context from review text
 * @param {string} text - Review text
 * @returns {string} Emotional context
 */
function extractEmotionalContext(text) {
  const emotionIndicators = ['feel', 'felt', 'love', 'happy', 'relieved', 
                            'grateful', 'excited', 'thrilled', 'amazed'];
  
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    if (emotionIndicators.some(indicator => lowerSentence.includes(indicator))) {
      return sentence.trim();
    }
  }
  
  return 'The experience left a lasting impression.';
}

// ============================================================================
// Directory Management
// ============================================================================

/**
 * Ensures required storage directories exist
 * Creates them recursively if missing
 * @returns {void}
 */
function ensureStorageDirectories() {
  const directories = [VIDEOS_STORAGE_DIR, TEMP_AUDIO_DIR];
  
  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      logger.info('Creating storage directory', { directory: dir });
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Generates a unique filename for a video
 * @param {number} reviewId - Review ID
 * @param {string} angle - Narrative angle
 * @returns {string} Filename
 */
function generateVideoFilename(reviewId, angle) {
  const timestamp = Date.now();
  const uniqueId = crypto.randomBytes(4).toString('hex');
  return `${reviewId}_${angle}_${timestamp}_${uniqueId}.mp4`;
}

/**
 * Generates a unique filename for temporary audio
 * @param {number} reviewId - Review ID
 * @param {string} angle - Narrative angle
 * @returns {string} Filename
 */
function generateAudioFilename(reviewId, angle) {
  const timestamp = Date.now();
  return `${reviewId}_${angle}_${timestamp}.mp3`;
}

// ============================================================================
// Permission Validation
// ============================================================================

/**
 * Validates that a review has approved permission for video generation
 * @param {Object} review - Review object
 * @returns {Promise<boolean>} True if permission is approved
 * @throws {PermissionError} If permission is not approved
 */
async function validatePermission(review) {
  logger.debug('Validating permission for review', { reviewId: review.id });
  
  try {
    const permissions = getPermissions(review.id);
    
    if (!permissions || permissions.length === 0) {
      throw new PermissionError(
        `No permission record found for review ${review.id}`,
        review.id
      );
    }
    
    // Check if any permission is approved
    const approvedPermission = permissions.find(p => p.status === 'approved');
    
    if (!approvedPermission) {
      const latestPermission = permissions[0];
      throw new PermissionError(
        `Permission not approved for review ${review.id}. Current status: ${latestPermission.status}`,
        review.id
      );
    }
    
    logger.info('Permission validated successfully', { 
      reviewId: review.id, 
      permissionId: approvedPermission.id 
    });
    
    return true;
  } catch (error) {
    if (error instanceof PermissionError) {
      throw error;
    }
    
    logger.logError(error, { operation: 'validatePermission', reviewId: review.id });
    throw new PermissionError(
      `Failed to validate permission for review ${review.id}: ${error.message}`,
      review.id
    );
  }
}

// ============================================================================
// Retry Logic
// ============================================================================

/**
 * Executes an async function with retry logic and exponential backoff
 * @template T
 * @param {Function} fn - Async function to execute
 * @param {string} operationName - Name for logging
 * @param {number} [maxRetries=MAX_RETRIES] - Maximum retry attempts
 * @returns {Promise<T>} Result of the function
 */
async function withRetry(fn, operationName, maxRetries = MAX_RETRIES) {
  let lastError;
  let delay = INITIAL_RETRY_DELAY;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      const isRetryable = error.isRetryable?.() || 
                          error.code === 'ECONNRESET' || 
                          error.code === 'ETIMEDOUT' ||
                          error.code === 'ENOTFOUND';
      
      if (isRetryable && attempt < maxRetries) {
        logger.warn('Operation failed, retrying', {
          operation: operationName,
          attempt,
          maxRetries,
          delayMs: delay,
          error: error.message
        });
        
        await sleep(delay);
        delay *= 2; // Exponential backoff
      } else {
        break;
      }
    }
  }
  
  logger.logError(lastError, { 
    operation: operationName, 
    maxRetries,
    finalAttempt: true 
  });
  
  throw lastError;
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// ElevenLabs TTS API
// ============================================================================

/**
 * Generates voiceover audio using ElevenLabs TTS API
 * @param {string} text - Text to convert to speech
 * @param {string} outputPath - Path to save the audio file
 * @param {Object} [options={}] - Additional options
 * @param {string} [options.voiceId] - Voice ID to use
 * @param {string} [options.modelId] - Model ID to use
 * @returns {Promise<{filePath: string, duration: number}>} Audio file info
 */
async function generateVoiceover(text, outputPath, options = {}) {
  const config = getConfig();
  const voiceId = options.voiceId || DEFAULT_VOICE_ID;
  const modelId = options.modelId || 'eleven_monolingual_v1';
  
  logger.info('Generating voiceover', { 
    textLength: text.length, 
    voiceId, 
    modelId,
    outputPath 
  });
  
  const startTime = Date.now();
  
  try {
    const response = await withRetry(async () => {
      const res = await fetch(`${ELEVENLABS_API_BASE}/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': config.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true
          }
        })
      });
      
      if (!res.ok) {
        let errorBody;
        try {
          errorBody = await res.json();
        } catch {
          errorBody = await res.text();
        }
        
        throw new ElevenLabsAPIError(
          `ElevenLabs TTS API error: ${res.status} ${res.statusText}`,
          res.status,
          errorBody
        );
      }
      
      return res;
    }, 'generateVoiceover');
    
    // Stream the response to file
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    await fs.promises.writeFile(outputPath, buffer);
    
    // Estimate duration based on text length (rough approximation)
    // Average speaking rate is about 150 words per minute
    const wordCount = text.split(/\s+/).length;
    const estimatedDuration = (wordCount / 150) * 60; // seconds
    
    const duration = Date.now() - startTime;
    
    logger.logAPICall('POST', `${ELEVENLABS_API_BASE}/v1/text-to-speech/${voiceId}`, duration, {
      textLength: text.length,
      fileSize: buffer.length,
      estimatedAudioDuration: estimatedDuration
    });
    
    logger.info('Voiceover generated successfully', { 
      outputPath, 
      fileSize: buffer.length,
      estimatedDuration: estimatedDuration
    });
    
    return {
      filePath: outputPath,
      duration: estimatedDuration
    };
  } catch (error) {
    if (error instanceof ElevenLabsAPIError) {
      throw error;
    }
    
    throw new ElevenLabsAPIError(
      `Failed to generate voiceover: ${error.message}`,
      null,
      { originalError: error.message }
    );
  }
}

// ============================================================================
// Grok Video Generation API
// ============================================================================

/**
 * Initiates video generation using Grok API
 * @param {Object} params - Generation parameters
 * @param {string} params.prompt - Video generation prompt/script
 * @param {string} [params.audioUrl] - URL or path to voiceover audio
 * @param {number} [params.duration] - Video duration in seconds
 * @param {string} [params.style] - Video style
 * @returns {Promise<{generationId: string}>} Generation ID for polling
 */
async function initiateVideoGeneration(params) {
  const config = getConfig();
  
  const {
    prompt,
    audioUrl = null,
    duration = DEFAULT_DURATION,
    style = 'testimonial'
  } = params;
  
  logger.info('Initiating video generation', { 
    promptLength: prompt.length, 
    duration, 
    style,
    hasAudio: !!audioUrl
  });
  
  const startTime = Date.now();
  
  try {
    const requestBody = {
      prompt: prompt,
      duration: duration,
      style: style
    };
    
    // Add audio reference if provided
    if (audioUrl) {
      requestBody.audio_url = audioUrl;
    }
    
    const response = await withRetry(async () => {
      const res = await fetch(`${GROK_API_BASE}/v1/video/generations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.GROK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!res.ok) {
        let errorBody;
        try {
          errorBody = await res.json();
        } catch {
          errorBody = await res.text();
        }
        
        throw new GrokAPIError(
          `Grok video generation API error: ${res.status} ${res.statusText}`,
          res.status,
          errorBody
        );
      }
      
      return res;
    }, 'initiateVideoGeneration');
    
    const data = await response.json();
    
    const apiDuration = Date.now() - startTime;
    logger.logAPICall('POST', `${GROK_API_BASE}/v1/video/generations`, apiDuration, {
      generationId: data.id || data.generation_id,
      status: data.status
    });
    
    return {
      generationId: data.id || data.generation_id,
      status: data.status
    };
  } catch (error) {
    if (error instanceof GrokAPIError) {
      throw error;
    }
    
    throw new GrokAPIError(
      `Failed to initiate video generation: ${error.message}`,
      null,
      { originalError: error.message }
    );
  }
}

/**
 * Polls for video generation completion
 * @param {string} generationId - Generation ID to poll
 * @param {number} [timeout=VIDEO_GENERATION_TIMEOUT] - Timeout in milliseconds
 * @returns {Promise<{videoUrl: string, duration: number}>} Video info
 */
async function pollVideoGeneration(generationId, timeout = VIDEO_GENERATION_TIMEOUT) {
  const config = getConfig();
  const startTime = Date.now();
  
  logger.info('Polling video generation status', { generationId, timeout });
  
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(`${GROK_API_BASE}/v1/video/generations/${generationId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.GROK_API_KEY}`
        }
      });
      
      if (!response.ok) {
        let errorBody;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = await response.text();
        }
        
        throw new GrokAPIError(
          `Grok status check error: ${response.status}`,
          response.status,
          errorBody
        );
      }
      
      const data = await response.json();
      
      logger.debug('Video generation status', { 
        generationId, 
        status: data.status,
        elapsedMs: Date.now() - startTime
      });
      
      if (data.status === 'completed' || data.status === 'succeeded') {
        logger.info('Video generation completed', { 
          generationId, 
          videoUrl: data.video_url || data.output?.url,
          duration: data.duration
        });
        
        return {
          videoUrl: data.video_url || data.output?.url || data.result?.url,
          duration: data.duration || data.output?.duration || DEFAULT_DURATION
        };
      }
      
      if (data.status === 'failed' || data.status === 'error') {
        throw new GrokAPIError(
          `Video generation failed: ${data.error || data.message || 'Unknown error'}`,
          null,
          data
        );
      }
      
      // Still processing, wait before next poll
      await sleep(POLLING_INTERVAL);
    } catch (error) {
      if (error instanceof GrokAPIError && !error.isRetryable()) {
        throw error;
      }
      
      // Log and continue polling on transient errors
      logger.warn('Polling error, will retry', { 
        generationId, 
        error: error.message 
      });
      
      await sleep(POLLING_INTERVAL);
    }
  }
  
  throw new GrokAPIError(
    `Video generation timed out after ${timeout}ms`,
    null,
    { generationId, timeout }
  );
}

/**
 * Downloads video from URL and saves to local storage
 * @param {string} videoUrl - URL to download video from
 * @param {string} outputPath - Local path to save video
 * @returns {Promise<{filePath: string, fileSize: number}>} Download result
 */
async function downloadVideo(videoUrl, outputPath) {
  logger.info('Downloading video', { videoUrl, outputPath });
  
  const startTime = Date.now();
  
  try {
    const response = await withRetry(async () => {
      const res = await fetch(videoUrl);
      
      if (!res.ok) {
        throw new GrokAPIError(
          `Failed to download video: ${res.status} ${res.statusText}`,
          res.status
        );
      }
      
      return res;
    }, 'downloadVideo');
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    await fs.promises.writeFile(outputPath, buffer);
    
    const duration = Date.now() - startTime;
    
    logger.info('Video downloaded successfully', { 
      outputPath, 
      fileSize: buffer.length,
      downloadTimeMs: duration
    });
    
    return {
      filePath: outputPath,
      fileSize: buffer.length
    };
  } catch (error) {
    if (error instanceof GrokAPIError) {
      throw error;
    }
    
    throw new GrokAPIError(
      `Failed to download video: ${error.message}`,
      null,
      { videoUrl }
    );
  }
}

/**
 * Generates a video using Grok API (combines initiation, polling, and download)
 * @param {Object} params - Generation parameters
 * @param {string} params.prompt - Video generation prompt/script
 * @param {string} params.outputPath - Local path to save video
 * @param {string} [params.audioPath] - Path to voiceover audio
 * @param {number} [params.duration] - Video duration in seconds
 * @param {string} [params.style] - Video style
 * @returns {Promise<{filePath: string, duration: number, fileSize: number}>}
 */
async function generateVideo(params) {
  const {
    prompt,
    outputPath,
    audioPath = null,
    duration = DEFAULT_DURATION,
    style = 'testimonial'
  } = params;
  
  // For now, we'll pass the audio path directly
  // In production, this might need to be uploaded to a accessible URL
  const audioUrl = audioPath ? `file://${path.resolve(audioPath)}` : null;
  
  // Initiate generation
  const { generationId } = await initiateVideoGeneration({
    prompt,
    audioUrl,
    duration,
    style
  });
  
  // Poll for completion
  const { videoUrl, duration: videoDuration } = await pollVideoGeneration(generationId);
  
  // Download the video
  const { filePath, fileSize } = await downloadVideo(videoUrl, outputPath);
  
  return {
    filePath,
    duration: videoDuration,
    fileSize
  };
}

// ============================================================================
// Video Generation Pipeline
// ============================================================================

/**
 * Generates a single video for a specific angle
 * @param {Object} review - Review object
 * @param {string} angle - Narrative angle
 * @param {Object} angleConfig - Angle configuration
 * @param {Object} [options={}] - Additional options
 * @returns {Promise<Object>} Video object
 */
async function generateVideoForAngle(review, angle, angleConfig, options = {}) {
  const {
    duration = DEFAULT_DURATION,
    voiceId = DEFAULT_VOICE_ID
  } = options;
  
  logger.logOperationStart(`generateVideo_${angle}`, { 
    reviewId: review.id, 
    angle,
    duration
  });
  
  const operationStartTime = Date.now();
  
  // Generate script from template
  const scriptText = angleConfig.template(review);
  
  logger.debug('Generated script', { 
    reviewId: review.id, 
    angle, 
    scriptLength: scriptText.length 
  });
  
  // Create file paths
  const audioFilename = generateAudioFilename(review.id, angle);
  const audioPath = path.join(TEMP_AUDIO_DIR, audioFilename);
  const videoFilename = generateVideoFilename(review.id, angle);
  const videoPath = path.join(VIDEOS_STORAGE_DIR, videoFilename);
  
  try {
    // Generate voiceover audio
    logger.info('Generating voiceover for angle', { reviewId: review.id, angle });
    
    const audioResult = await generateVoiceover(scriptText, audioPath, { voiceId });
    
    // Generate video with voiceover
    logger.info('Generating video for angle', { reviewId: review.id, angle });
    
    const videoResult = await generateVideo({
      prompt: scriptText,
      outputPath: videoPath,
      audioPath: audioPath,
      duration,
      style: 'testimonial'
    });
    
    // Save video metadata to database
    const videoId = saveVideo({
      scriptId: review.id, // Using reviewId as scriptId reference
      filePath: videoPath,
      duration: videoResult.duration,
      status: 'completed'
    });
    
    logger.logOperationEnd(`generateVideo_${angle}`, operationStartTime, {
      reviewId: review.id,
      videoId,
      filePath: videoPath
    });
    
    // Clean up temporary audio file
    try {
      await fs.promises.unlink(audioPath);
      logger.debug('Cleaned up temporary audio file', { audioPath });
    } catch (cleanupError) {
      logger.warn('Failed to clean up audio file', { 
        audioPath, 
        error: cleanupError.message 
      });
    }
    
    return {
      id: videoId,
      reviewId: review.id,
      angle,
      angleName: angleConfig.name,
      filePath: videoPath,
      duration: videoResult.duration,
      fileSize: videoResult.fileSize,
      scriptText,
      status: 'completed',
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    logger.logError(error, { 
      operation: 'generateVideoForAngle', 
      reviewId: review.id, 
      angle 
    });
    
    // Clean up partial files
    try {
      if (fs.existsSync(audioPath)) {
        await fs.promises.unlink(audioPath);
      }
      if (fs.existsSync(videoPath)) {
        await fs.promises.unlink(videoPath);
      }
    } catch (cleanupError) {
      logger.warn('Failed to clean up files after error', { 
        error: cleanupError.message 
      });
    }
    
    throw error;
  }
}

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Generates video testimonials from an approved customer review.
 * Creates 3-5 video variations with different narrative angles:
 * - Problem-focused: Emphasizes customer pain points
 * - Solution-focused: Highlights how the product helped
 * - Transformation-focused: Shows before/after results
 * - (Optional) Emotional-focused: Emphasizes feelings
 * - (Optional) Trust-focused: Builds credibility
 * 
 * @param {Object} review - Review object with approved permission
 * @param {number} review.id - Unique review identifier
 * @param {string} review.text - Review text content
 * @param {string} [review.author] - Author name
 * @param {number} [review.rating] - Rating (1-5)
 * @param {string} [review.platform] - Review platform
 * @param {Object} [options={}] - Generation options
 * @param {number} [options.duration=30] - Video duration in seconds (15, 30, or 60)
 * @param {string} [options.voiceId] - ElevenLabs voice ID
 * @param {number} [options.variationCount=3] - Number of variations (3-5)
 * @param {boolean} [options.includeExtendedAngles=false] - Include 4th and 5th angles
 * @returns {Promise<Array<Object>>} Array of Video objects with file paths and metadata
 * @throws {PermissionError} If review doesn't have approved permission
 * @throws {ElevenLabsAPIError} If voiceover generation fails
 * @throws {GrokAPIError} If video generation fails
 * 
 * @example
 * import { generateVideos } from './agents/generation.js';
 * 
 * const review = {
 *   id: 1,
 *   text: 'This product changed my life! Before, I was struggling...',
 *   author: 'Sarah M.',
 *   rating: 5,
 *   platform: 'google'
 * };
 * 
 * try {
 *   const videos = await generateVideos(review, { duration: 30 });
 *   console.log(`Generated ${videos.length} videos:`);
 *   videos.forEach(v => console.log(`- ${v.angle}: ${v.filePath}`));
 * } catch (error) {
 *   if (error instanceof PermissionError) {
 *     console.error('Permission not approved:', error.message);
 *   }
 * }
 */
export async function generateVideos(review, options = {}) {
  const {
    duration = DEFAULT_DURATION,
    voiceId = DEFAULT_VOICE_ID,
    variationCount = 3,
    includeExtendedAngles = false
  } = options;
  
  logger.info('Starting video generation', { 
    reviewId: review.id,
    author: review.author,
    platform: review.platform,
    duration,
    variationCount
  });
  
  const overallStartTime = Date.now();
  
  // Validate inputs
  if (!review || !review.id || !review.text) {
    throw new Error('Invalid review: must have id and text properties');
  }
  
  // Validate duration
  const validDurations = [15, 30, 60];
  const actualDuration = validDurations.includes(duration) ? duration : DEFAULT_DURATION;
  
  if (duration !== actualDuration) {
    logger.warn('Invalid duration, using default', { 
      requested: duration, 
      using: actualDuration 
    });
  }
  
  // Ensure storage directories exist
  ensureStorageDirectories();
  
  // Validate permission
  await validatePermission(review);
  
  // Determine which angles to generate
  const baseAngles = Object.entries(NARRATIVE_ANGLES);
  const extendedAngles = includeExtendedAngles ? Object.entries(EXTENDED_ANGLES) : [];
  
  let anglesToGenerate = [...baseAngles, ...extendedAngles];
  
  // Limit to requested variation count
  const actualVariationCount = Math.min(
    Math.max(3, variationCount),
    anglesToGenerate.length
  );
  anglesToGenerate = anglesToGenerate.slice(0, actualVariationCount);
  
  logger.info('Generating video variations', { 
    reviewId: review.id,
    angles: anglesToGenerate.map(([angle]) => angle),
    count: anglesToGenerate.length
  });
  
  // Generate videos for each angle
  const videos = [];
  const errors = [];
  
  for (const [angle, angleConfig] of anglesToGenerate) {
    try {
      logger.info(`Generating ${angle} video`, { 
        reviewId: review.id, 
        angle,
        angleName: angleConfig.name
      });
      
      const video = await generateVideoForAngle(review, angle, angleConfig, {
        duration: actualDuration,
        voiceId
      });
      
      videos.push(video);
      
      logger.info(`Completed ${angle} video`, { 
        reviewId: review.id, 
        videoId: video.id,
        filePath: video.filePath
      });
    } catch (error) {
      logger.logError(error, { 
        operation: 'generateVideos', 
        reviewId: review.id, 
        angle 
      });
      
      errors.push({
        angle,
        error: error.message,
        errorType: error.name
      });
      
      // Continue with other angles even if one fails
      // But if too many fail, stop
      if (errors.length >= Math.ceil(anglesToGenerate.length / 2)) {
        logger.error('Too many generation failures, stopping', { 
          reviewId: review.id,
          successCount: videos.length,
          errorCount: errors.length
        });
        break;
      }
    }
  }
  
  const totalDuration = Date.now() - overallStartTime;
  
  // Log completion summary
  logger.info('Video generation completed', {
    reviewId: review.id,
    totalVideos: videos.length,
    totalErrors: errors.length,
    totalDurationMs: totalDuration,
    averageTimePerVideo: videos.length > 0 ? totalDuration / videos.length : 0,
    videoFilePaths: videos.map(v => v.filePath)
  });
  
  // If all generations failed, throw an error
  if (videos.length === 0 && errors.length > 0) {
    const errorSummary = errors.map(e => `${e.angle}: ${e.error}`).join('; ');
    throw new GrokAPIError(
      `All video generations failed for review ${review.id}: ${errorSummary}`,
      null,
      { errors }
    );
  }
  
  return videos;
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Gets available narrative angles
 * @returns {Object} Object with angle names and descriptions
 */
export function getAvailableAngles() {
  const angles = {};
  
  for (const [key, config] of Object.entries(NARRATIVE_ANGLES)) {
    angles[key] = {
      name: config.name,
      description: config.description
    };
  }
  
  for (const [key, config] of Object.entries(EXTENDED_ANGLES)) {
    angles[key] = {
      name: config.name,
      description: config.description,
      extended: true
    };
  }
  
  return angles;
}

/**
 * Validates video generation prerequisites
 * Checks API connectivity and storage permissions
 * @returns {Promise<{valid: boolean, issues: string[]}>}
 */
export async function validatePrerequisites() {
  const issues = [];
  
  // Check storage directories
  try {
    ensureStorageDirectories();
    
    // Test write permissions
    const testFile = path.join(VIDEOS_STORAGE_DIR, '.write-test');
    await fs.promises.writeFile(testFile, 'test');
    await fs.promises.unlink(testFile);
  } catch (error) {
    issues.push(`Storage directory not writable: ${error.message}`);
  }
  
  // Check API keys exist
  const config = getConfig();
  
  if (!config.ELEVENLABS_API_KEY) {
    issues.push('ELEVENLABS_API_KEY is not configured');
  }
  
  if (!config.GROK_API_KEY) {
    issues.push('GROK_API_KEY is not configured');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  generateVideos,
  getAvailableAngles,
  validatePrerequisites,
  ElevenLabsAPIError,
  GrokAPIError,
  PermissionError
};