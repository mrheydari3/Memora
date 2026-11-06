import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AppText,
  Button,
  RevealItem,
  Screen,
  SettingsNote,
  SettingsPlate,
  SettingsRow,
  SettingsSection,
  TopAppBar,
} from '../components';
import { useDeckStore } from '../store/useDeckStore';
import { useReviewStore } from '../store/useReviewStore';
import { useGameStore } from '../store/useGameStore';
import { useSettingsStore } from '../store/useSettingsStore';
import * as repository from '../data/repository';
import { buildDevLibrary } from '../data/devFixture';
import { sampleCards, sampleDecks } from '../data/seed';
import { v2 } from '../theme/v2';

type Action = 'load' | 'restore' | 'wipe';

const count = (value: number) => value.toLocaleString('en-US');

/**
 * Developer data — seed, reset and wipe the on-device library.
 *
 * Test data has to live in the same AsyncStorage keys the app reads, or it
 * disappears on reload and never reaches the other screens; that is why this is
 * a screen instead of a fixture file. Each action writes the repository and then
 * reloads the stores, so the counts below and every other screen update without
 * a refresh.
 *
 * The wipe is a destructive action, so it arms on the first tap and only writes
 * on the second; moving to another action disarms it.
 */
export default function DevDataScreen() {
  const router = useRouter();

  const decks = useDeckStore((s) => s.decks);
  const cardsByDeck = useDeckStore((s) => s.cardsByDeck);
  const reviewLog = useReviewStore((s) => s.reviewLog);
  const [busy, setBusy] = useState<Action | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [wipeArmed, setWipeArmed] = useState(false);

  const totals = useMemo(() => {
    const cards = Object.values(cardsByDeck).reduce((sum, list) => sum + list.length, 0);
    return { cards, decks: decks.length, reviews: reviewLog.length };
  }, [cardsByDeck, decks, reviewLog]);

  /** Every store reads its own slice, so all four reload after a write. */
  const reloadStores = async () => {
    await Promise.all([
      useDeckStore.getState().load(),
      useReviewStore.getState().load(),
      useGameStore.getState().load(),
      useSettingsStore.getState().load(),
    ]);
  };

  const run = async (action: Action, success: string, work: () => Promise<void>) => {
    if (busy) return;
    setBusy(action);
    setMessage(null);
    try {
      await work();
      await reloadStores();
      setMessage(success);
    } catch (error) {
      console.error('Developer data action failed:', error);
      setMessage('That did not work. Check the console for the exact error.');
    } finally {
      setBusy(null);
    }
  };

  const loadTestLibrary = () => {
    setWipeArmed(false);
    void run('load', 'Test library loaded. It stays until you reset or wipe it.', async () => {
      const fixture = buildDevLibrary(Date.now());
      await repository.saveDecks(fixture.decks);
      await repository.saveFolders(fixture.folders);
      await repository.saveAllCards(fixture.cardsByDeck);
      await repository.saveReviewLog(fixture.reviewLog);
      await repository.saveGameRecords(fixture.gameRecords);
      await repository.saveSettings(fixture.settings);
      await repository.markInitialized();
    });
  };

  const restoreShippedDeck = () => {
    setWipeArmed(false);
    void run('restore', 'Back to the shipped deck, with no history.', async () => {
      await repository.saveDecks(sampleDecks);
      await repository.saveFolders([]);
      await repository.saveAllCards(sampleCards);
      await repository.saveReviewLog([]);
      await repository.saveGameRecords({});
      await repository.markInitialized();
    });
  };

  const wipeEverything = () => {
    if (!wipeArmed) {
      setWipeArmed(true);
      setMessage('Wiping is armed. Tap the same button again to erase this device.');
      return;
    }
    setWipeArmed(false);
    void run('wipe', 'Everything on this device is gone.', async () => {
      await repository.clearAll();
      // Mark the library as initialized so the first-run seed does not put the
      // shipped deck straight back into the space the user just emptied.
      await repository.markInitialized();
    });
  };

  return (
    <Screen
      scroll
      gutter
      contentMaxWidth={v2.layout.contentMaxWidth}
      header={<TopAppBar title="Developer data" back />}
    >
      <RevealItem index={0}>
        <SettingsPlate
          tone="accent"
          icon="science"
          eyebrow="Development only"
          title="Test library"
          description="Seed a fixed library, then reset or wipe it whenever you need a clean start."
          status={{
            label: busy ? 'Working…' : 'Device storage',
            tone: busy ? 'warning' : 'success',
          }}
          ledger={[
            { label: 'Decks', value: count(totals.decks) },
            { label: 'Cards', value: count(totals.cards) },
            { label: 'Reviews', value: count(totals.reviews) },
          ]}
        />
      </RevealItem>

      <SettingsSection label="Actions" index={1}>
        <View className="gap-2 p-3">
          <Button
            variant="primary"
            label="Load test library"
            icon="auto-awesome"
            loading={busy === 'load'}
            disabled={busy !== null && busy !== 'load'}
            onPress={loadTestLibrary}
          />
          <Button
            variant="secondary"
            label="Restore shipped deck"
            icon="restore"
            loading={busy === 'restore'}
            disabled={busy !== null && busy !== 'restore'}
            onPress={restoreShippedDeck}
          />
          <Button
            variant="outline"
            destructive
            label={wipeArmed ? 'Tap again to erase everything' : 'Wipe everything'}
            icon="delete-outline"
            loading={busy === 'wipe'}
            disabled={busy !== null && busy !== 'wipe'}
            onPress={wipeEverything}
          />
        </View>
      </SettingsSection>

      {message && (
        <View className="mt-5" accessibilityLiveRegion="polite">
          <AppText variant="bodySm" tone="muted">
            {message}
          </AppText>
        </View>
      )}

      <SettingsSection label="What you get" index={2}>
        <SettingsRow
          icon="folder"
          iconTone="info"
          title="Six decks, 47 cards"
          subtitle="Nested folders, an empty deck, an archived deck, an overflowing name, RTL cards and a fully overdue deck"
        />
        <SettingsRow
          icon="insights"
          iconTone="success"
          title="Thirty-three reviews"
          subtitle="Thirteen consecutive days, so the streak and the charts have data"
          isLast
        />
      </SettingsSection>

      <SettingsNote icon="warning-amber">
        Developer tools. Wiping removes every deck, card, review and setting on this device; it
        cannot be undone.
      </SettingsNote>
    </Screen>
  );
}
