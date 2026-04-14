// Vercel Serverless API - 分类列表
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(process.cwd(), 'api', 'data', 'categories.json');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return res.json(data);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const { categories } = req.body;
      if (categories) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({ categories }, null, 2));
        return res.json({ success: true });
      }
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
};
