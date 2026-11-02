import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { IconButton } from './IconButton';
import { glassFillStrong, iconSize, motion, veil } from '../theme/tokens';
import { usePresence } from '../motion';

type SheetPanelProps = {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  /** Renders the 44px close control in the sheet header. */
  onClose?: () => void;
};

/**
 * SheetPanel — the frosted panel itself: 28px top radius, a grab handle and a
 * 20px inner gutter. Shared by the modal sheet and the add-deck route, which is
 * presented as a sheet by the router. It lifts off the dimmed canvas by its
 * fill and shadow; there is no rule along its top edge.
 */
export function SheetPanel({
  title,
  subtitle,
  children,
  className = '',
  onClose,
}: SheetPanelProps) {
  return (
    <View
      className={`rounded-t-2xl px-5 pb-9 ${className}`}
      style={glassFillStrong}
    >
      <View className="items-center py-3">
        <View className="rounded-full bg-hairline-strong" style={{ height: 4, width: 40 }} />
      </View>
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
      <View className={title || subtitle ? 'mt-3' : ''}>{children}</View>
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

/**
 * BottomSheetModal — the standard sheet: dimmed canvas behind, frosted panel in
 * front. Every sheet in the app — deck options, rename, move, language picker,
 * step editor, steppers and the new-deck form — is this component.
 *
 * The panel is not a native modal animation: it fades the canvas and lifts the
 * panel on the token curve, stays mounted through its exit, and can therefore be
 * dismissed mid-flight without a flash of an empty modal.
 */
export function BottomSheetModal({
  visible,
  onClose,
  title,
  subtitle,
  children,
}: BottomSheetModalProps) {
  const { mounted, value } = usePresence(visible, { duration: motion.base });

  if (!mounted) return null;

  const backdropOpacity = value.interpolate({ inputRange: [0, 1], outputRange: [0, 0.64] });
  const translateY = value.interpolate({ inputRange: [0, 1], outputRange: [72, 0] });
  const panelOpacity = value.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: veil, opacity: backdropOpacity }]}
        />
        {/* The backdrop still dismisses a pointer press, but it is decoration
            for assistive tech: the header's close button is the accessible one. */}
        <Pressable className="flex-1" onPress={onClose} accessible={false} />
        <Animated.View style={{ opacity: panelOpacity, transform: [{ translateY }] }}>
          <SheetPanel title={title} subtitle={subtitle} onClose={onClose}>
            {children}
          </SheetPanel>
        </Animated.View>
      </View>
    </Modal>
  );
}
