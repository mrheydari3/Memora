import { useEffect, useState } from 'react';
import { Pressable, View, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { MaterialIcons } from '../../../components/Icon';
import { useDeckStore } from '../../../store/useDeckStore';
import { defaultFSRSState } from '../../../data/seed';
import { textDirection } from '../../../data/text';
import {
  AppText,
  Button,
  COLOR_CHOICES,
  GlassCard,
  IconButton,
  ListRow,
  Pill,
  PrimaryButton,
  Screen,
  SettingsNote,
  TopAppBar,
} from '../../../components';
import {
  colors,
  fills,
  glass,
  heights,
  iconSize,
  layout,
  over,
  radii,
  typography,
} from '../../../theme/tokens';
import { v2 } from '../../../theme/v2';
import type { Flashcard } from '../../../data/types';

type Side = 'front' | 'back';

/**
 * The tints a card may wear. They are the deck palette's own steps, so a card
 * can never introduce a colour the rest of the app does not know; the empty
 * value is the plain glass face.
 */
const CARD_COLOURS = [
  { value: '', label: 'No colour' },
  { value: COLOR_CHOICES[0], label: 'Blue' },
  { value: COLOR_CHOICES[1], label: 'Amber' },
  { value: COLOR_CHOICES[2], label: 'Red' },
  { value: COLOR_CHOICES[3], label: 'Green' },
  { value: COLOR_CHOICES[4], label: 'Grey' },
] as const;

/**
 * Add cards — you write on the card itself.
 *
 * The page is one flashcard, laid out the way it will be studied: the prompt as a
 * centred poster, a short accent rule, and the answer beneath it. Both sides are
 * typed directly on that face — there are no field labels, boxes or counters —
 * so the composer cannot read as a form. The chrome is the study card's own (a
 * dot, the side you are writing, the swap control), the card can be tinted from
 * the palette, the optional fields sit open below it and the save decision lives
 * in the fixed footer.
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
  const [color, setColor] = useState(existingCard?.color ?? '');
  const [writing, setWriting] = useState<Side | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(true);
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
    setColor(existingCard.color ?? '');
    setHydrated(true);
  }, [existingCard, hydrated]);

  const missing: Side | null = !front.trim() ? 'front' : !back.trim() ? 'back' : null;
  const canSave = missing === null;
  const detailsCount = [example.trim(), synonyms.trim()].filter(Boolean).length;
  const isEditing = Boolean(editCardId);
  const accent = color || colors.primary;

  /** Swap the two sides; the caret stays where it was because both are on the card. */
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
        color: color || undefined,
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
      color: color || undefined,
      createdAt: Date.now(),
      fsrs: defaultFSRSState(),
    };

    await addCard(card);

    if (andContinue) {
      setFront('');
      setBack('');
      setExample('');
      setSynonyms('');
      setDetailsOpen(true);
      setWriting(null);
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

      {/* The card, composed the way it will be studied. */}
      <GlassCard
        padding="none"
        style={{
          minHeight: layout.cardMinHeight,
          // The tint is mixed into the pane rather than laid over it: React
          // Native styles cannot stack two background colours.
          ...(color ? { backgroundColor: over(glass.fill, color, 0.16) } : {}),
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderWidth: 2,
            borderColor: accent,
            borderRadius: radii.pane,
            opacity: writing ? 1 : 0,
          }}
        />

        <View className="flex-row items-center justify-between pb-1 pl-5 pr-2 pt-3">
          <View className="flex-row items-center gap-2">
            <View
              style={{
                width: 5,
                height: 5,
                borderRadius: 3,
                backgroundColor: accent,
              }}
            />
            <AppText variant="caption" weight="semibold" tone="accent" className="uppercase">
              {writing === 'back' ? 'Writing the back' : writing ? 'Writing the front' : 'New card'}
            </AppText>
          </View>
          <IconButton
            icon="swap-vert"
            size="sm"
            accessibilityLabel="Swap front and back"
            onPress={swapSides}
          />
        </View>

        <View className="flex-1 justify-center px-6 pb-8 pt-2">
          <TextInput
            className="w-full text-center font-inter-bold text-on-surface"
            // The browser's own outline would cut a rectangle across the card;
            // the ring above marks focus instead, so the card stays one surface.
            style={{
              ...typography.title,
              minHeight: typography.title.lineHeight * 2,
              outlineWidth: 0,
              paddingVertical: 0,
              textAlign: 'center',
              writingDirection: textDirection(front),
            }}
            value={front}
            onChangeText={(next) => {
              setFront(next);
              setReceipt(null);
            }}
            placeholder="Word or question"
            placeholderTextColor={colors.outlineSoft}
            multiline
            textAlignVertical="center"
            onFocus={() => setWriting('front')}
            onBlur={() => setWriting((current) => (current === 'front' ? null : current))}
            accessibilityLabel="Front — the prompt"
          />

          <View
            style={{
              alignSelf: 'center',
              width: 36,
              height: 1,
              borderRadius: 1,
              marginTop: 14,
              marginBottom: 14,
              backgroundColor: color ?? colors.accentLine,
            }}
          />

          <TextInput
            className="w-full text-center font-inter-medium text-on-surface-variant"
            style={{
              ...typography.headline,
              minHeight: typography.headline.lineHeight * 2,
              outlineWidth: 0,
              paddingVertical: 0,
              textAlign: 'center',
              writingDirection: textDirection(back),
            }}
            value={back}
            onChangeText={(next) => {
              setBack(next);
              setReceipt(null);
            }}
            placeholder="Answer"
            placeholderTextColor={colors.outlineSoft}
            multiline
            textAlignVertical="center"
            onFocus={() => setWriting('back')}
            onBlur={() => setWriting((current) => (current === 'back' ? null : current))}
            accessibilityLabel="Back — the answer"
          />
        </View>
      </GlassCard>

      {/* Only what the card still needs — no counters, no field furniture. */}
      <View className="mt-3 flex-row items-center gap-1.5 px-1" accessibilityLiveRegion="polite">
        {canSave && <MaterialIcons name="check-circle" size={iconSize.xs} color={colors.success} />}
        <AppText variant="bodySm" tone={canSave ? 'success' : 'muted'} numberOfLines={1}>
          {canSave ? 'Both sides are ready' : `Still empty: the ${missing} side`}
        </AppText>
      </View>

      {/* The card's tint, picked from the palette the rest of the app uses. */}
      <View className="mt-5 px-1">
        <AppText variant="label" tone="muted" className="uppercase">
          Front colour
        </AppText>
        <View className="mt-1 flex-row items-center" style={{ gap: 4 }}>
          {CARD_COLOURS.map((choice) => {
            const active = color === choice.value;
            return (
              <Pressable
                key={choice.label}
                style={{
                  width: heights.hit,
                  height: heights.hit,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => {
                  setColor(choice.value);
                  setReceipt(null);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                aria-checked={active}
                accessibilityLabel={choice.value ? `Card colour ${choice.label}` : choice.label}
              >
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: choice.value || fills.control,
                  }}
                >
                  {active ? (
                    <MaterialIcons
                      name="check"
                      size={iconSize.sm}
                      color={choice.value ? colors.onPrimary : colors.primary}
                    />
                  ) : choice.value ? null : (
                    <MaterialIcons name="block" size={iconSize.xs} color={colors.outline} />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Optional fields are open: most cards get an example, so it should not
          cost a second tap to reach. */}
      <GlassCard padding="none" className="mt-5">
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

      {/* The receipt of a save-and-continue: the card clears, so something has
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
