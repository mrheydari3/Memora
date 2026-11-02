import { useState } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { pushOnce } from '../services/navigation';
import { MaterialIcons } from '@expo/vector-icons';
import { useDeckStore } from '../store/useDeckStore';
import { FSRS_DEFAULTS } from '../data/fsrs-params';
import {
  AppText,
  Screen,
  GlassCard,
  PrimaryButton,
  GhostButton,
  BottomSheetModal,
  SheetPanel,
  ListRow,
  Field,
} from '../components';
import { alpha, colors, fills, heights, iconSize } from '../theme/tokens';

const ICON_CHOICES = [
  'language',
  'school',
  'book',
  'terminal',
  'gavel',
  'medical-services',
  'palette',
  'mic',
  'flight',
  'train',
] as const;

const COLOR_CHOICES = [
  colors.primary,
  colors.warning,
  colors.error,
  colors.success,
  colors.secondary,
];

export default function AddDeckScreen() {
  const router = useRouter();
  const [formVisible, setFormVisible] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<string>(ICON_CHOICES[0]);
  const [color, setColor] = useState(COLOR_CHOICES[0]);

  const createDeck = async () => {
    if (!name.trim()) return;
    const id = `deck-${Date.now()}`;
    await useDeckStore.getState().addDeck({
      id,
      name: name.trim(),
      description: description.trim() || undefined,
      icon,
      color,
      parentId: null,
      algorithmPreset: 'fsrs',
      newCardsPerDay: 20,
      maxCardsPerDay: 80,
      shuffleCards: true,
      learningSteps: ['12 hours', '1 day', '2 days', '3 days'],
      masteredIntervalMultiplier: 2.5,
      ...FSRS_DEFAULTS,
      createdAt: Date.now(),
    });
    setFormVisible(false);
    router.replace(`/deck/${id}`);
  };

  return (
    <Screen>
      <Pressable className="flex-1" onPress={() => router.back()} accessibilityLabel="Close" />

      <SheetPanel
        title="New deck"
        subtitle="Start from scratch or bring your existing cards with you."
      >
        <GlassCard className="mt-2" padding="none">
          <ListRow
            icon="style"
            tile="lg"
            iconTone="accent"
            title="Add manually"
            subtitle="Create a deck and write cards one by one"
            onPress={() => setFormVisible(true)}
          />
          <View className="mx-4 h-px bg-hairline" />
          <ListRow
            icon="file-download"
            tile="lg"
            title="Bulk import"
            subtitle="Anki, Quizlet or CSV"
            onPress={() => pushOnce(router, '/mass-import')}
          />
        </GlassCard>

        <GhostButton className="mt-4" label="Cancel" variant="text" onPress={() => router.back()} />
      </SheetPanel>

      {/* New Deck form */}
      <BottomSheetModal visible={formVisible} onClose={() => setFormVisible(false)} title="New Deck">
        <ScrollView style={{ maxHeight: heights.sheetTall }} showsVerticalScrollIndicator={false}>
          <Field label="Name" value={name} onChangeText={setName} placeholder="Deck name" />

          <Field
            className="mt-4"
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Optional"
            multiline
            tall
          />

          <AppText variant="label" tone="muted" className="mb-2 mt-5 uppercase">
            Icon
          </AppText>
          <View className="mb-5 flex-row flex-wrap gap-2">
            {ICON_CHOICES.map((choice) => {
              const active = icon === choice;
              return (
                <Pressable
                  key={choice}
                  className={`items-center justify-center rounded-md border ${
                    active ? 'border-accent-line' : 'border-hairline'
                  }`}
                  style={{
                    width: heights.tileLg,
                    height: heights.tileLg,
                    backgroundColor: active ? colors.accentActive : fills.tile,
                  }}
                  onPress={() => setIcon(choice)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Icon ${choice}`}
                >
                  <MaterialIcons
                    name={choice}
                    size={iconSize.lg}
                    color={active ? colors.primary : colors.onSurfaceVariant}
                  />
                </Pressable>
              );
            })}
          </View>

          <AppText variant="label" tone="muted" className="mb-2 uppercase">
            Colour
          </AppText>
          <View className="mb-6 flex-row gap-3">
            {COLOR_CHOICES.map((choice) => {
              const active = color === choice;
              return (
                <Pressable
                  key={choice}
                  className={`items-center justify-center rounded-full border ${
                    active ? 'border-accent-line' : 'border-hairline'
                  }`}
                  style={{
                    width: heights.tileLg,
                    height: heights.tileLg,
                    backgroundColor: alpha(choice, 0.1),
                  }}
                  onPress={() => setColor(choice)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Colour ${choice}`}
                >
                  <View
                    className="h-6 w-6 rounded-full"
                    style={{ backgroundColor: choice }}
                  />
                </Pressable>
              );
            })}
          </View>

          <PrimaryButton label="Create deck" onPress={createDeck} disabled={!name.trim()} />
        </ScrollView>
      </BottomSheetModal>
    </Screen>
  );
}
