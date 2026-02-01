/**
 * Analysis Agent - Analyzes reviews and ranks them
 * Simplified version using rule-based analysis
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('AnalysisAgent');

/**
 * Calculate sentiment score based on rating and text
 */
function calculateSentiment(review) {
  const ratingScore = review.rating / 5;

  // Positive keywords
  const positiveWords = ['amazing', 'excellent', 'outstanding', 'great', 'best', 'fantastic', 'love', 'perfect', 'impressed'];
  const positiveCount = positiveWords.filter(word =>
    review.text.toLowerCase().includes(word)
  ).length;

  const textScore = Math.min(positiveCount * 0.15, 0.3);

  return Math.min(ratingScore + textScore, 1.0);
}

/**
 * Extract key quotes from review text
 */
function extractQuotes(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  return sentences
    .filter(s => s.length > 20 && s.length < 150)
    .slice(0, 2)
    .map(s => s.trim());
}

/**
 * Calculate conversion potential score
 */
function calculateConversionPotential(review, sentiment) {
  let score = sentiment * 10;

  // Boost for verified reviews
  if (review.metadata?.verified) {
    score += 1;
  }

  // Boost for helpful votes
  if (review.metadata?.helpfulVotes > 20) {
    score += 0.5;
  }

  // Boost for 5-star reviews
  if (review.rating === 5) {
    score += 0.5;
  }

  return Math.min(score, 10);
}

/**
 * Analyzes reviews and ranks them by conversion potential
 * @param {Array} reviews - Reviews to analyze
 * @returns {Promise<Array>} Analyzed and ranked reviews
 */
export async function analyzeReviews(reviews) {
  logger.info('Starting review analysis', { count: reviews.length });

  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  const analyzedReviews = reviews.map(review => {
    const sentiment = calculateSentiment(review);
    const quotes = extractQuotes(review.text);
    const conversionPotential = calculateConversionPotential(review, sentiment);

    return {
      ...review,
      sentimentScore: sentiment,
      extractedQuotes: quotes,
      conversionPotential,
      summary: `${review.rating}-star review with high sentiment (${(sentiment * 100).toFixed(0)}%)`,
      analyzedAt: new Date().toISOString()
    };
  });

  // Sort by conversion potential
  analyzedReviews.sort((a, b) => b.conversionPotential - a.conversionPotential);

  logger.info('Review analysis complete', {
    total: analyzedReviews.length,
    avgSentiment: (analyzedReviews.reduce((sum, r) => sum + r.sentimentScore, 0) / analyzedReviews.length).toFixed(2),
    topScore: analyzedReviews[0]?.conversionPotential.toFixed(1)
  });

  return analyzedReviews;
}

export default { analyzeReviews };
