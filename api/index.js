// Vercel serverless function handler
const express = require('express');
const serverless = require('serverless-http');

// Import the simplified router from the export file
const apiRouter = require('../server-export');

// Create Express app
const app = express();

// Use the API router for all requests
app.use('/', apiRouter);

// Export the serverless handler
module.exports = serverless(app);