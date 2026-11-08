import { useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ActionButton,
  PageHeader,
  SettingsChapter,
  SettingsFootnote,
  SettingsHero,
  SettingsLine,
} from '../components/v3';
import { AppText, Field, RevealItem, Screen } from '../components';
import {
  DEFAULT_IMPORT_DECK_NAME,
  parseImport,
  type ParsedImport,
} from '../data/importData';
import { importCardsToDeck, replaceLibraryFromBackup } from '../services/importer';
import { goBackOr, pushOnce } from '../services/navigation';
import { colors } from '../theme/tokens';
import { v3 } from '../theme/v3';

type ImportResult =
  | { kind: 'deck'; deckId: string; deckName: string; cards: number }
  | { kind: 'backup'; decks: number; cards: number; reviews: number };

const count = (value: number) => value.toLocaleString('en-US');
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const totalCards = (value: ParsedImport | null): number => {
  if (!value) return 0;
  if (value.kind === 'cards') return value.cards.length;
  return Object.values(value.cardsByDeck).reduce((sum, cards) => sum + cards.length, 0);
};

/**
 * Import — bring outside cards in, without pretending to parse formats the
 * project does not support.
 *
 * CSV/TSV and JSON are intentionally local and synchronous: no upload, no
 * account, no server. A card import lands in a fresh deck. A full Memora backup
 * replaces the library only after a second, explicit tap because replacing is
 * the one destructive action on this screen.
 */
export default function MassImportScreen() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [deckName, setDeckName] = useState(DEFAULT_IMPORT_DECK_NAME);
  const [preview, setPreview] = useState<ParsedImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const importedCards = useMemo(() => totalCards(preview), [preview]);
  const isBackup = preview?.kind === 'backup';
  const hasText = text.trim().length > 0;
  const canPreview = hasText && !busy;

  const clearPreview = () => {
    setPreview(null);
    setArmed(false);
    setError(null);
  };

  const changeText = (value: string) => {
    setText(value);
    clearPreview();
    setMessage(null);
    setResult(null);
  };

  const previewImport = (value = text) => {
    const parsed = parseImport(value);
    setResult(null);
    setMessage(null);
    if (!parsed.ok) {
      setPreview(null);
      setError(parsed.error);
      return;
    }
    setError(null);
    setPreview(parsed.value);
    setArmed(false);
    if (
      parsed.value.kind === 'cards' &&
      (!deckName.trim() || deckName.trim() === DEFAULT_IMPORT_DECK_NAME)
    ) {
      setDeckName(parsed.value.deckName);
    }
  };

  const chooseFile = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || busy) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.tsv,.txt,.json,text/csv,text/tab-separated-values,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_FILE_BYTES) {
        setError('That file is larger than 5 MB. Split it into smaller files.');
        return;
      }
      try {
        const value = await file.text();
        setText(value);
        clearPreview();
        setMessage(null);
        setResult(null);
        const baseName = file.name.replace(/\.[^.]+$/, '').trim();
        if (baseName) setDeckName(baseName);
      } catch {
        setError('That file could not be read.');
      }
    };
    input.click();
  };

  const runImport = async () => {
    if (!preview || busy) return;
    if (preview.kind === 'backup' && !armed) {
      setArmed(true);
      setMessage(
        'This will replace every deck, card, review and setting on this device. Tap again to confirm.'
      );
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (preview.kind === 'backup') {
        await replaceLibraryFromBackup(preview);
        setResult({
          kind: 'backup',
          decks: preview.decks.length,
          cards: totalCards(preview),
          reviews: preview.reviewLog.length,
        });
        setMessage('Backup restored. Your library is now the backup’s library.');
      } else {
        const deckId = await importCardsToDeck(deckName, preview.description, preview.cards);
        setResult({
          kind: 'deck',
          deckId,
          deckName: deckName.trim() || DEFAULT_IMPORT_DECK_NAME,
          cards: preview.cards.length,
        });
        setMessage(
          `${count(preview.cards.length)} card${preview.cards.length === 1 ? '' : 's'} imported into a new deck.`
        );
      }
      setPreview(null);
      setText('');
      setArmed(false);
    } catch (cause) {
      console.error('Import failed:', cause);
      setError('The import did not finish. Your existing library was not changed.');
      setArmed(false);
    } finally {
      setBusy(false);
    }
  };

  const openResult = () => {
    if (!result) return;
    if (result.kind === 'deck') {
      pushOnce(router, { pathname: '/deck/[id]', params: { id: result.deckId } });
      return;
    }
    pushOnce(router, '/home');
  };

  const warnings = preview?.warnings ?? [];

  return (
    <Screen
      scroll
      gutter
      contentMaxWidth={v3.layout.contentMaxWidth}
      header={
        <PageHeader
          title="Import data"
          back
          onBack={() => goBackOr(router, '/settings')}
        />
      }
    >
      <View style={{ paddingBottom: 24 }}>
        <View style={{ gap: 28 }}>
          <RevealItem index={0}>
            <SettingsHero
              testID="import-hero"
              eyebrow="Data room"
              status={{
                label: busy ? 'Working…' : preview ? 'Ready' : 'Waiting',
                tone: busy ? 'accent' : preview ? 'success' : 'muted',
              }}
              title={preview ? 'Ready to land.' : 'Bring your cards over.'}
              description="Paste or choose CSV, TSV or JSON. Cards land in a new deck; a full Memora backup can replace this device’s library."
              ledger={[
                { label: 'Cards', value: count(importedCards) },
                { label: 'Formats', value: 'CSV · TSV · JSON' },
                { label: 'Storage', value: 'This device' },
              ]}
            />
          </RevealItem>

          <RevealItem index={1}>
            <SettingsChapter label="Input">
              <View style={{ gap: 12, padding: 12 }}>
                <Field
                  label="Data"
                  value={text}
                  onChangeText={changeText}
                  multiline
                  minHeight={180}
                  placeholder={'front,back\nHaus,house'}
                  accessibilityLabel="Data to import"
                />
                <ActionButton
                  label="Choose file"
                  icon="folder-open"
                  tone="quiet"
                  onPress={chooseFile}
                  disabled={busy || Platform.OS !== 'web'}
                />
                <ActionButton
                  label="Preview"
                  icon="visibility"
                  onPress={() => previewImport()}
                  disabled={!canPreview}
                />
                <AppText variant="caption" tone="muted">
                  CSV and TSV use the first two columns as front and back. A header row named
                  front, back, example, note or synonyms is recognised.
                </AppText>
              </View>
            </SettingsChapter>
          </RevealItem>

          {!preview && !result && (
            <RevealItem index={2}>
              <SettingsChapter label="Accepted">
                <SettingsLine
                  icon="table-chart"
                  tone={colors.info}
                  title="CSV / TSV"
                  subtitle="Front, back and optional example, note or synonyms."
                />
                <SettingsLine
                  icon="data-object"
                  tone={colors.info}
                  title="JSON cards"
                  subtitle="An array of fronts and backs, or a deck export."
                />
                <SettingsLine
                  icon="restore"
                  tone={colors.success}
                  title="Memora backup"
                  subtitle="A full export: decks, folders, cards and review history."
                  last
                />
              </SettingsChapter>
            </RevealItem>
          )}

          {preview && (
            <RevealItem index={3}>
              <SettingsChapter label="Preview">
                <SettingsLine
                  icon={isBackup ? 'restore' : 'table-rows'}
                  tone={isBackup ? colors.success : colors.info}
                  title={
                    isBackup
                      ? `${count(preview.kind === 'backup' ? preview.decks.length : 0)} decks`
                      : `${count(importedCards)} cards`
                  }
                  subtitle={
                    isBackup
                      ? `${count(importedCards)} cards · ${count(
                          preview.kind === 'backup' ? preview.reviewLog.length : 0
                        )} reviews`
                      : 'They will land in a new deck.'
                  }
                  last
                />
                {!isBackup && (
                  <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.outlineVariant }}>
                    <Field
                      label="Deck name"
                      value={deckName}
                      onChangeText={setDeckName}
                      placeholder={DEFAULT_IMPORT_DECK_NAME}
                    />
                  </View>
                )}
              </SettingsChapter>
            </RevealItem>
          )}

          {warnings.length > 0 && (
            <View accessibilityLiveRegion="polite" style={{ gap: 4 }}>
              {warnings.slice(0, 3).map((warning) => (
                <AppText key={warning} variant="caption" tone="warning">
                  {warning}
                </AppText>
              ))}
              {warnings.length > 3 && (
                <AppText variant="caption" tone="tertiary">
                  +{warnings.length - 3} more warning{warnings.length - 3 === 1 ? '' : 's'}.
                </AppText>
              )}
            </View>
          )}

          {preview && (
            <ActionButton
              label={
                busy
                  ? 'Importing…'
                  : isBackup
                    ? armed
                      ? 'Tap again to replace everything'
                      : 'Replace library'
                    : `Import ${count(importedCards)} cards`
              }
              icon={isBackup ? 'restore' : 'file-download'}
              tone={isBackup ? 'danger' : 'primary'}
              onPress={() => void runImport()}
              disabled={busy}
            />
          )}

          {result && (
            <RevealItem index={4}>
              <SettingsChapter label="Imported">
                <SettingsLine
                  icon="check-circle"
                  tone={colors.success}
                  title={
                    result.kind === 'deck'
                      ? result.deckName
                      : `${count(result.decks)} decks restored`
                  }
                  subtitle={
                    result.kind === 'deck'
                      ? `${count(result.cards)} cards · new deck`
                      : `${count(result.cards)} cards · ${count(result.reviews)} reviews`
                  }
                  last
                />
              </SettingsChapter>
              <View style={{ marginTop: 12 }}>
                <ActionButton
                  label={result.kind === 'deck' ? 'Open deck' : 'Go to Home'}
                  icon="arrow-forward"
                  onPress={openResult}
                />
              </View>
            </RevealItem>
          )}

          {error && (
            <View accessibilityLiveRegion="assertive">
              <AppText variant="bodySm" tone="danger">
                {error}
              </AppText>
            </View>
          )}

          {message && (
            <View accessibilityLiveRegion="polite">
              <AppText variant="bodySm" tone="muted">
                {message}
              </AppText>
            </View>
          )}

          <SettingsFootnote icon="info-outline">
            Importing is local. Nothing is uploaded, and an import into a new deck never changes
            the schedule of an existing deck.
          </SettingsFootnote>
        </View>
      </View>
    </Screen>
  );
}
