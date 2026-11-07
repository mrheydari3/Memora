import { test, expect, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { STORAGE_KEYS } from '../../data/storageKeys';

/**
 * Phase 5 — behavioural flows, one family at a time.
 *
 * Every test starts from a fresh browser context, so the seeded library is the
 * fixture and no test inherits another test's writes. A flow is only complete
 * when it reloads and reads the persisted store, not when the screen merely
 * changes. Existing focused specs keep ownership of sheet focus trapping
 * (`group-a`), quiz-result focus (`quiz-result`), and study shortcuts
 * (`keyboard`); this suite covers the missing control families and the reload
 * half of their contracts.
 */

const DECK = 'Schritt Plus Neu A2/B1';
const DECK_ID = 'deck-german-a2b1';

test.use({ reducedMotion: 'reduce' });

const settle = async (page: Page) => {
  await page.waitForSelector('[role="main"]', { timeout: 30_000 });
  await page.waitForTimeout(700);
};

const go = async (page: Page, path: string) => {
  await page.goto(path);
  await settle(page);
};

const readStorage = async <T>(page: Page, key: string, fallback: T): Promise<T> =>
  page.evaluate(
    ({ storageKey, empty }) => {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return empty;
      try {
        return JSON.parse(raw);
      } catch {
        return empty;
      }
    },
    { storageKey: key, empty: fallback }
  );

const reviewCount = (page: Page) =>
  readStorage<unknown[]>(page, STORAGE_KEYS.reviewLog, []).then((entries) => entries.length);

const openFolderSheet = async (page: Page) => {
  await page.getByRole('button', { name: 'Manage folders' }).click();
  const sheet = page.getByRole('dialog').filter({ hasText: 'New folder' });
  await expect(sheet).toBeVisible();
  return sheet;
};

const addFolderToSheet = async (sheet: Locator, name: string) => {
  await sheet.getByLabel('New folder').fill(name);
  await sheet.getByRole('button', { name: 'Create folder' }).click();
  await expect(sheet.getByText(name, { exact: true })).toBeVisible();
};

const createFolder = async (page: Page, name: string) => {
  const sheet = await openFolderSheet(page);
  await addFolderToSheet(sheet, name);
  return sheet;
};

const closeSheet = async (page: Page) => {
  await page.getByRole('button', { name: 'Close sheet' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
};

const openDeckOptions = async (page: Page) => {
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  return sheet;
};

const createDeck = async (page: Page, name: string) => {
  await go(page, '/add-deck');
  await page.getByRole('button', { name: 'Add manually' }).click();
  await expect(page.getByLabel('Name')).toBeVisible();
  await page.getByLabel('Name').fill(name);
  await page.getByRole('button', { name: 'Create deck' }).click();
  await expect(page).toHaveURL(/\/deck\/deck-\d+$/);
  await expect(page.getByRole('heading', { name })).toBeVisible();
  const match = page.url().match(/\/deck\/(deck-\d+)$/);
  if (!match) throw new Error('Deck creation did not return a deck id');
  return match[1];
};

const addCardToDeck = async (page: Page, deckId: string, front: string, back: string) => {
  await go(page, `/deck/${deckId}/add-card`);
  await page.getByLabel('Front — the prompt').fill(front);
  await page.getByLabel('Back — the answer').fill(back);
  await page.getByRole('button', { name: 'Save card' }).click();
  await expect(page).toHaveURL(new RegExp(`/deck/${deckId}$`));
};

const createQuizDeck = async (page: Page) => {
  const deckId = await createDeck(page, 'Quiz Flow Deck');
  for (let index = 1; index <= 4; index += 1) {
    await addCardToDeck(
      page,
      deckId,
      `Quiz question ${index}`,
      `Quiz answer ${index}`
    );
  }
  return deckId;
};

type QuizCard = { front: { text: string }; back: { text: string } };

/** Finds which visible answer is correct for the current quiz card. */
const quizAnswerContext = async (page: Page, deckId: string) => {
  const cards = (await readStorage<Record<string, QuizCard[]>>(
    page,
    STORAGE_KEYS.allCards,
    {}
  ))[deckId] ?? [];
  const mainText = await page.locator('[role="main"]').innerText();
  const card = cards.find((entry) => mainText.includes(entry.front.text));
  if (!card) throw new Error('Could not identify the current quiz card');

  const answers = page.locator('[data-testid^="answer-"]');
  const count = await answers.count();
  for (let index = 0; index < count; index += 1) {
    if ((await answers.nth(index).innerText()).trim() === card.back.text) {
      return { card, correctPosition: index + 1 };
    }
  }
  throw new Error('Could not find the correct quiz answer');
};

const installTtsStub = async (page: Page) => {
  await page.addInitScript(() => {
    type TtsCall = { text: string; lang?: string };
    const calls: TtsCall[] = [];
    (window as typeof window & { __ttsCalls?: TtsCall[] }).__ttsCalls = calls;

    class FakeUtterance {
      text = '';
      lang = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      voice = null;
      onend: (() => void) | null = null;
    }
    (window as unknown as { SpeechSynthesisUtterance: typeof FakeUtterance })
      .SpeechSynthesisUtterance = FakeUtterance;

    const synth = {
      speak: (utterance: FakeUtterance) => {
        calls.push({ text: utterance.text, lang: utterance.lang });
        utterance.onend?.();
      },
      cancel: () => {},
      getVoices: () => [],
      pause: () => {},
      resume: () => {},
      speaking: false,
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth });
  });
};

const ttsCalls = async (page: Page) =>
  page.evaluate(
    () =>
      (window as typeof window & { __ttsCalls?: Array<{ text: string; lang?: string }> })
        .__ttsCalls ?? []
  );

test.describe('Phase 5 — behaviour', () => {
  test('deck: create, reload, then delete with confirmation', async ({ page }) => {
    await createDeck(page, 'Flow Created Deck');

    await expect(page.getByRole('button', { name: 'Create deck' })).toHaveCount(0);
    await page.reload();
    await settle(page);
    await expect(page.getByRole('heading', { name: 'Flow Created Deck' })).toBeVisible();

    await openDeckOptions(page);
    await page.getByRole('button', { name: 'Delete Deck' }).click();
    const confirm = page.getByRole('dialog', { name: 'Delete deck?' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Delete deck' }).click();

    await expect(page).toHaveURL(/\/home$/);
    await page.reload();
    await settle(page);
    await expect(page.getByTestId('deck-row').filter({ hasText: 'Flow Created Deck' })).toHaveCount(0);
  });

  test('deck: rename survives reload', async ({ page }) => {
    await go(page, `/deck/${DECK_ID}`);
    await openDeckOptions(page);
    await page.getByRole('button', { name: 'Rename Deck' }).click();

    const rename = page.getByRole('dialog', { name: 'Rename Deck' });
    await expect(rename).toBeVisible();
    await rename.getByLabel('Deck name').fill('Flow Renamed Deck');
    await rename.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('heading', { name: 'Flow Renamed Deck' })).toBeVisible();
    await page.reload();
    await settle(page);
    await expect(page.getByRole('heading', { name: 'Flow Renamed Deck' })).toBeVisible();
  });

  test('folder: create, reject duplicate, rename, appearance, pin, delete', async ({ page }) => {
    await go(page, '/home');
    const sheet = await createFolder(page, 'Flow Folder');

    await sheet.getByLabel('New folder').fill('Flow Folder');
    await sheet.getByRole('button', { name: 'Create folder' }).click();
    await expect(sheet.getByText('A folder with that name already exists.')).toBeVisible();

    await sheet.getByRole('button', { name: 'Options for folder Flow Folder' }).click();
    const editor = page.getByRole('dialog').filter({ hasText: 'Save folder' });
    await expect(editor).toBeVisible();

    await editor.getByLabel('Name').fill('Flow Folder Edited');
    await editor.getByRole('radio', { name: 'Colour Amber' }).click();
    await editor.getByRole('radio', { name: 'Icon Book' }).click();
    await editor.getByRole('button', { name: 'Pin folder' }).click();
    await editor.getByRole('button', { name: 'Save folder' }).click();
    await closeSheet(page);

    await expect(page.getByTestId('folder-row').filter({ hasText: 'Flow Folder Edited' })).toBeVisible();
    const folders = await readStorage<Array<{ name: string; icon?: string; color?: string; pinnedAt?: number | null }>>(
      page,
      STORAGE_KEYS.folders,
      []
    );
    const saved = folders.find((folder) => folder.name === 'Flow Folder Edited');
    expect(saved).toBeTruthy();
    expect(saved?.icon).toBe('book');
    expect(saved?.color).toBeTruthy();
    expect(saved?.pinnedAt).toBeTruthy();

    await page.reload();
    await settle(page);
    await expect(page.getByTestId('folder-row').filter({ hasText: 'Flow Folder Edited' })).toBeVisible();

    // Delete from the same editor; its decks move up one level.
    await page.getByRole('button', { name: 'Manage folders' }).click();
    const list = page.getByRole('dialog').filter({ hasText: 'New folder' });
    await list.getByRole('button', { name: 'Options for folder Flow Folder Edited' }).click();
    const deleteEditor = page.getByRole('dialog').filter({ hasText: 'Delete folder' });
    await deleteEditor.getByRole('button', { name: 'Delete folder' }).click();
    await expect(page.getByTestId('folder-row').filter({ hasText: 'Flow Folder Edited' })).toHaveCount(0);
  });

  test('folder move: a deck filed away returns when its folder is deleted', async ({ page }) => {
    await go(page, '/home');
    const sheet = await createFolder(page, 'Move Folder');
    await closeSheet(page);

    await go(page, `/deck/${DECK_ID}`);
    await openDeckOptions(page);
    await page.getByRole('button', { name: 'Move to folder' }).click();
    const move = page.getByRole('dialog', { name: 'Move to folder' });
    await expect(move).toBeVisible();
    await move.getByRole('button', { name: 'Move Folder' }).click();

    await go(page, '/home');
    const folderRow = page.getByTestId('folder-row').filter({ hasText: 'Move Folder' });
    await expect(folderRow).toBeVisible();
    await folderRow.click();
    await expect(page.getByTestId('deck-row').filter({ hasText: DECK })).toBeVisible();

    await page.getByRole('button', { name: 'Manage folders' }).click();
    const list = page.getByRole('dialog').filter({ hasText: 'New folder' });
    await list.getByRole('button', { name: 'Options for folder Move Folder' }).click();
    const editor = page.getByRole('dialog').filter({ hasText: 'Delete folder' });
    await editor.getByRole('button', { name: 'Delete folder' }).click();

    await expect(page.getByTestId('folder-row').filter({ hasText: 'Move Folder' })).toHaveCount(0);
    await expect(page.getByTestId('deck-row').filter({ hasText: DECK })).toBeVisible();
    await page.reload();
    await settle(page);
    await expect(page.getByTestId('deck-row').filter({ hasText: DECK })).toBeVisible();
    expect(sheet).toBeTruthy();
  });

  test('folder: nest and re-parent the tree, then reload it', async ({ page }) => {
    await go(page, '/home');
    const sheet = await openFolderSheet(page);
    await addFolderToSheet(sheet, 'Nest Parent');
    await addFolderToSheet(sheet, 'Nest Child');

    await sheet.getByRole('button', { name: 'Options for folder Nest Child' }).click();
    const editor = page.getByRole('dialog').filter({ hasText: 'Save folder' });
    await expect(editor).toBeVisible();
    await editor.getByRole('button', { name: /Location/ }).click();
    const location = page.getByRole('dialog').filter({ hasText: 'Choose the folder' });
    await expect(location).toBeVisible();
    await location.getByRole('button', { name: /Nest Parent/ }).click();
    await expect(editor.getByText('Nest Parent').first()).toBeVisible();
    await editor.getByRole('button', { name: 'Save folder' }).click();
    await closeSheet(page);

    type Folder = { id: string; name: string; parentId: string | null };
    const folders = await readStorage<Folder[]>(page, STORAGE_KEYS.folders, []);
    const parent = folders.find((folder) => folder.name === 'Nest Parent');
    const child = folders.find((folder) => folder.name === 'Nest Child');
    expect(parent).toBeTruthy();
    expect(child?.parentId).toBe(parent?.id);

    await page.reload();
    await settle(page);
    await page.getByTestId('folder-row').filter({ hasText: 'Nest Parent' }).click();
    await expect(page.getByTestId('folder-row').filter({ hasText: 'Nest Child' })).toBeVisible();

    // Re-parent the child back to the root; the parent must not disappear.
    await page.getByRole('button', { name: 'Options for folder Nest Child' }).click();
    const reparent = page.getByRole('dialog').filter({ hasText: 'Save folder' });
    await reparent.getByRole('button', { name: /Location/ }).click();
    const root = page.getByRole('dialog').filter({ hasText: 'Choose the folder' });
    await root.getByRole('button', { name: /Top level/ }).click();
    await reparent.getByRole('button', { name: 'Save folder' }).click();
    await closeSheet(page);
    await page.reload();
    await settle(page);

    const reparented = (await readStorage<Folder[]>(page, STORAGE_KEYS.folders, [])).find(
      (folder) => folder.name === 'Nest Child'
    );
    expect(reparented?.parentId).toBeNull();
    await expect(page.getByTestId('folder-row').filter({ hasText: 'Nest Child' })).toBeVisible();
  });

  test('deck: pin, duplicate, archive and reload', async ({ page }) => {
    await go(page, '/home');
    const deckOptions = page.getByRole('button', { name: `Options for deck ${DECK}`, exact: true });
    await deckOptions.click();
    const pinSheet = page.getByRole('dialog').filter({ hasText: DECK });
    await pinSheet.getByRole('button', { name: /^Pin deck/ }).click();
    await page.getByRole('button', { name: 'Close sheet' }).click();
    await page.reload();
    await settle(page);

    type DeckRecord = { id: string; name: string; pinnedAt?: number | null; archivedAt?: number | null };
    const pinned = (await readStorage<DeckRecord[]>(page, STORAGE_KEYS.decks, [])).find(
      (deck) => deck.id === DECK_ID
    );
    expect(pinned?.pinnedAt).toBeTruthy();

    await go(page, `/deck/${DECK_ID}`);
    await openDeckOptions(page);
    await page.getByRole('button', { name: 'Duplicate Deck' }).click();
    await go(page, '/home');
    const copyName = `${DECK} (Copy)`;
    await expect(page.getByTestId('deck-row').filter({ hasText: copyName })).toBeVisible();
    await page.reload();
    await settle(page);
    const afterDuplicate = await readStorage<DeckRecord[]>(page, STORAGE_KEYS.decks, []);
    expect(afterDuplicate.some((deck) => deck.name === copyName)).toBe(true);

    await go(page, `/deck/${DECK_ID}`);
    await openDeckOptions(page);
    await page.getByRole('button', { name: 'Archive Deck' }).click();
    await expect(page).toHaveURL(/\/library$/);
    await go(page, '/home');
    await expect(page.getByTestId('deck-row').filter({ hasText: copyName })).toBeVisible();
    await page.reload();
    await settle(page);
    const afterArchive = await readStorage<DeckRecord[]>(page, STORAGE_KEYS.decks, []);
    expect(afterArchive.find((deck) => deck.id === DECK_ID)?.archivedAt).toBeTruthy();
    await expect(page.getByTestId('deck-row').filter({ hasText: DECK })).toHaveCount(1);
  });

  test('deck: export downloads the deck and its cards', async ({ page }) => {
    await go(page, `/deck/${DECK_ID}`);
    const downloadPromise = page.waitForEvent('download');
    await openDeckOptions(page);
    await page.getByRole('button', { name: 'Export Deck' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);
    const path = await download.path();
    expect(path).toBeTruthy();
    const payload = JSON.parse(await readFile(path!, 'utf8')) as {
      deck: { id: string };
      cards: unknown[];
    };
    expect(payload.deck.id).toBe(DECK_ID);
    expect(payload.cards.length).toBeGreaterThan(0);
  });

  test('folder: deleting a parent re-parents its child folders', async ({ page }) => {
    await go(page, '/home');
    const sheet = await openFolderSheet(page);
    await addFolderToSheet(sheet, 'Tree Parent');
    await addFolderToSheet(sheet, 'Tree Child');

    await sheet.getByRole('button', { name: 'Options for folder Tree Child' }).click();
    const editor = page.getByRole('dialog').filter({ hasText: 'Save folder' });
    await editor.getByRole('button', { name: /Location/ }).click();
    const location = page.getByRole('dialog').filter({ hasText: 'Choose the folder' });
    await location.getByRole('button', { name: /Tree Parent/ }).click();
    await editor.getByRole('button', { name: 'Save folder' }).click();
    await closeSheet(page);

    await page.reload();
    await settle(page);
    await page.getByRole('button', { name: 'Manage folders' }).click();
    const list = page.getByRole('dialog').filter({ hasText: 'New folder' });
    await list.getByRole('button', { name: 'Options for folder Tree Parent' }).click();
    const deleteEditor = page.getByRole('dialog').filter({ hasText: 'Delete folder' });
    await deleteEditor.getByRole('button', { name: /^Delete folder/ }).click();
    await page.reload();
    await settle(page);

    type Folder = { name: string; parentId?: string | null };
    const folders = await readStorage<Folder[]>(page, STORAGE_KEYS.folders, []);
    expect(folders.find((folder) => folder.name === 'Tree Parent')).toBeUndefined();
    expect(folders.find((folder) => folder.name === 'Tree Child')?.parentId ?? null).toBeNull();
    await expect(page.getByTestId('folder-row').filter({ hasText: 'Tree Child' })).toBeVisible();
  });

  test('folder: move up and down rewrites sibling order', async ({ page }) => {
    await go(page, '/home');
    const sheet = await openFolderSheet(page);
    await addFolderToSheet(sheet, 'Order A');
    await addFolderToSheet(sheet, 'Order B');
    await addFolderToSheet(sheet, 'Order C');

    await sheet.getByRole('button', { name: 'Options for folder Order B' }).click();
    const editor = page.getByRole('dialog').filter({ hasText: 'Save folder' });
    await editor.getByRole('button', { name: 'Move down', exact: true }).click();
    await closeSheet(page);

    type Folder = { name: string; parentId?: string | null };
    const rootOrder = async () =>
      (await readStorage<Folder[]>(page, STORAGE_KEYS.folders, []))
        .filter((folder) => !folder.parentId)
        .map((folder) => folder.name);
    expect(await rootOrder()).toEqual(['Order A', 'Order C', 'Order B']);

    await page.reload();
    await settle(page);
    const reopened = await openFolderSheet(page);
    await reopened.getByRole('button', { name: 'Options for folder Order B' }).click();
    const editorAgain = page.getByRole('dialog').filter({ hasText: 'Save folder' });
    await editorAgain.getByRole('button', { name: 'Move up', exact: true }).click();
    await closeSheet(page);
    await page.reload();
    await settle(page);
    expect(await rootOrder()).toEqual(['Order A', 'Order B', 'Order C']);
  });

  test('deck: move up and down rewrites sibling order', async ({ page }) => {
    await go(page, '/home');
    await createDeck(page, 'Order Deck A');
    await createDeck(page, 'Order Deck B');
    await go(page, '/home');

    const deckNames = async () =>
      (await readStorage<Array<{ name: string }>>(page, STORAGE_KEYS.decks, [])).map(
        (deck) => deck.name
      );
    const openOptions = async (name: string) => {
      await page.getByRole('button', { name: `Options for deck ${name}`, exact: true }).click();
      const dialog = page.getByRole('dialog').filter({ hasText: name });
      await expect(dialog).toBeVisible();
      return dialog;
    };

    let options = await openOptions('Order Deck B');
    await options.getByRole('button', { name: 'Move up' }).click();
    await page.getByRole('button', { name: 'Close sheet' }).click();
    let names = await deckNames();
    expect(names.indexOf('Order Deck B')).toBeLessThan(names.indexOf('Order Deck A'));

    await page.reload();
    await settle(page);
    options = await openOptions('Order Deck B');
    await options.getByRole('button', { name: 'Move down' }).click();
    await page.getByRole('button', { name: 'Close sheet' }).click();
    await page.reload();
    await settle(page);
    names = await deckNames();
    expect(names.indexOf('Order Deck A')).toBeLessThan(names.indexOf('Order Deck B'));
  });

  test('deck: reset progress clears the schedule and review history', async ({ page }) => {
    await go(page, `/study/${DECK_ID}`);
    await page.keyboard.press('Space');
    await expect(page.getByText('Press 1–4 to rate')).toBeVisible();
    await page.keyboard.press('1');
    await page.waitForTimeout(400);

    const reviewsForDeck = async () =>
      (
        await readStorage<Array<{ deckId: string }>>(page, STORAGE_KEYS.reviewLog, [])
      ).filter((entry) => entry.deckId === DECK_ID).length;
    expect(await reviewsForDeck()).toBeGreaterThan(0);

    await go(page, `/deck/${DECK_ID}`);
    await openDeckOptions(page);
    await page.getByRole('button', { name: 'Reset Progress' }).click();
    const confirm = page.getByRole('dialog', { name: 'Reset progress?' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Reset progress' }).click();
    await page.waitForTimeout(500);

    expect(await reviewsForDeck()).toBe(0);
    const cards = (await readStorage<Record<string, Array<{ fsrs: { state: string } }>>>(
      page,
      STORAGE_KEYS.allCards,
      {}
    ))[DECK_ID] ?? [];
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((card) => card.fsrs.state === 'New')).toBe(true);

    await page.reload();
    await settle(page);
    expect(await reviewsForDeck()).toBe(0);
  });

  test('card: add, colour, edit, reload, delete', async ({ page }) => {
    await go(page, `/deck/${DECK_ID}/add-card`);
    const save = page.getByRole('button', { name: 'Save card' });
    await expect(save).toBeDisabled();

    await page.getByLabel('Front — the prompt').fill('Flow front');
    await page.getByLabel('Back — the answer').fill('Flow back');
    await page.getByRole('radio', { name: 'Card colour Amber' }).click();
    await save.click();

    await expect(page).toHaveURL(new RegExp(`/deck/${DECK_ID}$`));
    const row = page.getByTestId('deck-card-row').filter({ hasText: 'Flow front' });
    await expect(row).toBeVisible();
    await page.reload();
    await settle(page);
    await expect(row).toBeVisible();

    const card = (await readStorage<Record<string, Array<{ front: { text: string }; color?: string }>>>(
      page,
      STORAGE_KEYS.allCards,
      {}
    ))[DECK_ID]?.find((entry) => entry.front.text === 'Flow front');
    expect(card?.color).toBeTruthy();

    await page.getByRole('button', { name: 'More options for Flow front' }).click();
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page).toHaveURL(new RegExp(`/deck/${DECK_ID}/add-card\\?.*editCardId=`));
    await page.getByLabel('Back — the answer').fill('Flow back edited');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page).toHaveURL(new RegExp(`/deck/${DECK_ID}$`));
    await expect(page.getByTestId('deck-card-row').filter({ hasText: 'Flow back edited' })).toBeVisible();

    await page.getByRole('button', { name: 'More options for Flow front' }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    const confirm = page.getByRole('dialog', { name: 'Delete card?' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Delete card' }).click();
    await expect(page.getByTestId('deck-card-row').filter({ hasText: 'Flow front' })).toHaveCount(0);
    await page.reload();
    await settle(page);
    await expect(page.getByTestId('deck-card-row').filter({ hasText: 'Flow front' })).toHaveCount(0);
  });

  test('study: four ratings write reviews that survive reload', async ({ page }) => {
    await go(page, `/study/${DECK_ID}`);
    const before = await reviewCount(page);
    const showAnswer = page.getByRole('button', { name: 'Show answer' });

    for (let index = 0; index < 4; index += 1) {
      const studyNow = page.getByRole('button', { name: 'Study now' });
      if (await studyNow.isVisible().catch(() => false)) await studyNow.click();
      await page.keyboard.press('Space');
      await expect(page.getByText('Press 1–4 to rate')).toBeVisible();
      await page.keyboard.press(String(index + 1));
      // The last rating may complete the session; only intermediate ratings
      // must be followed by another Show answer control.
      if (index < 3) await expect(showAnswer).toBeVisible();
    }

    const after = await reviewCount(page);
    expect(after).toBe(before + 4);
    await page.reload();
    await settle(page);
    expect(await reviewCount(page)).toBe(after);
  });

  test('study: requeue keeps the denominator and reaches completion', async ({ page }) => {
    const deckId = await createDeck(page, 'Study Flow Deck');
    await addCardToDeck(page, deckId, 'Study front one', 'Study back one');
    await addCardToDeck(page, deckId, 'Study front two', 'Study back two');

    await go(page, `/study/${deckId}`);
    await expect(page.getByText('1 / 2')).toBeVisible();

    // Again re-enters the learning queue; the opening total must not grow.
    await page.keyboard.press('Space');
    await expect(page.getByText('Press 1–4 to rate')).toBeVisible();
    await page.keyboard.press('1');
    await expect(page.getByText('2 / 2')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Show answer' })).toBeVisible();
    await page.keyboard.press('Space');
    await page.keyboard.press('4');
    await page.waitForTimeout(500);

    const studyNow = page.getByRole('button', { name: 'Study now' });
    if (await studyNow.isVisible().catch(() => false)) {
      await studyNow.click();
      await expect(page.getByRole('button', { name: 'Show answer' })).toBeVisible();
      await page.keyboard.press('Space');
      await page.keyboard.press('4');
    } else if (await page.getByRole('button', { name: 'Show answer' }).isVisible().catch(() => false)) {
      await page.keyboard.press('Space');
      await page.keyboard.press('4');
    }

    await expect(page.getByText('All done')).toBeVisible();
    const completedReviews = await readStorage<Array<{ deckId: string }>>(
      page,
      STORAGE_KEYS.reviewLog,
      []
    ).then((entries) => entries.filter((entry) => entry.deckId === deckId).length);
    expect(completedReviews).toBeGreaterThanOrEqual(2);

    await page.reload();
    await settle(page);
    const afterReload = await readStorage<Array<{ deckId: string }>>(
      page,
      STORAGE_KEYS.reviewLog,
      []
    ).then((entries) => entries.filter((entry) => entry.deckId === deckId).length);
    expect(afterReload).toBe(completedReviews);
  });

  test('study: an empty deck explains that there is nothing to study', async ({ page }) => {
    const deckId = await createDeck(page, 'Study Empty Deck');
    await go(page, `/study/${deckId}`);

    await expect(page.getByText('No cards yet')).toBeVisible();
    await expect(
      page.getByText('This deck has no cards. Add one from the deck screen to start studying.')
    ).toBeVisible();
    await page.getByRole('button', { name: 'Add cards' }).click();
    await expect(page).toHaveURL(new RegExp(`/deck/${deckId}/add-card$`));

    await go(page, `/study/${deckId}`);
    await page.reload();
    await settle(page);
    await expect(page.getByText('No cards yet')).toBeVisible();
  });

  test('study: TTS reads the front and answer in their configured languages', async ({ page }) => {
    await installTtsStub(page);
    await go(page, `/study/${DECK_ID}`);
    const cards = (await readStorage<Record<string, QuizCard[]>>(
      page,
      STORAGE_KEYS.allCards,
      {}
    ))[DECK_ID] ?? [];
    const fronts = new Set(cards.map((card) => card.front.text));
    const backs = new Set(cards.map((card) => card.back.text));

    await expect.poll(async () => (await ttsCalls(page)).length).toBeGreaterThan(0);
    const first = await ttsCalls(page);
    expect(first.some((call) => fronts.has(call.text))).toBe(true);
    expect(first.some((call) => call.lang === 'de-DE')).toBe(true);

    const beforeReveal = first.length;
    await page.keyboard.press('Space');
    await expect.poll(async () => (await ttsCalls(page)).length).toBeGreaterThan(beforeReveal);
    const after = await ttsCalls(page);
    expect(after.some((call) => backs.has(call.text))).toBe(true);
    expect(after.some((call) => call.lang === 'fa-IR')).toBe(true);
  });

  test('quiz: a wrong answer reveals the correct one and records the miss', async ({ page }) => {
    const deckId = await createQuizDeck(page);
    await go(page, `/quiz/${deckId}`);
    await expect(page.getByText('Press 1–4 to answer')).toBeVisible();

    const { card, correctPosition } = await quizAnswerContext(page, deckId);
    const wrongPosition = correctPosition === 1 ? 2 : 1;
    await page.getByTestId(`answer-${wrongPosition}`).click();
    await expect(page.locator('[role="status"]')).toContainText(
      `Wrong. The answer was ${card.back.text}`
    );
    await expect
      .poll(async () => {
        const log = await readStorage<Array<{ deckId: string; rating: number }>>(
          page,
          STORAGE_KEYS.reviewLog,
          []
        );
        return log.some((entry) => entry.deckId === deckId && entry.rating === 1);
      })
      .toBe(true);
  });

  test('quiz: correct answers build a combo', async ({ page }) => {
    const deckId = await createQuizDeck(page);
    await go(page, `/quiz/${deckId}`);
    await expect(page.getByText('Press 1–4 to answer')).toBeVisible();

    for (let round = 0; round < 2; round += 1) {
      const { correctPosition } = await quizAnswerContext(page, deckId);
      await page.getByTestId(`answer-${correctPosition}`).click();
      await expect(page.locator('[role="status"]')).toContainText(
        round === 0 ? 'Correct. Score 100' : 'combo 2'
      );
      if (round === 0) await page.waitForTimeout(650);
    }
  });

  test('quiz: the clock warns under ten seconds', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-06T12:00:00Z') });
    await page.goto(`/quiz/${DECK_ID}`);
    await page.waitForSelector('[role="main"]', { timeout: 30_000 });
    await page.clock.runFor(1_500);
    await expect(page.getByText('Press 1–4 to answer')).toBeVisible();
    await page.clock.runFor(51_000);
    await expect(page.getByText('Hurry — under 10s')).toBeVisible();
  });

  test('quiz: clearing the deck pays the bonus and Play again restarts', async ({ page }) => {
    const deckId = await createQuizDeck(page);
    await page.clock.install({ time: new Date('2026-11-06T12:00:00Z') });
    await page.goto(`/quiz/${deckId}`);
    await page.waitForSelector('[role="main"]', { timeout: 30_000 });
    await page.clock.runFor(1_500);
    await expect(page.getByText('Press 1–4 to answer')).toBeVisible();

    for (let index = 0; index < 4; index += 1) {
      await page.getByTestId('answer-1').click();
      await page.clock.runFor(1_000);
    }

    const result = page.getByRole('dialog', { name: /^Round result:/ });
    await expect(result).toBeVisible();
    await expect(result).toContainText('Deck cleared');
    await expect(result).toContainText('Includes the +250 deck-cleared bonus');
    await result.getByRole('button', { name: 'Play again' }).click();
    await expect(page.getByText('Press 1–4 to answer')).toBeVisible();
  });

  test('quiz: an unplayable deck explains what it needs', async ({ page }) => {
    const deckId = await createDeck(page, 'Quiz Empty Deck');
    await go(page, `/quiz/${deckId}`);
    await expect(page.getByText('Not enough cards')).toBeVisible();
    await expect(page.getByText(/at least four cards/)).toBeVisible();
  });

  test('quiz: answer, finish the clock round, and persist the game record', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-06T12:00:00Z') });
    await page.goto(`/quiz/${DECK_ID}`);
    await page.waitForSelector('[role="main"]', { timeout: 30_000 });
    await page.clock.runFor(1_500);

    await expect(page.getByText('Press 1–4 to answer')).toBeVisible();
    await page.getByTestId('answer-1').click();
    await expect(page.locator('[role="status"]')).toContainText(/Correct|Wrong/);

    await page.clock.runFor(61_000);
    const result = page.getByRole('dialog', { name: /^Round result:/ });
    await expect(result).toBeVisible();
    await result.getByRole('button', { name: 'Back to Game' }).click();
    await expect(page).toHaveURL(/\/library$/);

    const records = await readStorage<Record<string, unknown>>(page, STORAGE_KEYS.gameRecords, {});
    expect(Object.keys(records).length).toBeGreaterThan(0);
  });

  test('discover: import a starter deck and find it on Home after reload', async ({ page }) => {
    await go(page, '/discover');
    await expect(page.getByRole('heading', { name: 'Starter decks' })).toBeVisible();
    await page.getByRole('button', { name: /French Basics/ }).first().click();
    await expect(page).toHaveURL(/\/discover\/discover-french-basics$/);

    await page.getByRole('button', { name: 'Add deck' }).click();
    await expect(page).toHaveURL(/\/deck\/deck-\d+$/);
    await expect(page.getByRole('heading', { name: 'French Basics' })).toBeVisible();

    await go(page, '/home');
    await expect(page.getByTestId('deck-row').filter({ hasText: 'French Basics' })).toBeVisible();
    await page.reload();
    await settle(page);
    await expect(page.getByTestId('deck-row').filter({ hasText: 'French Basics' })).toBeVisible();
  });

  test('settings: sound, algorithm, and speech choices persist', async ({ page }) => {
    await go(page, '/settings');
    const sound = page.getByRole('switch', { name: 'Quiz sound effects' });
    const soundBefore = await sound.getAttribute('aria-checked');
    await sound.click();
    const soundAfter = soundBefore === 'true' ? 'false' : 'true';
    await expect(sound).toHaveAttribute('aria-checked', soundAfter);
    await page.reload();
    await settle(page);
    await expect(page.getByRole('switch', { name: 'Quiz sound effects' })).toHaveAttribute(
      'aria-checked',
      soundAfter
    );

    await go(page, '/settings/algorithm');
    const fuzz = page.getByRole('switch', { name: 'Fuzz intervals' });
    const fuzzBefore = await fuzz.getAttribute('aria-checked');
    await fuzz.click();
    const fuzzAfter = fuzzBefore === 'true' ? 'false' : 'true';
    await page.reload();
    await settle(page);
    await expect(page.getByRole('switch', { name: 'Fuzz intervals' })).toHaveAttribute(
      'aria-checked',
      fuzzAfter
    );

    await go(page, '/settings/tts');
    const tts = page.getByRole('switch', { name: 'Text-to-Speech' });
    const ttsBefore = await tts.getAttribute('aria-checked');
    await tts.click();
    const ttsAfter = ttsBefore === 'true' ? 'false' : 'true';
    await page.reload();
    await settle(page);
    await expect(page.getByRole('switch', { name: 'Text-to-Speech' })).toHaveAttribute(
      'aria-checked',
      ttsAfter
    );

    await page.getByRole('button', { name: /Front language/ }).click();
    const languages = page.getByRole('dialog').filter({ hasText: 'German (de-DE)' });
    await languages.getByRole('button', { name: 'German (de-DE)' }).click();
    await expect(page.getByText('German (de-DE)')).toBeVisible();
    await page.reload();
    await settle(page);
    await expect(page.getByText('German (de-DE)')).toBeVisible();
  });

  test('settings: remaining toggles, back voice, and algorithm preset persist', async ({ page }) => {
    await go(page, '/settings');
    const haptics = page.getByRole('switch', { name: 'Quiz haptics' });
    const hapticsBefore = await haptics.getAttribute('aria-checked');
    await haptics.click();
    const hapticsAfter = hapticsBefore === 'true' ? 'false' : 'true';
    await page.reload();
    await settle(page);
    await expect(page.getByRole('switch', { name: 'Quiz haptics' })).toHaveAttribute(
      'aria-checked',
      hapticsAfter
    );

    await go(page, '/settings/tts');
    for (const name of ['Read Entire Card', 'Automatic Playback']) {
      const toggle = page.getByRole('switch', { name });
      const before = await toggle.getAttribute('aria-checked');
      await toggle.click();
      const after = before === 'true' ? 'false' : 'true';
      await page.reload();
      await settle(page);
      await expect(page.getByRole('switch', { name })).toHaveAttribute('aria-checked', after);
    }

    await page.getByRole('button', { name: /Back language/ }).click();
    const picker = page.getByRole('dialog', { name: 'Back language' });
    await picker.getByRole('button', { name: 'French (fr-FR)' }).click();
    await expect(page.getByText('French (fr-FR)').first()).toBeVisible();
    await page.reload();
    await settle(page);
    await expect(page.getByText('French (fr-FR)').first()).toBeVisible();

    await go(page, '/settings/algorithm');
    await page.getByRole('radio', { name: /Fast Repetition/ }).click();
    await page.reload();
    await settle(page);
    const decks = await readStorage<Array<{ id: string; algorithmPreset: string }>>(
      page,
      STORAGE_KEYS.decks,
      []
    );
    expect(decks.find((deck) => deck.id === DECK_ID)?.algorithmPreset).toBe('fast');
  });

  test('settings: adaptive order, shuffle, offline cache and install prompt work', async ({ page }) => {
    await go(page, '/settings/algorithm');
    const adaptive = page.getByRole('switch', { name: 'Adaptive review order' });
    const adaptiveBefore = await adaptive.getAttribute('aria-checked');
    await adaptive.click();
    const adaptiveAfter = adaptiveBefore === 'true' ? 'false' : 'true';
    const shuffle = page.getByRole('switch', { name: 'Shuffle Cards' });
    const shuffleBefore = await shuffle.getAttribute('aria-checked');
    await shuffle.click();
    const shuffleAfter = shuffleBefore === 'true' ? 'false' : 'true';
    await page.reload();
    await settle(page);
    await expect(page.getByRole('switch', { name: 'Adaptive review order' })).toHaveAttribute(
      'aria-checked',
      adaptiveAfter
    );
    await expect(page.getByRole('switch', { name: 'Shuffle Cards' })).toHaveAttribute(
      'aria-checked',
      shuffleAfter
    );

    await go(page, '/settings/offline');
    const cache = page.getByRole('switch', { name: 'Offline cache' });
    const cacheBefore = await cache.getAttribute('aria-checked');
    await cache.click();
    const cacheAfter = cacheBefore === 'true' ? 'false' : 'true';
    await page.reload();
    await settle(page);
    await expect(page.getByRole('switch', { name: 'Offline cache' })).toHaveAttribute(
      'aria-checked',
      cacheAfter
    );

    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt') as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: string }>;
      };
      event.prompt = () => {
        (window as typeof window & { __installPrompted?: boolean }).__installPrompted = true;
        return Promise.resolve();
      };
      event.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(event);
    });
    await expect(page.getByRole('button', { name: /Install Memora/ })).toBeVisible();
    await page.getByRole('button', { name: /Install Memora/ }).click();
    await expect(page.getByText('Installed').first()).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          (window as typeof window & { __installPrompted?: boolean }).__installPrompted ?? false
      )
    ).toBe(true);
  });

  test('navigation: settings rows open their pages', async ({ page }) => {
    await go(page, '/settings');
    const rows: Array<[RegExp, string]> = [
      [/^Algorithm/, '/settings/algorithm'],
      [/^Text-to-Speech/, '/settings/tts'],
      [/^Profile/, '/profile'],
      [/^Statistics/, '/statistics'],
      [/^Offline & install/, '/settings/offline'],
    ];
    for (const [name, path] of rows) {
      await page.getByRole('button', { name }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await page.getByRole('button', { name: 'Go back' }).click();
      await expect(page).toHaveURL(/\/settings$/);
    }
  });

  test('navigation: tabs and direct-link fallback land on the right route', async ({ page }) => {
    await go(page, '/home');
    await page.getByRole('tab', { name: 'Game' }).click();
    await expect(page).toHaveURL(/\/library$/);
    await page.getByRole('tab', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await page.getByRole('tab', { name: 'Home' }).click();
    await expect(page).toHaveURL(/\/home$/);

    await go(page, '/statistics');
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(page).toHaveURL(/\/settings$/);

    await go(page, '/add-deck');
    await page.getByRole('button', { name: 'Close sheet' }).click();
    await expect(page).toHaveURL(/\/library$/);
  });

  test('navigation: unknown route and browser forward recover', async ({ page }) => {
    await go(page, '/not-a-real-route');
    await expect(page.getByText('This page moved on')).toBeVisible();
    await page.getByRole('button', { name: 'Back to Game' }).click();
    await expect(page).toHaveURL(/\/library$/);

    await go(page, '/home');
    await page.getByTestId('deck-row').filter({ hasText: DECK }).click();
    await expect(page).toHaveURL(new RegExp(`/deck/${DECK_ID}$`));
    await page.goBack();
    await settle(page);
    await expect(page).toHaveURL(/\/home$/);
    await page.goForward();
    await settle(page);
    await expect(page).toHaveURL(new RegExp(`/deck/${DECK_ID}$`));
  });

  test('sheets: scrim click closes the folder sheet and returns focus', async ({ page }) => {
    await go(page, '/home');
    const trigger = page.getByRole('button', { name: 'Manage folders' });
    await trigger.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.mouse.click(8, 140);
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('sheets: Escape closes the folder sheet and returns focus', async ({ page }) => {
    await go(page, '/home');
    const trigger = page.getByRole('button', { name: 'Manage folders' });
    await trigger.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  /**
   * Every sheet opened from a screen (not from inside another sheet) gets the
   * same contract: it is a named dialog, focus starts on its close button and
   * cannot leave the dialog, Escape closes it, and focus returns to the trigger.
   * Sheets opened from a row inside another sheet are covered by the flows that
   * open them; their opener unmounts, so focus restore has no stable target.
   */
  const sheetFlows: Array<{ name: string; path: string; trigger: (page: Page) => Locator }> = [
    {
      name: 'deck sort',
      path: `/deck/${DECK_ID}`,
      trigger: (page) => page.getByRole('button', { name: /^Sort:/ }),
    },
    {
      name: 'card menu',
      path: `/deck/${DECK_ID}`,
      trigger: (page) => page.locator('[aria-label^="More options for "]').first(),
    },
    {
      name: 'deck options on Home',
      path: '/home',
      trigger: (page) => page.locator('[aria-label^="Options for deck "]').first(),
    },
    {
      name: 'front voice picker',
      path: '/settings/tts',
      trigger: (page) => page.getByRole('button', { name: /^Front language/ }),
    },
    {
      name: 'back voice picker',
      path: '/settings/tts',
      trigger: (page) => page.getByRole('button', { name: /^Back language/ }),
    },
    {
      name: 'retention stepper',
      path: '/settings/algorithm',
      trigger: (page) => page.getByRole('button', { name: /^Desired retention/ }),
    },
    {
      name: 'maximum interval',
      path: '/settings/algorithm',
      trigger: (page) => page.getByRole('button', { name: /^Maximum interval/ }),
    },
    {
      name: 'new cards per day',
      path: '/settings/algorithm',
      trigger: (page) => page.getByRole('button', { name: /^New cards per day/ }),
    },
    {
      name: 'maximum cards per day',
      path: '/settings/algorithm',
      trigger: (page) => page.getByRole('button', { name: /^Maximum cards per day/ }),
    },
  ];

  for (const flow of sheetFlows) {
    test(`sheets: the ${flow.name} sheet traps focus, closes on Escape and restores focus`, async ({
      page,
    }) => {
      await go(page, flow.path);
      const trigger = flow.trigger(page);
      await trigger.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(page.getByRole('button', { name: 'Close sheet' })).toBeFocused();

      await page.keyboard.press('Shift+Tab');
      expect(
        await dialog.evaluate((node) => node.contains(document.activeElement))
      ).toBe(true);

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
    });
  }

  test('sheets: the folder editor opens from the Folders sheet and Escape closes it', async ({
    page,
  }) => {
    await go(page, '/home');
    const opener = page.getByRole('button', { name: 'Manage folders' });
    await opener.click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await addFolderToSheet(sheet, 'Sheet Edit Folder');

    await sheet
      .locator('[aria-label^="Options for folder "]')
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Edit folder' })).toBeVisible();
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('sheets: the algorithm deck picker and apply-to-all sheets need a second deck', async ({
    page,
  }) => {
    await createDeck(page, 'Sheet Second Deck');
    await go(page, '/settings/algorithm');

    const picker = page.getByRole('button', { name: /^Current deck/ });
    await picker.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close sheet' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(picker).toBeFocused();

    const applyAll = page.getByRole('button', { name: 'Apply to all decks', exact: true });
    await applyAll.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close sheet' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(applyAll).toBeFocused();
  });
});
