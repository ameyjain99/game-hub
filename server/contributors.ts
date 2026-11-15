import { REPO, type Contributor } from '../src/shared/project';

const HOUR = 60 * 60_000;
const RETRY = 5 * 60_000;

interface GitHubContributor {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
  type: string;
}

/**
 * The repository's contributors for the home page. GitHub is asked at most once
 * an hour (its API allows 60 unsigned calls an hour), so every visitor shares one
 * answer. If GitHub fails, the last list stays and it is asked again in 5 minutes.
 */
export function contributorsSource(get: typeof fetch = fetch, now: () => number = Date.now): () => Promise<Contributor[]> {
  let list: Contributor[] = [];
  let next = 0; // when GitHub may be asked again
  let pending: Promise<Contributor[]> | null = null;

  const ask = async (): Promise<Contributor[]> => {
    try {
      const res = await get(`https://api.github.com/repos/${REPO}/contributors?per_page=100`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'GameHub' },
      });
      if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
      const rows = (await res.json()) as GitHubContributor[];
      list = rows
        .filter((r) => r.type === 'User')
        .map((r) => ({ login: r.login, avatar: r.avatar_url, url: r.html_url, contributions: r.contributions }));
      next = now() + HOUR;
    } catch {
      next = now() + RETRY;
    }
    pending = null;
    return list;
  };

  return () => (now() < next ? Promise.resolve(list) : (pending ??= ask()));
}
