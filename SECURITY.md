# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report privately via [GitHub Security Advisories](https://github.com/andycufari/jasonjs/security/advisories/new) or email **andres@cm64.studio**. Include reproduction steps and the impact you believe it has. You'll get an acknowledgment within a few days, and a fix or mitigation plan before any public disclosure.

## Supported versions

The latest release on `main` is supported. There are no long-term support branches.

## Threat model — what counts

JasonJS's open-source runtime is a **trusted-site** model: everything under `sites/` (components, functions, settings) is code you or your team wrote, executed with full privileges like any other server code. "A site function can read the filesystem" is not a vulnerability — that's the design.

What *does* count, roughly in order of severity:

- Authentication or authorization bypass (session forgery, role escalation, `"auth": true` pages served without a session)
- Cross-site data access — one site reading another site's data, settings, or secrets through `app.db`, storage, or caching
- Injection reachable from *visitor* input: XSS through page rendering or template interpolation, query injection through the `/api/data` REST layer, SSRF through the image/media proxy
- Secrets leaking to the client (`settings/.env.json` values, instance env)
- Path traversal in asset serving or site file resolution

## Hardening notes for self-hosters

- Set a strong `NEXTAUTH_SECRET`; without it sessions are forgeable.
- Site functions run with server privileges — only deploy site code you trust, and treat third-party site folders like third-party npm packages.
- Put the instance behind a reverse proxy and forward `X-Forwarded-Host` correctly; host headers select which site is served.
- `settings/.env.json` files hold per-site secrets — keep them out of public forks of your site folders.
