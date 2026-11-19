import { createServer } from "node:http"
import { createPublicKey } from "node:crypto"
import { readFileSync } from "node:fs"
import { createGithubForge } from "./github.mjs"
import { createGitlabForge } from "./gitlab.mjs"
import { createIssuer } from "./issuer.mjs"
import { loadRuntimeConfig, readConfigFile } from "./config.mjs"

export function publicJwkFromPem(pem, kid) {
  const jwk = createPublicKey(pem).export({ format: "jwk" })
  jwk.alg = "RS256"
  jwk.use = "sig"
  jwk.kid = kid
  delete jwk.key_ops
  return jwk
}

export async function listenIssuer({ configPath, env, fetchImpl }) {
  const raw = readConfigFile(configPath)
  const runtime = await loadRuntimeConfig(raw, env)
  const pemName = (raw["signing-key"] && raw["signing-key"]["pem-path-env"]) || "PRIVATE_DOCS_LOGIN_SIGNING_KEY_PATH"
  const pem = readFileSync(env[pemName], "utf8")
  return listenRuntime(runtime, pem, fetchImpl || globalThis.fetch)
}

export async function listenRuntime(runtime, pem, fetchImpl) {
  const github = runtime.github
    ? createGithubForge({ ...runtime.github, fetchImpl })
    : null
  const gitlab = runtime.gitlab.map((instance) => createGitlabForge({ ...instance, fetchImpl }))
  const issuer = createIssuer({
    issuer: runtime.issuer,
    groupsClaim: runtime.groupsClaim,
    clients: runtime.clients,
    privateKey: runtime.privateKey,
    publicJwk: publicJwkFromPem(pem, runtime.kid),
    kid: runtime.kid,
    github,
    gitlab,
  })
  const server = createServer(async (req, res) => {
    try {
      const host = req.headers.host || `${runtime.listenHost}:${runtime.listenPort}`
      const body = await readBody(req)
      const request = new Request(`http://${host}${req.url}`, {
        method: req.method,
        headers: req.headers,
        body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
      })
      const response = await issuer.handle(request)
      const headers = {}
      response.headers.forEach((value, key) => { headers[key] = value })
      res.writeHead(response.status, headers)
      res.end(Buffer.from(await response.arrayBuffer()))
    } catch (error) {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" })
      res.end("The issuer hit an error. The operator can read the process output.")
      console.error(error.message)
    }
  })
  await new Promise((resolve) => server.listen(runtime.listenPort, runtime.listenHost, resolve))
  return { server, runtime }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on("data", (chunk) => chunks.push(chunk))
    req.on("end", () => resolve(Buffer.concat(chunks)))
    req.on("error", reject)
  })
}
