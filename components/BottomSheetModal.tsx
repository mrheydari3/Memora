import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentRef, Ref } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import type {
  GestureResponderHandlers,
  LayoutChangeEvent,
  ScrollViewProps,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { AppText } from './AppText';
import { IconButton } from './IconButton';
import {
  colors,
  glass,
  glassFillStrong,
  heights,
  iconSize,
  motion,
  radii,
  shadow,
  sheet,
  veil,
} from '../theme/tokens';
import { timingTo, usePresence } from '../motion';

type SheetPanelProps = {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  /** Renders the 44px close control in the sheet header. */
  onClose?: () => void;
  /** The modal passes a draggable handle; a plain sheet keeps the quiet one. */
  grabber?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  onLayout?: (event: LayoutChangeEvent) => void;
  /** Natural body height, used to keep the body visible at the drag floor. */
  onBodyLayout?: (event: LayoutChangeEvent) => void;
  /**
   * Scrolls the body instead of clipping it. The modal turns this on only while
   * the sheet is resized: at its natural height the body must lay out exactly
   * as a plain view, with no second scrollbar and no layout shift.
   */
  scroll?: boolean;
};

/**
 * SheetPanel — the frosted panel itself: 28px top radius, a grab handle and a
 * 20px inner gutter. Shared by the modal sheet and the add-deck route, which is
 * presented as a sheet by the router. It lifts off the blurred canvas by its
 * fill and its shadow; there is no rule along its top edge.
 */
/**
 * True while the sheet body owns scrolling. Lists read it through
 * `SheetScrollView` so a resized sheet never ends up with two scroll regions.
 */
const SheetScrollContext = createContext(false);

/**
 * A vertical list inside a sheet. At the sheet's natural height it scrolls
 * exactly as before; once the learner resizes the sheet, the body is the only
 * scroll region, so the list grows in place instead of adding a second
 * scrollbar and a two-step scroll chain.
 */
export function SheetScrollView({ style, children, ...rest }: ScrollViewProps) {
  const grows = useContext(SheetScrollContext);
  if (!grows) {
    return (
      <ScrollView {...rest} style={style}>
        {children}
      </ScrollView>
    );
  }
  const growStyle: ViewStyle = { ...(StyleSheet.flatten(style) ?? {}), maxHeight: undefined };
  return <View style={growStyle}>{children}</View>;
}

export function SheetPanel({
  title,
  subtitle,
  children,
  className = '',
  onClose,
  grabber,
  style,
  onLayout,
  onBodyLayout,
  scroll = false,
}: SheetPanelProps) {
  return (
    <View
      className={`rounded-t-2xl px-5 pb-9 ${className}`}
      style={[glassFillStrong, { backgroundColor: glass.sheet }, style as ViewStyle]}
      onLayout={onLayout}
    >
      {grabber ?? (
        <View className="items-center py-3">
          <View
            className="rounded-full bg-hairline-strong"
            style={{ height: sheet.handleHeight, width: sheet.handleWidth }}
          />
        </View>
      )}
      {(title || subtitle || onClose) && (
        <View className="flex-row items-start">
          <View className="flex-1">
            {title && (
              <AppText variant="headline" weight="semibold" className="mb-1" numberOfLines={1}>
                {title}
              </AppText>
            )}
            {subtitle && (
              <AppText variant="bodySm" tone="muted" className="mb-3">
                {subtitle}
              </AppText>
            )}
          </View>
          {/*
            The close affordance is a real button in the header. It used to be
            the backdrop alone — a plain div carrying `aria-label`, which axe
            reports as `aria-prohibited-attr` and which a keyboard user could
            not reach at all.
          */}
          {onClose && (
            <View className="ml-2">
              <IconButton
                icon="close"
                size="sm"
                glyphSize={iconSize.md}
                onPress={onClose}
                accessibilityLabel="Close sheet"
              />
            </View>
          )}
        </View>
      )}
      <SheetScrollContext.Provider value={scroll}>
        {scroll ? (
          // Only the body scrolls, so the grabber, the title and the close control
          // stay pinned to the top edge and never slide under the content.
          <ScrollView
            style={[styles.body, title || subtitle ? styles.bodyOffset : null]}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View className={title || subtitle ? 'mt-3' : ''} onLayout={onBodyLayout}>
            {children}
          </View>
        )}
      </SheetScrollContext.Provider>
    </View>
  );
}

/** The full-width strip that owns the resize gesture. */
function SheetGrabber({
  active,
  stripRef,
  ...handlers
}: { active: boolean; stripRef?: Ref<ComponentRef<typeof View>> } & GestureResponderHandlers) {
  return (
    <View
      ref={stripRef}
      {...handlers}
      className="w-full items-center justify-center"
      style={{ height: heights.hit }}
    >
      <View
        style={{
          height: sheet.handleHeight,
          width: active ? sheet.handleActiveWidth : sheet.handleWidth,
          borderRadius: sheet.handleHeight,
          backgroundColor: active ? colors.primary : colors.hairlineStrong,
        }}
      />
    </View>
  );
}

type BottomSheetModalProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Optional line under the title (counts, context). */
  subtitle?: string;
  children: React.ReactNode;
};

/** Web globals, declared narrowly so nothing else in the app needs DOM types. */
type WebDocument = {
  addEventListener: (type: 'keydown', listener: (event: { key?: string }) => void) => void;
  removeEventListener: (type: 'keydown', listener: (event: { key?: string }) => void) => void;
  body: { style: { overflow: string } };
};

/** The slice of the DOM pointer API the web handle needs. */
type WebPointerNode = {
  addEventListener: (
    type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
    listener: (event: WebPointerEvent) => void
  ) => void;
  removeEventListener: (
    type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
    listener: (event: WebPointerEvent) => void
  ) => void;
  setPointerCapture?: (pointerId: number) => void;
  releasePointerCapture?: (pointerId: number) => void;
  hasPointerCapture?: (pointerId: number) => boolean;
};

type WebPointerEvent = {
  pointerId: number;
  button: number;
  clientY: number;
  timeStamp: number;
  preventDefault: () => void;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/**
 * BottomSheetModal — the standard sheet: a blurred, dimmed canvas behind, a
 * frosted panel in front. Every sheet in the app — deck options, rename, move,
 * language picker, step editor, steppers and the new-deck form — is this
 * component.
 *
 * The scrim is a real blur rather than a flat dark layer, so the page behind a
 * sheet reads as depth and never competes with the panel. The panel is not a
 * native modal animation: it fades the scrim and lifts the panel on the token
 * curve, stays mounted through its exit, and can therefore be dismissed
 * mid-flight without a flash of an empty modal.
 *
 * A hold on the handle and a drag resizes the panel between the viewport's
 * `minHeightRatio` and its own content height; releasing past the floor (or a
 * fast flick at it) closes the sheet. Escape, the header's close control and a
 * press on the scrim close it too.
 */
export function BottomSheetModal({
  visible,
  onClose,
  title,
  subtitle,
  children,
}: BottomSheetModalProps) {
  const { mounted, value } = usePresence(visible, { duration: motion.base });
  const { height: windowHeight } = useWindowDimensions();

  const heightAnim = useRef(new Animated.Value(0)).current;
  const [resized, setResized] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [naturalHeight, setNaturalHeight] = useState(0);
  const [bodyHeight, setBodyHeight] = useState(0);

  const naturalRef = useRef(0);
  const resizedRef = useRef(false);
  const currentRef = useRef(0);
  const startRef = useRef(0);
  const floorRef = useRef(0);
  const maxRef = useRef(0);
  const windowRef = useRef(windowHeight);
  const onCloseRef = useRef(onClose);

  const maxHeight = Math.round(windowHeight * sheet.maxHeightRatio);
  /**
   * The floor leaves every sheet something to drag: a short sheet (the folders
   * sheet is ~260px) sits below the viewport fraction, and using that fraction
   * blindly made it impossible to shrink — only to dismiss.
   */
  const contentHeight =
    naturalHeight > 0 ? naturalHeight : Math.round(windowHeight * sheet.minHeightRatio);
  /**
   * The grabber, the header and the panel's padding cannot scroll, so the floor
   * stops where the body still has room. Without this a short sheet could be
   * dragged until its content area collapsed to nothing.
   */
  const chromeHeight = naturalHeight > 0 && bodyHeight > 0 ? naturalHeight - bodyHeight : 0;
  const floor = Math.min(
    contentHeight,
    Math.max(
      Math.max(
        Math.min(contentHeight, sheet.minDragHeight),
        Math.min(contentHeight - sheet.minShrink, Math.round(windowHeight * sheet.minHeightRatio))
      ),
      chromeHeight + sheet.minBody
    )
  );

  floorRef.current = floor;
  maxRef.current = maxHeight;
  windowRef.current = windowHeight;
  onCloseRef.current = onClose;

  // A sheet that closed for any reason comes back at its natural height.
  useEffect(() => {
    if (visible) return;
    resizedRef.current = false;
    setResized(false);
    setDragging(false);
  }, [visible]);

  /**
   * Escape closes on the web, and the canvas behind an open sheet must not
   * scroll underneath it. Both are restored when the sheet goes away.
   */
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const doc = (globalThis as { document?: WebDocument }).document;
    if (!doc) return;

    const onKeyDown = (event: { key?: string }) => {
      if (event.key === 'Escape') onCloseRef.current();
    };

    doc.addEventListener('keydown', onKeyDown);
    const previousOverflow = doc.body.style.overflow;
    doc.body.style.overflow = 'hidden';

    return () => {
      doc.removeEventListener('keydown', onKeyDown);
      doc.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  /** Release: snap to the floor or to the natural height, or dismiss. */
  const finishDrag = useCallback(
    (dy: number, velocity: number) => {
      setDragging(false);

      const start = startRef.current;
      const minHeight = floorRef.current;
      const natural = naturalRef.current;
      const reached = clamp(start - dy, minHeight, natural);

      const pulledPastFloor = start - dy < minHeight - sheet.closeOverscroll;
      const flickedDownAtFloor = velocity > 1.1 && reached <= minHeight + 1;

      if (pulledPastFloor || flickedDownAtFloor) {
        // Collapse to nothing before handing over, so the panel does not jump
        // back to its full height on the way out.
        void timingTo(heightAnim, 0, { duration: motion.fast, nativeDriver: false }).then(() => {
          resizedRef.current = false;
          setResized(false);
          onCloseRef.current();
        });
        return;
      }

      const target = reached < (minHeight + natural) / 2 ? minHeight : natural;
      currentRef.current = target;

      void timingTo(heightAnim, target, {
        duration: motion.fast,
        nativeDriver: false,
      }).then(() => {
        // Back at its content height, the panel follows its content again.
        if (target === natural) {
          resizedRef.current = false;
          setResized(false);
        }
      });
    },
    [heightAnim]
  );

  /** Shared by the native responder and the web pointer drag. */
  const beginDrag = useCallback(() => {
    const start =
      (resizedRef.current ? currentRef.current : naturalRef.current) ||
      Math.round(windowRef.current * sheet.minHeightRatio);
    startRef.current = start;
    currentRef.current = start;
    heightAnim.setValue(start);
    resizedRef.current = true;
    setResized(true);
    setDragging(true);
  }, [heightAnim]);

  const moveDrag = useCallback(
    (dy: number) => {
      const next = clamp(startRef.current - dy, floorRef.current, naturalRef.current);
      currentRef.current = next;
      heightAnim.setValue(next);
    },
    [heightAnim]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // The strip is dedicated to the gesture, so it may claim the touch.
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 2,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: beginDrag,
        onPanResponderMove: (_event, gesture) => moveDrag(gesture.dy),
        onPanResponderRelease: (_event, gesture) => finishDrag(gesture.dy, gesture.vy),
        onPanResponderTerminate: (_event, gesture) => finishDrag(gesture.dy, gesture.vy),
      }),
    [beginDrag, finishDrag, moveDrag]
  );

  const grabberRef = useRef<ComponentRef<typeof View>>(null);

  /**
   * The web responder system can terminate a gesture without asking once the
   * panel owns a scroll view, which left a second drag on a resized sheet dead.
   * The handle therefore owns the pointer itself on the web: pointer capture
   * keeps every move and the release even when the cursor leaves the 44px
   * strip. Native keeps the responder above.
   */
  useEffect(() => {
    if (Platform.OS !== 'web' || !mounted) return;
    const node = grabberRef.current as unknown as WebPointerNode | null;
    if (!node) return;

    let pointerId: number | null = null;
    let startY = 0;
    let lastY = 0;
    let lastTime = 0;
    let velocity = 0;

    const onPointerDown = (event: WebPointerEvent) => {
      if (pointerId !== null || event.button !== 0) return;
      pointerId = event.pointerId;
      startY = event.clientY;
      lastY = startY;
      lastTime = event.timeStamp;
      velocity = 0;
      beginDrag();
      node.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    };

    const onPointerMove = (event: WebPointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const elapsed = event.timeStamp - lastTime;
      if (elapsed > 0) velocity = (event.clientY - lastY) / elapsed;
      lastY = event.clientY;
      lastTime = event.timeStamp;
      moveDrag(event.clientY - startY);
    };

    const endPointerDrag = (event: WebPointerEvent) => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      if (node.hasPointerCapture?.(event.pointerId)) {
        node.releasePointerCapture?.(event.pointerId);
      }
      finishDrag(event.clientY - startY, velocity);
    };

    node.addEventListener('pointerdown', onPointerDown);
    node.addEventListener('pointermove', onPointerMove);
    node.addEventListener('pointerup', endPointerDrag);
    node.addEventListener('pointercancel', endPointerDrag);

    return () => {
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('pointermove', onPointerMove);
      node.removeEventListener('pointerup', endPointerDrag);
      node.removeEventListener('pointercancel', endPointerDrag);
    };
  }, [beginDrag, finishDrag, mounted, moveDrag]);

  /**
   * Natural height is measured only while the panel owns its height. Once the
   * learner has resized it, the layout reports the fixed height and must not be
   * mistaken for the content's own.
   */
  const handlePanelLayout = (event: LayoutChangeEvent) => {
    if (resizedRef.current) return;
    const next = event.nativeEvent.layout.height;
    naturalRef.current = next;
    setNaturalHeight((previous) => (Math.abs(previous - next) < 0.5 ? previous : next));
  };

  const handleBodyLayout = (event: LayoutChangeEvent) => {
    if (resizedRef.current) return;
    const next = event.nativeEvent.layout.height;
    setBodyHeight((previous) => (Math.abs(previous - next) < 0.5 ? previous : next));
  };

  if (!mounted) return null;

  const translateY = value.interpolate({ inputRange: [0, 1], outputRange: [96, 0] });
  const scale = value.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] });
  const panelOpacity = value.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0, 1, 1],
  });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        {/* The scrim: a frosted layer plus a fixed ink wash, both faded in. */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { opacity: value }]}
        >
          <BlurView
            intensity={sheet.scrimBlur}
            tint="dark"
            style={StyleSheet.absoluteFill}
            blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: veil, opacity: sheet.scrimDim },
            ]}
          />
        </Animated.View>

        {/* The scrim still dismisses a pointer press, but it is decoration for
            assistive tech: the header's close button is the accessible one. */}
        <Pressable className="flex-1" onPress={onClose} accessible={false} />

        <Animated.View
          style={[
            styles.panel,
            {
              maxHeight,
              opacity: panelOpacity,
              transform: [{ translateY }, { scale }],
            },
            resized ? { height: heightAnim } : null,
          ]}
        >
          <SheetPanel
            title={title}
            subtitle={subtitle}
            onClose={onClose}
            onLayout={handlePanelLayout}
            onBodyLayout={handleBodyLayout}
            style={resized ? styles.fill : undefined}
            scroll={resized}
            grabber={
              <SheetGrabber
                active={dragging}
                stripRef={grabberRef}
                {...(Platform.OS === 'web' ? {} : panResponder.panHandlers)}
              />
            }
          >
            {children}
          </SheetPanel>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: {
    overflow: 'hidden',
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    borderCurve: 'continuous',
    boxShadow: shadow.card,
  },
  fill: {
    flex: 1,
  },
  // `minHeight: 0` lets the scroll view shrink inside the fixed-height panel
  // instead of forcing its content height onto the flex column.
  body: {
    flex: 1,
    minHeight: 0,
  },
  /** Matches the plain body's `mt-3`, so the switch never shifts the content. */
  bodyOffset: {
    marginTop: 12,
  },
});
