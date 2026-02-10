/**
 * Algo Accelerator API Server
 *
 * Provides backend services for:
 * - VSAC (Value Set Authority Center) API integration
 * - LLM API proxying (Anthropic, OpenAI, Google)
 * - Future: User auth, measure storage, audit logging
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { vsacRouter } from './routes/vsac.js';
import { llmRouter } from './routes/llm.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5174',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API info
app.get('/api', (req, res) => {
  res.json({
    name: 'Algo Accelerator API',
    version: '1.0.0',
    endpoints: {
      vsac: {
        search: 'GET /api/vsac/search?query=:query',
        valueSet: 'GET /api/vsac/valueset/:oid',
        expand: 'GET /api/vsac/expand/:oid',
      },
      llm: {
        extract: 'POST /api/llm/extract',
        chat: 'POST /api/llm/chat',
      },
    },
  });
});

// Routes
app.use('/api/vsac', vsacRouter);
app.use('/api/llm', llmRouter);

// Error handling
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`Algo Accelerator API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API info: http://localhost:${PORT}/api`);
});

export default app;
