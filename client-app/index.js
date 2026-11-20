// index.js — minimal OAuth 2.0 / OIDC client (Authorization Code + PKCE)
const express = require('express');
const session = require('express-session');
const crypto = require('crypto');

const app = express();

// Keycloak endpoints for the oauth-lab realm
const KC = 'http://localhost:8080/realms/oauth-lab/protocol/openid-connect';
const CLIENT_ID = 'lab-client';
const REDIRECT_URI = 'http://localhost:3000/callback';

app.use(session({
  secret: 'lab-session-secret',
  resave: false,
  saveUninitialized: true,
}));

// base64url helper
const b64url = (buf) => buf.toString('base64url');

// Home page
app.get('/', (req, res) => {
  res.send(`<h2>OAuth Lab — Client App</h2>
    <p><a href="/login">Log in with Keycloak</a></p>`);
});

// Step 1: build the authorization request
app.get('/login', (req, res) => {
  // CSRF + replay protections
  const state = crypto.randomBytes(16).toString('hex');
  const nonce = crypto.randomBytes(16).toString('hex');
  // PKCE
  const codeVerifier = b64url(crypto.randomBytes(32));
  const codeChallenge = b64url(crypto.createHash('sha256').update(codeVerifier).digest());

  // stash them for the callback to verify
  req.session.state = state;
  req.session.nonce = nonce;
  req.session.codeVerifier = codeVerifier;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid profile email',
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  res.redirect(`${KC}/auth?${params}`);
});

// Step 2: handle the redirect back, exchange code for tokens
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  // verify state matches what we sent (CSRF protection)
  if (!state || state !== req.session.state) {
    return res.status(400).send('State mismatch — possible CSRF.');
  }

  // exchange the code (+ PKCE verifier) for tokens
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code,
    code_verifier: req.session.codeVerifier,
  });

  const r = await fetch(`${KC}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const tokens = await r.json();

  if (tokens.error) {
    return res.status(400).send(`<pre>Token error:\n${JSON.stringify(tokens, null, 2)}</pre>`);
  }

  // decode the ID token payload (middle part) just to view the claims
  const payload = JSON.parse(
    Buffer.from(tokens.id_token.split('.')[1], 'base64url').toString()
  );

  res.send(`<h2>Logged in ✅</h2>
    <h3>ID token claims</h3>
    <pre>${JSON.stringify(payload, null, 2)}</pre>
    <h3>Raw tokens</h3>
    <pre>${JSON.stringify(tokens, null, 2)}</pre>
    <p><a href="/logout">Log out</a></p>`);
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.listen(3000, () => console.log('Client app running at http://localhost:3000'));