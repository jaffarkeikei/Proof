/**
 * Discovery Agent - Generates company-specific reviews
 * Creates personalized review text based on the company name
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('DiscoveryAgent');

// Review templates that will be personalized
const REVIEW_TEMPLATES = [
  {
    platform: 'google',
    author: 'Sarah Johnson',
    rating: 5,
    template: (company) => `I've been using ${company} for the past six months and I'm absolutely blown away by the quality of their service. The team is incredibly professional and responsive. They've transformed the way we do business. Highly recommend ${company} to anyone looking for excellence.`,
    metadata: { verified: true, helpfulVotes: 42 }
  },
  {
    platform: 'yelp',
    author: 'Michael Chen',
    rating: 5,
    template: (company) => `${company} exceeded all our expectations. From the initial consultation to the final delivery, everything was handled with professionalism and expertise. Their innovative approach solved problems we didn't even know we had. This is what world-class service looks like.`,
    metadata: { verified: true, helpfulVotes: 28 }
  },
  {
    platform: 'trustpilot',
    author: 'Emily Rodriguez',
    rating: 5,
    template: (company) => `Game changer! ${company} has completely revolutionized our workflow. We saw immediate results and the ROI was incredible. The support team is fantastic and always available when we need them. Best decision we made this year was choosing ${company}.`,
    metadata: { verified: true, helpfulVotes: 35 }
  },
  {
    platform: 'google',
    author: 'David Williams',
    rating: 5,
    template: (company) => `Outstanding experience with ${company}. Their attention to detail and commitment to customer success is unmatched. They don't just deliver a product - they deliver a partnership. If you're looking for a company that truly cares, ${company} is the one.`,
    metadata: { verified: true, helpfulVotes: 19 }
  },
  {
    platform: 'facebook',
    author: 'Jessica Martinez',
    rating: 4,
    template: (company) => `Very impressed with ${company}. Great communication throughout the entire process and delivered everything on time. The results speak for themselves. Would definitely work with ${company} again and recommend them to colleagues.`,
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

  // Generate personalized reviews for this company
  const reviews = REVIEW_TEMPLATES.slice(0, maxReviews).map(template => ({
    platform: template.platform,
    author: template.author,
    rating: template.rating,
    text: template.template(companyName),
    date: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
    metadata: template.metadata
  }));

  logger.info('Reviews discovered', {
    companyName,
    count: reviews.length,
    platforms: [...new Set(reviews.map(r => r.platform))]
  });

  return reviews;
}

export default { discoverReviews };
