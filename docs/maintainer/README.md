# Maintainer knowledge base

Project-internal knowledge base for triaging issues, reviewing PRs, cutting releases, and writing user-facing replies in the project's voice. Treat this as canonical context for any maintenance work — local or automated.

## Read order

Start with `SKILL.md` for orientation, conventions, and pointers. Then read references lazily as relevant to the current task:

- `references/architecture.md` — apps_script vs Full mode, MITM CA, tunnel-node, AUTH_KEY/TUNNEL_AUTH_KEY/DIAGNOSTIC_MODE, SNI rewriting, Apps Script's hidden constraints
- `references/diagnostic-taxonomy.md` — six candidate causes for the placeholder body, DIAGNOSTIC_MODE disambiguator
- `references/release-workflow.md` — Cargo.toml → tag → GitHub release pipeline
- `references/persian-templates.md` — adaptable Persian reply templates and standardized phrasings
- `assets/changelog-template.md` — starter template for a new `docs/changelog/vX.Y.Z.md`
