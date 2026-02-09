# Incident Response Runbook (AI Terminal)

This document is a lightweight runbook for handling vulnerability reports for the AI Terminal desktop app and the docs/website.

## Intake

- Primary channel: security@aiterminal.app (see SECURITY.md)
- Acknowledge receipt within 72 hours.
- Ask for: affected version, reproduction steps, impact, proof-of-concept, and whether the reporter wants credit.

## Triage

- Confirm scope (desktop app, docs site, release pipeline).
- Reproduce on the latest release and current main.
- Classify severity:
  - Critical: secret exfiltration, remote code execution, release pipeline compromise.
  - High: local privilege escalation, significant data exposure, security boundary bypass.
  - Medium: limited data exposure, hard-to-exploit injection, denial-of-service.
  - Low: minor information leak, best-practice issues.

## Containment

- If release pipeline is suspected: rotate CI secrets immediately, revoke certificates/keys if applicable, and pause releases.
- If web headers/deployment issue: patch at the edge (CDN/WAF) first, then in repo.

## Fix

- Patch on a dedicated branch.
- Add a regression test when practical.
- Verify:
  - API keys never persist to localStorage.
  - Audit logs redact secrets.
  - Auto-execution remains disabled in production builds.
  - External URL opening remains https-only and allowlisted.

## Release

- Cut a new version and publish signed + notarized artifacts.
- Publish SHA-256 checksums alongside release assets.

## Disclosure

- Coordinate a disclosure timeline with the reporter.
- For serious issues, publish a short advisory in the release notes and/or repository.
