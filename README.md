# OAuth 2.0 / OIDC Security Lab — Attacking and Hardening SSO

A hands-on security lab that breaks, exploits, fixes, and re-tests five classic
OAuth 2.0 / OpenID Connect misconfigurations against a self-hosted Keycloak
identity provider. Each finding is mapped to the governing RFC and a documented
real-world incident.

The client is hand-written (no OAuth library) so every security parameter —
`state`, `nonce`, `code_challenge`, `code_verifier`, scopes — is visible and
attackable rather than hidden behind a framework.

## Architecture

```
User browser ──visits app──> Client app (:3000) ──OAuth flow──> Keycloak (:8080)
                                                                      │
                                                        token leaked  ▼ (when misconfigured)
                                                             Attacker server (:4444)
```

- **Keycloak 26** (Docker) — identity provider
- **Client app** — Node.js / Express, Authorization Code + PKCE, no OAuth library
- **Attacker server** — minimal capture server for stolen codes/tokens

## Findings

| # | Misconfiguration | Impact | Fix | Standard |
|---|------------------|--------|-----|----------|
| 1 | Loose `redirect_uri` (wildcard) | Authorization code stolen to attacker server | Exact URI matching | RFC 9700, 6749 §3.1.2 |
| 2 | PKCE not enforced | Intercepted code → full tokens (account takeover) | Require `S256` | RFC 7636, 9700 |
| 3 | Missing `state` / `nonce` | Login CSRF; ID token replay | Validate `state` and `nonce` | RFC 6749 §10.12, OIDC Core |
| 4 | Over-broad scopes | Login token carried `manage-account` | Least privilege (trim default roles) | RFC 6749 §3.3, 9700 |
| 5 | Implicit flow enabled | Access token leaked in URL (history, Referer, logs) | Code + PKCE only | RFC 9700, OAuth 2.1 |

## Methodology

Each finding followed the same cycle: **break → exploit → fix → re-test → document.**
The baseline was a correctly configured Authorization Code + PKCE flow; each
attack degraded one control at a time to isolate its effect. Evidence
(before/after screenshots) is in [`/evidence`](./evidence).

## Running the lab

```bash
# 1. Start Keycloak
docker run -d --name keycloak -p 8080:8080 \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
  quay.io/keycloak/keycloak:26.0 start-dev

# 2. Start the client app
cd client-app && npm install && node index.js   # http://localhost:3000

# 3. Start the attacker server (separate terminal)
cd attacker && node server.js                    # http://localhost:4444
```

Create a realm `oauth-lab`, a public client `lab-client`
(redirect `http://localhost:3000/callback`), and a test user.

## References

- [RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749) — OAuth 2.0
- [RFC 6819](https://datatracker.ietf.org/doc/html/rfc6819) — OAuth 2.0 Threat Model
- [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636) — PKCE
- [RFC 9700](https://datatracker.ietf.org/doc/rfc9700/) — OAuth 2.0 Security BCP
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)

## Disclaimer

Educational security research. All attacks run entirely on `localhost` against a
throwaway lab user (`alice@lab.test`). Any tokens in the evidence screenshots are
expired lab tokens with no real-world validity.