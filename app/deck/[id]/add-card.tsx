import { useEffect, useState } from 'react';
import { Pressable, View, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { MaterialIcons } from '../../../components/Icon';
import { useDeckStore } from '../../../store/useDeckStore';
import { goBackOr } from '../../../services/navigation';
import { defaultFSRSState } from '../../../data/seed';
import { textDirection } from '../../../data/text';
import {
  AppText,
  BottomSheetModal,
  Button,
  CARD_COLOR_CHOICES,
  PrimaryButton,
  Screen,
} from '../../../components';
import { HeaderIcon, PageHeader } from '../../../components/v3';
import {
  alpha,
  colors,
  fills,
  glass,
  heights,
  iconSize,
  layout,
  over,
  typography,
} from '../../../theme/tokens';
import { v3 } from '../../../theme/v3';
import type { Flashcard } from '../../../data/types';

type Side = 'front' | 'back';

const FRONT_MAX = 120;
const BACK_MAX = 200;
/** The mockup's writing wells: two lines of the front, two of the back. */
const FRONT_MIN_HEIGHT = 104;
const BACK_MIN_HEIGHT = 96;

const NUMERIC = { fontVariant: ['tabular-nums'] as const };

/**
 * Add cards, v3 "Nocturne Focus" — you write on the card itself.
 *
 * The page is one flashcard laid out the way it will be studied: a 64px bar
 * with the route's name, the deck it lands in, then the card face. Both sides
 * are typed directly on that face — no field boxes — with a character count, a
 * divider whose swap control trades the sides, and a live readiness line under
 * the card. The tint palette, the optional context and the save decision sit
 * below it, and the actions stay pinned to the bottom.
 *
 * Behaviour is unchanged: a draft is guarded on back, a long prompt grows
 * instead of clipping, editing keeps the card's schedule, and "save and add
 * another" clears the composer and reports the deck's new count.
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
  const [frontHeight, setFrontHeight] = useState<number | null>(null);
  const [backHeight, setBackHeight] = useState<number | null>(null);
  const [discardVisible, setDiscardVisible] = useState(false);

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
  const title = isEditing ? 'Edit card' : 'Add a card';

  // Compare against the saved card, not against an empty form. For a new card
  // the same expression uses empty strings, so selecting a tint alone still
  // protects the draft.
  const isDirty =
    front !== (existingCard?.front.text ?? '') ||
    back !== (existingCard?.back.text ?? '') ||
    example !== (existingCard?.example ?? '') ||
    synonyms !== (existingCard?.synonyms ?? '') ||
    color !== (existingCard?.color ?? '');

  /** Swap the two sides; the caret stays where it was because both are on the card. */
  const swapSides = () => {
    setFront(back);
    setBack(front);
    setReceipt(null);
  };

  // A card opened from a link or a reload has no screen behind it. Land on the
  // deck instead, which is where back would go.
  const leaveComposer = () => {
    const fallback = (id ? `/deck/${id}` : '/(tabs)/home') as Href;
    goBackOr(router, fallback);
  };

  const handleBack = () => {
    if (!isDirty) {
      leaveComposer();
      return;
    }
    setDiscardVisible(true);
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
      setFrontHeight(null);
      setBackHeight(null);
      setReceipt(`Card saved. ${deckCardCount + 1} cards in this deck.`);
    } else {
      leaveComposer();
    }
  };

  const colorLabel = color
    ? CARD_COLOR_CHOICES.find((choice) => choice.value === color)?.label ?? 'Custom'
    : 'Default (None)';

  // A receipt outranks readiness: after save-and-add-another the composer is
  // empty again, so the line must say the card landed before it says it is empty.
  const statusText = receipt
    ? receipt
    : canSave
      ? 'Both sides are ready'
      : missing === 'front'
        ? back.trim()
          ? 'Needs a question or word on front'
          : 'Still empty: the front side'
        : 'Add an answer on the back';
  const statusColour = receipt || canSave ? colors.success : missing === 'back' ? colors.outline : colors.warning;

  const fieldStyle = {
    minHeight: heights.field,
    borderRadius: 12,
    backgroundColor: colors.surfaceControl,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center' as const,
  };

  const header = (
    <PageHeader
      title={title}
      back
      onBack={handleBack}
      maxWidth={v3.layout.composerMaxWidth}
      actions={<HeaderIcon icon="close" label="Close composer" onPress={handleBack} />}
    />
  );

  const footer = (
    <View style={{ backgroundColor: colors.background, alignItems: 'center' }}>
      <View
        style={{
          width: '100%',
          maxWidth: v3.layout.composerMaxWidth,
          paddingHorizontal: 20,
          paddingTop: 10,
          paddingBottom: 24,
          gap: 10,
        }}
      >
      <Pressable
        onPress={() => saveCard(false)}
        disabled={!canSave}
        accessibilityRole="button"
        accessibilityLabel={isEditing ? 'Save changes' : 'Save card'}
        accessibilityState={{ disabled: !canSave }}
        aria-disabled={!canSave}
        style={{
          minHeight: heights.button,
          borderRadius: 14,
          backgroundColor: canSave ? colors.primaryContainer : fills.control,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <MaterialIcons
          name="check"
          size={iconSize.lg}
          color={canSave ? colors.onPrimaryContainer : colors.outline}
        />
        <AppText
          variant="body"
          weight="semibold"
          style={{ color: canSave ? colors.onPrimaryContainer : colors.outline }}
        >
          {isEditing ? 'Save changes' : 'Save card'}
        </AppText>
      </Pressable>

      {!isEditing && (
        <Pressable
          onPress={() => saveCard(true)}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityLabel="Save and add another"
          accessibilityState={{ disabled: !canSave }}
          aria-disabled={!canSave}
          style={{
            minHeight: 48,
            borderRadius: 14,
            backgroundColor: fills.control,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <MaterialIcons
            name="add"
            size={19}
            color={canSave ? colors.primary : colors.outline}
          />
          <AppText
            variant="body"
            weight="semibold"
            style={{ color: canSave ? colors.onSurface : colors.outline }}
          >
            Save and add another
          </AppText>
        </Pressable>
      )}
      </View>
    </View>
  );

  return (
    <Screen
      scroll
      gutter
      contentMaxWidth={v3.layout.composerMaxWidth}
      header={header}
      footer={footer}
    >
      {/* Which deck the card lands in, and where it will sit in it. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          paddingHorizontal: 4,
          marginBottom: 20,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surfacePane,
              flexShrink: 0,
            }}
          >
            <MaterialIcons name="folder-open" size={19} color={colors.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              Target deck
            </AppText>
            <AppText variant="body" weight="semibold" numberOfLines={1}>
              {deck?.name ?? 'Deck'}
            </AppText>
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: colors.surfaceInset,
            flexShrink: 0,
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: isEditing ? colors.primary : colors.warning,
            }}
          />
          <AppText variant="label" weight="medium" tone="muted" style={NUMERIC}>
            {isEditing ? 'Editing' : `Card ${deckCardCount + 1}`}
          </AppText>
        </View>
      </View>

      {/* The card, composed the way it will be studied. */}
      <View
        style={{
          backgroundColor: colors.surfaceCardFace,
          // The tint is mixed into the pane rather than laid over it: React
          // Native styles cannot stack two background colours.
          ...(color ? { backgroundColor: over(glass.fill, color, 0.1) } : {}),
          borderRadius: v3.radii.pane,
          borderWidth: 1,
          borderColor: alpha(colors.outlineSoft, 0.4),
          padding: 24,
          minHeight: layout.cardMinHeight,
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
            borderRadius: v3.radii.pane,
            opacity: writing ? 1 : 0,
          }}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <AppText
            variant="label"
            tone={color ? 'muted' : 'tertiary'}
            className="uppercase"
            style={{ letterSpacing: 0.8 }}
          >
            Front
          </AppText>
          <AppText variant="caption" tone={color ? 'muted' : 'tertiary'} style={NUMERIC}>
            {front.length} / {FRONT_MAX}
          </AppText>
        </View>

        <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }}>
          <TextInput
            className="composer-input w-full text-center font-inter-bold text-on-surface"
            // The card ring is the primary focus mark; the inset CSS ring on
            // the input is the keyboard-safe backup the audit requires.
            style={{
              ...v3.type.composerFront,
              minHeight: FRONT_MIN_HEIGHT,
              height: frontHeight ?? undefined,
              outlineWidth: 0,
              paddingVertical: 0,
              textAlign: 'center',
              writingDirection: textDirection(front),
            }}
            scrollEnabled={false}
            onContentSizeChange={(event) => {
              const next = Math.ceil(event.nativeEvent.contentSize.height);
              setFrontHeight((current) => (current === next ? current : next));
            }}
            value={front}
            onChangeText={(next) => {
              setFront(next);
              setReceipt(null);
            }}
            placeholder="Word or question"
            placeholderTextColor={colors.outlineSoft}
            multiline
            maxLength={FRONT_MAX}
            textAlignVertical="center"
            onFocus={() => setWriting('front')}
            onBlur={() => setWriting((current) => (current === 'front' ? null : current))}
            accessibilityLabel="Front — the prompt"
          />
        </View>

        {/* The swap control sits on the card's own divider. */}
        <View style={{ paddingVertical: 8, justifyContent: 'center', marginVertical: 2 }}>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: alpha(colors.outlineSoft, 0.4),
            }}
          />
          <View style={{ alignSelf: 'center' }}>
            <Pressable
              onPress={swapSides}
              accessibilityRole="button"
              accessibilityLabel="Swap front and back"
              style={{
                width: 44,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surfaceControl,
                  borderWidth: 1,
                  borderColor: alpha(colors.outlineSoft, 0.4),
                }}
              >
                <MaterialIcons name="swap-vert" size={20} color={colors.primaryContainer} />
              </View>
            </Pressable>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <AppText
            variant="label"
            tone={color ? 'muted' : 'tertiary'}
            className="uppercase"
            style={{ letterSpacing: 0.8 }}
          >
            Back
          </AppText>
          <AppText variant="caption" tone={color ? 'muted' : 'tertiary'} style={NUMERIC}>
            {back.length} / {BACK_MAX}
          </AppText>
        </View>

        <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }}>
          <TextInput
            className="composer-input w-full text-center font-inter-semibold text-on-surface"
            style={{
              ...typography.headline,
              minHeight: BACK_MIN_HEIGHT,
              height: backHeight ?? undefined,
              outlineWidth: 0,
              paddingVertical: 0,
              textAlign: 'center',
              writingDirection: textDirection(back),
            }}
            scrollEnabled={false}
            onContentSizeChange={(event) => {
              const next = Math.ceil(event.nativeEvent.contentSize.height);
              setBackHeight((current) => (current === next ? current : next));
            }}
            value={back}
            onChangeText={(next) => {
              setBack(next);
              setReceipt(null);
            }}
            placeholder="Answer"
            placeholderTextColor={colors.outlineSoft}
            multiline
            maxLength={BACK_MAX}
            textAlignVertical="center"
            onFocus={() => setWriting('back')}
            onBlur={() => setWriting((current) => (current === 'back' ? null : current))}
            accessibilityLabel="Back — the answer"
          />
        </View>
      </View>

      {/* Only what the card still needs — no counters, no field furniture. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 8,
          marginTop: 14,
          marginBottom: 24,
        }}
        accessibilityLiveRegion="polite"
      >
        <View
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColour, flexShrink: 0 }}
        />
        <AppText variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
          {statusText}
        </AppText>
      </View>

      {/* The card's tint, picked from the palette the rest of the app uses. */}
      <View style={{ paddingHorizontal: 4, marginBottom: 24 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            marginBottom: 8,
          }}
        >
          <AppText
            variant="label"
            tone="muted"
            className="uppercase"
            style={{ letterSpacing: 0.6 }}
          >
            Front colour
          </AppText>
          <AppText variant="caption" tone="tertiary" numberOfLines={1}>
            {colorLabel}
          </AppText>
        </View>

        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Card colour"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 4,
          }}
        >
          <Pressable
            onPress={() => {
              setColor('');
              setReceipt(null);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: color === '' }}
            aria-checked={color === ''}
            accessibilityLabel="No colour"
            style={{
              minWidth: heights.hit,
              height: heights.hit,
              paddingHorizontal: 12,
              borderRadius: 999,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: color === '' ? colors.selectionSurface : colors.surfaceControl,
              borderWidth: 1,
              borderColor:
                color === '' ? alpha(colors.primary, 0.35) : alpha(colors.outlineSoft, 0.3),
            }}
          >
            <MaterialIcons
              name="block"
              size={18}
              color={color === '' ? colors.primary : colors.onSurfaceVariant}
            />
            <AppText variant="label" weight="medium" tone={color === '' ? 'accent' : 'muted'}>
              None
            </AppText>
          </Pressable>

          {CARD_COLOR_CHOICES.map((choice) => {
            const active = color === choice.value;
            return (
              <Pressable
                key={choice.label}
                onPress={() => {
                  setColor(choice.value);
                  setReceipt(null);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                aria-checked={active}
                accessibilityLabel={`Card colour ${choice.label}`}
                style={{
                  width: heights.hit,
                  height: heights.hit,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    borderWidth: 2,
                    borderColor: active ? colors.primary : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: choice.value,
                    }}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Optional context is open: most cards get an example, so it should not
          cost a second tap to reach. */}
      <View
        style={{
          backgroundColor: colors.surfacePane,
          borderRadius: v3.radii.card,
          overflow: 'hidden',
        }}
      >
        <Pressable
          onPress={() => setDetailsOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: detailsOpen }}
          aria-expanded={detailsOpen}
          style={{
            minHeight: 56,
            paddingHorizontal: 20,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surfaceTile,
                borderWidth: 1,
                borderColor: alpha(colors.outlineSoft, 0.4),
                flexShrink: 0,
              }}
            >
              <MaterialIcons name="auto-stories" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="body" weight="semibold">
                Example & synonyms
              </AppText>
              <AppText variant="caption" tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
                {detailsCount > 0 ? `${detailsCount} added` : 'Optional context for this card'}
              </AppText>
            </View>
          </View>
          <MaterialIcons
            name={detailsOpen ? 'expand-less' : 'expand-more'}
            size={iconSize.xl}
            color={colors.onSurfaceVariant}
          />
        </Pressable>

        {detailsOpen && (
          <View style={{ paddingHorizontal: 20, paddingBottom: 20, paddingTop: 4, gap: 12 }}>
            <View style={{ gap: 6 }}>
              <AppText
                variant="label"
                tone="tertiary"
                className="uppercase"
                style={{ letterSpacing: 0.6 }}
              >
                Example sentence
              </AppText>
              <View style={fieldStyle}>
                <TextInput
                  className="w-full text-body font-inter-regular text-on-surface"
                  placeholder="An example sentence"
                  placeholderTextColor={colors.outline}
                  value={example}
                  onChangeText={setExample}
                  accessibilityLabel="Example"
                  style={{ outlineWidth: 0, paddingVertical: 0 }}
                />
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <AppText
                variant="label"
                tone="tertiary"
                className="uppercase"
                style={{ letterSpacing: 0.6 }}
              >
                Synonyms
              </AppText>
              <View style={fieldStyle}>
                <TextInput
                  className="w-full text-body font-inter-regular text-on-surface"
                  placeholder="Synonyms"
                  placeholderTextColor={colors.outline}
                  value={synonyms}
                  onChangeText={setSynonyms}
                  accessibilityLabel="Synonyms"
                  style={{ outlineWidth: 0, paddingVertical: 0 }}
                />
              </View>
            </View>
          </View>
        )}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
          paddingHorizontal: 8,
          marginTop: 20,
          marginBottom: 28,
        }}
      >
        <MaterialIcons
          name="info-outline"
          size={18}
          color={colors.outline}
          style={{ marginTop: 1 }}
        />
        <AppText variant="caption" tone="tertiary" style={{ flex: 1 }}>
          {isEditing
            ? 'Changes keep the card’s review history, so its schedule is not reset.'
            : 'A new card joins today’s new-card queue and is due the day you add it.'}
        </AppText>
      </View>

      <BottomSheetModal
        visible={discardVisible}
        onClose={() => setDiscardVisible(false)}
        title="Discard changes?"
        subtitle="This card has not been saved."
      >
        <View className="gap-3">
          <PrimaryButton label="Keep editing" onPress={() => setDiscardVisible(false)} />
          <Button
            variant="text"
            destructive
            label="Discard changes"
            onPress={() => {
              setDiscardVisible(false);
              leaveComposer();
            }}
          />
        </View>
      </BottomSheetModal>
    </Screen>
  );
}
