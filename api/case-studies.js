// API Route: /api/case-studies
// Returns all case studies from cases.json

const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  // CORS headers
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
    const dataPath = path.join(__dirname, 'data', 'cases.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Handle both array and object with result/data wrapper
    const cases = Array.isArray(data) ? data : (data.data || []);
    
    res.status(200).json({
      success: true,
      data: cases
    });
  } catch (error) {
    console.error('Error reading cases:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load cases'
    });
  }
};
