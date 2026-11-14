export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[c])
}

function page(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body>
<main>
<h1>${escapeHtml(title)}</h1>
${body}
</main>
</body>
</html>`
}

export function htmlResponse(status, title, body) {
  return new Response(page(title, body), {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  })
}

export function refusalPage({ forge, installUrl, optInUsername, instanceUrl }) {
  if (forge === "gitlab") {
    const name = optInUsername || "the opt-in user"
    return htmlResponse(403, "This group has not opted in", `
<p>Antora Private Docs Login could not sign you in. You are not a member of a GitLab group that has opted in.</p>
<p>A group owner opts in by inviting the GitLab user <strong>${escapeHtml(name)}</strong> to the group. Guest access is enough. A group you belong to that has not invited that user is not included. A personal email address does not grant access.</p>
<p>After the invite, sign in again from the documentation site.${instanceUrl ? ` The GitLab host for this login is ${escapeHtml(instanceUrl)}.` : ""}</p>`)
  }
  const link = installUrl
    ? `<p><a href="${escapeHtml(installUrl)}">Install Antora Private Docs Login</a></p>`
    : ""
  return htmlResponse(403, "This organization has not installed the app", `
<p>Antora Private Docs Login could not sign you in. Your GitHub user is not a member of an organization that has installed this GitHub App.</p>
<p>An owner of the organization installs the app named Antora Private Docs Login. After that install, sign in again. A personal email address does not grant access.</p>
${link}`)
}

export function chooserPage(providers, hidden) {
  const fields = Object.entries(hidden)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`)
    .join("\n")
  const buttons = providers.map((p) => {
    const extra = p.instanceUrl
      ? `<input type="hidden" name="instance" value="${escapeHtml(p.instanceUrl)}" form="${escapeHtml(p.formId)}">`
      : ""
    return `<form id="${escapeHtml(p.formId)}" action="/authorize" method="get">
${fields}
<input type="hidden" name="forge" value="${escapeHtml(p.forge)}">
${extra}
<button type="submit">${escapeHtml(p.label)}</button>
</form>`
  }).join("\n")
  return htmlResponse(200, "Choose where to sign in", `
<p>Antora Private Docs Login signs you in through a forge your organization has opted into.</p>
<p>Choose GitHub or a GitLab host. You will come back here only if that organization or group has not opted in.</p>
${buttons}`)
}

export function badRedirectPage() {
  return htmlResponse(400, "This return address is not registered", `
<p>This sign-in link uses a return address that is not registered for that client.</p>
<p>The relying party operator adds the exact redirect URI to the issuer config, then tries the link again.</p>`)
}

export function forgeErrorPage(forge) {
  return htmlResponse(502, "Sign-in did not finish", `
<p>${escapeHtml(forge)} did not complete sign-in.</p>
<p>Start again from the documentation site. If it keeps failing, the issuer operator checks the app credentials.</p>`)
}
