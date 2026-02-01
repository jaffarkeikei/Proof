/**
 * Discovery Agent - Scrapes reviews from web sources
 * Simplified version using mock data for demo
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('DiscoveryAgent');

// Mock reviews for quick demo
const MOCK_REVIEWS = [
  {
    platform: 'google',
    author: 'Sarah Johnson',
    rating: 5,
    text: 'Absolutely amazing service! The team went above and beyond to ensure our project was a success. Their attention to detail and commitment to quality is unmatched. Would recommend to anyone looking for excellence.',
    date: '2024-01-15T10:30:00Z',
    metadata: { verified: true, helpfulVotes: 42 }
  },
  {
    platform: 'yelp',
    author: 'Michael Chen',
    rating: 5,
    text: 'Best experience I have ever had with a company. Professional, responsive, and delivered exactly what they promised. The results exceeded our expectations in every way.',
    date: '2024-02-20T14:00:00Z',
    metadata: { verified: true, helpfulVotes: 28 }
  },
  {
    platform: 'trustpilot',
    author: 'Emily Rodriguez',
    rating: 5,
    text: 'Game changer for our business! We saw immediate results and the ROI was incredible. The support team is fantastic and always available when we need them.',
    date: '2024-03-10T09:15:00Z',
    metadata: { verified: true, helpfulVotes: 35 }
  },
  {
    platform: 'google',
    author: 'David Williams',
    rating: 5,
    text: 'Outstanding quality and exceptional customer service. They truly care about their clients and it shows in everything they do. Highly recommended!',
    date: '2024-03-25T16:45:00Z',
    metadata: { verified: true, helpfulVotes: 19 }
  },
  {
    platform: 'facebook',
    author: 'Jessica Martinez',
    rating: 4,
    text: 'Very impressed with the results. Great communication throughout the process and delivered on time. Would definitely work with them again.',
    date: '2024-04-05T11:20:00Z',
    metadata: { verified: false, helpfulVotes: 12 }
  }
];

/**
 * Discovers reviews for a company
 * @param {string} companyName - Company name to search for
 * @param {Object} options - Discovery options
 * @returns {Promise<Array>} Array of discovered reviews
 */
export async function discoverReviews(companyName, options = {}) {
  logger.info('Starting review discovery', { companyName, options });

  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  const maxReviews = options.maxReviews || 5;
  const reviews = MOCK_REVIEWS.slice(0, maxReviews);

  logger.info('Reviews discovered', {
    companyName,
    count: reviews.length,
    platforms: [...new Set(reviews.map(r => r.platform))]
  });

  return reviews;
}

export default { discoverReviews };
