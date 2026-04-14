// API Route: /api/contact
// Handles contact form submissions

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

  try {
    const { name, email, phone, message, source } = req.body;
    
    // Log the contact submission (in production, send email or save to database)
    console.log('Contact form submission:', {
      name,
      email,
      phone,
      message,
      source,
      timestamp: new Date().toISOString()
    });
    
    res.status(200).json({
      success: true,
      message: 'Message received successfully'
    });
  } catch (error) {
    console.error('Error handling contact:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message'
    });
  }
};
