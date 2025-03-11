// Standalone API endpoint for health check
module.exports = (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: 'vercel',
    version: '1.0.0',
    message: 'Vercel deployment is working!'
  });
};