# Agent notes

Antora Private Docs Login is an OpenID Connect issuer. The reference host is a Node HTTP server. Do not add a Cloudflare Worker, `wrangler.toml`, or a Workers-only import as a requirement.

Config is SDL. Secrets are environment names, documented in `docs/environment-variables.adoc`. Do not commit PEM files, client secrets, or tokens.

GitHub opt-in is an installation of the app named Antora Private Docs Login. GitLab opt-in is membership of the configured user. Do not treat every group a person belongs to as opted in.

Registering a relying party does not switch a live Cloudflare Access identity provider.
