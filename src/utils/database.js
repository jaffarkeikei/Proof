/**
 * @module utils/database
 * @description SQLite database module for persisting pipeline state, reviews, scripts,
 * videos, and execution runs. Uses better-sqlite3 for synchronous database operations
 * with high performance, automatic schema initialization, and transaction support.
 * 
 * Features:
 * - Singleton database connection pattern
 * - Automatic schema initialization on first run
 * - Foreign key constraints between tables
 * - Prepared statements for all queries (SQL injection prevention)
 * - Transaction support for atomic multi-table operations
 * - SQLITE_BUSY retry logic with exponential backoff
 * - WAL mode for improved concurrent read performance
 * 
 * @example
 * import { getDatabase, savePipelineRun, saveReviews, getReviews } from './utils/database.js';
 * 
 * // Create a new pipeline run
 * const runId = savePipelineRun({ companyName: 'Acme Corp' });
 * 
 * // Save reviews for the run
 * const reviewIds = saveReviews(runId, [
 *   { platform: 'google', text: 'Great service!', rating: 5 }
 * ]);
 * 
 * // Retrieve reviews
 * const reviews = getReviews(runId);
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { getConfig } from './config.js';
import { createLogger } from './logger.js';

// ============================================================================
// Module State
// ============================================================================

const logger = createLogger('Database');

/**
 * Singleton database instance
 * @type {Database.Database|null}
 * @private
 */
let dbInstance = null;

// ============================================================================
// Configuration Constants
// ============================================================================

/**
 * Maximum number of retries for SQLITE_BUSY errors
 * @constant {number}
 * @private
 */
const MAX_RETRIES = 3;

/**
 * Initial delay between retries in milliseconds
 * @constant {number}
 * @private
 */
const INITIAL_RETRY_DELAY = 100;

/**
 * Busy timeout in milliseconds for SQLite
 * @constant {number}
 * @private
 */
const BUSY_TIMEOUT = 5000;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Ensures the directory for the database file exists
 * Creates it recursively if missing
 * 
 * @param {string} dbPath - Path to the database file
 * @private
 */
function ensureDirectoryExists(dbPath) {
  const dir = path.dirname(dbPath);
  
  if (!fs.existsSync(dir)) {
    logger.info('Creating database directory', { directory: dir });
    
    try {
      fs.mkdirSync(dir, { recursive: true });
      logger.debug('Database directory created successfully', { directory: dir });
    } catch (error) {
      logger.logError(error, { operation: 'ensureDirectoryExists', directory: dir });
      throw new Error(`Failed to create database directory: ${error.message}`);
    }
  }
}

/**
 * Gets the current timestamp in ISO 8601 format
 * 
 * @returns {string} ISO 8601 formatted timestamp
 * @private
 */
function getCurrentTimestamp() {
  return new Date().toISOString();
}

/**
 * Executes a database operation with retry logic for SQLITE_BUSY errors
 * Uses exponential backoff between retries
 * 
 * @param {Function} operation - The database operation to execute
 * @param {string} [operationName='unknown'] - Name for logging purposes
 * @param {number} [maxRetries=MAX_RETRIES] - Maximum number of retry attempts
 * @param {number} [initialDelay=INITIAL_RETRY_DELAY] - Initial delay in milliseconds
 * @returns {*} Result of the operation
 * @throws {Error} If operation fails after all retries
 * @private
 */
function executeWithRetry(operation, operationName = 'unknown', maxRetries = MAX_RETRIES, initialDelay = INITIAL_RETRY_DELAY) {
  let lastError;
  let delay = initialDelay;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return operation();
    } catch (error) {
      lastError = error;
      
      // Only retry on SQLITE_BUSY errors
      if (error.code === 'SQLITE_BUSY' && attempt < maxRetries) {
        logger.warn('Database busy, retrying operation', {
          operation: operationName,
          attempt,
          maxRetries,
          delayMs: delay
        });
        
        // Synchronous sleep using busy wait (better-sqlite3 is synchronous)
        const endTime = Date.now() + delay;
        while (Date.now() < endTime) {
          // Busy wait - this is acceptable for synchronous SQLite operations
        }
        
        // Exponential backoff
        delay *= 2;
      } else {
        // Non-retryable error or max retries exceeded
        break;
      }
    }
  }
  
  // Log and rethrow the last error
  logger.logError(lastError, { operation: operationName, maxRetries });
  throw lastError;
}

// ============================================================================
// Schema Initialization
// ============================================================================

/**
 * Initializes the database schema
 * Creates all tables if they don't exist and sets up indexes
 * 
 * @param {Database.Database} db - Database instance
 * @throws {Error} If schema initialization fails
 * @private
 */
function initSchema(db) {
  logger.info('Initializing database schema');
  
  try {
    // Enable foreign key constraints
    db.pragma('foreign_keys = ON');
    
    // Create pipeline_runs table
    db.exec(`
      CREATE TABLE IF NOT EXISTS pipeline_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        error_message TEXT
      )
    `);
    logger.debug('Created table: pipeline_runs');
    
    // Create reviews table with foreign key to pipeline_runs
    db.exec(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pipeline_run_id INTEGER NOT NULL,
        platform TEXT NOT NULL,
        author TEXT,
        rating REAL,
        text TEXT NOT NULL,
        date TEXT,
        sentiment_score REAL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (pipeline_run_id) REFERENCES pipeline_runs(id) ON DELETE CASCADE
      )
    `);
    logger.debug('Created table: reviews');
    
    // Create scripts table with foreign key to reviews
    db.exec(`
      CREATE TABLE IF NOT EXISTS scripts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        review_id INTEGER NOT NULL,
        angle TEXT NOT NULL CHECK (angle IN ('problem', 'solution', 'transformation')),
        script_text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
      )
    `);
    logger.debug('Created table: scripts');
    
    // Create videos table with foreign key to scripts
    db.exec(`
      CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        script_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        duration REAL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
      )
    `);
    logger.debug('Created table: videos');
    
    // Create permissions table with foreign key to reviews
    db.exec(`
      CREATE TABLE IF NOT EXISTS permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        review_id INTEGER NOT NULL,
        consent_token TEXT NOT NULL UNIQUE,
        phone_number TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        sent_at TEXT,
        responded_at TEXT,
        FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
      )
    `);
    logger.debug('Created table: permissions');
    
    // Create indexes for optimized queries
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status);
      CREATE INDEX IF NOT EXISTS idx_pipeline_runs_created_at ON pipeline_runs(created_at);
      CREATE INDEX IF NOT EXISTS idx_reviews_pipeline_run_id ON reviews(pipeline_run_id);
      CREATE INDEX IF NOT EXISTS idx_reviews_platform ON reviews(platform);
      CREATE INDEX IF NOT EXISTS idx_scripts_review_id ON scripts(review_id);
      CREATE INDEX IF NOT EXISTS idx_scripts_angle ON scripts(angle);
      CREATE INDEX IF NOT EXISTS idx_videos_script_id ON videos(script_id);
      CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
      CREATE INDEX IF NOT EXISTS idx_permissions_review_id ON permissions(review_id);
      CREATE INDEX IF NOT EXISTS idx_permissions_consent_token ON permissions(consent_token);
      CREATE INDEX IF NOT EXISTS idx_permissions_status ON permissions(status);
    `);
    logger.debug('Created indexes');
    
    logger.info('Database schema initialized successfully');
  } catch (error) {
    logger.logError(error, { operation: 'initSchema' });
    throw new Error(`Failed to initialize database schema: ${error.message}`);
  }
}

// ============================================================================
// Database Connection Management
// ============================================================================

/**
 * Gets or creates the singleton database instance
 * Automatically initializes schema on first run
 * 
 * @returns {Database.Database} The database instance
 * @throws {Error} If database connection or initialization fails
 * 
 * @example
 * import { getDatabase } from './utils/database.js';
 * 
 * const db = getDatabase();
 * // Use db for raw queries if needed
 */
function getDatabase() {
  if (dbInstance !== null) {
    return dbInstance;
  }
  
  const config = getConfig();
  const dbPath = path.resolve(config.DATABASE_PATH);
  
  logger.info('Opening database connection', { path: dbPath });
  
  // Ensure the data directory exists
  ensureDirectoryExists(dbPath);
  
  try {
    // Open database connection
    dbInstance = new Database(dbPath, {
      // Enable verbose logging in development
      verbose: config.NODE_ENV === 'development' 
        ? (message) => logger.debug('SQLite', { sql: message })
        : null
    });
    
    // Configure database for optimal performance
    // WAL mode provides better concurrent read performance
    dbInstance.pragma('journal_mode = WAL');
    
    // Enable foreign key constraint enforcement
    dbInstance.pragma('foreign_keys = ON');
    
    // Set busy timeout to handle concurrent access
    dbInstance.pragma(`busy_timeout = ${BUSY_TIMEOUT}`);
    
    // Optimize synchronization for better performance with acceptable durability
    dbInstance.pragma('synchronous = NORMAL');
    
    // Use memory-mapped I/O for better performance (64MB)
    dbInstance.pragma('mmap_size = 67108864');
    
    // Initialize schema if needed
    initSchema(dbInstance);
    
    logger.info('Database connection established successfully', { 
      path: dbPath,
      walMode: true,
      foreignKeys: true
    });
    
    return dbInstance;
  } catch (error) {
    logger.logError(error, { operation: 'getDatabase', path: dbPath });
    throw new Error(`Failed to open database: ${error.message}`);
  }
}

/**
 * Closes the database connection
 * Should be called during graceful application shutdown
 * 
 * @returns {void}
 * 
 * @example
 * import { closeDatabase } from './utils/database.js';
 * 
 * process.on('SIGTERM', () => {
 *   closeDatabase();
 *   process.exit(0);
 * });
 */
function closeDatabase() {
  if (dbInstance !== null) {
    logger.info('Closing database connection');
    
    try {
      // Checkpoint WAL file before closing
      dbInstance.pragma('wal_checkpoint(TRUNCATE)');
      dbInstance.close();
      dbInstance = null;
      logger.info('Database connection closed successfully');
    } catch (error) {
      logger.logError(error, { operation: 'closeDatabase' });
      dbInstance = null;
    }
  }
}

// ============================================================================
// Pipeline Runs CRUD Operations
// ============================================================================

/**
 * Saves a new pipeline run to the database
 * 
 * @param {Object} data - Pipeline run data
 * @param {string} data.companyName - Name of the company being processed
 * @param {string} [data.status='pending'] - Initial status of the run
 * @returns {number} The ID of the created pipeline run
 * @throws {Error} If the insert operation fails
 * 
 * @example
 * import { savePipelineRun } from './utils/database.js';
 * 
 * const runId = savePipelineRun({ companyName: 'Acme Corporation' });
 * console.log(`Created pipeline run with ID: ${runId}`);
 */
function savePipelineRun(data) {
  const db = getDatabase();
  const timestamp = getCurrentTimestamp();
  
  logger.debug('Saving pipeline run', { companyName: data.companyName });
  
  try {
    const stmt = db.prepare(`
      INSERT INTO pipeline_runs (company_name, status, created_at, updated_at)
      VALUES (@companyName, @status, @createdAt, @updatedAt)
    `);
    
    const result = executeWithRetry(
      () => stmt.run({
        companyName: data.companyName,
        status: data.status || 'pending',
        createdAt: timestamp,
        updatedAt: timestamp
      }),
      'savePipelineRun'
    );
    
    const runId = Number(result.lastInsertRowid);
    
    logger.info('Pipeline run saved', { 
      runId,
      companyName: data.companyName,
      status: data.status || 'pending'
    });
    
    return runId;
  } catch (error) {
    logger.logError(error, { 
      operation: 'savePipelineRun', 
      companyName: data.companyName 
    });
    throw error;
  }
}

/**
 * Retrieves a pipeline run by ID
 * 
 * @param {number} runId - The pipeline run ID
 * @returns {Object|null} The pipeline run data or null if not found
 * 
 * @example
 * import { getPipelineRun } from './utils/database.js';
 * 
 * const run = getPipelineRun(1);
 * if (run) {
 *   console.log(`Status: ${run.status}`);
 * }
 */
function getPipelineRun(runId) {
  const db = getDatabase();
  
  logger.debug('Getting pipeline run', { runId });
  
  try {
    const stmt = db.prepare(`
      SELECT id, company_name, status, created_at, updated_at, error_message
      FROM pipeline_runs
      WHERE id = ?
    `);
    
    const row = executeWithRetry(() => stmt.get(runId), 'getPipelineRun');
    
    if (!row) {
      logger.debug('Pipeline run not found', { runId });
      return null;
    }
    
    return {
      id: row.id,
      companyName: row.company_name,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      errorMessage: row.error_message
    };
  } catch (error) {
    logger.logError(error, { operation: 'getPipelineRun', runId });
    throw error;
  }
}

/**
 * Updates a pipeline run's status and/or error message
 * 
 * @param {number} runId - The pipeline run ID
 * @param {Object} data - Update data
 * @param {string} [data.status] - New status value
 * @param {string} [data.errorMessage] - Error message (typically set when status is 'failed')
 * @returns {boolean} True if the run was updated, false if not found
 * 
 * @example
 * import { updatePipelineRun } from './utils/database.js';
 * 
 * // Update status to completed
 * updatePipelineRun(1, { status: 'completed' });
 * 
 * // Update status to failed with error message
 * updatePipelineRun(1, { 
 *   status: 'failed', 
 *   errorMessage: 'API rate limit exceeded' 
 * });
 */
function updatePipelineRun(runId, data) {
  const db = getDatabase();
  const timestamp = getCurrentTimestamp();
  
  logger.debug('Updating pipeline run', { runId, ...data });
  
  try {
    const stmt = db.prepare(`
      UPDATE pipeline_runs
      SET status = COALESCE(@status, status),
          error_message = COALESCE(@errorMessage, error_message),
          updated_at = @updatedAt
      WHERE id = @runId
    `);
    
    const result = executeWithRetry(
      () => stmt.run({
        runId,
        status: data.status || null,
        errorMessage: data.errorMessage || null,
        updatedAt: timestamp
      }),
      'updatePipelineRun'
    );
    
    const updated = result.changes > 0;
    
    if (updated) {
      logger.info('Pipeline run updated', { runId, status: data.status });
    } else {
      logger.debug('Pipeline run not found for update', { runId });
    }
    
    return updated;
  } catch (error) {
    logger.logError(error, { operation: 'updatePipelineRun', runId });
    throw error;
  }
}

/**
 * Retrieves all pipeline runs, optionally filtered by status
 * 
 * @param {Object} [options={}] - Query options
 * @param {string} [options.status] - Filter by status (e.g., 'pending', 'completed', 'failed')
 * @param {number} [options.limit=100] - Maximum number of results to return
 * @param {number} [options.offset=0] - Number of results to skip (for pagination)
 * @returns {Array<Object>} Array of pipeline run objects
 * 
 * @example
 * import { getAllPipelineRuns } from './utils/database.js';
 * 
 * // Get all runs
 * const allRuns = getAllPipelineRuns();
 * 
 * // Get only pending runs
 * const pendingRuns = getAllPipelineRuns({ status: 'pending' });
 * 
 * // Paginated results
 * const page2 = getAllPipelineRuns({ limit: 10, offset: 10 });
 */
function getAllPipelineRuns(options = {}) {
  const db = getDatabase();
  const limit = options.limit || 100;
  const offset = options.offset || 0;
  
  logger.debug('Getting all pipeline runs', { options });
  
  try {
    let stmt;
    let rows;
    
    if (options.status) {
      stmt = db.prepare(`
        SELECT id, company_name, status, created_at, updated_at, error_message
        FROM pipeline_runs
        WHERE status = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `);
      rows = executeWithRetry(
        () => stmt.all(options.status, limit, offset),
        'getAllPipelineRuns'
      );
    } else {
      stmt = db.prepare(`
        SELECT id, company_name, status, created_at, updated_at, error_message
        FROM pipeline_runs
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `);
      rows = executeWithRetry(
        () => stmt.all(limit, offset),
        'getAllPipelineRuns'
      );
    }
    
    return rows.map(row => ({
      id: row.id,
      companyName: row.company_name,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      errorMessage: row.error_message
    }));
  } catch (error) {
    logger.logError(error, { operation: 'getAllPipelineRuns', options });
    throw error;
  }
}

/**
 * Deletes a pipeline run and all associated data (cascades to reviews, scripts, etc.)
 * 
 * @param {number} runId - The pipeline run ID to delete
 * @returns {boolean} True if deleted, false if not found
 */
function deletePipelineRun(runId) {
  const db = getDatabase();
  
  logger.debug('Deleting pipeline run', { runId });
  
  try {
    const stmt = db.prepare('DELETE FROM pipeline_runs WHERE id = ?');
    const result = executeWithRetry(() => stmt.run(runId), 'deletePipelineRun');
    
    const deleted = result.changes > 0;
    
    if (deleted) {
      logger.info('Pipeline run deleted', { runId });
    } else {
      logger.debug('Pipeline run not found for deletion', { runId });
    }
    
    return deleted;
  } catch (error) {
    logger.logError(error, { operation: 'deletePipelineRun', runId });
    throw error;
  }
}

// ============================================================================
// Reviews CRUD Operations
// ============================================================================

/**
 * Saves multiple reviews for a pipeline run using a transaction
 * 
 * @param {number} pipelineRunId - The pipeline run ID to associate reviews with
 * @param {Array<Object>} reviews - Array of review objects to save
 * @param {string} reviews[].platform - Review platform (e.g., 'google', 'yelp', 'trustpilot')
 * @param {string} [reviews[].author] - Name of the review author
 * @param {number} [reviews[].rating] - Review rating (typically 1-5)
 * @param {string} reviews[].text - Review text content
 * @param {string} [reviews[].date] - Original review date
 * @param {number} [reviews[].sentimentScore] - Calculated sentiment score (-1 to 1)
 * @returns {Array<number>} Array of created review IDs
 * @throws {Error} If the transaction fails (all inserts are rolled back)
 * 
 * @example
 * import { saveReviews } from './utils/database.js';
 * 
 * const reviewIds = saveReviews(1, [
 *   { 
 *     platform: 'google', 
 *     author: 'John D.', 
 *     rating: 5, 
 *     text: 'Excellent service!',
 *     date: '2024-01-15'
 *   },
 *   { 
 *     platform: 'yelp', 
 *     text: 'Great experience overall',
 *     rating: 4
 *   }
 * ]);
 */
function saveReviews(pipelineRunId, reviews) {
  const db = getDatabase();
  const timestamp = getCurrentTimestamp();
  
  logger.debug('Saving reviews', { 
    pipelineRunId, 
    reviewCount: reviews?.length || 0
  });
  
  if (!reviews || reviews.length === 0) {
    logger.debug('No reviews to save');
    return [];
  }
  
  try {
    const insertStmt = db.prepare(`
      INSERT INTO reviews (
        pipeline_run_id, platform, author, rating, text, date, sentiment_score, created_at
      )
      VALUES (
        @pipelineRunId, @platform, @author, @rating, @text, @date, @sentimentScore, @createdAt
      )
    `);
    
    const insertedIds = [];
    
    // Create transaction for atomic bulk insert
    const insertMany = db.transaction((reviewList) => {
      for (const review of reviewList) {
        const result = insertStmt.run({
          pipelineRunId,
          platform: review.platform,
          author: review.author || null,
          rating: review.rating || null,
          text: review.text,
          date: review.date || null,
          sentimentScore: review.sentimentScore || null,
          createdAt: timestamp
        });
        insertedIds.push(Number(result.lastInsertRowid));
      }
    });
    
    executeWithRetry(() => insertMany(reviews), 'saveReviews');
    
    logger.info('Reviews saved', { 
      pipelineRunId, 
      reviewCount: insertedIds.length,
      reviewIds: insertedIds
    });
    
    return insertedIds;
  } catch (error) {
    logger.logError(error, { 
      operation: 'saveReviews', 
      pipelineRunId, 
      reviewCount: reviews.length 
    });
    throw error;
  }
}

/**
 * Retrieves all reviews for a pipeline run
 * 
 * @param {number} pipelineRunId - The pipeline run ID
 * @returns {Array<Object>} Array of review objects
 * 
 * @example
 * import { getReviews } from './utils/database.js';
 * 
 * const reviews = getReviews(1);
 * reviews.forEach(review => {
 *   console.log(`${review.platform}: ${review.text}`);
 * });
 */
function getReviews(pipelineRunId) {
  const db = getDatabase();
  
  logger.debug('Getting reviews', { pipelineRunId });
  
  try {
    const stmt = db.prepare(`
      SELECT id, pipeline_run_id, platform, author, rating, text, date,
             sentiment_score, created_at
      FROM reviews
      WHERE pipeline_run_id = ?
      ORDER BY created_at ASC
    `);
    
    const rows = executeWithRetry(() => stmt.all(pipelineRunId), 'getReviews');
    
    return rows.map(row => ({
      id: row.id,
      pipelineRunId: row.pipeline_run_id,
      platform: row.platform,
      author: row.author,
      rating: row.rating,
      text: row.text,
      date: row.date,
      sentimentScore: row.sentiment_score,
      createdAt: row.created_at
    }));
  } catch (error) {
    logger.logError(error, { operation: 'getReviews', pipelineRunId });
    throw error;
  }
}

/**
 * Gets a single review by ID
 * 
 * @param {number} reviewId - The review ID
 * @returns {Object|null} The review object or null if not found
 */
function getReview(reviewId) {
  const db = getDatabase();
  
  logger.debug('Getting review', { reviewId });
  
  try {
    const stmt = db.prepare(`
      SELECT id, pipeline_run_id, platform, author, rating, text, date,
             sentiment_score, created_at
      FROM reviews
      WHERE id = ?
    `);
    
    const row = executeWithRetry(() => stmt.get(reviewId), 'getReview');
    
    if (!row) {
      return null;
    }
    
    return {
      id: row.id,
      pipelineRunId: row.pipeline_run_id,
      platform: row.platform,
      author: row.author,
      rating: row.rating,
      text: row.text,
      date: row.date,
      sentimentScore: row.sentiment_score,
      createdAt: row.created_at
    };
  } catch (error) {
    logger.logError(error, { operation: 'getReview', reviewId });
    throw error;
  }
}

/**
 * Updates a review's sentiment score
 * 
 * @param {number} reviewId - The review ID
 * @param {number} sentimentScore - The sentiment score (typically -1 to 1)
 * @returns {boolean} True if updated, false if review not found
 */
function updateReviewSentiment(reviewId, sentimentScore) {
  const db = getDatabase();
  
  logger.debug('Updating review sentiment', { reviewId, sentimentScore });
  
  try {
    const stmt = db.prepare(`
      UPDATE reviews
      SET sentiment_score = ?
      WHERE id = ?
    `);
    
    const result = executeWithRetry(
      () => stmt.run(sentimentScore, reviewId),
      'updateReviewSentiment'
    );
    
    const updated = result.changes > 0;
    
    if (updated) {
      logger.debug('Review sentiment updated', { reviewId, sentimentScore });
    }
    
    return updated;
  } catch (error) {
    logger.logError(error, { operation: 'updateReviewSentiment', reviewId });
    throw error;
  }
}

// ============================================================================
// Scripts CRUD Operations
// ============================================================================

/**
 * Saves a single script for a review
 * 
 * @param {Object} data - Script data
 * @param {number} data.reviewId - Associated review ID
 * @param {string} data.angle - Script angle ('problem', 'solution', or 'transformation')
 * @param {string} data.scriptText - The script content
 * @returns {number} The created script ID
 * 
 * @example
 * import { saveScript } from './utils/database.js';
 * 
 * const scriptId = saveScript({
 *   reviewId: 1,
 *   angle: 'problem',
 *   scriptText: 'Have you ever struggled with...'
 * });
 */
function saveScript(data) {
  const db = getDatabase();
  const timestamp = getCurrentTimestamp();
  
  logger.debug('Saving script', { reviewId: data.reviewId, angle: data.angle });
  
  try {
    const stmt = db.prepare(`
      INSERT INTO scripts (review_id, angle, script_text, created_at)
      VALUES (@reviewId, @angle, @scriptText, @createdAt)
    `);
    
    const result = executeWithRetry(
      () => stmt.run({
        reviewId: data.reviewId,
        angle: data.angle,
        scriptText: data.scriptText,
        createdAt: timestamp
      }),
      'saveScript'
    );
    
    const scriptId = Number(result.lastInsertRowid);
    
    logger.info('Script saved', { 
      scriptId,
      reviewId: data.reviewId,
      angle: data.angle
    });
    
    return scriptId;
  } catch (error) {
    logger.logError(error, { 
      operation: 'saveScript', 
      reviewId: data.reviewId,
      angle: data.angle
    });
    throw error;
  }
}

/**
 * Saves multiple scripts using a transaction
 * 
 * @param {Array<Object>} scripts - Array of script objects
 * @param {number} scripts[].reviewId - Associated review ID
 * @param {string} scripts[].angle - Script angle
 * @param {string} scripts[].scriptText - The script content
 * @returns {Array<number>} Array of created script IDs
 */
function saveScripts(scripts) {
  const db = getDatabase();
  const timestamp = getCurrentTimestamp();
  
  logger.debug('Saving scripts', { scriptCount: scripts?.length || 0 });
  
  if (!scripts || scripts.length === 0) {
    return [];
  }
  
  try {
    const stmt = db.prepare(`
      INSERT INTO scripts (review_id, angle, script_text, created_at)
      VALUES (@reviewId, @angle, @scriptText, @createdAt)
    `);
    
    const insertedIds = [];
    
    const insertMany = db.transaction((scriptList) => {
      for (const script of scriptList) {
        const result = stmt.run({
          reviewId: script.reviewId,
          angle: script.angle,
          scriptText: script.scriptText,
          createdAt: timestamp
        });
        insertedIds.push(Number(result.lastInsertRowid));
      }
    });
    
    executeWithRetry(() => insertMany(scripts), 'saveScripts');
    
    logger.info('Scripts saved', { scriptCount: insertedIds.length });
    
    return insertedIds;
  } catch (error) {
    logger.logError(error, { operation: 'saveScripts', scriptCount: scripts.length });
    throw error;
  }
}

/**
 * Gets all scripts for a review
 * 
 * @param {number} reviewId - The review ID
 * @returns {Array<Object>} Array of script objects
 */
function getScripts(reviewId) {
  const db = getDatabase();
  
  logger.debug('Getting scripts', { reviewId });
  
  try {
    const stmt = db.prepare(`
      SELECT id, review_id, angle, script_text, created_at
      FROM scripts
      WHERE review_id = ?
      ORDER BY created_at ASC
    `);
    
    const rows = executeWithRetry(() => stmt.all(reviewId), 'getScripts');
    
    return rows.map(row => ({
      id: row.id,
      reviewId: row.review_id,
      angle: row.angle,
      scriptText: row.script_text,
      createdAt: row.created_at
    }));
  } catch (error) {
    logger.logError(error, { operation: 'getScripts', reviewId });
    throw error;
  }
}

/**
 * Gets a single script by ID
 * 
 * @param {number} scriptId - The script ID
 * @returns {Object|null} The script object or null if not found
 */
function getScript(scriptId) {
  const db = getDatabase();
  
  logger.debug('Getting script', { scriptId });
  
  try {
    const stmt = db.prepare(`
      SELECT id, review_id, angle, script_text, created_at
      FROM scripts
      WHERE id = ?
    `);
    
    const row = executeWithRetry(() => stmt.get(scriptId), 'getScript');
    
    if (!row) {
      return null;
    }
    
    return {
      id: row.id,
      reviewId: row.review_id,
      angle: row.angle,
      scriptText: row.script_text,
      createdAt: row.created_at
    };
  } catch (error) {
    logger.logError(error, { operation: 'getScript', scriptId });
    throw error;
  }
}

/**
 * Gets all scripts for a pipeline run (joins through reviews)
 * 
 * @param {number} pipelineRunId - The pipeline run ID
 * @returns {Array<Object>} Array of script objects with review metadata
 */
function getScriptsForPipelineRun(pipelineRunId) {
  const db = getDatabase();
  
  logger.debug('Getting scripts for pipeline run', { pipelineRunId });
  
  try {
    const stmt = db.prepare(`
      SELECT s.id, s.review_id, s.angle, s.script_text, s.created_at,
             r.platform AS review_platform, r.author AS review_author, r.rating AS review_rating
      FROM scripts s
      INNER JOIN reviews r ON s.review_id = r.id
      WHERE r.pipeline_run_id = ?
      ORDER BY r.id ASC, s.created_at ASC
    `);
    
    const rows = executeWithRetry(
      () => stmt.all(pipelineRunId),
      'getScriptsForPipelineRun'
    );
    
    return rows.map(row => ({
      id: row.id,
      reviewId: row.review_id,
      angle: row.angle,
      scriptText: row.script_text,
      createdAt: row.created_at,
      reviewPlatform: row.review_platform,
      reviewAuthor: row.review_author,
      reviewRating: row.review_rating
    }));
  } catch (error) {
    logger.logError(error, { operation: 'getScriptsForPipelineRun', pipelineRunId });
    throw error;
  }
}

// ============================================================================
// Videos CRUD Operations
// ============================================================================

/**
 * Saves video metadata
 * 
 * @param {Object} data - Video data
 * @param {number} data.scriptId - Associated script ID
 * @param {string} data.filePath - Path to the video file
 * @param {number} [data.duration] - Video duration in seconds
 * @param {string} [data.status='pending'] - Video status ('pending', 'processing', 'completed', 'failed')
 * @returns {number} The created video ID
 * 
 * @example
 * import { saveVideo } from './utils/database.js';
 * 
 * const videoId = saveVideo({
 *   scriptId: 1,
 *   filePath: '/videos/script_1_v1.mp4',
 *   duration: 45.5,
 *   status: 'completed'
 * });
 */
function saveVideo(data) {
  const db = getDatabase();
  const timestamp = getCurrentTimestamp();
  
  logger.debug('Saving video', { scriptId: data.scriptId, filePath: data.filePath });
  
  try {
    const stmt = db.prepare(`
      INSERT INTO videos (script_id, file_path, duration, status, created_at)
      VALUES (@scriptId, @filePath, @duration, @status, @createdAt)
    `);
    
    const result = executeWithRetry(
      () => stmt.run({
        scriptId: data.scriptId,
        filePath: data.filePath,
        duration: data.duration || null,
        status: data.status || 'pending',
        createdAt: timestamp
      }),
      'saveVideo'
    );
    
    const videoId = Number(result.lastInsertRowid);
    
    logger.info('Video saved', { 
      videoId,
      scriptId: data.scriptId,
      status: data.status || 'pending'
    });
    
    return videoId;
  } catch (error) {
    logger.logError(error, { 
      operation: 'saveVideo', 
      scriptId: data.scriptId 
    });
    throw error;
  }
}

/**
 * Gets a single video by ID
 * 
 * @param {number} videoId - The video ID
 * @returns {Object|null} The video object or null if not found
 */
function getVideo(videoId) {
  const db = getDatabase();
  
  logger.debug('Getting video', { videoId });
  
  try {
    const stmt = db.prepare(`
      SELECT id, script_id, file_path, duration, status, created_at
      FROM videos
      WHERE id = ?
    `);
    
    const row = executeWithRetry(() => stmt.get(videoId), 'getVideo');
    
    if (!row) {
      return null;
    }
    
    return {
      id: row.id,
      scriptId: row.script_id,
      filePath: row.file_path,
      duration: row.duration,
      status: row.status,
      createdAt: row.created_at
    };
  } catch (error) {
    logger.logError(error, { operation: 'getVideo', videoId });
    throw error;
  }
}

/**
 * Gets all videos for a pipeline run (joins through scripts and reviews)
 * 
 * @param {number} pipelineRunId - The pipeline run ID
 * @returns {Array<Object>} Array of video objects with script metadata
 * 
 * @example
 * import { getVideos } from './utils/database.js';
 * 
 * const videos = getVideos(1);
 * videos.forEach(video => {
 *   console.log(`Video ${video.id}: ${video.filePath} (${video.status})`);
 * });
 */
function getVideos(pipelineRunId) {
  const db = getDatabase();
  
  logger.debug('Getting videos for pipeline run', { pipelineRunId });
  
  try {
    const stmt = db.prepare(`
      SELECT v.id, v.script_id, v.file_path, v.duration, v.status, v.created_at,
             s.angle AS script_angle, s.script_text,
             r.platform AS review_platform, r.author AS review_author
      FROM videos v
      INNER JOIN scripts s ON v.script_id = s.id
      INNER JOIN reviews r ON s.review_id = r.id
      WHERE r.pipeline_run_id = ?
      ORDER BY v.created_at ASC
    `);
    
    const rows = executeWithRetry(() => stmt.all(pipelineRunId), 'getVideos');
    
    return rows.map(row => ({
      id: row.id,
      scriptId: row.script_id,
      filePath: row.file_path,
      duration: row.duration,
      status: row.status,
      createdAt: row.created_at,
      scriptAngle: row.script_angle,
      scriptText: row.script_text,
      reviewPlatform: row.review_platform,
      reviewAuthor: row.review_author
    }));
  } catch (error) {
    logger.logError(error, { operation: 'getVideos', pipelineRunId });
    throw error;
  }
}

/**
 * Updates video status and/or duration
 * 
 * @param {number} videoId - The video ID
 * @param {Object} data - Update data
 * @param {string} [data.status] - New status value
 * @param {number} [data.duration] - Video duration in seconds
 * @param {string} [data.filePath] - Updated file path
 * @returns {boolean} True if updated, false if video not found
 */
function updateVideo(videoId, data) {
  const db = getDatabase();
  
  logger.debug('Updating video', { videoId, ...data });
  
  try {
    const stmt = db.prepare(`
      UPDATE videos
      SET status = COALESCE(@status, status),
          duration = COALESCE(@duration, duration),
          file_path = COALESCE(@filePath, file_path)
      WHERE id = @videoId
    `);
    
    const result = executeWithRetry(
      () => stmt.run({
        videoId,
        status: data.status || null,
        duration: data.duration || null,
        filePath: data.filePath || null
      }),
      'updateVideo'
    );
    
    const updated = result.changes > 0;
    
    if (updated) {
      logger.info('Video updated', { videoId, status: data.status });
    }
    
    return updated;
  } catch (error) {
    logger.logError(error, { operation: 'updateVideo', videoId });
    throw error;
  }
}

// ============================================================================
// Permissions CRUD Operations
// ============================================================================

/**
 * Saves a permission request for a review
 * 
 * @param {Object} data - Permission data
 * @param {number} data.reviewId - Associated review ID
 * @param {string} data.consentToken - Unique consent token for tracking
 * @param {string} data.phoneNumber - Phone number to contact for permission
 * @param {string} [data.status='pending'] - Permission status
 * @param {string} [data.sentAt] - Timestamp when permission request was sent
 * @returns {number} The created permission ID
 * 
 * @example
 * import { savePermission } from './utils/database.js';
 * import { randomUUID } from 'crypto';
 * 
 * const permissionId = savePermission({
 *   reviewId: 1,
 *   consentToken: randomUUID(),
 *   phoneNumber: '+15551234567',
 *   sentAt: new Date().toISOString()
 * });
 */
function savePermission(data) {
  const db = getDatabase();
  
  logger.debug('Saving permission', { reviewId: data.reviewId });
  
  try {
    const stmt = db.prepare(`
      INSERT INTO permissions (review_id, consent_token, phone_number, status, sent_at)
      VALUES (@reviewId, @consentToken, @phoneNumber, @status, @sentAt)
    `);
    
    const result = executeWithRetry(
      () => stmt.run({
        reviewId: data.reviewId,
        consentToken: data.consentToken,
        phoneNumber: data.phoneNumber,
        status: data.status || 'pending',
        sentAt: data.sentAt || null
      }),
      'savePermission'
    );
    
    const permissionId = Number(result.lastInsertRowid);
    
    logger.info('Permission saved', { 
      permissionId,
      reviewId: data.reviewId,
      status: data.status || 'pending'
    });
    
    return permissionId;
  } catch (error) {
    logger.logError(error, { 
      operation: 'savePermission', 
      reviewId: data.reviewId 
    });
    throw error;
  }
}

/**
 * Gets a permission by its consent token
 * 
 * @param {string} consentToken - The unique consent token
 * @returns {Object|null} The permission object or null if not found
 * 
 * @example
 * import { getPermissionByToken } from './utils/database.js';
 * 
 * const permission = getPermissionByToken('abc123-token');
 * if (permission && permission.status === 'pending') {
 *   // Process the consent response
 * }
 */
function getPermissionByToken(consentToken) {
  const db = getDatabase();
  
  logger.debug('Getting permission by token');
  
  try {
    const stmt = db.prepare(`
      SELECT id, review_id, consent_token, phone_number, status, sent_at, responded_at
      FROM permissions
      WHERE consent_token = ?
    `);
    
    const row = executeWithRetry(() => stmt.get(consentToken), 'getPermissionByToken');
    
    if (!row) {
      return null;
    }
    
    return {
      id: row.id,
      reviewId: row.review_id,
      consentToken: row.consent_token,
      phoneNumber: row.phone_number,
      status: row.status,
      sentAt: row.sent_at,
      respondedAt: row.responded_at
    };
  } catch (error) {
    logger.logError(error, { operation: 'getPermissionByToken' });
    throw error;
  }
}

/**
 * Gets all permissions for a review
 * 
 * @param {number} reviewId - The review ID
 * @returns {Array<Object>} Array of permission objects
 */
function getPermissions(reviewId) {
  const db = getDatabase();
  
  logger.debug('Getting permissions', { reviewId });
  
  try {
    const stmt = db.prepare(`
      SELECT id, review_id, consent_token, phone_number, status, sent_at, responded_at
      FROM permissions
      WHERE review_id = ?
      ORDER BY sent_at DESC NULLS LAST
    `);
    
    const rows = executeWithRetry(() => stmt.all(reviewId), 'getPermissions');
    
    return rows.map(row => ({
      id: row.id,
      reviewId: row.review_id,
      consentToken: row.consent_token,
      phoneNumber: row.phone_number,
      status: row.status,
      sentAt: row.sent_at,
      respondedAt: row.responded_at
    }));
  } catch (error) {
    logger.logError(error, { operation: 'getPermissions', reviewId });
    throw error;
  }
}

/**
 * Gets all permissions for a pipeline run
 * 
 * @param {number} pipelineRunId - The pipeline run ID
 * @returns {Array<Object>} Array of permission objects with review metadata
 */
function getPermissionsForPipelineRun(pipelineRunId) {
  const db = getDatabase();
  
  logger.debug('Getting permissions for pipeline run', { pipelineRunId });
  
  try {
    const stmt = db.prepare(`
      SELECT p.id, p.review_id, p.consent_token, p.phone_number, p.status, 
             p.sent_at, p.responded_at,
             r.platform AS review_platform, r.author AS review_author
      FROM permissions p
      INNER JOIN reviews r ON p.review_id = r.id
      WHERE r.pipeline_run_id = ?
      ORDER BY p.sent_at DESC NULLS LAST
    `);
    
    const rows = executeWithRetry(
      () => stmt.all(pipelineRunId),
      'getPermissionsForPipelineRun'
    );
    
    return rows.map(row => ({
      id: row.id,
      reviewId: row.review_id,
      consentToken: row.consent_token,
      phoneNumber: row.phone_number,
      status: row.status,
      sentAt: row.sent_at,
      respondedAt: row.responded_at,
      reviewPlatform: row.review_platform,
      reviewAuthor: row.review_author
    }));
  } catch (error) {
    logger.logError(error, { operation: 'getPermissionsForPipelineRun', pipelineRunId });
    throw error;
  }
}

/**
 * Updates a permission's status
 * 
 * @param {number} permissionId - The permission ID
 * @param {Object} data - Update data
 * @param {string} [data.status] - New status ('approved', 'denied', 'expired')
 * @param {string} [data.respondedAt] - Timestamp of response
 * @returns {boolean} True if updated, false if permission not found
 */
function updatePermission(permissionId, data) {
  const db = getDatabase();
  
  logger.debug('Updating permission', { permissionId, status: data.status });
  
  try {
    const stmt = db.prepare(`
      UPDATE permissions
      SET status = COALESCE(@status, status),
          responded_at = COALESCE(@respondedAt, responded_at)
      WHERE id = @permissionId
    `);
    
    const result = executeWithRetry(
      () => stmt.run({
        permissionId,
        status: data.status || null,
        respondedAt: data.respondedAt || null
      }),
      'updatePermission'
    );
    
    const updated = result.changes > 0;
    
    if (updated) {
      logger.info('Permission updated', { permissionId, status: data.status });
    }
    
    return updated;
  } catch (error) {
    logger.logError(error, { operation: 'updatePermission', permissionId });
    throw error;
  }
}

/**
 * Updates a permission's status by consent token
 * Also sets the responded_at timestamp automatically
 * 
 * @param {string} consentToken - The consent token
 * @param {string} status - New status ('approved', 'denied')
 * @returns {boolean} True if updated, false if token not found
 * 
 * @example
 * import { updatePermissionByToken } from './utils/database.js';
 * 
 * // Handle consent approval
 * const updated = updatePermissionByToken('abc123-token', 'approved');
 */
function updatePermissionByToken(consentToken, status) {
  const db = getDatabase();
  const timestamp = getCurrentTimestamp();
  
  logger.debug('Updating permission by token', { status });
  
  try {
    const stmt = db.prepare(`
      UPDATE permissions
      SET status = ?,
          responded_at = ?
      WHERE consent_token = ?
    `);
    
    const result = executeWithRetry(
      () => stmt.run(status, timestamp, consentToken),
      'updatePermissionByToken'
    );
    
    const updated = result.changes > 0;
    
    if (updated) {
      logger.info('Permission updated by token', { status });
    }
    
    return updated;
  } catch (error) {
    logger.logError(error, { operation: 'updatePermissionByToken' });
    throw error;
  }
}

// ============================================================================
// Transaction Support
// ============================================================================

/**
 * Executes a function within a database transaction
 * Automatically commits on success or rolls back on error
 * 
 * @param {Function} fn - Function to execute within the transaction
 * @returns {*} Result of the function
 * @throws {Error} If the transaction fails (automatically rolled back)
 * 
 * @example
 * import { runTransaction, savePipelineRun, saveReviews } from './utils/database.js';
 * 
 * // Atomic operation: create pipeline run and save reviews together
 * const result = runTransaction(() => {
 *   const runId = savePipelineRun({ companyName: 'Acme Corp' });
 *   const reviewIds = saveReviews(runId, reviews);
 *   return { runId, reviewIds };
 * });
 */
function runTransaction(fn) {
  const db = getDatabase();
  
  logger.debug('Starting transaction');
  
  try {
    const transaction = db.transaction(fn);
    const result = executeWithRetry(() => transaction(), 'runTransaction');
    
    logger.debug('Transaction committed successfully');
    return result;
  } catch (error) {
    logger.logError(error, { operation: 'runTransaction' });
    throw error;
  }
}

// ============================================================================
// Database Utilities
// ============================================================================

/**
 * Gets database statistics for monitoring
 * 
 * @returns {Object} Object containing table row counts
 * 
 * @example
 * import { getDatabaseStats } from './utils/database.js';
 * 
 * const stats = getDatabaseStats();
 * console.log(`Total pipeline runs: ${stats.pipelineRuns}`);
 * console.log(`Total reviews: ${stats.reviews}`);
 */
function getDatabaseStats() {
  const db = getDatabase();
  
  logger.debug('Getting database statistics');
  
  try {
    const stats = {
      pipelineRuns: db.prepare('SELECT COUNT(*) as count FROM pipeline_runs').get().count,
      reviews: db.prepare('SELECT COUNT(*) as count FROM reviews').get().count,
      scripts: db.prepare('SELECT COUNT(*) as count FROM scripts').get().count,
      videos: db.prepare('SELECT COUNT(*) as count FROM videos').get().count,
      permissions: db.prepare('SELECT COUNT(*) as count FROM permissions').get().count
    };
    
    logger.debug('Database statistics retrieved', stats);
    
    return stats;
  } catch (error) {
    logger.logError(error, { operation: 'getDatabaseStats' });
    throw error;
  }
}

/**
 * Performs database maintenance operations
 * Should be called periodically to optimize database performance
 * 
 * @returns {void}
 */
function optimizeDatabase() {
  const db = getDatabase();
  
  logger.info('Running database optimization');
  
  try {
    // Analyze tables for query optimization
    db.exec('ANALYZE');
    
    // Checkpoint WAL file
    db.pragma('wal_checkpoint(TRUNCATE)');
    
    logger.info('Database optimization completed');
  } catch (error) {
    logger.logError(error, { operation: 'optimizeDatabase' });
    throw error;
  }
}

/**
 * Checks if the database connection is healthy
 * 
 * @returns {boolean} True if database is healthy
 */
function isDatabaseHealthy() {
  try {
    const db = getDatabase();
    const result = db.prepare('SELECT 1 as health').get();
    return result && result.health === 1;
  } catch (error) {
    logger.logError(error, { operation: 'isDatabaseHealthy' });
    return false;
  }
}

// ============================================================================
// Module Exports
// ============================================================================

export {
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
  getScript,
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
  getPermissionsForPipelineRun,
  updatePermission,
  updatePermissionByToken,
  
  // Utilities
  getDatabaseStats,
  optimizeDatabase,
  isDatabaseHealthy
};