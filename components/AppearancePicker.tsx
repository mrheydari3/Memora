import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTextScale } from '../hooks/useTextScale';
import { MaterialIcons } from './Icon';
import { AppText } from './AppText';
import { SearchBar } from './SearchBar';
import { alpha, colors, fills, heights, iconSize, radii } from '../theme/tokens';
import { ICON_GROUPS, iconLabel, iconSearchText } from '../data/appearance';

/**
 * The tints a card, deck or folder may wear, named. All of them are palette
 * tokens: a colour here is user data, not a new design colour, so it is always
 * one of the semantic steps the rest of the app already knows. The labels are
 * what a screen reader and the card-colour filter read out.
 */
export const CARD_COLOR_CHOICES = [
  { value: colors.primary, label: 'Blue' },
  { value: colors.warning, label: 'Amber' },
  { value: colors.error, label: 'Red' },
  { value: colors.success, label: 'Green' },
  { value: colors.secondary, label: 'Grey' },
] as const;

/** The same tints as bare values, for a picker that only needs the colour. */
export const COLOR_CHOICES = CARD_COLOR_CHOICES.map((choice) => choice.value);

type AppearancePickerProps = {
  icon: string;
  color: string;
  onIconChange: (icon: string) => void;
  onColorChange: (color: string) => void;
  /**
   * Fold the icon catalogue behind one summary row until it is opened. The
   * folder sheet uses this so a 65-icon grid never pushes its Create button
   * off the sheet; the deck composer keeps the catalogue visible.
   */
  collapsible?: boolean;
};

/**
 * AppearancePicker — the searchable icon chooser and colour dots shared by a
 * deck and a folder, so the two never grow two different choosers.
 *
 * The 65 icons are grouped by meaning instead of presented as one long grid:
 * language glyphs first (the common case here), then general subjects. Search
 * filters those groups in place and understands aliases such as "math", "audio"
 * and "art", so a learner does not have to know the Material icon name. Every
 * tile remains a 44px target, and the selection is a fill step plus the accent
 * glyph, never an outline.
 */
export function AppearancePicker({
  icon,
  color,
  onIconChange,
  onColorChange,
  collapsible = false,
}: AppearancePickerProps) {
  const { largeText } = useTextScale();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const term = query.trim().toLowerCase().replace(/-/g, ' ');

  const groups = useMemo(
    () =>
      ICON_GROUPS.map((group) => ({
        ...group,
        icons: group.icons.filter((choice) => iconSearchText(choice).includes(term)),
      })).filter((group) => group.icons.length > 0),
    [term]
  );

  const colourBlock = (
    <>
      <AppText variant="label" tone="muted" className="mb-2 mt-5 uppercase">
        Colour
      </AppText>
      <View className="flex-row flex-wrap" style={{ gap: 12 }}>
        {CARD_COLOR_CHOICES.map(({ value, label }) => {
          const active = color === value;
          return (
            <Pressable
              key={value}
              className="items-center justify-center rounded-full"
              style={{
                width: heights.tileLg,
                height: heights.tileLg,
                backgroundColor: alpha(value, active ? 0.28 : 0.12),
              }}
              onPress={() => onColorChange(value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              aria-checked={active}
              accessibilityLabel={`Colour ${label}`}
            >
              <View className="h-6 w-6 rounded-full" style={{ backgroundColor: value }} />
            </Pressable>
          );
        })}
      </View>
    </>
  );

  // The folder form opens on one row; the catalogue only earns its height when
  // the learner asks for it. The deck composer never collapses it.
  if (collapsible && !expanded) {
    return (
      <View>
        <AppText variant="label" tone="muted" className="mb-2 mt-5 uppercase">
          Icon
        </AppText>
        <Pressable
          onPress={() => setExpanded(true)}
          role="button"
          accessibilityLabel={`Change icon, currently ${iconLabel(icon)}`}
          style={{
            minHeight: heights.hit,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 10,
            paddingVertical: largeText ? 8 : 0,
            borderRadius: radii.control,
            backgroundColor: fills.tile,
          }}
        >
          <View
            style={{
              width: heights.iconSm,
              height: heights.iconSm,
              borderRadius: radii.micro,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha(color, 0.2),
            }}
          >
            <MaterialIcons
              name={icon as React.ComponentProps<typeof MaterialIcons>['name']}
              size={iconSize.md}
              color={color}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <AppText variant="bodySm" weight="semibold" numberOfLines={2}>
              {iconLabel(icon)}
            </AppText>
            {largeText ? (
              <AppText variant="caption" weight="semibold" tone="accent">
                Change icon
              </AppText>
            ) : null}
          </View>
          {!largeText ? (
            <AppText variant="caption" weight="semibold" tone="accent">
              Change icon
            </AppText>
          ) : null}
          <MaterialIcons name="expand-more" size={iconSize.sm} color={colors.outline} />
        </Pressable>
        {colourBlock}
      </View>
    );
  }

  return (
    <View>
      <View className="mb-2 flex-row items-center justify-between" style={{ gap: 12 }}>
        <AppText variant="label" tone="muted" className="uppercase">
          Icon
        </AppText>
        {collapsible ? (
          <Pressable
            onPress={() => setExpanded(false)}
            role="button"
            accessibilityLabel="Done choosing icon"
            style={{
              minHeight: heights.hit,
              // The word alone is ~40px wide; 44×44 keeps the target legal
              // without changing the header row's 44px height or 8px gap.
              minWidth: heights.hit,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 4,
            }}
          >
            <AppText variant="caption" weight="semibold" tone="accent">
              Done
            </AppText>
          </Pressable>
        ) : (
          <AppText variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
            {iconLabel(icon)}
          </AppText>
        )}
      </View>

      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search icons"
        accessibilityLabel="Search icons"
      />

      {groups.map((group) => (
        <View key={group.key} className="mt-4">
          <View className="mb-2 flex-row items-center justify-between">
            <AppText variant="label" tone="muted" className="uppercase">
              {group.label}
            </AppText>
            <AppText variant="caption" tone="muted">
              {group.icons.length}
            </AppText>
          </View>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {group.icons.map((choice) => {
              const active = icon === choice;
              return (
                <Pressable
                  key={choice}
                  className="items-center justify-center rounded-md"
                  style={{
                    width: heights.tileLg,
                    height: heights.tileLg,
                    backgroundColor: active ? colors.accentActive : fills.tile,
                  }}
                  onPress={() => onIconChange(choice)}
                  accessibilityRole="radio"
                  // A radio announces its state through `checked`, not `selected`:
                  // role=radio requires aria-checked, and react-native-web does not
                  // derive it from accessibilityState, so it is set explicitly too.
                  accessibilityState={{ checked: active }}
                  aria-checked={active}
                  accessibilityLabel={`Icon ${iconLabel(choice)}`}
                >
                  <MaterialIcons
                    name={choice}
                    size={iconSize.lg}
                    color={active ? colors.primary : colors.onSurfaceVariant}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      {groups.length === 0 && (
        <AppText variant="bodySm" tone="muted" className="mt-4">
          No icons match “{query.trim()}”.
        </AppText>
      )}

      {colourBlock}
    </View>
  );
}
