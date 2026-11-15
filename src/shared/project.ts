/** Where GameHub's code lives, for the home page's links and its contributors list. */
export const REPO = 'ameyjain99/game-hub';
export const REPO_URL = `https://github.com/${REPO}`;

export const REPO_LINKS = {
  contributing: `${REPO_URL}/blob/main/CONTRIBUTING.md`,
  standards: `${REPO_URL}/blob/main/GAME_STANDARDS.md`,
  license: `${REPO_URL}/blob/main/LICENSE`,
  issues: `${REPO_URL}/issues/new`,
  contributors: `${REPO_URL}/graphs/contributors`,
};

/** One person who has contributed to the repository, as `/api/contributors` sends it. */
export interface Contributor {
  login: string;
  avatar: string;
  url: string;
  /** Commits to the repository. */
  contributions: number;
}
