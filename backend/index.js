const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');

const keysRouter = require('./routes/keys');
const modelsRouter = require('./routes/models');
const planRouter = require('./routes/plan');
const executeRouter = require('./routes/execute');
const historyRouter = require('./routes/history');
const analyticsRouter = require('./routes/analytics');

const app = express();

app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const planLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, error: 'Rate limit exceeded for /api/plan' }
});

const executeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: 'Rate limit exceeded for /api/execute' }
});

const keysLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Rate limit exceeded for /api/keys' }
});

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { success: false, error: 'Rate limit exceeded' }
});

app.use('/api/keys', keysLimiter, keysRouter);
app.use('/api/models', readLimiter, modelsRouter); // compatibility alias
app.use('/api/plan', planLimiter, planRouter);
app.use('/api/execute', executeLimiter, executeRouter);
app.use('/api/history', readLimiter, historyRouter);
app.use('/api/analytics', readLimiter, analyticsRouter);

app.use(errorHandler);

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});

module.exports = app;
