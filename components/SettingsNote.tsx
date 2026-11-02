import { View } from 'react-native';
import { MaterialIcons } from './Icon';
import { AppText } from './AppText';
import { colors, iconSize } from '../theme/tokens';

type SettingsNoteProps = {
  children: React.ReactNode;
  icon?: React.ComponentProps<typeof MaterialIcons>['name'];
  className?: string;
};

/**
 * SettingsNote — the quiet explanation under a settings group: a small glyph
 * and one paragraph, separated by space rather than a rule. Every settings
 * screen ends on this note instead of inventing its own floating info row.
 */
export function SettingsNote({ children, icon = 'info-outline', className = '' }: SettingsNoteProps) {
  return (
    <View className={`mt-7 flex-row items-start gap-2 ${className}`}>
      {/* Optical nudge: the 16px glyph sits a hair low next to 13px text. */}
      <MaterialIcons name={icon} size={iconSize.sm} color={colors.outline} style={{ marginTop: 1 }} />
      <AppText variant="bodySm" tone="muted" className="flex-1">
        {children}
      </AppText>
    </View>
  );
}
