// Enhanced Vercel serverless function handler for all API routes
const express = require('express');
const serverless = require('serverless-http');

// Import the enhanced router from the export file that contains all API functions
const apiRouter = require('../server-export');

// Create Express app
const app = express();

// Add basic request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Use the API router for all requests
app.use('/', apiRouter);

// Add a fallback route handler for any unmatched routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: "API endpoint not found",
    path: req.originalUrl,
    availableEndpoints: [
      "/api/health", 
      "/api/test",
      "/api/test-goapi"
    ]
  });
});

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: err.message
  });
});

// Export the serverless handler
module.exports = serverless(app, {
  binary: ['image/png', 'image/jpeg', 'image/webp', 'application/octet-stream']
});