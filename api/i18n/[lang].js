// Vercel Serverless API - 翻译数据
const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const { lang } = req.query;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const DATA_FILE = path.join(process.cwd(), 'api', 'data', 'translations.json');

  try {
    if (req.method === 'GET') {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return res.json(data[lang] || data['en'] || {});
    }

    if (req.method === 'PUT') {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      data[lang] = req.body;
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
      return res.json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
};
