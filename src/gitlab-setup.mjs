export async function gitlabSetupText({ instance, fetchImpl, issuer }) {
  const url = instance.instanceUrl.replace(/\/$/, "")
  const group = instance.ownerGroup
  const settings = `${url}/groups/${encodeURIComponent(group).replace(/%2F/g, "/")}/-/settings/applications`
  const callback = `${issuer.replace(/\/$/, "")}/gitlab/callback`
  let found
  try {
    const res = await fetchImpl(`${url}/api/v4/groups/${encodeURIComponent(group)}`)
    if (res.status === 404) {
      found = `No GitLab group named ${group} was found on ${url}. Create that group, then open the settings URL.`
    } else if (res.ok) {
      found = `The group ${group} is on ${url}.`
    } else {
      found = `GitLab responded ${res.status} when this command looked up ${group} on ${url}.`
    }
  } catch {
    found = `This command could not reach ${url}. Open the settings URL after the group exists.`
  }
  return [
    "Antora Private Docs Login on GitLab is one group-owned application. GitLab has no GitHub App installation.",
    found,
    `Open ${settings}`,
    "Name: Antora Private Docs Login",
    `Redirect URI: ${callback}`,
    "Confidential: yes",
    "Scope: read_api",
    "Do not enable api, read_repository, write_repository, or email.",
    `Opt-in: a group owner invites the GitLab user ${instance.optInUsername} to the group (Guest is enough).`,
    "A group the person belongs to, which has not invited that user, is left out of the token.",
    "Copy the Application ID and secret into the env names in docs/modules/private-docs-login/pages/environment-variables.adoc.",
    "Do not commit the secret.",
  ].join("\n")
}
