import { createContext, useContext, useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import type { LayoutChangeEvent, ScrollViewProps, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { IconButton } from './IconButton';
import { glass, glassFillStrong, iconSize, motion, radii, sheet, veil } from '../theme/tokens';
import { v3 } from '../theme/v3';
import { usePresence } from '../motion';
import { HapticsEngine } from '../services/haptics';

type SheetPanelProps = {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  /** Renders the 44px close control in the sheet header. */
  onClose?: () => void;
  /** Kept for call-site compatibility; sheets no longer carry a drag handle. */
  grabber?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  onLayout?: (event: LayoutChangeEvent) => void;
  /** Kept for call-site compatibility with the old resizable body. */
  onBodyLayout?: (event: LayoutChangeEvent) => void;
  /** Scrolls the body instead of letting a long sheet grow past the viewport. */
  scroll?: boolean;
  /** A centred desktop dialog with the page gutter and all four corners. */
  desktop?: boolean;
};

/** True while the sheet body owns scrolling. Lists read it through `SheetScrollView`. */
const SheetScrollContext = createContext(false);

/**
 * A vertical list inside a sheet. The sheet body is the only scroll region, so a
 * list never adds a second scrollbar and a two-step scroll chain.
 */
export function SheetScrollView({ style, children, ...rest }: ScrollViewProps) {
  const grows = useContext(SheetScrollContext);
  if (!grows) {
    return (
      <ScrollView decelerationRate="normal" scrollEventThrottle={16} {...rest} style={style}>
        {children}
      </ScrollView>
    );
  }
  const growStyle: ViewStyle = { ...(StyleSheet.flatten(style) ?? {}), maxHeight: undefined };
  return <View style={growStyle}>{children}</View>;
}

/**
 * SheetPanel — the sheet surface itself: 28px top radius, a 20px gutter and a
 * quiet header of title, subtitle and one close control.
 *
 * There is no grab handle: a sheet is closed by its header button, the scrim or
 * Escape, never by dragging, so nothing in the panel implies a gesture it does
 * not have.
 */
export function SheetPanel({
  title,
  subtitle,
  children,
  className = '',
  onClose,
  grabber,
  style,
  onLayout,
  scroll = false,
  desktop = false,
}: SheetPanelProps) {
  const hasHeader = Boolean(title || subtitle || onClose);

  return (
    <View
      className={`rounded-t-2xl px-5 pb-8 ${
        hasHeader ? (desktop ? 'pt-7' : 'pt-6') : 'pt-3'
      } ${className}`}
      style={[glassFillStrong, { backgroundColor: glass.sheet }, style as ViewStyle]}
      onLayout={onLayout}
    >
      {grabber}
      {hasHeader && (
        <View className="flex-row items-start">
          <View className="flex-1 pr-2">
            {title && (
              <AppText variant="headline" weight="semibold" numberOfLines={2} headingLevel={1}>
                {title}
              </AppText>
            )}
            {subtitle && (
              <AppText variant="bodySm" tone="muted" className="mt-1.5">
                {subtitle}
              </AppText>
            )}
          </View>
          {onClose && (
            <IconButton
              icon="close"
              size="sm"
              glyphSize={iconSize.md}
              onPress={onClose}
              accessibilityLabel="Close sheet"
            />
          )}
        </View>
      )}
      <SheetScrollContext.Provider value={scroll}>
        {scroll ? (
          // Only the body scrolls, so the header and the close control stay
          // pinned to the top edge and never slide under the content.
          <ScrollView
            style={[styles.body, hasHeader ? styles.bodyOffset : null]}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View className={hasHeader ? 'mt-5' : ''}>{children}</View>
        )}
      </SheetScrollContext.Provider>
    </View>
  );
}

type BottomSheetModalProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Optional line under the title (counts, context). */
  subtitle?: string;
  /**
   * Re-runs focus management when the body swaps while the sheet stays open.
   * Without it the control that had focus can unmount, dropping focus onto the
   * page behind the scrim and out of the dialog.
   */
  focusKey?: string | number;
  /**
   * Escape can step back one nested level instead of dismissing the whole
   * sheet; the scrim and close control still close everything.
   */
  onEscape?: () => void;
  /**
   * A short action or option list: the sheet may stop at its content instead of
   * reserving nearly half the viewport. Forms keep the default tall surface.
   */
  compact?: boolean;
  /**
   * Centre the panel as a desktop dialog with a 960px cap and all four rounded
   * corners. Phone and tablet keep the bottom-docked sheet unchanged.
   */
  desktopLayout?: boolean;
  /** Narrower desktop dialog, for a short option list rather than a form. */
  desktopMaxWidth?: number;
  children: React.ReactNode;
};

/** Web globals, declared narrowly so nothing else in the app needs DOM types. */
type WebElement = {
  focus: () => void;
  contains: (node: WebElement | null) => boolean;
  querySelectorAll: (selector: string) => ArrayLike<WebElement>;
};

type WebKeyEvent = {
  key?: string;
  shiftKey?: boolean;
  preventDefault: () => void;
};

type WebDocument = {
  activeElement: WebElement | null;
  addEventListener: (type: 'keydown', listener: (event: WebKeyEvent) => void) => void;
  removeEventListener: (type: 'keydown', listener: (event: WebKeyEvent) => void) => void;
  body: { style: { overflow: string } };
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role="button"]:not([aria-disabled="true"]), [role="menuitem"]:not([aria-disabled="true"]), [role="menuitemradio"]:not([aria-disabled="true"]), [role="menuitemcheckbox"]:not([aria-disabled="true"]), [role="radio"]:not([aria-disabled="true"]), [role="switch"]:not([aria-disabled="true"]), [role="checkbox"]:not([aria-disabled="true"]), [role="tab"]:not([aria-disabled="true"]), [tabindex]:not([tabindex="-1"])';

/**
 * BottomSheetModal — the standard sheet: a dimmed canvas behind, an opaque panel
 * in front. Every sheet in the app — deck options, rename, move, language
 * picker, step editor, steppers and the new-deck form — is this component.
 *
 * A sheet is not draggable. It enters on the token curve, and it closes from a
 * press on the scrim, the header's close control, Escape (web) or the hardware
 * back button (Android). Because the panel is opaque and the scrim is a flat ink
 * wash, the entrance is the only motion and there is nothing to tug at.
 */
export function BottomSheetModal({
  visible,
  onClose,
  title,
  subtitle,
  focusKey,
  onEscape,
  compact = false,
  desktopLayout = false,
  desktopMaxWidth,
  children,
}: BottomSheetModalProps) {
  const { mounted, value } = usePresence(visible, { duration: motion.base });
  const { height: measuredHeight, width: measuredWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = desktopLayout && measuredWidth >= 1024;

  // One soft tick when a sheet surfaces and one when it is dismissed. The
  // engine's dedupe key means a menu that wraps this sheet never buzzes twice.
  const wasVisibleRef = useRef(false);
  useEffect(() => {
    if (visible === wasVisibleRef.current) return;
    wasVisibleRef.current = visible;
    if (visible) HapticsEngine.modalOpen();
    else HapticsEngine.modalClose();
  }, [visible]);
  /**
   * A browser can report no window height at all — a PWA restored in the
   * background, a phone rotating on open, an embedded webview before layout.
   * An unknown height therefore leaves the panel unclamped instead of
   * collapsing it to nothing.
   */
  const windowHeight =
    Number.isFinite(measuredHeight) && measuredHeight > 0 ? measuredHeight : 0;
  const maxHeight =
    windowHeight > 0
      ? isDesktop
        ? Math.max(0, windowHeight - 64)
        : Math.round(windowHeight * (compact ? 0.82 : sheet.maxHeightRatio))
      : undefined;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;
  const panelRef = useRef<React.ComponentRef<typeof View>>(null);
  const returnFocusRef = useRef<WebElement | null>(null);
  const wasMountedRef = useRef(false);

  /**
   * A sheet is a dialog, not a floating card: focus starts inside it, Tab cycles
   * through its controls, and the trigger regains focus when it closes. Without
   * this the browser leaves focus on the page behind the scrim, so a keyboard
   * user tabs through content they cannot see.
   */
  useEffect(() => {
    if (!visible || !mounted || Platform.OS !== 'web') return;
    const doc = (globalThis as { document?: WebDocument }).document;
    const panel = panelRef.current as unknown as WebElement | null;
    if (!doc || !panel) return;

    // A content swap while open must not replace the trigger the sheet returns
    // focus to; only the first pass (or a fresh open) records it.
    if (!returnFocusRef.current) returnFocusRef.current = doc.activeElement;

    const focusable = () => Array.from(panel.querySelectorAll(FOCUSABLE));
    const first = () => focusable()[0] ?? panel;
    first().focus();

    const onKeyDown = (event: WebKeyEvent) => {
      if (event.key !== 'Tab') return;

      const items = focusable();
      const active = doc.activeElement;
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (!active || !panel.contains(active) || active === panel) {
        event.preventDefault();
        firstItem.focus();
      } else if (event.shiftKey && active === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && active === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    doc.addEventListener('keydown', onKeyDown);
    return () => doc.removeEventListener('keydown', onKeyDown);
  }, [visible, mounted, focusKey]);

  /**
   * Wait for the exit animation to unmount the modal before returning focus.
   * The browser has already removed the sheet's controls by then; focusing the
   * trigger earlier lets the modal's own teardown drop focus back to the body.
   */
  useEffect(() => {
    if (mounted) {
      wasMountedRef.current = true;
      return;
    }
    if (!wasMountedRef.current) return;
    wasMountedRef.current = false;
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    target?.focus?.();
  }, [mounted]);

  /**
   * Escape closes on the web, and the canvas behind an open sheet must not
   * scroll underneath it. Both are restored when the sheet goes away.
   */
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const doc = (globalThis as { document?: WebDocument }).document;
    if (!doc) return;

    const onKeyDown = (event: WebKeyEvent) => {
      if (event.key === 'Escape') (onEscapeRef.current ?? onCloseRef.current)();
    };

    doc.addEventListener('keydown', onKeyDown);
    const previousOverflow = doc.body.style.overflow;
    doc.body.style.overflow = 'hidden';

    return () => {
      doc.removeEventListener('keydown', onKeyDown);
      doc.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  if (!mounted) return null;

  // One translate, no scale: the panel rises into place without appearing to
  // grow, which is what makes a sheet read as a surface rather than a card.
  const translateY = value.interpolate({ inputRange: [0, 1], outputRange: [72, 0] });
  const panelOpacity = value.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] });

  const renderPanel = () => (
    <Animated.View
      style={[
        styles.panel,
        isDesktop ? styles.desktopPanel : null,
        isDesktop && desktopMaxWidth ? { maxWidth: desktopMaxWidth } : null,
        {
          maxHeight,
          // A short sheet still reads as a surface rather than a strip,
          // unless it is a compact menu: those size to their own content.
          minHeight:
            !compact && !isDesktop && windowHeight > 0
              ? Math.round(windowHeight * sheet.minHeightRatio)
              : undefined,
          opacity: panelOpacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View ref={panelRef} tabIndex={-1}>
        <SheetPanel
          title={title}
          subtitle={subtitle}
          onClose={onClose}
          desktop={isDesktop}
          style={{
            paddingBottom: Math.max(
              compact ? 20 : 32,
              insets.bottom + (compact ? 12 : 16)
            ),
          }}
        >
          {children}
        </SheetPanel>
      </View>
    </Animated.View>
  );

  return (
    <Modal
      visible
      transparent
      animationType="none"
      // Web's ModalContent dismisses on Escape keyup, which would bypass a
      // nested sheet's level-aware handler. Web uses the keydown listener
      // below; native keeps the hardware back button.
      onRequestClose={Platform.OS === 'web' ? undefined : onClose}
      statusBarTranslucent
      accessibilityLabel={title ?? 'Options'}
    >
      <View style={{ flex: 1 }}>
        {/*
          The scrim: a flat ink wash, faded in with the panel. It stays in the
          modal's lowest layer so the panel always paints over it.
        */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: value }]}
        >
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: veil, opacity: sheet.scrimDim }]}
          />
        </Animated.View>

        {/* The scrim dismisses a pointer press, but it is decoration for
            assistive tech: the header's close button is the accessible one. */}
        <Pressable className="flex-1" onPress={onClose} accessible={false} />

        {isDesktop ? (
          <View style={styles.desktopStage} pointerEvents="box-none">
            {renderPanel()}
          </View>
        ) : (
          renderPanel()
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    zIndex: 0,
    ...(Platform.OS === 'web' ? ({ isolation: 'isolate' } as unknown as ViewStyle) : {}),
  },
  panel: {
    zIndex: 1,
    overflow: 'hidden',
    // Full-bleed on a phone, a centred surface on a wide canvas: a sheet that
    // stretched to 1280px would read as a second page, not as a sheet.
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    // Docked to the bottom edge: only the top corners are round, so the sheet
    // reads as the surface the page slides under.
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    borderCurve: 'continuous',
    backgroundColor: glass.sheet,
  },
  desktopStage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  desktopPanel: {
    // Match the Game/Settings desktop column, including its 20px page gutter.
    maxWidth: v3.layout.contentMaxWidth,
    // A dialog is a complete surface: unlike the docked sheet, it rounds both
    // ends so it reads as centred on the canvas rather than sliding under it.
    borderBottomLeftRadius: radii.sheet,
    borderBottomRightRadius: radii.sheet,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  /** Matches the plain body's `mt-5`, so the switch never shifts the content. */
  bodyOffset: {
    marginTop: 20,
  },
});
