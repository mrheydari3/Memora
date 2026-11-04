import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { pushOnce } from '../services/navigation';
import { useDeckStore } from '../store/useDeckStore';
import { FSRS_DEFAULTS } from '../data/fsrs-params';
import { ICON_CHOICES } from '../data/appearance';
import {
  AppearancePicker,
  COLOR_CHOICES,
  Screen,
  PrimaryButton,
  GhostButton,
  BottomSheetModal,
  SheetPanel,
  SheetScrollView,
  ListRow,
  Field,
} from '../components';
import { heights } from '../theme/tokens';

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

      {/* The router presents this route as a sheet, so it carries the same inset
          and rounding the modal sheets do. */}
      <SheetPanel
        title="New deck"
        subtitle="Start from scratch or bring your existing cards with you."
      >
        <View className="mt-2">
          <ListRow
            title="Add manually"
            subtitle="Create a deck and write cards one by one"
            icon="edit"
            tile="sm"
            density="compact"
            gutter={0}
            showChevron={false}
            onPress={() => setFormVisible(true)}
          />
          <ListRow
            title="Bulk import"
            subtitle="Anki, Quizlet or CSV"
            icon="upload-file"
            tile="sm"
            density="compact"
            gutter={0}
            showChevron={false}
            onPress={() => pushOnce(router, '/mass-import')}
          />
        </View>

        <GhostButton className="mt-4" label="Cancel" variant="text" onPress={() => router.back()} />
      </SheetPanel>

      {/* New Deck form */}
      <BottomSheetModal visible={formVisible} onClose={() => setFormVisible(false)} title="New Deck">
        <SheetScrollView style={{ maxHeight: heights.sheetTall }} showsVerticalScrollIndicator={false}>
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

          <View className="mb-6 mt-5">
            <AppearancePicker icon={icon} color={color} onIconChange={setIcon} onColorChange={setColor} />
          </View>

          <PrimaryButton label="Create deck" onPress={createDeck} disabled={!name.trim()} />
        </SheetScrollView>
      </BottomSheetModal>
    </Screen>
  );
}
