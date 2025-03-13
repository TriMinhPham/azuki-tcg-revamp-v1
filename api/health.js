// Simple API endpoint for health check that will work on Vercel
module.exports = (req, res) => {
  // Basic health check response
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL ? 'vercel' : (process.env.NODE_ENV || 'development'),
    version: '1.0.0',
    message: 'Vercel deployment is working!',
    apis: {
      healthCheck: '/api/health',
      testEndpoint: '/api/test'
    }
  });
};