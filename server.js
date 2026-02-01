/**
 * Proof - PDD Demo Server
 * Demonstrates PDD-generated modules in action:
 * - config: Environment configuration
 * - logger: Structured logging
 * - database: SQLite persistence
 * - validation: Input validation with Zod
 */

import express from 'express';
import { getConfig } from './src/utils/config.js';
import { createLogger } from './src/utils/logger.js';
import {
  getDatabase,
  savePipelineRun,
  getPipelineRun,
  saveReviews,
  getReviews,
  getDatabaseStats
} from './src/utils/database.js';
import {
  validatePipelineInput,
  validateReview,
  ValidationError
} from './src/utils/validation.js';

// ============================================================================
// Initialize
// ============================================================================

const config = getConfig();
const logger = createLogger('Server');
const app = express();

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  const reqLogger = logger.withCorrelationId(req.headers['x-request-id'] || Date.now().toString());
  req.logger = reqLogger;
  reqLogger.info(`${req.method} ${req.path}`);
  next();
});

// ============================================================================
// Routes - Demonstrating PDD-Generated Modules
// ============================================================================

/**
 * Health check endpoint
 * Demonstrates: logger module
 */
app.get('/health', (req, res) => {
  logger.info('Health check requested');
  res.json({
    status: 'healthy',
    message: 'PDD Demo Server',
    modules: {
      config: '✅ Loaded',
      logger: '✅ Active',
      database: '✅ Connected',
      validation: '✅ Ready'
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * Get configuration (safe subset)
 * Demonstrates: config module
 */
app.get('/api/config', (req, res) => {
  logger.info('Configuration requested');
  res.json({
    nodeEnv: config.NODE_ENV,
    port: config.PORT,
    databasePath: config.DATABASE_PATH,
    apiKeysConfigured: {
      rtrvr: !!config.RTRVR_API_KEY,
      cerebras: !!config.CEREBRAS_API_KEY,
      elevenlabs: !!config.ELEVENLABS_API_KEY,
      grok: !!config.GROK_API_KEY,
      twilio: !!config.TWILIO_ACCOUNT_SID,
      toolhouse: !!config.TOOLHOUSE_API_KEY
    }
  });
});

/**
 * Get database statistics
 * Demonstrates: database module
 */
app.get('/api/database/stats', (req, res) => {
  try {
    const stats = getDatabaseStats();
    logger.info('Database stats retrieved', { stats });
    res.json(stats);
  } catch (error) {
    logger.logError(error, { endpoint: '/api/database/stats' });
    res.status(500).json({ error: 'Failed to retrieve database stats' });
  }
});

/**
 * Create a new pipeline run
 * Demonstrates: validation + database modules
 */
app.post('/api/pipeline/start', (req, res) => {
  try {
    // Validate input using PDD-generated validation module
    const validatedInput = validatePipelineInput(req.body);
    req.logger.info('Pipeline input validated', { input: validatedInput });

    // Save to database using PDD-generated database module
    const runId = savePipelineRun({
      companyName: validatedInput.companyName,
      targetAudience: validatedInput.targetAudience,
      maxReviews: validatedInput.maxReviews,
      platforms: JSON.stringify(validatedInput.platforms || []),
      status: 'pending',
      progress: 0,
      currentStage: 'initialized'
    });

    logger.info('Pipeline run created', { runId, companyName: validatedInput.companyName });

    res.status(201).json({
      success: true,
      runId,
      message: 'Pipeline run created successfully',
      data: {
        companyName: validatedInput.companyName,
        status: 'pending',
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      logger.warn('Validation failed', {
        schema: error.schemaName,
        summary: error.getSummary()
      });
      res.status(400).json({
        error: 'Validation failed',
        details: error.getSummary(),
        fields: error.details
      });
    } else {
      logger.logError(error, { endpoint: '/api/pipeline/start' });
      res.status(500).json({ error: 'Failed to create pipeline run' });
    }
  }
});

/**
 * Get pipeline run status
 * Demonstrates: database + logger modules
 */
app.get('/api/pipeline/:runId', (req, res) => {
  try {
    const runId = parseInt(req.params.runId, 10);

    if (isNaN(runId)) {
      return res.status(400).json({ error: 'Invalid runId' });
    }

    const run = getPipelineRun(runId);

    if (!run) {
      logger.warn('Pipeline run not found', { runId });
      return res.status(404).json({ error: 'Pipeline run not found' });
    }

    logger.info('Pipeline run retrieved', { runId, status: run.status });

    res.json({
      success: true,
      data: run
    });
  } catch (error) {
    logger.logError(error, { endpoint: '/api/pipeline/:runId' });
    res.status(500).json({ error: 'Failed to retrieve pipeline run' });
  }
});

/**
 * Add reviews to a pipeline run
 * Demonstrates: validation + database modules
 */
app.post('/api/pipeline/:runId/reviews', (req, res) => {
  try {
    const runId = parseInt(req.params.runId, 10);
    const { reviews } = req.body;

    if (isNaN(runId)) {
      return res.status(400).json({ error: 'Invalid runId' });
    }

    if (!Array.isArray(reviews)) {
      return res.status(400).json({ error: 'Reviews must be an array' });
    }

    // Validate each review
    const validatedReviews = reviews.map(review => {
      try {
        return validateReview(review);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new Error(`Review validation failed: ${error.getSummary()}`);
        }
        throw error;
      }
    });

    // Save reviews to database
    const reviewIds = saveReviews(runId, validatedReviews.map(review => ({
      pipelineRunId: runId,
      platform: review.platform,
      author: review.author,
      rating: review.rating,
      text: review.text,
      date: review.date,
      metadata: JSON.stringify(review.metadata || {})
    })));

    logger.info('Reviews saved', { runId, count: reviewIds.length });

    res.status(201).json({
      success: true,
      message: `${reviewIds.length} reviews saved`,
      reviewIds
    });
  } catch (error) {
    if (error.message.includes('validation failed')) {
      res.status(400).json({ error: error.message });
    } else {
      logger.logError(error, { endpoint: '/api/pipeline/:runId/reviews' });
      res.status(500).json({ error: 'Failed to save reviews' });
    }
  }
});

/**
 * Get reviews for a pipeline run
 * Demonstrates: database module
 */
app.get('/api/pipeline/:runId/reviews', (req, res) => {
  try {
    const runId = parseInt(req.params.runId, 10);

    if (isNaN(runId)) {
      return res.status(400).json({ error: 'Invalid runId' });
    }

    const reviews = getReviews(runId);

    logger.info('Reviews retrieved', { runId, count: reviews.length });

    res.json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    logger.logError(error, { endpoint: '/api/pipeline/:runId/reviews' });
    res.status(500).json({ error: 'Failed to retrieve reviews' });
  }
});

/**
 * List all pipeline runs
 * Demonstrates: database module
 */
app.get('/api/pipeline', (req, res) => {
  try {
    const db = getDatabase();
    const runs = db.prepare('SELECT * FROM pipeline_runs ORDER BY created_at DESC LIMIT 50').all();

    logger.info('Pipeline runs listed', { count: runs.length });

    res.json({
      success: true,
      count: runs.length,
      data: runs
    });
  } catch (error) {
    logger.logError(error, { endpoint: '/api/pipeline' });
    res.status(500).json({ error: 'Failed to list pipeline runs' });
  }
});

// ============================================================================
// Error Handling
// ============================================================================

app.use((err, req, res, next) => {
  logger.logError(err, { path: req.path, method: req.method });
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// ============================================================================
// Start Server
// ============================================================================

const PORT = config.PORT;

app.listen(PORT, () => {
  logger.info('🚀 Proof Demo Server started', {
    port: PORT,
    env: config.NODE_ENV,
    pddModules: ['config', 'logger', 'database', 'validation']
  });

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║  🎯 Proof - PDD Hackathon Demo Server                     ║');
  console.log('║                                                            ║');
  console.log('║  Server running at: http://localhost:' + PORT + '                  ║');
  console.log('║                                                            ║');
  console.log('║  PDD-Generated Modules Active:                            ║');
  console.log('║    ✅ config.js    (429 lines)                            ║');
  console.log('║    ✅ logger.js    (414 lines)                            ║');
  console.log('║    ✅ database.js  (1748 lines)                           ║');
  console.log('║    ✅ validation.js (738 lines)                           ║');
  console.log('║                                                            ║');
  console.log('║  Try these endpoints:                                     ║');
  console.log('║    GET  /health                                           ║');
  console.log('║    GET  /api/config                                       ║');
  console.log('║    GET  /api/database/stats                               ║');
  console.log('║    POST /api/pipeline/start                               ║');
  console.log('║    GET  /api/pipeline                                     ║');
  console.log('║    GET  /api/pipeline/:runId                              ║');
  console.log('║    POST /api/pipeline/:runId/reviews                      ║');
  console.log('║    GET  /api/pipeline/:runId/reviews                      ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
});
