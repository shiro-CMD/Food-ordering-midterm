require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express(); // no body parser here: bodies are streamed to the services

const proxy = (target) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: { '^/api': '' },
    onError: (err, req, res) => res.status(502).json({ message: 'Upstream service unavailable' }),
  });

// Role rules: [method, path regex, allowed roles]
const rules = [
  ['GET',    /^\/api\/menu(\/[^/]+)?$/,          ['ADMIN', 'CUSTOMER']],
  ['POST',   /^\/api\/menu$/,                    ['ADMIN']],
  ['PUT',    /^\/api\/menu\/[^/]+$/,             ['ADMIN']],
  ['DELETE', /^\/api\/menu\/[^/]+$/,             ['ADMIN']],
  ['POST',   /^\/api\/orders$/,                  ['CUSTOMER']],
  ['GET',    /^\/api\/orders\/my$/,              ['CUSTOMER']],
  ['GET',    /^\/api\/orders$/,                  ['ADMIN']],
  ['PUT',    /^\/api\/orders\/[^/]+\/status$/,   ['ADMIN']],
  ['DELETE', /^\/api\/orders\/[^/]+$/,           ['ADMIN']],
];

function secure(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ message: 'Missing or malformed token' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ message: e.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token' });
  }

  const path = req.originalUrl.split('?')[0];
  const rule = rules.find(([m, re]) => m === req.method && re.test(path));
  if (!rule) return res.status(404).json({ message: 'Route not found' });
  if (!rule[2].includes(payload.role))
    return res.status(403).json({ message: `Forbidden: ${payload.role} cannot access this route` });

  // overwrite any client-supplied identity headers
  req.headers['x-user-id'] = String(payload.userId);
  req.headers['x-user-role'] = payload.role;
  next();
}

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'gateway' }));

// public
app.use('/api/register', proxy(process.env.REGISTRATION_URL));
app.use('/api/login', proxy(process.env.LOGIN_URL));
app.use('/api/validate', proxy(process.env.LOGIN_URL));

// protected
app.use(['/api/menu', '/api/orders'], secure);
app.use('/api/menu', proxy(process.env.MENU_URL));
app.use('/api/orders', proxy(process.env.ORDER_URL)); // ORDER_URL points at the Nginx load balancer

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Gateway on ${PORT}`));
