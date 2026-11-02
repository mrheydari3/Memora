import { View } from 'react-native';
import { MaterialIcons } from '../components/Icon';
import { AppText, Screen, TopAppBar, GlassCard, ListRow, RevealItem } from '../components';
import { colors, fills, iconSize } from '../theme/tokens';

const SOURCES = [
  { id: 'anki', title: 'Anki', subtitle: '.apkg / .colpkg files', icon: 'school' },
  { id: 'quizlet', title: 'Quizlet', subtitle: 'URL or export file', icon: 'language' },
  { id: 'csv', title: 'CSV / Excel', subtitle: '.csv / .xlsx files', icon: 'description' },
] as const;

export default function MassImportScreen() {
  return (
    <Screen scroll gutter header={<TopAppBar title="Mass import" back />}>

      <RevealItem index={0}>
        <AppText variant="title">Bring your cards over</AppText>
        <AppText variant="body" tone="muted" className="mt-2">
          Choose a source to import your existing flashcards into Memora.
        </AppText>
      </RevealItem>

      <RevealItem index={1}>
      <GlassCard className="mt-6" padding="none">
        {SOURCES.map((source, i) => (
          <RevealItem key={source.id} index={i}>
          <ListRow
            title={source.title}
            subtitle={source.subtitle}
            icon={source.icon}
            tile="lg"
            density="tall"
            titleWeight="semibold"
            divider={i < SOURCES.length - 1}
            // Not pressable: parsing is not implemented, and a row with a
            // chevron that does nothing on tap reads as a broken control.
            showChevron={false}
          />
          </RevealItem>
        ))}
      </GlassCard>
      </RevealItem>

      <RevealItem index={2}>
      <View
        className="mt-4 flex-row items-start gap-2 rounded-md px-4 py-3"
        style={{ backgroundColor: fills.subtle }}
      >
        <MaterialIcons name="info-outline" size={iconSize.sm} color={colors.outline} />
        <AppText variant="bodySm" tone="muted" className="flex-1">
          File parsing is not wired up yet, so importing is disabled for now.
        </AppText>
      </View>
      </RevealItem>
    </Screen>
  );
}
