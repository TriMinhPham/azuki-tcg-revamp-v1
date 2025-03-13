// Enhanced API endpoint for health check
module.exports = (req, res) => {
  const apiKeysStatus = {
    opensea: !!process.env.OPENSEA_API_KEY,
    gpt: !!process.env.GPT_API_KEY,
    goapi: !!process.env.GOAPI_API_KEY
  };
  
  // Determine overall status
  const allRequiredKeysAvailable = Object.values(apiKeysStatus).every(status => status);
  const status = allRequiredKeysAvailable ? "ok" : "missing_api_keys";
  
  // Add version and runtime info
  res.json({
    status: status,
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL ? 'vercel' : (process.env.NODE_ENV || 'development'),
    version: '1.0.0',
    runtime: {
      node: process.version,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    },
    apiKeys: {
      // Only show existence status, not the actual keys
      allConfigured: allRequiredKeysAvailable,
      ...apiKeysStatus
    },
    message: 'Vercel deployment is working!',
    apis: {
      healthCheck: '/api/health',
      testEndpoint: '/api/test',
      goApiTest: '/api/test-goapi'
    }
  });
};