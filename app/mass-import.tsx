import { Platform, View, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '../components/Icon';
import { AppText, RevealItem, Screen, TopAppBar } from '../components';
import { alpha, colors, glassFill, iconSize, rims } from '../theme/tokens';
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

/**
 * The page is static, so the scroll pane has no control to focus and axe's
 * scrollable-region-focusable rule fails. The pass is the page's main object;
 * making it a named, focusable region gives keyboard users a way to reach and
 * scroll the pane, and the global :focus-visible ring shows where they are.
 */
const PASS_FOCUS_PROPS: object =
  Platform.OS === 'web'
    ? { tabIndex: 0, role: 'region', 'aria-label': 'Intake pass' }
    : {};

function Stamp({
  label,
  color,
  rotate = -2,
}: {
  label: string;
  color: string;
  rotate?: number;
}) {
  return (
    <View
      style={{
        transform: [{ rotate: `${rotate}deg` }],
        borderRadius: 5,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: alpha(color, 0.5),
        backgroundColor: alpha(color, 0.06),
        paddingHorizontal: 8,
        paddingVertical: 4,
        alignSelf: 'flex-start',
      }}
    >
      <AppText
        variant="caption"
        weight="bold"
        style={{ color, letterSpacing: 0.9, textTransform: 'uppercase' }}
      >
        {label}
      </AppText>
    </View>
  );
}

/** The round intake stamp in the masthead, decorative and hidden from AT. */
function IntakeSeal() {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 88,
        height: 88,
        borderRadius: 44,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: alpha(colors.warning, 0.5),
        backgroundColor: alpha(colors.warning, 0.05),
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: '-7deg' }],
        flexShrink: 0,
      }}
    >
      <MaterialIcons name="move-to-inbox" size={iconSize.sm} color={colors.warning} />
      <AppText
        variant="caption"
        weight="bold"
        style={{ color: colors.warning, letterSpacing: 1.2, marginTop: 2 }}
      >
        INTAKE
      </AppText>
      <AppText variant="caption" tone="muted" style={{ letterSpacing: 0.8 }}>
        LATER
      </AppText>
    </View>
  );
}

function RoomSection({
  index,
  label,
  hint,
  color,
  first = false,
  children,
}: {
  index: string;
  label: string;
  hint: string;
  color: string;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: first ? 0 : 28 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View
          style={{
            minWidth: 30,
            minHeight: 30,
            borderRadius: 9,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: alpha(color, 0.55),
            backgroundColor: alpha(color, 0.08),
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
          }}
        >
          <AppText
            variant="caption"
            weight="bold"
            style={{ color, fontVariant: ['tabular-nums'] }}
          >
            {index}
          </AppText>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText
            variant="label"
            weight="semibold"
            headingLevel={2}
            style={{ color, letterSpacing: 1.2 }}
          >
            {label}
          </AppText>
          <AppText variant="caption" tone="muted" style={{ marginTop: 1 }}>
            {hint}
          </AppText>
        </View>
      </View>

      <View
        style={{
          height: 1,
          backgroundColor: alpha(color, 0.18),
          marginTop: 10,
          marginBottom: 10,
        }}
      />

      <View
        style={[
          glassFill,
          {
            borderRadius: 24,
            borderTopWidth: 1,
            borderTopColor: rims.soft,
            borderBottomWidth: 1,
            borderBottomColor: colors.outlineVariant,
            overflow: 'hidden',
          },
        ]}
      >
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: alpha(color, 0.55),
          }}
        />
        {children}
      </View>
    </View>
  );
}

function StatusTag({
  label,
  color,
  marginTop = 6,
}: {
  label: string;
  color: string;
  marginTop?: number;
}) {
  return (
    <View
      style={{
        marginTop,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: alpha(color, 0.3),
        backgroundColor: alpha(color, 0.06),
        borderRadius: 5,
        paddingHorizontal: 6,
        paddingVertical: 2,
      }}
    >
      <AppText
        variant="caption"
        weight="semibold"
        style={{ color, letterSpacing: 0.4 }}
      >
        {label}
      </AppText>
    </View>
  );
}

function SourceRow({
  icon,
  title,
  format,
  last,
}: {
  icon: IconName;
  title: string;
  format: string;
  last: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        minHeight: 64,
        padding: 16,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: alpha(colors.onSurface, 0.07),
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(colors.success, 0.12),
          flexShrink: 0,
          alignSelf: 'flex-start',
        }}
      >
        <MaterialIcons name={icon} size={iconSize.md} color={colors.success} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="body" weight="medium">
          {title}
        </AppText>
        <AppText variant="bodySm" tone="muted" style={{ marginTop: 3 }}>
          {format}
        </AppText>
        <StatusTag label="On hold" color={colors.warning} />
      </View>
    </View>
  );
}

function ParserRow() {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        padding: 16,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(colors.warning, 0.12),
          flexShrink: 0,
          alignSelf: 'flex-start',
        }}
      >
        <MaterialIcons name="construction" size={iconSize.md} color={colors.warning} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="body" weight="medium">
          File parser
        </AppText>
        <AppText variant="bodySm" tone="muted" style={{ marginTop: 3 }}>
          Anki, Quizlet and spreadsheet parsing are not wired up yet.
        </AppText>
        <StatusTag label="Pending" color={colors.warning} />
      </View>
    </View>
  );
}

/** One step of the planned intake route inside the pass. */
function IntakeStep({
  index,
  icon,
  title,
  body,
}: {
  index: string;
  icon: IconName;
  title: string;
  body: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
      <View
        style={{
          minWidth: 30,
          minHeight: 30,
          borderRadius: 9,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: alpha(colors.warning, 0.45),
          backgroundColor: alpha(colors.warning, 0.06),
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 4,
          flexShrink: 0,
        }}
      >
        <AppText
          variant="caption"
          weight="bold"
          style={{ color: colors.warning, fontVariant: ['tabular-nums'] }}
        >
          {index}
        </AppText>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <MaterialIcons
            name={icon}
            size={iconSize.sm}
            color={colors.warning}
            style={{ marginTop: 3 }}
          />
          <AppText variant="body" weight="medium" style={{ flexShrink: 1 }}>
            {title}
          </AppText>
        </View>
        <AppText variant="bodySm" tone="muted" style={{ marginTop: 2 }}>
          {body}
        </AppText>
      </View>
    </View>
  );
}

function IntakeConnector() {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 1,
        height: 14,
        marginLeft: 14,
        marginVertical: 4,
        borderLeftWidth: 1,
        borderStyle: 'dashed',
        borderLeftColor: alpha(colors.onSurface, 0.18),
      }}
    />
  );
}

function DeskNote() {
  return (
    <View
      style={{
        marginTop: 24,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: alpha(colors.warning, 0.24),
        backgroundColor: alpha(colors.warning, 0.04),
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        transform: [{ rotate: '-0.6deg' }],
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(colors.warning, 0.12),
          flexShrink: 0,
        }}
      >
        <MaterialIcons name="construction" size={iconSize.sm} color={colors.warning} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText
          variant="caption"
          weight="bold"
          style={{ color: colors.warning, letterSpacing: 1 }}
        >
          Desk note
        </AppText>
        <AppText variant="bodySm" tone="muted" style={{ marginTop: 3 }}>
          File parsing is not wired up yet, so importing is disabled for now. The desk is
          ready; the parser is not.
        </AppText>
      </View>
    </View>
  );
}

export default function MassImportScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const ledger: { label: string; value: string; warning?: boolean }[] = [
    { label: 'Sources', value: '03' },
    { label: 'Formats', value: 'APKG · CSV · XLSX' },
    { label: 'Parser', value: 'Not wired', warning: true },
  ];

  const masthead = (
    <View style={{ paddingBottom: 8 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialIcons name="auto-awesome" size={iconSize.sm} color={colors.success} />
            <AppText
              variant="caption"
              weight="bold"
              style={{ color: colors.success, letterSpacing: 1.4 }}
            >
              Data room · 05.4
            </AppText>
          </View>
        </View>
        <IntakeSeal />
      </View>

      <AppText variant="title" headingLevel={2} style={{ marginTop: 8 }}>
        The intake desk.
      </AppText>
      <AppText variant="bodySm" tone="muted" style={{ marginTop: 6, maxWidth: 540 }}>
        Anki, Quizlet and spreadsheet exports will land here. The desk is ready; the parser
        is not.
      </AppText>
    </View>
  );

  const intakePass = (
    <View {...PASS_FOCUS_PROPS} style={{ position: 'relative' }}>
      <View
        style={[
          glassFill,
          {
            borderRadius: v2.radii.pane,
            borderTopWidth: 1,
            borderTopColor: rims.soft,
            borderBottomWidth: 1,
            borderBottomColor: colors.outlineVariant,
            overflow: 'hidden',
          },
        ]}
      >
        <View
          style={{
            position: 'absolute',
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: alpha(colors.success, 0.1),
            right: -92,
            top: -108,
          }}
        />
        <View
          style={{
            position: 'absolute',
            width: 170,
            height: 170,
            borderRadius: 85,
            backgroundColor: alpha(colors.warning, 0.06),
            left: -82,
            bottom: -108,
          }}
        />

        <View style={{ padding: v2.spacing.panel }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialIcons
                name="confirmation-number"
                size={iconSize.sm}
                color={colors.success}
              />
              <AppText
                variant="caption"
                weight="bold"
                style={{ color: colors.success, letterSpacing: 1.1 }}
              >
                Intake pass
              </AppText>
            </View>
            <Stamp label="On hold" color={colors.warning} rotate={-2} />
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 8,
              marginTop: 12,
              flexWrap: 'wrap',
            }}
          >
            <AppText variant="headline" headingLevel={2} style={{ flexShrink: 1 }}>
              Bring your cards over.
            </AppText>
            <AppText
              variant="caption"
              tone="muted"
              style={{ letterSpacing: 1, fontVariant: ['tabular-nums'] }}
            >
              PASS 04
            </AppText>
          </View>

          <View
            style={{
              marginTop: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <AppText
              variant="caption"
              weight="bold"
              style={{ color: colors.warning, letterSpacing: 1 }}
            >
              Planned route
            </AppText>
            <AppText variant="caption" tone="muted">
              Nothing imports yet
            </AppText>
          </View>

          <View style={{ marginTop: 10 }}>
            <IntakeStep
              index="01"
              icon="touch-app"
              title="Choose a source"
              body="Anki, Quizlet or a spreadsheet."
            />
            <IntakeConnector />
            <IntakeStep
              index="02"
              icon="visibility"
              title="Preview the cards"
              body="See the count before anything lands."
            />
            <IntakeConnector />
            <IntakeStep
              index="03"
              icon="library-add"
              title="Land in a deck"
              body="Into a deck you choose."
            />
          </View>

          <View
            style={{
              marginTop: 16,
              borderTopWidth: 1,
              borderStyle: 'dashed',
              borderTopColor: alpha(colors.onSurface, 0.18),
              paddingTop: 12,
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            {ledger.map((entry) => (
              <View key={entry.label} style={{ flexGrow: 1, flexBasis: 140, minWidth: 0 }}>
                <AppText variant="caption" tone="muted" style={{ letterSpacing: 0.8 }}>
                  {entry.label}
                </AppText>
                <AppText
                  variant="bodySm"
                  weight="semibold"
                  style={[
                    { marginTop: 2, fontVariant: ['tabular-nums'] },
                    entry.warning ? { color: colors.warning } : null,
                  ]}
                >
                  {entry.value}
                </AppText>
              </View>
            ))}
          </View>

          <View
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTopWidth: 1,
              borderStyle: 'dashed',
              borderTopColor: alpha(colors.onSurface, 0.14),
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
              {Array.from({ length: 14 }).map((_, index) => (
                <View
                  key={index}
                  style={{
                    width: index % 4 === 0 ? 3 : 2,
                    height: index % 3 === 0 ? 14 : 9,
                    backgroundColor: alpha(colors.onSurfaceVariant, 0.45),
                  }}
                />
              ))}
            </View>
            <AppText variant="caption" tone="muted" style={{ letterSpacing: 1 }}>
              SHELF 05.4
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );

  const sourcesSection = (
    <RoomSection
      index="01"
      label="Sources"
      hint="Anki · Quizlet · CSV"
      color={colors.success}
      first
    >
      {SOURCES.map((source, index) => (
        <SourceRow
          key={source.id}
          icon={source.icon}
          title={source.title}
          format={source.format}
          last={index === SOURCES.length - 1}
        />
      ))}
    </RoomSection>
  );

  const parserSection = (
    <RoomSection index="02" label="Parser" hint="Not wired yet" color={colors.warning}>
      <ParserRow />
    </RoomSection>
  );

  const sections = (
    <View>
      {sourcesSection}
      {parserSection}
    </View>
  );

  return (
    <Screen
      scroll
      gutter
      contentMaxWidth={v2.layout.contentMaxWidth}
      header={<TopAppBar title="Import" back />}
    >
      <View style={{ paddingBottom: 48 }}>
        <RevealItem index={0}>{masthead}</RevealItem>

        <View
          style={{
            marginTop: 24,
            flexDirection: wide ? 'row' : 'column',
            alignItems: wide ? 'flex-start' : 'stretch',
            gap: wide ? 32 : 24,
          }}
        >
          <View style={{ width: wide ? 400 : undefined, flexShrink: 0 }}>
            <RevealItem index={1}>{intakePass}</RevealItem>
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <RevealItem index={2}>{sections}</RevealItem>
            <RevealItem index={3}>
              <DeskNote />
            </RevealItem>
          </View>
        </View>
      </View>
    </Screen>
  );
}
