import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText, RevealItem, Screen } from '../components';
import {
  ActionButton,
  PageHeader,
  SettingsChapter,
  SettingsFootnote,
  SettingsHero,
  SettingsLine,
} from '../components/v3';
import { useDeckStore } from '../store/useDeckStore';
import { useReviewStore } from '../store/useReviewStore';
import { useGameStore } from '../store/useGameStore';
import { useSettingsStore } from '../store/useSettingsStore';
import * as repository from '../data/repository';
import { buildDevLibrary } from '../data/devFixture';
import { sampleCards, sampleDecks } from '../data/seed';
import { goBackOr } from '../services/navigation';
import { colors } from '../theme/tokens';
import { v3 } from '../theme/v3';

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
      contentMaxWidth={v3.layout.contentMaxWidth}
      header={
        <PageHeader
          title="Developer data"
          back
          onBack={() => goBackOr(router, '/settings')}
        />
      }
    >
      <View style={{ paddingBottom: 24 }}>
        <View style={{ gap: 28 }}>
          <RevealItem index={0}>
            <SettingsHero
              testID="dev-hero"
              eyebrow="Dev only"
              status={{
                label: busy ? 'Working…' : 'Device storage',
                tone: busy ? 'accent' : 'success',
              }}
              title="Test library"
              description="Seed a fixed library, then reset or wipe it whenever you need a clean start."
              ledger={[
                { label: 'Decks', value: count(totals.decks) },
                { label: 'Cards', value: count(totals.cards) },
                { label: 'Reviews', value: count(totals.reviews) },
              ]}
            />
          </RevealItem>

          <RevealItem index={1}>
            <SettingsChapter label="Actions">
              <View style={{ gap: 8, padding: 12 }}>
                <ActionButton
                  label="Load test library"
                  icon="auto-awesome"
                  disabled={busy !== null && busy !== 'load'}
                  onPress={loadTestLibrary}
                />
                <ActionButton
                  label="Restore shipped deck"
                  icon="restore"
                  tone="quiet"
                  disabled={busy !== null && busy !== 'restore'}
                  onPress={restoreShippedDeck}
                />
                <ActionButton
                  label={wipeArmed ? 'Tap again to erase everything' : 'Wipe everything'}
                  icon="delete-outline"
                  tone="danger"
                  disabled={busy !== null && busy !== 'wipe'}
                  onPress={wipeEverything}
                />
              </View>
            </SettingsChapter>
          </RevealItem>

          {message && (
            <View accessibilityLiveRegion="polite">
              <AppText variant="bodySm" tone="muted">
                {message}
              </AppText>
            </View>
          )}

          <RevealItem index={2}>
            <SettingsChapter label="What you get">
              <SettingsLine
                icon="folder"
                tone={colors.info}
                title="Six decks, 47 cards"
                subtitle="Nesting, empty, archived, long names, RTL and overdue."
              />
              <SettingsLine
                icon="insights"
                tone={colors.success}
                title="Thirty-three reviews"
                subtitle="Thirteen days of history for streaks and charts."
                last
              />
            </SettingsChapter>
          </RevealItem>

          <SettingsFootnote icon="warning-amber">
            Developer tools. Wiping removes every deck, card, review and setting on this device; it
            cannot be undone.
          </SettingsFootnote>
        </View>
      </View>
    </Screen>
  );
}
