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
import { MaterialIcons } from '../components/Icon';
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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const desktop = windowWidth >= 1024;
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
  const desktopPanelHeight =
    windowHeight > 0 ? Math.min(760, Math.max(0, windowHeight - 64)) : undefined;

  const detailsPane = (
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
  );

  const appearancePane = (
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
  );

  const deckPreview = (
    <Surface tone="pane" radius="card" padding="md" style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: radii.control,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alpha(color, 0.14),
          }}
        >
          <MaterialIcons
            name={icon as React.ComponentProps<typeof MaterialIcons>['name']}
            size={iconSize.lg}
            color={color}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <AppText variant="body" weight="semibold" numberOfLines={1}>
            {trimmedName || 'Untitled deck'}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {description.trim() || 'No description yet'} · 0 cards
          </AppText>
        </View>
      </View>
      <AppText variant="caption" tone="tertiary">
        A preview of this deck’s tile on Home.
      </AppText>
    </Surface>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{
        flex: 1,
        justifyContent: desktop ? 'center' : 'flex-end',
        alignItems: desktop ? 'center' : undefined,
        padding: desktop ? 32 : 0,
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
          maxWidth: desktop ? 960 : undefined,
          height: desktop ? desktopPanelHeight : undefined,
          maxHeight: desktop ? desktopPanelHeight : maxHeight,
          overflow: 'hidden',
          borderTopLeftRadius: radii.sheet,
          borderTopRightRadius: radii.sheet,
          borderBottomLeftRadius: desktop ? radii.sheet : 0,
          borderBottomRightRadius: desktop ? radii.sheet : 0,
          borderCurve: 'continuous',
          backgroundColor: glass.sheet,
        }}
      >
        <View
          style={{
            minHeight: desktop ? 78 : 64,
            paddingHorizontal: desktop ? 28 : 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: desktop ? 12 : 0,
          }}
        >
          {!desktop && (
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
          )}
          <View style={{ flex: 1, gap: 2, paddingTop: desktop ? 0 : 8 }}>
            <AppText variant="headline" weight="semibold" headingLevel={1} numberOfLines={1}>
              New deck
            </AppText>
            {desktop && (
              <AppText variant="bodySm" tone="muted">
                Name it, give it a face, then add cards.
              </AppText>
            )}
          </View>
          <IconButton
            icon="close"
            size="sm"
            glyphSize={iconSize.md}
            onPress={closeSheet}
            accessibilityLabel="Close sheet"
          />
        </View>

        <ScrollView
          style={desktop ? { flex: 1, minHeight: 0 } : { flexShrink: 1, minHeight: 0 }}
          contentContainerStyle={{
            paddingHorizontal: desktop ? 28 : 20,
            paddingTop: 4,
            paddingBottom: 16,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {desktop ? (
            <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
              <View style={{ flex: 1, minWidth: 0, gap: 20 }}>
                {deckPreview}
                {detailsPane}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Surface tone="pane" radius="card" padding="md" style={{ gap: 4 }}>
                  <AppText variant="label" tone="tertiary" className="uppercase">
                    Appearance
                  </AppText>
                  <View style={{ marginTop: 14 }}>{appearancePane}</View>
                </Surface>
              </View>
            </View>
          ) : (
            <View style={{ gap: 20 }}>
              {detailsPane}
              {appearancePane}
            </View>
          )}
        </ScrollView>

        <View
          style={{
            gap: 10,
            flexDirection: desktop ? 'row' : 'column',
            justifyContent: desktop ? 'flex-end' : undefined,
            alignItems: desktop ? 'center' : undefined,
            paddingHorizontal: desktop ? 28 : 20,
            paddingTop: 12,
            paddingBottom: desktop ? 24 : Math.max(20, insets.bottom + 12),
            borderTopWidth: desktop ? 1 : 0,
            borderTopColor: desktop ? alpha(colors.outlineSoft, 0.25) : undefined,
            backgroundColor: glass.sheet,
          }}
        >
          {saveError && (
            <AppText
              variant="caption"
              style={{ color: colors.error, flex: desktop ? 1 : undefined }}
              accessibilityLiveRegion="polite"
            >
              {saveError}
            </AppText>
          )}
          {desktop ? (
            <>
              <View style={{ width: 160 }}>
                <ActionButton
                  label="Cancel"
                  tone="quiet"
                  onPress={closeSheet}
                  disabled={creating}
                />
              </View>
              <View style={{ width: 200 }}>
                <ActionButton label="Create deck" onPress={createDeck} disabled={!canCreate} />
              </View>
            </>
          ) : (
            <>
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
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
