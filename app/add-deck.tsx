import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDeckStore } from '../store/useDeckStore';
import { goBackOr } from '../services/navigation';
import { FSRS_DEFAULTS } from '../data/fsrs-params';
import { ICON_CHOICES } from '../data/appearance';
import {
  AppText,
  AppearancePicker,
  COLOR_CHOICES,
  Field,
  IconButton,
} from '../components';
import { ActionButton, Surface } from '../components/v3';
import { alpha, colors, glass, iconSize, radii, sheet, veil } from '../theme/tokens';

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
  const { height: windowHeight } = useWindowDimensions();
  const decks = useDeckStore((state) => state.decks);
  const panelRef = useRef<React.ComponentRef<typeof View>>(null);
  const returnFocus = useRef<WebNode | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<string>(ICON_CHOICES[0]);
  const [color, setColor] = useState(COLOR_CHOICES[0]);
  const [nameEdited, setNameEdited] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const duplicateName =
    trimmedName.length > 0 &&
    decks.some((deck) => deck.name.trim().toLowerCase() === trimmedName.toLowerCase());
  const nameError = duplicateName
    ? 'A deck with that name already exists.'
    : nameEdited && !trimmedName
      ? 'Give the deck a name.'
      : null;
  const canCreate = trimmedName.length > 0 && !duplicateName && !creating;

  const closeSheet = () => goBackOr(router, '/(tabs)/home');

  // The sheet owns focus while it is open. Store the trigger so closing the
  // route returns the caret to "Add deck" instead of dropping it on <body>.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const doc = webDocument();
    returnFocus.current = doc?.activeElement ?? null;
    return () => returnFocus.current?.focus?.();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const doc = webDocument();
    const panel = panelRef.current as unknown as WebNode | null;
    if (!doc || !panel) return;

    const focusable = () => Array.from(panel.querySelectorAll(FOCUSABLE));
    focusable()[0]?.focus();

    const onKeyDown = (event: WebKeyEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        goBackOr(router, '/(tabs)/home');
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
  }, [router]);

  const createDeck = async () => {
    if (!canCreate) return;
    setCreating(true);
    setSaveError(null);
    const id = `deck-${Date.now()}`;
    try {
      await useDeckStore.getState().addDeck({
        id,
        name: trimmedName,
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
      router.replace(`/deck/${id}`);
    } catch {
      setCreating(false);
      setSaveError('This deck could not be saved. Try again.');
    }
  };

  const maxHeight =
    windowHeight > 0 ? Math.round(windowHeight * sheet.maxHeightRatio) : undefined;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: alpha(veil, sheet.scrimDim),
      }}
    >
      {/* The canvas behind the sheet closes it. It is not a control: the
          sheet header owns the accessible close. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={closeSheet}
        accessible={false}
        focusable={false}
        importantForAccessibility="no"
      />

      <View
        ref={panelRef}
        role="dialog"
        accessibilityLabel="New deck"
        accessibilityViewIsModal
        style={{
          width: '100%',
          maxHeight,
          overflow: 'hidden',
          borderTopLeftRadius: radii.sheet,
          borderTopRightRadius: radii.sheet,
          borderCurve: 'continuous',
          backgroundColor: glass.sheet,
        }}
      >
        <View
          style={{
            height: 64,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 8,
              left: 0,
              right: 0,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: sheet.handleWidth,
                height: sheet.handleHeight,
                borderRadius: sheet.handleHeight / 2,
                backgroundColor: colors.outlineVariant,
              }}
            />
          </View>
          <AppText
            variant="headline"
            weight="semibold"
            headingLevel={1}
            numberOfLines={1}
            style={{ flex: 1, paddingTop: 8 }}
          >
            New deck
          </AppText>
          <IconButton
            icon="close"
            size="sm"
            glyphSize={iconSize.md}
            onPress={closeSheet}
            accessibilityLabel="Close sheet"
          />
        </View>

        <ScrollView
          style={{ flexShrink: 1, minHeight: 0 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ gap: 20 }}>
            <Surface tone="pane" radius="card" padding="md" style={{ gap: 16 }}>
              <Field
                label="Name"
                value={name}
                onChangeText={(next) => {
                  setName(next);
                  setNameEdited(true);
                  setSaveError(null);
                }}
                placeholder="Deck name"
              />

              {nameError && (
                <AppText
                  variant="caption"
                  style={{ color: colors.error, marginTop: -8 }}
                  accessibilityLiveRegion="polite"
                >
                  {nameError}
                </AppText>
              )}

              <Field
                label="Description"
                value={description}
                onChangeText={setDescription}
                placeholder="Optional"
                multiline
                tall
              />
            </Surface>

            <AppearancePicker
              icon={icon}
              color={color}
              onIconChange={(next) => {
                setIcon(next);
                setSaveError(null);
              }}
              onColorChange={(next) => {
                setColor(next);
                setSaveError(null);
              }}
            />
          </View>
        </ScrollView>

        <View
          style={{
            gap: 10,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: Math.max(20, insets.bottom + 12),
            backgroundColor: glass.sheet,
          }}
        >
          {saveError && (
            <AppText
              variant="caption"
              style={{ color: colors.error }}
              accessibilityLiveRegion="polite"
            >
              {saveError}
            </AppText>
          )}
          <ActionButton
            label="Create deck"
            onPress={createDeck}
            disabled={!canCreate}
          />
          <ActionButton
            label="Cancel"
            tone="quiet"
            onPress={closeSheet}
            disabled={creating}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
