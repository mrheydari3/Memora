import { useEffect, useRef, useState } from 'react';
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
  SegmentedControl,
  SettingsNote,
  TopAppBar,
} from '../../../components';
import { colors, heights, iconSize, radii } from '../../../theme/tokens';
import { v2 } from '../../../theme/v2';
import type { Flashcard } from '../../../data/types';

type Side = 'front' | 'back';

/**
 * Add cards — the composer is the card.
 *
 * Two stacked textareas made the page a form. Here the writing area is a single
 * card face with the study card's own chrome (a dot, the side name, the flip
 * control), so what you type is what you will be quizzed with; the Front/Back
 * rail flips between the two sides and the type direction follows the script you
 * type, since half the cards here are Persian. The optional fields sit behind a
 * row, so the page opens as one card and one decision.
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
  const [side, setSide] = useState<Side>('front');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const field = useRef<React.ComponentRef<typeof TextInput>>(null);
  const mounted = useRef(false);

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

  // Flipping sides moves the caret into the face you just turned to. The first
  // render is skipped so opening the page does not yank the keyboard up.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    field.current?.focus();
  }, [side]);

  const value = side === 'front' ? front : back;
  const setValue = side === 'front' ? setFront : setBack;
  const direction = textDirection(value);
  const missing: Side | null = !front.trim() ? 'front' : !back.trim() ? 'back' : null;
  const canSave = missing === null;
  const detailsCount = [example.trim(), synonyms.trim()].filter(Boolean).length;
  const isEditing = Boolean(editCardId);

  /** Swap the two sides and keep the writer on the face they were on. */
  const swapSides = () => {
    setFront(back);
    setBack(front);
    setReceipt(null);
  };

  const write = (text: string) => {
    setValue(text);
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
      setSide('front');
      setDetailsOpen(false);
      setReceipt(`Card saved. ${deckCardCount + 1} cards in this deck.`);
    } else {
      leaveComposer();
    }
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

      <SegmentedControl
        className="mb-3"
        appearance="plain"
        segments={[
          {
            key: 'front',
            label: 'Front',
            icon: front.trim() ? 'check' : undefined,
            active: side === 'front',
            onPress: () => setSide('front'),
          },
          {
            key: 'back',
            label: 'Back',
            icon: back.trim() ? 'check' : undefined,
            active: side === 'back',
            onPress: () => setSide('back'),
          },
        ]}
      />

      {/* The writing area: one card face, with the study card's chrome. */}
      <GlassCard padding="none">
        {/* Focus is drawn on the face, not on the raw textarea: a browser
            rectangle inside a rounded card read as a stray box. */}
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
            opacity: focused ? 1 : 0,
          }}
        />
        <View className="flex-row items-center justify-between pl-4 pr-1 pt-2">
          <View className="flex-row items-center gap-2">
            <View
              style={{
                width: 5,
                height: 5,
                borderRadius: 3,
                backgroundColor: colors.primary,
              }}
            />
            <AppText variant="caption" weight="semibold" tone="accent" className="uppercase">
              {side === 'front' ? 'Front' : 'Back'}
            </AppText>
          </View>
          <IconButton
            icon="swap-vert"
            size="sm"
            accessibilityLabel="Swap front and back"
            onPress={swapSides}
          />
        </View>

        <TextInput
          ref={field}
          className="px-4 pb-2 pt-2 text-headline font-inter-medium text-on-surface"
          // Six field heights: the face carries most of the page, so the card
          // reads as the thing you are making rather than as a form. The
          // direction follows the script, so Persian is written right-to-left.
          //
          // The textarea's own focus outline is turned off in favour of the ring
          // drawn around the whole face above: a browser rectangle inside a
          // rounded card read as a stray box. Focus is still visible — the pane
          // ring appears for keyboard and pointer focus alike.
          style={{
            minHeight: heights.field * 6,
            outlineWidth: 0,
            writingDirection: direction,
            textAlign: direction === 'rtl' ? 'right' : 'left',
          }}
          value={value}
          onChangeText={write}
          placeholder={
            side === 'front'
              ? 'The prompt — a word, a phrase, a question'
              : 'The answer — what you want to remember'
          }
          placeholderTextColor={colors.outline}
          multiline
          textAlignVertical="top"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={side === 'front' ? 'Front — the prompt' : 'Back — the answer'}
        />

        {/* The face's own footer: how much is written, and what is missing. */}
        <View
          className="flex-row items-center justify-between px-4 pb-3"
          accessibilityLiveRegion="polite"
        >
          <AppText variant="caption" tone="tertiary">
            {value.trim().length} characters
          </AppText>
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
