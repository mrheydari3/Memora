import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDeckStore } from '../store/useDeckStore';
import { FSRS_DEFAULTS } from '../data/fsrs-params';
import { ICON_CHOICES } from '../data/appearance';
import {
  AppearancePicker,
  COLOR_CHOICES,
  PrimaryButton,
  GhostButton,
  BottomSheetModal,
  SheetPanel,
  SheetScrollView,
  ListRow,
  Field,
} from '../components';
import { alpha, heights, sheet, veil } from '../theme/tokens';

/**
 * Web focus management, typed narrowly because this file should not need the
 * DOM lib. The route is a transparent modal, so the previous screen stays in
 * the document and would otherwise keep its controls in the Tab order.
 */
type WebNode = {
  focus: () => void;
  contains: (node: WebNode | null) => boolean;
  querySelectorAll: (selector: string) => ArrayLike<WebNode>;
};

type WebKeyEvent = {
  key?: string;
  shiftKey?: boolean;
  preventDefault: () => void;
};

type WebDocument = {
  activeElement: WebNode | null;
  addEventListener: (type: 'keydown', listener: (event: WebKeyEvent) => void) => void;
  removeEventListener: (type: 'keydown', listener: (event: WebKeyEvent) => void) => void;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), [role="button"]:not([aria-disabled="true"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function webDocument(): WebDocument | null {
  return (globalThis as { document?: WebDocument }).document ?? null;
}

export default function AddDeckScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const panelRef = useRef<React.ComponentRef<typeof View>>(null);
  const returnFocus = useRef<WebNode | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<string>(ICON_CHOICES[0]);
  const [color, setColor] = useState(COLOR_CHOICES[0]);

  // The sheet owns focus while it is open. Store the trigger so closing the
  // route returns the caret to "Add deck" instead of dropping it on <body>.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const doc = webDocument();
    returnFocus.current = doc?.activeElement ?? null;
    return () => returnFocus.current?.focus?.();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || formVisible) return;
    const doc = webDocument();
    const panel = panelRef.current as unknown as WebNode | null;
    if (!doc || !panel) return;

    const focusable = () => Array.from(panel.querySelectorAll(FOCUSABLE));
    focusable()[0]?.focus();

    const onKeyDown = (event: WebKeyEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        router.back();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = doc.activeElement;

      if (!active || !panel.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    doc.addEventListener('keydown', onKeyDown);
    return () => doc.removeEventListener('keydown', onKeyDown);
  }, [formVisible, router]);

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
      adaptiveOrdering: true,
      learningSteps: ['12 hours', '1 day', '2 days', '3 days'],
      masteredIntervalMultiplier: 2.5,
      ...FSRS_DEFAULTS,
      createdAt: Date.now(),
    });
    setFormVisible(false);
    router.replace(`/deck/${id}`);
  };

  return (
    <View
      className="flex-1 justify-end"
      style={{ backgroundColor: alpha(veil, sheet.scrimDim) }}
    >
      {/* The canvas behind the sheet closes it, exactly like BottomSheetModal.
          It is not a control: the sheet header owns the accessible close. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => router.back()}
        accessible={false}
        focusable={false}
        importantForAccessibility="no"
      />

      {/* Same sheet geometry as every modal: 28px top radius, opaque panel,
          header close control, and the home-indicator inset respected. */}
      <View
        ref={panelRef}
        role="dialog"
        accessibilityLabel="New deck"
        accessibilityViewIsModal
        style={{ width: '100%' }}
      >
        <SheetPanel
          title="New deck"
          subtitle="Start from scratch and write cards one by one."
          onClose={() => router.back()}
          style={{ paddingBottom: Math.max(32, insets.bottom + 16) }}
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
          </View>

          <GhostButton
            className="mt-4"
            label="Cancel"
            variant="text"
            onPress={() => router.back()}
          />
        </SheetPanel>
      </View>

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
    </View>
  );
}
