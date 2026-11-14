import { readFileSync } from "node:fs"
import { asList, parseSdl } from "./sdl.mjs"
import { importSigningKey } from "./codec.mjs"

export function readConfigFile(path) {
  return parseSdl(readFileSync(path, "utf8"))
}

export function describeConfig(raw) {
  if (!raw || typeof raw.issuer !== "string" || !raw.issuer) {
    throw new Error("Config needs an issuer URL")
  }
  return {
    issuer: raw.issuer.replace(/\/$/, ""),
    groupsClaim: raw["groups-claim"] || "groups",
  }
}

function envValue(env, name) {
  const value = env[name]
  if (!value) throw new Error(`Set environment variable ${name}`)
  return value
}

export async function loadRuntimeConfig(raw, env) {
  const described = describeConfig(raw)
  const listen = raw.listen || {}
  const signing = raw["signing-key"] || {}
  const pemPath = envValue(env, signing["pem-path-env"] || "ANTORA_PRIVATE_DOCS_SIGNING_KEY_PATH")
  const privateKey = await importSigningKey(readFileSync(pemPath, "utf8"))
  const clients = asList(raw.client).map((client) => ({
    id: client.id,
    secret: envValue(env, client["secret-env"]),
    redirectUris: asList(client.redirect),
  }))
  let github = null
  if (raw.github) {
    github = {
      webBase: raw.github.web || "https://github.com",
      apiBase: raw.github.api || "https://api.github.com",
      owner: raw.github.owner,
      slug: raw.github.slug || "antora-private-docs-site",
      appId: envValue(env, raw.github["app-id-env"]),
      clientId: envValue(env, raw.github["client-id-env"]),
      clientSecret: envValue(env, raw.github["client-secret-env"]),
    }
  }
  const gitlab = asList(raw.gitlab && raw.gitlab.instance).map((instance) => ({
    instanceUrl: instance.url,
    ownerGroup: instance["owner-group"],
    optInUsername: instance["opt-in-username"],
    clientId: envValue(env, instance["client-id-env"]),
    clientSecret: envValue(env, instance["client-secret-env"]),
  }))
  const listenOverride = env.ANTORA_PRIVATE_DOCS_LISTEN
  let host = listen.host || "127.0.0.1"
  let port = Number(listen.port || 4180)
  if (listenOverride) {
    const split = listenOverride.lastIndexOf(":")
    host = listenOverride.slice(0, split)
    port = Number(listenOverride.slice(split + 1))
  }
  return {
    ...described,
    listenHost: host,
    listenPort: port,
    kid: signing.kid || "antora-private-docs-1",
    privateKey,
    clients,
    github,
    gitlab,
  }
}
