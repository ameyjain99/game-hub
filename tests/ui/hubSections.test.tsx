// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { HubScreen } from '../../src/app/HubScreen';
import { REPO_URL } from '../../src/shared/project';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ana = { login: 'ana', avatar: 'https://avatars.example/ana?v=4', url: 'https://github.com/ana', contributions: 1 };
const ben = { login: 'ben', avatar: 'https://avatars.example/ben?v=4', url: 'https://github.com/ben', contributions: 12 };

/** Answer `/api/contributors` with `list` (or fail when it's null). */
function stubContributors(list: unknown[] | null) {
  const fetch = vi.fn(async () => (list ? { ok: true, json: async () => list } : Promise.reject(new Error('offline'))));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const hub = () => render(<HubScreen onSelect={vi.fn()} onJoin={vi.fn()} />);
const section = (name: RegExp) => screen.getByRole('region', { name });

test('every link in the header and footer leads to a section on the page', () => {
  stubContributors([]);
  hub();
  const anchors = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('#'));
  const targets = new Set(anchors.map((a) => a.getAttribute('href')!.slice(1)));
  for (const id of ['library', 'how', 'about', 'open-source', 'faq']) expect(targets).toContain(id);
  for (const id of targets) expect(document.getElementById(id), `#${id}`).not.toBeNull();
});

test('About says what GameHub is and what every game is built to', () => {
  stubContributors([]);
  hub();
  const about = section(/made to feel like the real table/i);
  expect(within(about).getByText(/free, open-source/i)).toBeTruthy();
  const points = within(about).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
  expect(points).toEqual(['The real rules', 'Faces at the table', 'Never a seat short', 'No accounts, no installs', 'Hidden stays hidden', 'Free and open source']);
});

test('Open source sends people to the GitHub repository, its guide and its issues, in a new tab', () => {
  stubContributors([]);
  hub();
  const open = section(/built in the open/i);
  const link = (name: RegExp) => within(open).getByRole('link', { name });
  expect(link(/view on github/i).getAttribute('href')).toBe(REPO_URL);
  expect(link(/contributing guide/i).getAttribute('href')).toBe(`${REPO_URL}/blob/main/CONTRIBUTING.md`);
  expect(link(/report a bug/i).getAttribute('href')).toBe(`${REPO_URL}/issues/new`);
  for (const a of within(open).getAllByRole('link')) {
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noreferrer');
  }
});

test('contributors come from the server, each linking to their GitHub profile', async () => {
  const fetch = stubContributors([ben, ana]);
  hub();
  const open = section(/built in the open/i);
  const benLink = await within(open).findByRole('link', { name: /ben, 12 commits/i });
  expect(benLink.getAttribute('href')).toBe('https://github.com/ben');
  expect(within(open).getByRole('link', { name: /ana, 1 commit$/i }).getAttribute('href')).toBe('https://github.com/ana');
  expect(within(open).getByText('2 people')).toBeTruthy();
  expect(fetch).toHaveBeenCalledWith('/api/contributors');
});

test("without the server's list, the section still points to GitHub's contributors page", async () => {
  stubContributors(null);
  hub();
  const open = section(/built in the open/i);
  const all = await within(open).findByRole('link', { name: /see everyone on github/i });
  expect(all.getAttribute('href')).toBe(`${REPO_URL}/graphs/contributors`);
});

test('FAQ answers stay folded until their question is opened', () => {
  stubContributors([]);
  hub();
  const faq = section(/questions, answered/i);
  const question = within(faq).getByText('Is GameHub free?');
  const item = question.closest('details')!;
  expect(item.open).toBe(false);
  fireEvent.click(question);
  expect(item.open).toBe(true);
});
