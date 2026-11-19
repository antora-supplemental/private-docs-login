import { hostOf } from "./codec.mjs"

const API_VERSION = "2022-11-28"

function apiHeaders(token) {
  return {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": API_VERSION,
    "user-agent": "private-docs-login",
  }
}

export function organizationsFromInstallations(body, appId) {
  const wanted = Number(appId)
  return (body.installations || [])
    .filter((row) => Number(row.app_id) === wanted && row.account && row.account.type === "Organization")
    .map((row) => row.account.login)
}

export async function listInstalledOrganizations({ fetchImpl, apiBase, accessToken, appId }) {
  const root = apiBase.replace(/\/$/, "")
  const headers = apiHeaders(accessToken)
  const logins = []
  let url = `${root}/user/installations?per_page=100`
  for (let page = 0; page < 20 && url; page += 1) {
    const res = await fetchImpl(url, { headers })
    if (!res.ok) throw new Error(`GitHub installations responded ${res.status}`)
    const body = await res.json()
    logins.push(...organizationsFromInstallations(body, appId))
    url = nextLink(res.headers.get("link"))
  }
  return logins
}

function nextLink(header) {
  if (!header) return ""
  for (const part of header.split(",")) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/)
    if (match) return match[1]
  }
  return ""
}

export function createGithubForge(options) {
  const web = options.webBase.replace(/\/$/, "")
  const api = options.apiBase.replace(/\/$/, "")
  return {
    id: "github",
    label: "GitHub",
    host: hostOf(web),
    installUrl: `${web}/apps/${options.slug}/installations/new`,
    async authorizationUrl({ redirectUri, state }) {
      const url = new URL(`${web}/login/oauth/authorize`)
      url.searchParams.set("client_id", options.clientId)
      url.searchParams.set("redirect_uri", redirectUri)
      url.searchParams.set("state", state)
      url.searchParams.set("allow_signup", "false")
      return url.toString()
    },
    async complete({ code, redirectUri }) {
      const tokenRes = await options.fetchImpl(`${web}/login/oauth/access_token`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
          "user-agent": "private-docs-login",
        },
        body: new URLSearchParams({
          client_id: options.clientId,
          client_secret: options.clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      })
      if (!tokenRes.ok) throw new Error(`GitHub token responded ${tokenRes.status}`)
      const token = await tokenRes.json()
      if (!token.access_token) throw new Error("GitHub token response had no access token")
      const userRes = await options.fetchImpl(`${api}/user`, { headers: apiHeaders(token.access_token) })
      if (!userRes.ok) throw new Error(`GitHub user responded ${userRes.status}`)
      const user = await userRes.json()
      const groups = await listInstalledOrganizations({
        fetchImpl: options.fetchImpl,
        apiBase: api,
        accessToken: token.access_token,
        appId: options.appId,
      })
      return {
        subject: String(user.id),
        username: user.login || "",
        groups,
      }
    },
  }
}

export function githubManifest({ issuer, setupOrigin }) {
  const root = issuer.replace(/\/$/, "")
  const setup = setupOrigin.replace(/\/$/, "")
  return {
    name: "Private Docs Login",
    description: "A login provider for private documentation sites that use OpenID Connect. GitHub and GitLab org members sign in through their org's installation.",
    url: root,
    redirect_url: `${setup}/setup/github/callback`,
    callback_urls: [`${root}/github/callback`],
    setup_url: `${root}/github/setup`,
    public: true,
    default_permissions: { members: "read" },
  }
}
