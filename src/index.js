require('dotenv').config();
const express = require('express');
const { getAvailableTools } = require('./toolhouse');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Simple endpoint to test
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Get available Toolhouse tools
app.get('/api/tools', async (req, res) => {
  try {
    const tools = await getAvailableTools();
    res.json({ tools });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Main endpoint - find reviews for a company
app.post('/api/discover', async (req, res) => {
  const { company } = req.body;

  if (!company) {
    return res.status(400).json({ error: 'Company name required' });
  }

  // TODO: integrate with Rtrvr.ai to scrape reviews
  // For now, just return mock data
  res.json({
    company,
    reviews: [
      {
        text: "This product changed our workflow completely",
        author: "John D.",
        source: "G2",
        rating: 5
      }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
