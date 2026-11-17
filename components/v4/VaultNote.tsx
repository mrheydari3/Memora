import { View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { colors } from '../../theme/tokens';
import { v4 } from '../../theme/v4';

/**
 * VaultNote — the one line that says the library is local.
 *
 * It sits after the archive at the root of the shelf only. The lock is teal,
 * the sentence is tertiary ink: a promise, not a feature.
 */
export function VaultNote() {
  return (
    <View
      testID="library-vault-note"
      style={{
        marginTop: v4.layout.vaultGap,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
      }}
    >
      <MaterialIcons name="lock-outline" size={12} color={colors.v4Teal} />
      <AppText style={[v4.type.meta, { color: colors.outline, letterSpacing: 0.1 }]}>
        Your library stays on this device.
      </AppText>
    </View>
  );
}
