const express = require('express');
const path = require('path');
const fs = require('fs');

const { validateToken, unwrap } = require('./lib/vault');

const app = express();
app.disable('x-powered-by');

// listen_port from config.json, overridable via PORT env var.
let listenPort = 3000;
try {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  if (config.listen_port) listenPort = config.listen_port;
} catch (e) {
  // fall back to default / env
}
const port = process.env.PORT || listenPort;

// Cap request bodies — the only expected input is a small token.
app.use(express.json({ limit: '8kb' }));

// Security headers (mirrors vercel.json for local/self-hosted use).
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/unwrap', async (req, res) => {
  const token = req.body && req.body.token;
  const check = validateToken(token);
  if (!check.ok) {
    res.status(400).json({ success: false, error: check.error });
    return;
  }

  const result = await unwrap(token);
  res.status(result.success ? 200 : 400).json(result);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
