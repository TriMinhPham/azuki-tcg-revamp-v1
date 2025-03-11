// Special server export file for Vercel
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

// Create router for API endpoints
const router = express.Router();

// Add CORS headers to all responses
router.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON requests
router.use(express.json());

// Simple API routes for Vercel
router.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL ? 'vercel' : 'development',
    version: '1.0.0'
  });
});

router.get('/api/test', (req, res) => {
  res.json({
    message: 'API is working on Vercel',
    timestamp: new Date().toISOString()
  });
});

// Serve static files from the dist directory
if (!process.env.VERCEL) {
  // Only when running as a standalone server, not as serverless function
  const app = express();
  app.use(router);
  app.use(express.static(path.join(__dirname, 'dist')));
  
  // Handle SPA routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
  
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export the router for use in serverless functions
module.exports = router;