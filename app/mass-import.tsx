import { MaterialIcons } from '../components/Icon';
import {
  Pill,
  RevealItem,
  Screen,
  SettingsNote,
  SettingsPlate,
  SettingsRow,
  SettingsSection,
  TopAppBar,
} from '../components';
import { v2 } from '../theme/v2';

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
 * The page follows the settings rhythm like every other data screen: one plate
 * with the state of the intake, then chapters for the sources, the parser and
 * the planned route. Every line is a standard setting row, status is a `Pill`,
 * and the closing caveat is a `SettingsNote`. There are no stamps, seals, room
 * numbers or dashed frames — the shared fills and spacing carry the page, so it
 * reads as part of the same app as Settings and Offline.
 */
export default function MassImportScreen() {
  return (
    <Screen
      scroll
      gutter
      contentMaxWidth={v2.layout.contentMaxWidth}
      header={<TopAppBar title="Import" back backFallback="/(tabs)/home" />}
    >
      <RevealItem index={0}>
        <SettingsPlate
          tone="glass"
          icon="move-to-inbox"
          eyebrow="Data room"
          title="Bring your cards over."
          description="Anki, Quizlet and spreadsheet exports will land here. The desk is ready; the parser is not."
          status={{ label: 'Planned', tone: 'warning' }}
          ledger={[
            { label: 'Sources', value: String(SOURCES.length) },
            { label: 'Formats', value: 'APKG · CSV · XLSX' },
            { label: 'Parser', value: 'Not wired' },
          ]}
        />
      </RevealItem>

      <SettingsSection label="Sources" index={1} hint={String(SOURCES.length)}>
        {SOURCES.map((source) => (
          <SettingsRow
            key={source.id}
            icon={source.icon}
            iconTone="info"
            title={source.title}
            subtitle={source.format}
            trailing={<Pill label="On hold" tone="warning" />}
          />
        ))}
      </SettingsSection>

      <SettingsSection label="Parser" index={2}>
        <SettingsRow
          icon="construction"
          iconTone="warning"
          title="File parser"
          subtitle="Anki, Quizlet and spreadsheet parsing are not wired up yet."
          trailing={<Pill label="Pending" tone="warning" />}
          isLast
        />
      </SettingsSection>

      <SettingsSection label="Planned route" index={3} hint="Nothing imports yet">
        {STEPS.map((step) => (
          <SettingsRow
            key={step.index}
            icon={step.icon}
            iconTone="info"
            title={step.title}
            subtitle={step.body}
            value={step.index}
          />
        ))}
      </SettingsSection>

      <SettingsNote icon="info-outline">
        Importing stays disabled until the file parser lands. The decks, cards and review history
        already on this device are untouched.
      </SettingsNote>
    </Screen>
  );
}
