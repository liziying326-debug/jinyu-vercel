// Vercel Serverless API - 登录
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;

  // 简单认证（生产环境应该用加密）
  if (username === 'admin' && password === 'admin123') {
    return res.json({ 
      success: true, 
      token: 'jinyu-token-' + Date.now(),
      user: { username: 'admin', role: 'admin' }
    });
  }

  res.status(401).json({ success: false, error: 'Invalid credentials' });
};
