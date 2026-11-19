import { createServer } from "node:http"
import { mkdirSync, writeFileSync } from "node:fs"
import { githubManifest } from "./github.mjs"
import { escapeHtml } from "./html.mjs"

export function manifestForm({ webBase, owner, manifest }) {
  const action = `${webBase.replace(/\/$/, "")}/organizations/${owner}/settings/apps/new`
  const json = JSON.stringify(JSON.stringify(manifest)).replace(/</g, "\\u003c")
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Create Antora Private Docs Login</title></head>
<body>
<main>
<h1>Create the GitHub App</h1>
<p>Antora Private Docs Login is one GitHub App. This page sends GitHub the manifest. You approve it in the next screen. The app is owned by ${escapeHtml(owner)}.</p>
<p>GitHub's install dialog shows this description, and nothing else from this repository: ${escapeHtml(manifest.description || "")}</p>
<p>Leave this window open. GitHub will return here with a code, and the command will write credentials into a gitignored folder.</p>
<form method="post" action="${escapeHtml(action)}">
<input type="hidden" name="manifest" id="manifest">
<button type="submit">Continue to GitHub</button>
</form>
<script>
document.getElementById("manifest").value = ${json}
</script>
</main>
</body>
</html>`
}

export function startManifestServer({ host, port, webBase, owner, issuer, fetchImpl, onCredentials }) {
  const origin = `http://${host}:${port}`
  const manifest = githubManifest({ issuer, setupOrigin: origin })
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", origin)
    if (req.method === "GET" && url.pathname === "/") {
      const html = manifestForm({ webBase, owner, manifest })
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
      res.end(html)
      return
    }
    if (req.method === "GET" && url.pathname === "/setup/github/callback") {
      const code = url.searchParams.get("code")
      if (!code) {
        res.writeHead(400, { "content-type": "text/plain; charset=utf-8" })
        res.end("GitHub did not return a code. Run github-manifest again.")
        return
      }
      try {
        const exchanged = await exchangeManifestCode(fetchImpl, code)
        onCredentials(exchanged)
        res.writeHead(200, { "content-type": "text/plain; charset=utf-8" })
        res.end("GitHub App created. Credentials were written to the gitignored var folder. You can close this window.")
      } catch (error) {
        res.writeHead(502, { "content-type": "text/plain; charset=utf-8" })
        res.end(`GitHub did not exchange the manifest code. ${error.message}`)
      }
      return
    }
    res.writeHead(404)
    res.end()
  })
  return new Promise((resolve) => {
    server.listen(port, host, () => resolve(server))
  })
}

export async function exchangeManifestCode(fetchImpl, code) {
  const res = await fetchImpl(`https://api.github.com/app-manifests/${encodeURIComponent(code)}/conversions`, {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "antora-private-docs",
    },
  })
  if (!res.ok) throw new Error(`GitHub manifest exchange responded ${res.status}`)
  const body = await res.json()
  if (body.name !== "Antora Private Docs Login") {
    throw new Error("GitHub returned an app whose name is not Antora Private Docs Login")
  }
  return body
}

export function writeGithubCredentials(dir, body) {
  mkdirSync(dir, { recursive: true })
  const pemPath = `${dir}/github-app.pem`
  writeFileSync(pemPath, body.pem || "", { mode: 0o600 })
  writeFileSync(`${dir}/github-app.json`, JSON.stringify({
    id: body.id,
    client_id: body.client_id,
    client_secret: body.client_secret,
    html_url: body.html_url,
    slug: body.slug,
    pem_path: pemPath,
  }, null, 2), { mode: 0o600 })
  return { id: body.id, slug: body.slug, pemPath, jsonPath: `${dir}/github-app.json` }
}
