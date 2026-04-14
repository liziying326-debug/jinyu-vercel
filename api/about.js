// API Route: /api/about
// Returns company about data from about.json

const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const dataPath = path.join(__dirname, 'data', 'about.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    res.status(200).json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Error reading about:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load about data'
    });
  }
};
