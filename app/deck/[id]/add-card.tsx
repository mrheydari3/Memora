import { useEffect, useState } from 'react';
import { View, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '../../../components/Icon';
import { useDeckStore } from '../../../store/useDeckStore';
import { defaultFSRSState } from '../../../data/seed';
import { textDirection } from '../../../data/text';
import {
  AppText,
  Button,
  CardTextField,
  GlassCard,
  Pill,
  PrimaryButton,
  Screen,
  SettingsNote,
  TopAppBar,
} from '../../../components';
import { colors, heights, iconSize } from '../../../theme/tokens';
import { v2 } from '../../../theme/v2';
import type { Flashcard } from '../../../data/types';

/**
 * Add cards — the card composer.
 *
 * Two fields, one optional detail block and two ways to finish: save and leave
 * for the deck, or save and keep writing. The page says what a saved card will
 * do (join today's new-card queue) and confirms each save in place, because a
 * form that clears itself with no receipt looks like it lost the card.
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

  const saveCard = async (andContinue: boolean) => {
    if (!front.trim() || !back.trim()) return;

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
      router.back();
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
      setReceipt(`Card saved. ${deckCardCount + 1} cards in this deck.`);
    } else {
      router.back();
    }
  };

  const swapFields = () => {
    const tmp = front;
    setFront(back);
    setBack(tmp);
    setReceipt(null);
  };

  const canSave = front.trim().length > 0 && back.trim().length > 0;
  const isEditing = Boolean(editCardId);

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
      {/* Deck context: which deck the card lands in, and what it is. */}
      <View className="mb-6 flex-row items-center">
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
        <Pill label={isEditing ? 'Editing' : 'New card'} />
      </View>

      <CardTextField
        label="Front"
        placeholder="The prompt — a word, a phrase, a question"
        value={front}
        onChangeText={(text) => {
          setFront(text);
          setReceipt(null);
        }}
        accessibilityLabel="Front — the prompt"
      />

      {/* Swap sits in the flow, not on top of the two panes: the old control
          was an opaque tile straddling both fields. */}
      <View className="my-2 items-center">
        <Button
          variant="text"
          size="md"
          label="Swap front and back"
          icon="swap-vert"
          onPress={swapFields}
        />
      </View>

      <CardTextField
        label="Back"
        placeholder="The answer — what you want to remember"
        value={back}
        onChangeText={(text) => {
          setBack(text);
          setReceipt(null);
        }}
        accessibilityLabel="Back — the answer"
      />

      <AppText variant="label" tone="muted" className="mb-2 mt-7 uppercase">
        Optional details
      </AppText>
      <GlassCard padding="none">
        <View className="flex-row items-center px-4 py-3">
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
        <View className="flex-row items-center px-4 py-3">
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
      </GlassCard>

      {/* The receipt of a save-and-continue: the fields clear, so something has
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
