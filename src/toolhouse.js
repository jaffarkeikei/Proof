const { Toolhouse } = require('@toolhouseai/sdk');

// Initialize Toolhouse
function initToolhouse() {
  if (!process.env.TOOLHOUSE_API_KEY) {
    console.warn('TOOLHOUSE_API_KEY not set');
    return null;
  }

  return new Toolhouse({
    apiKey: process.env.TOOLHOUSE_API_KEY
  });
}

// Get available tools
async function getAvailableTools() {
  const th = initToolhouse();
  if (!th) return [];

  try {
    const tools = await th.tools();
    return tools;
  } catch (error) {
    console.error('Error fetching tools:', error.message);
    return [];
  }
}

module.exports = {
  initToolhouse,
  getAvailableTools
};
