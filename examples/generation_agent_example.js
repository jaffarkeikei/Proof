/**
 * Generation Agent Example
 * 
 * This example demonstrates how to use the generation module to create
 * video testimonials from approved customer reviews. The module uses
 * ElevenLabs for text-to-speech voiceovers and Grok (xAI) for AI video generation.
 * 
 * Prerequisites:
 * - ELEVENLABS_API_KEY and GROK_API_KEY configured in .env
 * - Review must have approved permission in the database
 * - Storage directories must be writable
 * 
 * File location: examples/ directory (relative to project root)
 */

import {
  generateVideos,
  getAvailableAngles,
  validatePrerequisites,
  ElevenLabsAPIError,
  GrokAPIError,
  PermissionError
} from '../src/agents/generation.js';

// ============================================================================
// Example 1: Check Prerequisites Before Generation
// ============================================================================

/**
 * Validates that all prerequisites are met before attempting video generation.
 * Checks API key configuration and storage directory permissions.
 * 
 * @returns {Promise<boolean>} True if all prerequisites are valid
 */
async function checkPrerequisites() {
  console.log('=== Checking Prerequisites ===\n');
  
  const { valid, issues } = await validatePrerequisites();
  
  if (valid) {
    console.log('✅ All prerequisites are met!\n');
  } else {
    console.log('❌ Prerequisites check failed:');
    issues.forEach(issue => console.log(`   - ${issue}`));
    console.log('');
  }
  
  return valid;
}

// ============================================================================
// Example 2: View Available Narrative Angles
// ============================================================================

/**
 * Displays all available narrative angles for video generation.
 * Each angle produces a different style of testimonial video.
 */
function displayAvailableAngles() {
  console.log('=== Available Narrative Angles ===\n');
  
  const angles = getAvailableAngles();
  
  Object.entries(angles).forEach(([key, config]) => {
    const extended = config.extended ? ' (Extended)' : '';
    console.log(`📹 ${config.name}${extended}`);
    console.log(`   Key: "${key}"`);
    console.log(`   Description: ${config.description}\n`);
  });
}

// ============================================================================
// Example 3: Basic Video Generation
// ============================================================================

/**
 * Generates video testimonials from a review using default settings.
 * Creates 3 video variations (problem, solution, transformation angles).
 * 
 * @param {Object} review - Review object with approved permission
 * @param {number} review.id - Unique review identifier (must exist in database with approved permission)
 * @param {string} review.text - Full review text content
 * @param {string} [review.author] - Author name for personalization
 * @param {number} [review.rating] - Rating (1-5) for inclusion in scripts
 * @param {string} [review.platform] - Platform name (google, yelp, etc.)
 * @returns {Promise<Array>} Array of Video objects with file paths and metadata
 */
async function basicVideoGeneration(review) {
  console.log('=== Basic Video Generation ===\n');
  console.log(`Generating videos for review ${review.id} by "${review.author}"...\n`);
  
  try {
    // Generate videos with default options (3 variations, 30 seconds each)
    const videos = await generateVideos(review);
    
    console.log(`✅ Successfully generated ${videos.length} videos:\n`);
    
    videos.forEach((video, index) => {
      console.log(`Video ${index + 1}: ${video.angleName}`);
      console.log(`   File: ${video.filePath}`);
      console.log(`   Duration: ${video.duration} seconds`);
      console.log(`   Size: ${(video.fileSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Status: ${video.status}\n`);
    });
    
    return videos;
  } catch (error) {
    handleGenerationError(error);
    throw error;
  }
}

// ============================================================================
// Example 4: Video Generation with Custom Options
// ============================================================================

/**
 * Generates video testimonials with custom configuration options.
 * 
 * @param {Object} review - Review object with approved permission
 * @param {Object} options - Custom generation options
 * @param {number} [options.duration=30] - Video duration: 15, 30, or 60 seconds
 * @param {string} [options.voiceId] - ElevenLabs voice ID for TTS
 * @param {number} [options.variationCount=3] - Number of variations (3-5)
 * @param {boolean} [options.includeExtendedAngles=false] - Include emotional/trust angles
 * @returns {Promise<Array>} Array of Video objects
 */
async function customVideoGeneration(review, options = {}) {
  console.log('=== Custom Video Generation ===\n');
  console.log('Options:', JSON.stringify(options, null, 2), '\n');
  
  try {
    const videos = await generateVideos(review, options);
    
    console.log(`✅ Generated ${videos.length} custom videos\n`);
    
    return videos;
  } catch (error) {
    handleGenerationError(error);
    throw error;
  }
}

// ============================================================================
// Example 5: Generate Extended Variations (5 Videos)
// ============================================================================

/**
 * Generates all 5 video variations including extended angles.
 * Extended angles include:
 * - Emotional-focused: Emphasizes the emotional journey
 * - Trust-focused: Builds credibility through authentic testimonial
 * 
 * @param {Object} review - Review object with approved permission
 * @returns {Promise<Array>} Array of 5 Video objects
 */
async function generateAllVariations(review) {
  console.log('=== Full 5-Video Generation ===\n');
  
  try {
    const videos = await generateVideos(review, {
      duration: 30,
      variationCount: 5,
      includeExtendedAngles: true
    });
    
    console.log('Generated videos by angle:');
    videos.forEach(video => {
      console.log(`   - ${video.angle}: ${video.angleName}`);
    });
    console.log('');
    
    return videos;
  } catch (error) {
    handleGenerationError(error);
    throw error;
  }
}

// ============================================================================
// Error Handling Helper
// ============================================================================

/**
 * Handles and logs generation errors with appropriate messages.
 * 
 * @param {Error} error - Error thrown during generation
 */
function handleGenerationError(error) {
  console.log('❌ Video generation failed:\n');
  
  if (error instanceof PermissionError) {
    console.log(`Permission Error: ${error.message}`);
    console.log(`Review ID: ${error.reviewId}`);
    console.log('Ensure the review has an approved permission before generating videos.\n');
  } else if (error instanceof ElevenLabsAPIError) {
    console.log(`ElevenLabs API Error: ${error.message}`);
    if (error.statusCode) console.log(`Status Code: ${error.statusCode}`);
    if (error.isRetryable()) {
      console.log('This error is retryable - consider trying again.\n');
    }
  } else if (error instanceof GrokAPIError) {
    console.log(`Grok API Error: ${error.message}`);
    if (error.statusCode) console.log(`Status Code: ${error.statusCode}`);
    if (error.isRetryable()) {
      console.log('This error is retryable - consider trying again.\n');
    }
  } else {
    console.log(`Unexpected Error: ${error.message}\n`);
  }
}

// ============================================================================
// Main Execution
// ============================================================================

/**
 * Main function demonstrating complete usage of the generation module.
 */
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           Generation Agent - Usage Examples                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  // Display available angles
  displayAvailableAngles();
  
  // Check prerequisites
  const prereqsValid = await checkPrerequisites();
  if (!prereqsValid) {
    console.log('Please fix prerequisites before running video generation.');
    return;
  }
  
  // Sample review object (must have approved permission in database)
  const sampleReview = {
    id: 1,  // Must match a review ID with approved permission
    text: `Before I found this product, I was struggling with constant headaches 
           and couldn't focus at work. I tried everything but nothing worked. 
           Then I discovered this amazing solution and my life completely changed! 
           Within just two weeks, my headaches were gone and I felt more energized 
           than ever. I'm so grateful I found this - it truly transformed my daily life. 
           I highly recommend it to anyone facing similar challenges!`,
    author: 'Sarah M.',
    rating: 5,
    platform: 'google'
  };
  
  console.log('Sample Review:');
  console.log(`   Author: ${sampleReview.author}`);
  console.log(`   Rating: ${'⭐'.repeat(sampleReview.rating)}`);
  console.log(`   Platform: ${sampleReview.platform}`);
  console.log(`   Text: "${sampleReview.text.substring(0, 100)}..."\n`);
  
  try {
    // Example: Basic generation (3 videos, 30 seconds each)
    const basicVideos = await basicVideoGeneration(sampleReview);
    
    // Example: Custom generation (60-second videos)
    const longVideos = await customVideoGeneration(sampleReview, {
      duration: 60,
      variationCount: 3
    });
    
    // Example: Full 5-video generation with extended angles
    const allVideos = await generateAllVariations(sampleReview);
    
    // Summary
    console.log('=== Generation Summary ===');
    console.log(`Total videos generated: ${basicVideos.length + longVideos.length + allVideos.length}`);
    console.log('Videos saved to: storage/videos/ (relative to project root)\n');
    
  } catch (error) {
    console.log('Generation examples could not complete due to errors.');
  }
}

// Run the example
main().catch(console.error);