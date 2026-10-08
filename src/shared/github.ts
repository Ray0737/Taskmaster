export function parseGithubRemote(url: string): { owner: string; repo: string } | null {
  const m = /github\.com[:/]+([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i.exec(url.trim())
  return m ? { owner: m[1], repo: m[2] } : null
}

// GitHub's "open a pull request for this branch" page (the branch must be pushed).
export function prUrl(remote: string, branch: string): string | null {
  const r = parseGithubRemote(remote)
  return r ? `https://github.com/${r.owner}/${r.repo}/pull/new/${encodeURIComponent(branch).replace(/%2F/g, '/')}` : null
}
