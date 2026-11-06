import { useEffect, useState } from 'react';
import { View, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { MaterialIcons } from '../../../components/Icon';
import { useDeckStore } from '../../../store/useDeckStore';
import { defaultFSRSState } from '../../../data/seed';
import { textDirection } from '../../../data/text';
import {
  AppText,
  Button,
  GlassCard,
  IconButton,
  ListRow,
  Pill,
  PrimaryButton,
  Screen,
  SettingsNote,
  TopAppBar,
} from '../../../components';
import { colors, fills, heights, iconSize, radii } from '../../../theme/tokens';
import { v2 } from '../../../theme/v2';
import type { Flashcard } from '../../../data/types';

type Side = 'front' | 'back';

/**
 * Add cards — one card, both faces.
 *
 * The page is a single pane whose top half is the front and whose bottom half is
 * the back, separated by a fill step rather than a rule, so both sides are
 * visible while you write and neither can be forgotten. Each face names itself
 * and counts its own characters on one line; the swap control sits with the
 * front, since it moves that side's text. Type direction follows the script, so
 * a Persian face is written right-to-left. The optional fields stay folded away
 * and the save decision lives in the fixed footer.
 */
export default function AddCardScreen() {
  const { id, editCardId } = useLocalSearchParams<{ id: string; editCardId?: string }>();
  const router = useRouter();
  const deck = useDeckStore((s) => s.decks.find((d) => d.id === id));
  const deckCardCount = useDeckStore((s) => (id ? s.cardsByDeck[id]?.length ?? 0 : 0));
  const existingCard = useDeckStore((s) =>
    editCardId ? Object.values(s.cardsByDeck).flat().find((c) => c.id === editCardId) : undefined
  );
  const addCard = useDeckStore((s) => s.addCard);
  const updateCard = useDeckStore((s) => s.updateCard);

  const [front, setFront] = useState(existingCard?.front.text ?? '');
  const [back, setBack] = useState(existingCard?.back.text ?? '');
  const [example, setExample] = useState(existingCard?.example ?? '');
  const [synonyms, setSynonyms] = useState(existingCard?.synonyms ?? '');
  const [writing, setWriting] = useState<Side | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);

  // The store loads asynchronously, so on a deep link or reload the card being
  // edited can arrive after the first render. Fill the fields when it does;
  // otherwise the screen would look empty and saving would create a duplicate.
  useEffect(() => {
    if (hydrated || !existingCard) return;
    setFront(existingCard.front.text);
    setBack(existingCard.back.text);
    setExample(existingCard.example ?? '');
    setSynonyms(existingCard.synonyms ?? '');
    setHydrated(true);
  }, [existingCard, hydrated]);

  const missing: Side | null = !front.trim() ? 'front' : !back.trim() ? 'back' : null;
  const canSave = missing === null;
  const detailsCount = [example.trim(), synonyms.trim()].filter(Boolean).length;
  const isEditing = Boolean(editCardId);

  /** Swap the two sides; the caret does not move because both faces are on screen. */
  const swapSides = () => {
    setFront(back);
    setBack(front);
    setReceipt(null);
  };

  // A card opened from a link or a reload has no screen behind it, and a bare
  // router.back() then leaves the composer sitting there with an unhandled
  // GO_BACK error. Land on the deck instead, which is where back would go.
  const leaveComposer = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(`/deck/${id}` as Href);
  };

  const saveCard = async (andContinue: boolean) => {
    if (!canSave) return;

    if (editCardId) {
      // Never fall through to the create path: the card is missing only while
      // the store is still loading, and creating would duplicate it.
      if (!existingCard) return;
      await updateCard(editCardId, {
        front: { text: front.trim(), direction: textDirection(front) },
        back: { text: back.trim(), direction: textDirection(back) },
        example: example.trim() || undefined,
        synonyms: synonyms.trim() || undefined,
      });
      leaveComposer();
      return;
    }

    const card: Flashcard = {
      id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      deckId: id,
      front: { text: front.trim(), direction: textDirection(front) },
      back: { text: back.trim(), direction: textDirection(back) },
      example: example.trim() || undefined,
      synonyms: synonyms.trim() || undefined,
      createdAt: Date.now(),
      fsrs: defaultFSRSState(),
    };

    await addCard(card);

    if (andContinue) {
      setFront('');
      setBack('');
      setExample('');
      setSynonyms('');
      setDetailsOpen(false);
      setWriting(null);
      setReceipt(`Card saved. ${deckCardCount + 1} cards in this deck.`);
    } else {
      leaveComposer();
    }
  };

  /** A face's own name line: the marker, the side, what it holds, its count. */
  const faceLine = (side: Side, hint: string) => {
    const text = side === 'front' ? front : back;
    const filled = Boolean(text.trim());
    const active = writing === side;

    return (
      <View className="flex-row items-center gap-2 px-4 pt-3">
        <View
          style={{
            width: 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: filled ? colors.primary : colors.outline,
          }}
        />
        <AppText
          variant="caption"
          weight="semibold"
          tone={active || filled ? 'accent' : 'muted'}
          className="uppercase"
        >
          {side === 'front' ? 'Front' : 'Back'}
        </AppText>
        <AppText variant="caption" tone="tertiary" numberOfLines={1} className="flex-1">
          {hint}
        </AppText>
        <AppText variant="caption" tone="tertiary" style={{ fontVariant: ['tabular-nums'] }}>
          {text.trim().length}
        </AppText>
        {side === 'front' && (
          <IconButton
            icon="swap-vert"
            size="sm"
            accessibilityLabel="Swap front and back"
            onPress={swapSides}
          />
        )}
      </View>
    );
  };

  /** One face's writing area. Both are always mounted, so both are always ready. */
  const faceField = (side: Side, placeholder: string, lines: number) => {
    const text = side === 'front' ? front : back;
    const direction = textDirection(text);

    return (
      <TextInput
        className="px-4 pb-2 pt-1 text-headline font-inter-medium text-on-surface"
        // The browser's own focus rectangle would sit inside the rounded pane as
        // a stray box; the ring is drawn once around the whole card instead, so
        // focus is still visible while writing in either face.
        style={{
          minHeight: heights.field * lines,
          outlineWidth: 0,
          writingDirection: direction,
          textAlign: direction === 'rtl' ? 'right' : 'left',
        }}
        value={text}
        onChangeText={(next) => {
          (side === 'front' ? setFront : setBack)(next);
          setReceipt(null);
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.outline}
        multiline
        textAlignVertical="top"
        onFocus={() => setWriting(side)}
        onBlur={() => setWriting((current) => (current === side ? null : current))}
        accessibilityLabel={side === 'front' ? 'Front — the prompt' : 'Back — the answer'}
      />
    );
  };

  return (
    <Screen
      scroll
      gutter
      contentMaxWidth={v2.layout.contentMaxWidth}
      header={<TopAppBar title={isEditing ? 'Edit card' : 'Add a card'} back />}
      footer={
        <View className="gap-1 px-5 pb-6">
          <PrimaryButton
            label={isEditing ? 'Save changes' : 'Save card'}
            icon="check"
            onPress={() => saveCard(false)}
            disabled={!canSave}
          />
          {!isEditing && (
            <Button
              variant="text"
              label="Save and add another"
              icon="add"
              onPress={() => saveCard(true)}
              disabled={!canSave}
            />
          )}
        </View>
      }
    >
      {/* Which deck the card lands in, and where it will sit in it. */}
      <View className="mb-4 flex-row items-center">
        <MaterialIcons name="folder" size={iconSize.sm} color={colors.outline} />
        <AppText
          variant="bodySm"
          weight="medium"
          tone="muted"
          className="ml-2 flex-1"
          numberOfLines={1}
        >
          {deck?.name ?? 'Deck'}
        </AppText>
        <Pill label={isEditing ? 'Editing' : `Card ${deckCardCount + 1}`} />
      </View>

      {/* The card itself: front above, back below, split by a fill step. */}
      <GlassCard padding="none">
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderWidth: 2,
            borderColor: colors.primary,
            borderRadius: radii.pane,
            opacity: writing ? 1 : 0,
          }}
        />

        <View>
          {faceLine('front', 'The prompt')}
          {faceField('front', 'A word, a phrase, a question', 2.5)}
        </View>

        <View style={{ backgroundColor: fills.inset }}>
          {faceLine('back', 'The answer')}
          {faceField('back', 'What you want to remember', 3)}
        </View>

        {/* The card's own status: what is still missing, or that it is done. */}
        <View
          className="flex-row items-center gap-1.5 px-4 pb-3 pt-1"
          accessibilityLiveRegion="polite"
        >
          {canSave && (
            <MaterialIcons name="check-circle" size={iconSize.xs} color={colors.success} />
          )}
          <AppText variant="caption" tone={canSave ? 'success' : 'tertiary'} numberOfLines={1}>
            {canSave ? 'Both sides are ready' : `The ${missing} side is empty`}
          </AppText>
        </View>
      </GlassCard>

      {/* Optional fields stay folded away: they are not part of most cards. */}
      <GlassCard padding="none" className="mt-6">
        <ListRow
          icon="notes"
          iconTone="info"
          title="Example & synonyms"
          subtitle={detailsCount > 0 ? `${detailsCount} added` : 'Optional context for this card'}
          showChevron={false}
          trailing={
            <MaterialIcons
              name={detailsOpen ? 'expand-less' : 'expand-more'}
              size={iconSize.md}
              color={colors.outline}
            />
          }
          onPress={() => setDetailsOpen((open) => !open)}
          accessibilityLabel={
            detailsOpen ? 'Hide example and synonyms' : 'Add an example and synonyms'
          }
        />

        {detailsOpen && (
          <View>
            <View className="flex-row items-center px-4 py-1">
              <MaterialIcons name="format-quote" size={iconSize.sm} color={colors.outline} />
              <TextInput
                className="ml-3 flex-1 text-body font-inter-regular text-on-surface"
                placeholder="An example sentence"
                placeholderTextColor={colors.outline}
                value={example}
                onChangeText={setExample}
                accessibilityLabel="Example"
                style={{ minHeight: heights.field }}
              />
            </View>
            <View className="flex-row items-center px-4 py-1">
              <MaterialIcons name="join-inner" size={iconSize.sm} color={colors.outline} />
              <TextInput
                className="ml-3 flex-1 text-body font-inter-regular text-on-surface"
                placeholder="Synonyms"
                placeholderTextColor={colors.outline}
                value={synonyms}
                onChangeText={setSynonyms}
                accessibilityLabel="Synonyms"
                style={{ minHeight: heights.field }}
              />
            </View>
          </View>
        )}
      </GlassCard>

      {/* The receipt of a save-and-continue: the faces clear, so something has
          to say the card actually landed. */}
      {receipt && (
        <View className="mt-4" accessibilityLiveRegion="polite">
          <AppText variant="bodySm" tone="success">
            {receipt}
          </AppText>
        </View>
      )}

      <SettingsNote icon="schedule">
        {isEditing
          ? 'Changes keep the card’s review history, so its schedule is not reset.'
          : 'A new card joins today’s new-card queue and is due the day you add it.'}
      </SettingsNote>
    </Screen>
  );
}
