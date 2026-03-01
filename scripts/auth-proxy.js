/**
 * Proxy server for Firebase Auth on localhost.
 * Fixes "missing initial state" error when using Google/Microsoft OAuth on localhost
 * by serving the Firebase auth handler from the same origin (localhost).
 *
 * Usage: node scripts/auth-proxy.js
 * Then open http://localhost:8081 and run Expo web on port 8082.
 * Or use: npm run web:dev (starts both)
 */
const http = require('http');
const https = require('https');

const EXPO_PORT = 8082;
const PROXY_PORT = 8081;
const FIREBASE_AUTH_ORIGIN = 'https://gatorguide.firebaseapp.com';

const server = http.createServer((req, res) => {
  if (req.url?.startsWith('/__/auth/') || req.url === '/__/auth') {
    const targetUrl = FIREBASE_AUTH_ORIGIN + req.url;
    const proxyReq = https.get(targetUrl, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (e) => {
      console.error('Proxy error:', e.message);
      res.writeHead(502);
      res.end('Proxy error');
    });
  } else {
    // Forward to Expo dev server
    const options = {
      hostname: 'localhost',
      port: EXPO_PORT,
      path: req.url,
      method: req.method,
      headers: req.headers,
    };
    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (e) => {
      res.writeHead(502);
      res.end(`Expo not running on port ${EXPO_PORT}. Start with: npx expo start --web --port ${EXPO_PORT}`);
    });
    req.pipe(proxyReq);
  }
});

server.listen(PROXY_PORT, () => {
  console.log(`Auth proxy: http://localhost:${PROXY_PORT} -> Expo:${EXPO_PORT}, /__/auth -> Firebase`);
  console.log(`Open http://localhost:${PROXY_PORT} in browser. Set EXPO_PUBLIC_AUTH_DOMAIN=localhost:${PROXY_PORT} in .env`);
});
