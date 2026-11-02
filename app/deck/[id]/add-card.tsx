import { useEffect, useState } from 'react';
import { View, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useDeckStore } from '../../../store/useDeckStore';
import { defaultFSRSState } from '../../../data/seed';
import { textDirection } from '../../../data/text';
import {
  AppText,
  Screen,
  TopAppBar,
  GlassCard,
  RichTextField,
  PrimaryButton,
  IconButton,
  Pill,
} from '../../../components';
import { colors, iconSize } from '../../../theme/tokens';
import type { Flashcard } from '../../../data/types';

export default function AddCardScreen() {
  const { id, editCardId } = useLocalSearchParams<{ id: string; editCardId?: string }>();
  const router = useRouter();
  const deck = useDeckStore((s) => s.decks.find((d) => d.id === id));
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
        front: { text: front.trim(), direction: existingCard.front.direction },
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
      // Clear for rapid entry
      setFront('');
      setBack('');
      setExample('');
      setSynonyms('');
    } else {
      router.back();
    }
  };

  const swapFields = () => {
    const tmp = front;
    setFront(back);
    setBack(tmp);
  };

  const canSave = front.trim().length > 0 && back.trim().length > 0;

  return (
    <Screen
      scroll
      gutter
      header={
        <TopAppBar
          title={editCardId ? 'Edit card' : 'Add cards'}
          back
          actions={[
            {
              icon: 'check',
              accessibilityLabel: 'Save card',
              onPress: () => saveCard(false),
              disabled: !canSave,
            },
          ]}
        />
      }
      footer={
        !editCardId ? (
          <View className="px-5 pb-8">
            <PrimaryButton
              label="Save and add another"
              icon="add"
              onPress={() => saveCard(true)}
              disabled={!canSave}
            />
          </View>
        ) : null
      }
    >
        {/* Deck context */}
        <View className="mb-4 flex-row items-center">
          <MaterialIcons name="folder" size={iconSize.sm} color={colors.outline} />
          <AppText variant="bodySm" weight="medium" tone="muted" className="ml-2 flex-1" numberOfLines={1}>
            {deck?.name ?? 'Deck'}
          </AppText>
          <Pill label={editCardId ? 'Editing' : 'New card'} />
        </View>

        <RichTextField placeholder="Front — the prompt" value={front} onChangeText={setFront} />

        <View className="z-10 -my-2 items-center">
          <IconButton
            icon="swap-vert"
            size="sm"
            onPress={swapFields}
            accessibilityLabel="Swap front and back"
            className="bg-surface"
          />
        </View>

        <RichTextField placeholder="Back — the answer" value={back} onChangeText={setBack} />

        {/* Optional detail */}
        <AppText variant="label" tone="muted" className="mb-2 mt-7 uppercase">
          Additional info
        </AppText>
        <GlassCard padding="none">
          <View className="flex-row items-center border-b border-hairline px-4 py-3">
            <MaterialIcons name="format-quote" size={iconSize.sm} color={colors.outline} />
            <TextInput
              className="ml-3 flex-1 text-body font-inter-regular text-on-surface"
              placeholder="Add an example sentence"
              placeholderTextColor={colors.outline}
              value={example}
              onChangeText={setExample}
              accessibilityLabel="Example"
            />
          </View>
          <View className="flex-row items-center px-4 py-3">
            <MaterialIcons name="join-inner" size={iconSize.sm} color={colors.outline} />
            <TextInput
              className="ml-3 flex-1 text-body font-inter-regular text-on-surface"
              placeholder="Add synonyms"
              placeholderTextColor={colors.outline}
              value={synonyms}
              onChangeText={setSynonyms}
              accessibilityLabel="Synonyms"
            />
          </View>
        </GlassCard>

        {editCardId && (
          <PrimaryButton
            className="mt-6"
            label="Save changes"
            onPress={() => saveCard(false)}
            disabled={!canSave}
          />
        )}
    </Screen>
  );
}
