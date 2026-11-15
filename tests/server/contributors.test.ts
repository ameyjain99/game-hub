import { expect, test, vi } from 'vitest';
import { contributorsSource } from '../../server/contributors';

const row = (login: string, contributions: number, type = 'User') => ({
  login,
  contributions,
  type,
  avatar_url: `https://avatars.example/${login}?v=4`,
  html_url: `https://github.com/${login}`,
});
const person = (login: string, contributions: number) => ({
  login,
  contributions,
  avatar: `https://avatars.example/${login}?v=4`,
  url: `https://github.com/${login}`,
});

/** A stand-in for fetch that answers every call with `body`. */
const answering = (body: unknown, ok = true) => vi.fn(async (..._args: unknown[]) => ({ ok, status: ok ? 200 : 403, json: async () => body }) as Response);

test("lists the repository's people from GitHub, leaving out bots", async () => {
  const get = answering([row('ben', 12), row('dependabot[bot]', 9, 'Bot'), row('ana', 3)]);
  expect(await contributorsSource(get)()).toEqual([person('ben', 12), person('ana', 3)]);
  expect(get).toHaveBeenCalledWith('https://api.github.com/repos/ameyjain99/game-hub/contributors?per_page=100', expect.anything());
});

test('asks GitHub at most once an hour, however many visitors ask', async () => {
  let now = 0;
  const get = answering([row('ana', 3)]);
  const load = contributorsSource(get, () => now);
  await Promise.all([load(), load()]);
  await load();
  expect(get).toHaveBeenCalledTimes(1);
  now = 60 * 60_000 + 1;
  await load();
  expect(get).toHaveBeenCalledTimes(2);
});

test('when GitHub fails, the last list stays and GitHub is asked again five minutes later', async () => {
  let now = 0;
  const get = answering([row('ana', 3)]);
  const load = contributorsSource(get, () => now);
  await load();
  get.mockImplementation(async () => ({ ok: false, status: 403, json: async () => ({ message: 'rate limit' }) }) as Response);
  now = 60 * 60_000 + 1;
  expect(await load()).toEqual([person('ana', 3)]);
  now += 60_000;
  await load();
  expect(get).toHaveBeenCalledTimes(2);
  now += 5 * 60_000;
  await load();
  expect(get).toHaveBeenCalledTimes(3);
});

test('with GitHub unreachable from the start, the list is empty', async () => {
  const get = vi.fn(async () => {
    throw new Error('offline');
  });
  expect(await contributorsSource(get)()).toEqual([]);
});
