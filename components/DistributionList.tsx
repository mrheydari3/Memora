import { View } from 'react-native';
import { AppText } from './AppText';
import { fills } from '../theme/tokens';

export type DistributionItem = {
  key: string;
  label: string;
  count: number;
  /** 0–1, or null when the sample is empty. */
  share: number | null;
  color: string;
};

type DistributionListProps = {
  items: readonly DistributionItem[];
  /** Hide bars for zero-count rows; the count and dash still print. */
  hideEmptyBars?: boolean;
  className?: string;
};

const formatCount = (value: number) => value.toLocaleString('en-US');

/**
 * DistributionList — one row per category, with the count and its share.
 *
 * The bar encodes the share, but the share is always printed: a 6% bar is not
 * readable to the pixel, and these numbers are the point. A null share prints
 * an em dash rather than 0%, because "no sample" and "none" are different.
 */
export function DistributionList({
  items,
  hideEmptyBars = false,
  className = '',
}: DistributionListProps) {
  return (
    <View className={`gap-3 ${className}`}>
      {items.map((item) => {
        const percentage =
          item.share === null ? null : Math.max(0, Math.min(1, item.share)) * 100;
        const showBar = !hideEmptyBars || item.count > 0;

        return (
          <View key={item.key}>
            <View className="flex-row items-center">
              <View
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <AppText
                variant="bodySm"
                weight="medium"
                tone="muted"
                className="mx-2 flex-1"
                numberOfLines={1}
              >
                {item.label}
              </AppText>
              <AppText variant="bodySm" weight="semibold">
                {formatCount(item.count)}
              </AppText>
              <AppText
                variant="caption"
                tone="muted"
                align="right"
                style={{ width: 42, marginStart: 6 }}
              >
                {percentage === null ? '—' : `${Math.round(percentage)}%`}
              </AppText>
            </View>
            {showBar ? (
              <View
                className="mt-1.5 h-1 overflow-hidden rounded-full"
                style={{ backgroundColor: fills.track }}
              >
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${percentage ?? 0}%`,
                    backgroundColor: item.color,
                  }}
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
