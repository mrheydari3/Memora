import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '../components/Icon';
import { Pill, RevealItem, Screen } from '../components';
import {
  PageHeader,
  SettingsChapter,
  SettingsFootnote,
  SettingsHero,
  SettingsLine,
} from '../components/v3';
import { goBackOr } from '../services/navigation';
import { colors } from '../theme/tokens';
import { v3 } from '../theme/v3';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

const SOURCES: {
  id: string;
  title: string;
  format: string;
  icon: IconName;
}[] = [
  { id: 'anki', title: 'Anki', format: '.apkg / .colpkg files', icon: 'school' },
  { id: 'quizlet', title: 'Quizlet', format: 'URL or export file', icon: 'language' },
  { id: 'csv', title: 'CSV / Excel', format: '.csv / .xlsx files', icon: 'description' },
];

/** The route the importer will take, in reading order. */
const STEPS: { index: string; title: string; body: string; icon: IconName }[] = [
  { index: '01', title: 'Choose a source', body: 'Anki, Quizlet or a spreadsheet.', icon: 'touch-app' },
  { index: '02', title: 'Preview the cards', body: 'See the count before anything lands.', icon: 'visibility' },
  { index: '03', title: 'Land in a deck', body: 'Into a deck you choose.', icon: 'library-add' },
];

/**
 * Import — what the intake desk will accept, and what it cannot do yet.
 *
 * The page follows the v3 settings rhythm: one hero with the intake state, then
 * chapters for the sources, the parser and the planned route. Every line is a
 * `SettingsLine`, status is a `Pill`, and the closing caveat is a
 * `SettingsFootnote`. The parser is still honestly absent; no control pretends
 * a file can be chosen or imported.
 */
export default function MassImportScreen() {
  const router = useRouter();

  return (
    <Screen
      scroll
      gutter
      contentMaxWidth={v3.layout.contentMaxWidth}
      header={
        <PageHeader
          title="Import"
          back
          onBack={() => goBackOr(router, '/(tabs)/home')}
        />
      }
    >
      <View style={{ paddingBottom: 24 }}>
        <View style={{ gap: 28 }}>
          <RevealItem index={0}>
            <SettingsHero
              testID="import-hero"
              eyebrow="Data room"
              status={{ label: 'Planned', tone: 'muted' }}
              title="Bring your cards over."
              description="Anki, Quizlet and spreadsheet exports will land here. The desk is ready; the parser is not."
              ledger={[
                { label: 'Sources', value: String(SOURCES.length) },
                { label: 'Formats', value: '3 types' },
                { label: 'Parser', value: 'Not wired' },
              ]}
            />
          </RevealItem>

          <RevealItem index={1}>
            <SettingsChapter label="Sources">
              {SOURCES.map((source, index) => (
                <SettingsLine
                  key={source.id}
                  icon={source.icon}
                  tone={colors.info}
                  title={source.title}
                  subtitle={source.format}
                  trailing={<Pill label="On hold" tone="warning" />}
                  last={index === SOURCES.length - 1}
                />
              ))}
            </SettingsChapter>
          </RevealItem>

          <RevealItem index={2}>
            <SettingsChapter label="Parser">
              <SettingsLine
                icon="construction"
                tone={colors.warning}
                title="File parser"
                subtitle="Not wired up yet."
                trailing={<Pill label="Pending" tone="warning" />}
                last
              />
            </SettingsChapter>
          </RevealItem>

          <RevealItem index={3}>
            <SettingsChapter label="Planned route">
              {STEPS.map((step, index) => (
                <SettingsLine
                  key={step.index}
                  icon={step.icon}
                  tone={colors.info}
                  title={step.title}
                  subtitle={step.body}
                  value={step.index}
                  last={index === STEPS.length - 1}
                />
              ))}
            </SettingsChapter>
          </RevealItem>

          <SettingsFootnote icon="info-outline">
            Importing stays disabled until the file parser lands. The decks, cards and review history
            already on this device are untouched.
          </SettingsFootnote>
        </View>
      </View>
    </Screen>
  );
}
