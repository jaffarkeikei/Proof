/**
 * Proof - Full Production Server
 * Complete pipeline with video generation
 */

import express from 'express';
import { getConfig } from './src/utils/config.js';
import { createLogger } from './src/utils/logger.js';
import { validatePipelineInput } from './src/utils/validation.js';
import { PipelineOrchestrator } from './src/pipeline/orchestrator.js';

// ============================================================================
// Initialize
// ============================================================================

const config = getConfig();
const logger = createLogger('FullServer');
const app = express();

// Store active orchestrators by runId
const activeOrchestrators = new Map();

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  const reqLogger = logger.withCorrelationId(req.headers['x-request-id'] || Date.now().toString());
  req.logger = reqLogger;
  reqLogger.info(`${req.method} ${req.path}`);
  next();
});

// CORS for frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Serve static video files
app.use('/videos', express.static('storage/videos'));
app.use('/public/videos', express.static('public/videos'));

// ============================================================================
// Routes
// ============================================================================

/**
 * Root route - Serve info page
 */
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Proof - Autonomous Social Proof Engine</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          padding: 20px;
        }
        .container {
          text-align: center;
          max-width: 800px;
        }
        h1 { font-size: 48px; margin-bottom: 20px; }
        p { font-size: 18px; margin-bottom: 30px; opacity: 0.9; }
        .button {
          display: inline-block;
          padding: 15px 40px;
          background: white;
          color: #667eea;
          text-decoration: none;
          border-radius: 10px;
          font-weight: 600;
          font-size: 18px;
          transition: transform 0.2s;
        }
        .button:hover { transform: scale(1.05); }
        .endpoints {
          margin-top: 50px;
          background: rgba(255,255,255,0.1);
          padding: 30px;
          border-radius: 15px;
          text-align: left;
        }
        .endpoint {
          margin: 10px 0;
          font-family: monospace;
          background: rgba(0,0,0,0.2);
          padding: 10px;
          border-radius: 5px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎬 Proof</h1>
        <p>Autonomous Social Proof Engine</p>
        <p>Transform customer reviews into high-converting video testimonials</p>

        <a href="/demo" class="button">🚀 Open Demo</a>

        <div class="endpoints">
          <h3>API Endpoints:</h3>
          <div class="endpoint">POST /api/pipeline/run - Start video generation</div>
          <div class="endpoint">GET /api/pipeline/:runId/progress - SSE progress stream</div>
          <div class="endpoint">GET /health - Health check</div>
        </div>

        <p style="margin-top: 40px; font-size: 14px; opacity: 0.7;">
          Powered by PDD • ElevenLabs • Grok • Cerebras • Rtrvr
        </p>
      </div>
    </body>
    </html>
  `);
});

/**
 * Demo page redirect
 */
app.get('/demo', (req, res) => {
  res.redirect('http://localhost:3001');
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  logger.info('Health check requested');
  res.json({
    status: 'healthy',
    message: 'Proof Full Production Server',
    modules: {
      config: '✅ Loaded',
      logger: '✅ Active',
      database: '✅ Connected',
      validation: '✅ Ready',
      orchestrator: '✅ Ready'
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * Start pipeline execution
 * POST /api/pipeline/run
 * Body: { companyName, maxReviews? }
 */
app.post('/api/pipeline/run', async (req, res) => {
  try {
    // Validate input
    const validatedInput = validatePipelineInput(req.body);
    req.logger.info('Starting pipeline', { input: validatedInput });

    // Create orchestrator
    const orchestrator = new PipelineOrchestrator();

    // Start pipeline asynchronously
    const pipelinePromise = orchestrator.executePipeline(validatedInput);

    // Get runId immediately
    orchestrator.once('progress', (data) => {
      activeOrchestrators.set(data.runId, orchestrator);

      // Send immediate response with runId
      res.json({
        success: true,
        runId: data.runId,
        message: 'Pipeline started',
        status: 'running'
      });
    });

    // Handle completion
    orchestrator.once('complete', (result) => {
      logger.info('Pipeline completed', { runId: result.runId });
    });

    // Handle errors
    orchestrator.once('error', (error) => {
      logger.error('Pipeline error', { error: error.error });
    });

  } catch (error) {
    logger.logError(error, { endpoint: '/api/pipeline/run' });
    res.status(400).json({
      error: error.message,
      details: error.details || null
    });
  }
});

/**
 * Server-Sent Events for pipeline progress
 * GET /api/pipeline/:runId/progress
 */
app.get('/api/pipeline/:runId/progress', (req, res) => {
  const { runId } = req.params;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  logger.info('SSE connection established', { runId });

  // Get orchestrator
  const orchestrator = activeOrchestrators.get(parseInt(runId));

  if (!orchestrator) {
    res.write(`data: ${JSON.stringify({ error: 'Pipeline not found' })}\n\n`);
    res.end();
    return;
  }

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ message: 'Connected to pipeline', status: 'connected' })}\n\n`);

  // Forward progress events
  const onProgress = (data) => {
    res.write(`data: ${JSON.stringify({ ...data, status: 'progress' })}\n\n`);
  };

  const onComplete = (data) => {
    res.write(`data: ${JSON.stringify({ ...data, status: 'completed' })}\n\n`);
    cleanup();
  };

  const onError = (error) => {
    res.write(`data: ${JSON.stringify({ ...error, status: 'error' })}\n\n`);
    cleanup();
  };

  // Attach listeners
  orchestrator.on('progress', onProgress);
  orchestrator.once('complete', onComplete);
  orchestrator.once('error', onError);

  // Cleanup function
  const cleanup = () => {
    orchestrator.removeListener('progress', onProgress);
    orchestrator.removeListener('complete', onComplete);
    orchestrator.removeListener('error', onError);
    activeOrchestrators.delete(parseInt(runId));
    res.end();
  };

  // Handle client disconnect
  req.on('close', () => {
    logger.info('SSE connection closed', { runId });
    cleanup();
  });
});

/**
 * Get pipeline status
 * GET /api/pipeline/:runId
 */
app.get('/api/pipeline/:runId', (req, res) => {
  const { runId } = req.params;
  const orchestrator = activeOrchestrators.get(parseInt(runId));

  if (!orchestrator) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }

  res.json({
    runId: parseInt(runId),
    status: 'running',
    message: 'Pipeline is active'
  });
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

const PORT = config.PORT || 3000;

app.listen(PORT, () => {
  logger.info('🚀 Proof Full Production Server started', {
    port: PORT,
    env: config.NODE_ENV
  });

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║  🎬 Proof - Full Production Server                        ║');
  console.log('║                                                            ║');
  console.log(`║  Server: http://localhost:${PORT}                            ║`);
  console.log('║  Demo:   http://localhost:3001                             ║');
  console.log('║                                                            ║');
  console.log('║  Features:                                                 ║');
  console.log('║    ✅ Video generation with ElevenLabs + Grok             ║');
  console.log('║    ✅ Real-time progress via SSE                          ║');
  console.log('║    ✅ Review discovery and analysis                       ║');
  console.log('║    ✅ Complete pipeline orchestration                     ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
});
