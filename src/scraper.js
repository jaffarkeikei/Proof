const axios = require('axios');

// Mock scraper until Rtrvr.ai is integrated
async function scrapeReviews(company) {
  // TODO: Replace with actual Rtrvr.ai API call
  // For now, return realistic mock data

  const mockReviews = [
    {
      text: `${company} completely transformed how we handle customer feedback. The automation is incredible.`,
      author: 'Sarah M.',
      source: 'G2',
      rating: 5,
      date: '2026-01-15'
    },
    {
      text: `Best investment we made this year. ${company} saved us 20 hours a week.`,
      author: 'Mike Chen',
      source: 'Trustpilot',
      rating: 5,
      date: '2026-01-10'
    },
    {
      text: `Game changer for our marketing team. ${company} generates content 10x faster than before.`,
      author: 'Jessica R.',
      source: 'ProductHunt',
      rating: 5,
      date: '2026-01-05'
    }
  ];

  return mockReviews;
}

module.exports = { scrapeReviews };
