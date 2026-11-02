import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { glassFillStrong, motion, veil } from '../theme/tokens';
import { usePresence } from '../motion';

type SheetPanelProps = {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * SheetPanel — the frosted panel itself: 28px top radius, hairline top edge, a
 * grab handle and a 20px inner gutter. Shared by the modal sheet and the
 * add-deck route, which is presented as a sheet by the router.
 */
export function SheetPanel({ title, subtitle, children, className = '' }: SheetPanelProps) {
  return (
    <View
      className={`rounded-t-2xl border-t border-hairline px-5 pb-9 ${className}`}
      style={glassFillStrong}
    >
      <View className="items-center py-3">
        <View className="rounded-full bg-hairline-strong" style={{ height: 4, width: 40 }} />
      </View>
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
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Close sheet" />
        <Animated.View style={{ opacity: panelOpacity, transform: [{ translateY }] }}>
          <SheetPanel title={title} subtitle={subtitle}>
            {children}
          </SheetPanel>
        </Animated.View>
      </View>
    </Modal>
  );
}
