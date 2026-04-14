// API Route: /api/blog
// Returns all news/blog posts from news.json

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
    const dataPath = path.join(__dirname, 'data', 'news.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const posts = Array.isArray(data) ? data : (data.data || []);
    
    res.status(200).json({
      success: true,
      data: posts
    });
  } catch (error) {
    console.error('Error reading news:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load news'
    });
  }
};
