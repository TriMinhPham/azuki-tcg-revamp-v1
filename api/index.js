// Minimal API handler for Vercel compatibility
const express = require('express');
const serverless = require('serverless-http');

// Create Express app
const app = express();

// Log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Simple JSON parsing middleware
app.use(express.json());

// Add CORS headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Test route that always works
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API is working on Vercel',
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL ? 'vercel' : 'development',
    path: req.path
  });
});

// Main route handler for all other paths
app.all('*', (req, res) => {
  // Return info about the request but avoid any complex dependencies
  res.json({
    success: true,
    info: "Vercel API endpoint is working",
    path: req.originalUrl || req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
    message: "This is a simplified handler to diagnose Vercel deployment issues"
  });
});

// Export the serverless handler with minimal options
module.exports = serverless(app);