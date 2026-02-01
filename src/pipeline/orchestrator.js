/**
 * Pipeline Orchestrator
 * Coordinates the execution of all agents: Discovery → Analysis → Generation
 */

import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger.js';
import { savePipelineRun, updatePipelineRun, saveReviews, savePermission } from '../utils/database.js';
import { discoverReviews } from '../agents/discovery.js';
import { analyzeReviews } from '../agents/analysis.js';
import crypto from 'crypto';

const logger = createLogger('Orchestrator');

/**
 * Pipeline orchestrator class
 */
export class PipelineOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.currentRun = null;
  }

  /**
   * Execute complete pipeline
   * @param {Object} input - Pipeline input
   * @returns {Promise<Object>} Pipeline result
   */
  async executePipeline(input) {
    const { companyName, maxReviews = 5 } = input;

    try {
      // Create pipeline run
      const runId = savePipelineRun({
        companyName,
        status: 'running',
        progress: 0,
        currentStage: 'discovery'
      });

      this.currentRun = runId;

      logger.info('Pipeline started', { runId, companyName });
      this.emit('progress', { runId, stage: 'discovery', message: 'Discovering reviews...', progress: 10 });

      // Stage 1: Discovery
      const reviews = await discoverReviews(companyName, { maxReviews });

      this.emit('progress', { runId, stage: 'discovery', message: `Found ${reviews.length} reviews`, progress: 30 });

      // Save reviews to database and get their IDs
      const reviewIds = saveReviews(runId, reviews.map(r => ({
        pipelineRunId: runId,
        platform: r.platform,
        author: r.author,
        rating: r.rating,
        text: r.text,
        date: r.date,
        metadata: JSON.stringify(r.metadata || {})
      })));

      logger.info('Reviews saved to database', { runId, reviewIds });

      updatePipelineRun(runId, {
        status: 'running',
        progress: 30,
        currentStage: 'analysis'
      });

      this.emit('progress', { runId, stage: 'analysis', message: 'Analyzing reviews...', progress: 40 });

      // Stage 2: Analysis
      const analyzedReviews = await analyzeReviews(reviews);

      this.emit('progress', { runId, stage: 'analysis', message: 'Analysis complete', progress: 60 });

      // Get top review for video generation
      const topReview = analyzedReviews[0];
      const topReviewId = reviewIds[0]; // ID of the first (top) review from database

      logger.info('Top review selected', {
        runId,
        reviewId: topReviewId,
        author: topReview.author,
        sentiment: topReview.sentimentScore,
        conversionPotential: topReview.conversionPotential
      });

      updatePipelineRun(runId, {
        status: 'running',
        progress: 60,
        currentStage: 'generation'
      });

      // Create approved permission for video generation (demo auto-approval)
      const permissionToken = crypto.randomBytes(16).toString('hex');

      savePermission({
        reviewId: topReviewId,
        status: 'approved',
        consentToken: permissionToken,
        requestedAt: new Date().toISOString(),
        respondedAt: new Date().toISOString()
      });

      logger.info('Permission auto-approved for demo', { reviewId: topReviewId, runId });

      this.emit('progress', { runId, stage: 'generation', message: 'Generating video with ElevenLabs + Grok...', progress: 70 });

      // Stage 3: Video Generation - Use REAL APIs
      let videoResult;
      const generationModule = await import('../agents/generation.js');

      logger.info('Using PDD-generated generation agent with REAL ElevenLabs + Grok APIs');

      // Call the real generation function with the review that has permission
      const reviewWithId = { ...topReview, id: topReviewId };
      const videos = await generationModule.generateVideos(reviewWithId, {
        companyName,
        maxVideos: 1,  // Generate 1 video
        runId
      });

      videoResult = videos[0];

      this.emit('progress', { runId, stage: 'generation', message: 'Video generated successfully', progress: 100 });

      // Update pipeline run as completed
      updatePipelineRun(runId, {
        status: 'completed',
        progress: 100,
        currentStage: 'completed'
      });

      logger.info('Pipeline completed', { runId, videoPath: videoResult.videoPath });

      // Generate video URL pointing to backend server
      const videoUrl = videoResult.videoUrl || `http://localhost:3000/videos/${runId}.mp4`;

      this.emit('complete', {
        runId,
        status: 'completed',
        videoUrl,
        videoPath: videoResult.videoPath,
        review: topReview
      });

      return {
        success: true,
        runId,
        videoUrl,
        videoPath: videoResult.videoPath,
        reviewsCount: reviews.length,
        topReview
      };

    } catch (error) {
      logger.logError(error, { stage: 'pipeline', runId: this.currentRun });

      if (this.currentRun) {
        updatePipelineRun(this.currentRun, {
          status: 'error',
          errorMessage: error.message
        });
      }

      this.emit('error', {
        runId: this.currentRun,
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  /**
   * Fallback demo video generation
   */
  async generateDemoVideo(review, companyName) {
    // Simulate video generation
    await new Promise(resolve => setTimeout(resolve, 3000));

    logger.info('Demo video generated (fallback)', { company: companyName, author: review.author });

    // Return a placeholder - the actual video would be generated by ElevenLabs + Grok
    return {
      videoPath: `storage/videos/${this.currentRun}.mp4`,
      videoUrl: `http://localhost:3000/videos/${this.currentRun}.mp4`,
      duration: 45,
      status: 'completed',
      note: 'This would be a real video with ElevenLabs voice + Grok visuals in production'
    };
  }

  /**
   * Get current pipeline status
   */
  getStatus(runId) {
    // Implementation would query database
    return {
      runId,
      status: 'running',
      progress: 50
    };
  }
}

export default PipelineOrchestrator;
