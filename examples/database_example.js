/**
 * Database Module Usage Example
 * 
 * This example demonstrates how to use the SQLite database module for persisting
 * pipeline state, reviews, scripts, videos, and permissions.
 * 
 * The module uses better-sqlite3 for synchronous operations with:
 * - Singleton database connection pattern
 * - Automatic schema initialization
 * - Foreign key constraints
 * - Transaction support for atomic operations
 * - Prepared statements (SQL injection prevention)
 * 
 * Prerequisites:
 * - Environment variables configured (see config module)
 * - Node.js with ES modules support
 * 
 * Run from project root: node examples/database_example.js
 */

import {
  // Core database access
  getDatabase,
  closeDatabase,
  runTransaction,
  
  // Pipeline runs CRUD
  savePipelineRun,
  getPipelineRun,
  updatePipelineRun,
  getAllPipelineRuns,
  deletePipelineRun,
  
  // Reviews CRUD
  saveReviews,
  getReviews,
  getReview,
  updateReviewSentiment,
  
  // Scripts CRUD
  saveScript,
  saveScripts,
  getScripts,
  getScriptsForPipelineRun,
  
  // Videos CRUD
  saveVideo,
  getVideo,
  getVideos,
  updateVideo,
  
  // Permissions CRUD
  savePermission,
  getPermissionByToken,
  getPermissions,
  updatePermissionByToken,
  
  // Utilities
  getDatabaseStats,
  optimizeDatabase,
  isDatabaseHealthy
} from '../src/utils/database.js';

import { randomUUID } from 'crypto';

// ============================================================================
// Example: Complete Pipeline Workflow
// ============================================================================

console.log('='.repeat(60));
console.log('Database Module Example - Complete Pipeline Workflow');
console.log('='.repeat(60));

// ----------------------------------------------------------------------------
// 1. Database Health Check
// ----------------------------------------------------------------------------

console.log('\n1. Checking database health...');
const healthy = isDatabaseHealthy();
console.log(`   Database healthy: ${healthy}`);

if (!healthy) {
  console.error('   Database is not healthy. Exiting.');
  process.exit(1);
}

// ----------------------------------------------------------------------------
// 2. Create a Pipeline Run
// ----------------------------------------------------------------------------

console.log('\n2. Creating a new pipeline run...');

/**
 * savePipelineRun creates a new pipeline execution record
 * 
 * @param {Object} data - Pipeline run data
 * @param {string} data.companyName - Name of the company being processed
 * @param {string} [data.status='pending'] - Initial status
 * @returns {number} The created pipeline run ID
 */
const runId = savePipelineRun({ 
  companyName: 'Acme Corporation',
  status: 'pending'
});
console.log(`   Created pipeline run with ID: ${runId}`);

// ----------------------------------------------------------------------------
// 3. Save Reviews for the Pipeline Run
// ----------------------------------------------------------------------------

console.log('\n3. Saving reviews for the pipeline run...');

/**
 * saveReviews bulk inserts reviews associated with a pipeline run
 * Uses a transaction for atomicity - all succeed or all fail
 * 
 * @param {number} pipelineRunId - The pipeline run to associate reviews with
 * @param {Array<Object>} reviews - Array of review objects
 * @returns {Array<number>} Array of created review IDs
 */
const reviews = [
  {
    platform: 'google',
    author: 'John Smith',
    rating: 5,
    text: 'Excellent service! They transformed our business operations completely.',
    date: '2024-01-15'
  },
  {
    platform: 'yelp',
    author: 'Jane Doe',
    rating: 4,
    text: 'Great experience overall. The team was professional and responsive.',
    date: '2024-01-10'
  },
  {
    platform: 'trustpilot',
    author: 'Bob Wilson',
    rating: 5,
    text: 'Solved a problem we struggled with for years. Highly recommend!',
    date: '2024-01-08'
  }
];

const reviewIds = saveReviews(runId, reviews);
console.log(`   Saved ${reviewIds.length} reviews with IDs: [${reviewIds.join(', ')}]`);

// ----------------------------------------------------------------------------
// 4. Update Review Sentiment Scores
// ----------------------------------------------------------------------------

console.log('\n4. Updating review sentiment scores...');

/**
 * updateReviewSentiment updates the sentiment analysis score for a review
 * 
 * @param {number} reviewId - The review ID to update
 * @param {number} sentimentScore - Sentiment score (typically -1 to 1)
 * @returns {boolean} True if updated, false if not found
 */
const sentimentScores = [0.92, 0.78, 0.95];

reviewIds.forEach((id, index) => {
  const updated = updateReviewSentiment(id, sentimentScores[index]);
  console.log(`   Review ${id}: sentiment = ${sentimentScores[index]} (updated: ${updated})`);
});

// ----------------------------------------------------------------------------
// 5. Retrieve Reviews
// ----------------------------------------------------------------------------

console.log('\n5. Retrieving reviews for pipeline run...');

/**
 * getReviews retrieves all reviews associated with a pipeline run
 * 
 * @param {number} pipelineRunId - The pipeline run ID
 * @returns {Array<Object>} Array of review objects with all fields
 */
const retrievedReviews = getReviews(runId);
console.log(`   Found ${retrievedReviews.length} reviews:`);

retrievedReviews.forEach(review => {
  console.log(`   - [${review.platform}] ${review.author}: "${review.text.substring(0, 40)}..." (Rating: ${review.rating}, Sentiment: ${review.sentimentScore})`);
});

// ----------------------------------------------------------------------------
// 6. Save Scripts for Reviews
// ----------------------------------------------------------------------------

console.log('\n6. Saving scripts for reviews...');

/**
 * saveScript creates a single script for a review
 * 
 * @param {Object} data - Script data
 * @param {number} data.reviewId - Associated review ID
 * @param {string} data.angle - Script angle ('problem', 'solution', 'transformation')
 * @param {string} data.scriptText - The script content
 * @returns {number} The created script ID
 */
const scriptId1 = saveScript({
  reviewId: reviewIds[0],
  angle: 'problem',
  scriptText: 'Have you ever struggled with inefficient business operations? Many companies face this challenge...'
});
console.log(`   Created problem script with ID: ${scriptId1}`);

/**
 * saveScripts bulk inserts multiple scripts using a transaction
 * 
 * @param {Array<Object>} scripts - Array of script objects
 * @returns {Array<number>} Array of created script IDs
 */
const bulkScripts = [
  {
    reviewId: reviewIds[0],
    angle: 'solution',
    scriptText: 'Acme Corporation provides a comprehensive solution that streamlines your workflow...'
  },
  {
    reviewId: reviewIds[0],
    angle: 'transformation',
    scriptText: 'After implementing our solution, businesses see a complete transformation in their operations...'
  },
  {
    reviewId: reviewIds[1],
    angle: 'problem',
    scriptText: 'Finding professional and responsive teams can be challenging in today\'s market...'
  }
];

const bulkScriptIds = saveScripts(bulkScripts);
console.log(`   Bulk created ${bulkScriptIds.length} scripts with IDs: [${bulkScriptIds.join(', ')}]`);

// Retrieve scripts for the pipeline run
const allScripts = getScriptsForPipelineRun(runId);
console.log(`   Total scripts for pipeline run: ${allScripts.length}`);

// ----------------------------------------------------------------------------
// 7. Save Video Metadata
// ----------------------------------------------------------------------------

console.log('\n7. Saving video metadata...');

/**
 * saveVideo creates a video record associated with a script
 * 
 * @param {Object} data - Video data
 * @param {number} data.scriptId - Associated script ID
 * @param {string} data.filePath - Path to the video file
 * @param {number} [data.duration] - Video duration in seconds
 * @param {string} [data.status='pending'] - Video status
 * @returns {number} The created video ID
 */
const videoId = saveVideo({
  scriptId: scriptId1,
  filePath: '/output/videos/run_' + runId + '/script_' + scriptId1 + '_v1.mp4',
  duration: 45.5,
  status: 'completed'
});
console.log(`   Created video with ID: ${videoId}`);

// Update video status
const videoUpdated = updateVideo(videoId, { 
  status: 'completed',
  duration: 47.2 
});
console.log(`   Updated video status: ${videoUpdated}`);

// Retrieve videos for pipeline run
const pipelineVideos = getVideos(runId);
console.log(`   Videos for pipeline run: ${pipelineVideos.length}`);

// ----------------------------------------------------------------------------
// 8. Permission Management
// ----------------------------------------------------------------------------

console.log('\n8. Managing permissions...');

/**
 * savePermission creates a consent tracking record for a review
 * 
 * @param {Object} data - Permission data
 * @param {number} data.reviewId - Associated review ID
 * @param {string} data.consentToken - Unique token for tracking consent
 * @param {string} data.phoneNumber - Contact phone number
 * @param {string} [data.status='pending'] - Permission status
 * @param {string} [data.sentAt] - When the request was sent
 * @returns {number} The created permission ID
 */
const consentToken = randomUUID();
const permissionId = savePermission({
  reviewId: reviewIds[0],
  consentToken: consentToken,
  phoneNumber: '+15551234567',
  status: 'pending',
  sentAt: new Date().toISOString()
});
console.log(`   Created permission with ID: ${permissionId}`);
console.log(`   Consent token: ${consentToken}`);

// Simulate consent approval
/**
 * updatePermissionByToken updates permission status using the consent token
 * Automatically sets responded_at timestamp
 * 
 * @param {string} consentToken - The unique consent token
 * @param {string} status - New status ('approved', 'denied')
 * @returns {boolean} True if updated, false if not found
 */
const consentUpdated = updatePermissionByToken(consentToken, 'approved');
console.log(`   Permission approved: ${consentUpdated}`);

// Retrieve permission by token
const permission = getPermissionByToken(consentToken);
console.log(`   Permission status: ${permission?.status}, responded at: ${permission?.respondedAt}`);

// ----------------------------------------------------------------------------
// 9. Transaction Example - Atomic Operations
// ----------------------------------------------------------------------------

console.log('\n9. Using transactions for atomic operations...');

/**
 * runTransaction executes multiple operations atomically
 * If any operation fails, all changes are rolled back
 * 
 * @param {Function} fn - Function containing database operations
 * @returns {*} Result of the function
 * @throws {Error} If transaction fails (automatically rolled back)
 */
const transactionResult = runTransaction(() => {
  // Create another pipeline run
  const newRunId = savePipelineRun({ companyName: 'Transaction Test Corp' });
  
  // Save reviews for this run
  const newReviewIds = saveReviews(newRunId, [
    { platform: 'google', text: 'Test review in transaction', rating: 5 }
  ]);
  
  // Save a script
  const newScriptId = saveScript({
    reviewId: newReviewIds[0],
    angle: 'problem',
    scriptText: 'Transaction test script content'
  });
  
  return { runId: newRunId, reviewIds: newReviewIds, scriptId: newScriptId };
});

console.log(`   Transaction completed successfully:`);
console.log(`   - Pipeline Run ID: ${transactionResult.runId}`);
console.log(`   - Review IDs: [${transactionResult.reviewIds.join(', ')}]`);
console.log(`   - Script ID: ${transactionResult.scriptId}`);

// ----------------------------------------------------------------------------
// 10. Pipeline Run Status Updates
// ----------------------------------------------------------------------------

console.log('\n10. Updating pipeline run status...');

/**
 * updatePipelineRun updates the status and/or error message
 * 
 * @param {number} runId - The pipeline run ID
 * @param {Object} data - Update data
 * @param {string} [data.status] - New status value
 * @param {string} [data.errorMessage] - Error message for failed runs
 * @returns {boolean} True if updated, false if not found
 */
updatePipelineRun(runId, { status: 'processing' });
console.log(`   Updated pipeline ${runId} to 'processing'`);

updatePipelineRun(runId, { status: 'completed' });
console.log(`   Updated pipeline ${runId} to 'completed'`);

// Retrieve the updated pipeline run
const pipelineRun = getPipelineRun(runId);
console.log(`   Pipeline run status: ${pipelineRun?.status}`);

// ----------------------------------------------------------------------------
// 11. Query All Pipeline Runs with Filtering
// ----------------------------------------------------------------------------

console.log('\n11. Querying pipeline runs...');

/**
 * getAllPipelineRuns retrieves pipeline runs with optional filtering
 * 
 * @param {Object} [options={}] - Query options
 * @param {string} [options.status] - Filter by status
 * @param {number} [options.limit=100] - Maximum results
 * @param {number} [options.offset=0] - Pagination offset
 * @returns {Array<Object>} Array of pipeline run objects
 */
const allRuns = getAllPipelineRuns();
console.log(`   Total pipeline runs: ${allRuns.length}`);

const completedRuns = getAllPipelineRuns({ status: 'completed' });
console.log(`   Completed runs: ${completedRuns.length}`);

const paginatedRuns = getAllPipelineRuns({ limit: 5, offset: 0 });
console.log(`   First page (5 runs): ${paginatedRuns.length}`);

// ----------------------------------------------------------------------------
// 12. Database Statistics
// ----------------------------------------------------------------------------

console.log('\n12. Database statistics...');

/**
 * getDatabaseStats returns row counts for all tables
 * Useful for monitoring and dashboards
 * 
 * @returns {Object} Object with counts for each table
 */
const stats = getDatabaseStats();
console.log(`   Pipeline Runs: ${stats.pipelineRuns}`);
console.log(`   Reviews: ${stats.reviews}`);
console.log(`   Scripts: ${stats.scripts}`);
console.log(`   Videos: ${stats.videos}`);
console.log(`   Permissions: ${stats.permissions}`);

// ----------------------------------------------------------------------------
// 13. Database Optimization
// ----------------------------------------------------------------------------

console.log('\n13. Running database optimization...');

/**
 * optimizeDatabase performs maintenance operations
 * - ANALYZE for query optimization
 * - WAL checkpoint for disk space recovery
 * 
 * Should be called periodically (e.g., daily maintenance job)
 */
optimizeDatabase();
console.log('   Database optimized successfully');

// ----------------------------------------------------------------------------
// 14. Cleanup - Delete Test Data
// ----------------------------------------------------------------------------

console.log('\n14. Cleaning up test data...');

/**
 * deletePipelineRun removes a pipeline run and all associated data
 * Foreign key constraints cascade deletions to reviews, scripts, videos
 * 
 * @param {number} runId - The pipeline run ID to delete
 * @returns {boolean} True if deleted, false if not found
 */
const deleted = deletePipelineRun(transactionResult.runId);
console.log(`   Deleted transaction test pipeline: ${deleted}`);

// ----------------------------------------------------------------------------
// 15. Graceful Shutdown
// ----------------------------------------------------------------------------

console.log('\n15. Closing database connection...');

/**
 * closeDatabase should be called during graceful shutdown
 * Performs WAL checkpoint before closing
 */
closeDatabase();
console.log('   Database connection closed');

console.log('\n' + '='.repeat(60));
console.log('Example completed successfully!');
console.log('='.repeat(60));