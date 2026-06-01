// Wrapper around the bklit RingChart (registry: @bklit/ring-chart).
// `rings` is an array of { label, value, maxValue, color } — one concentric
// ring per item, progress = value / maxValue. The center shows the summed
// total by default, or the hovered ring's value.
import { RingChart } from './ring-chart';
import { Ring } from './ring';
import { RingCenter } from './ring-center';

export default function BklitRing({
  rings = [],
  centerLabel = 'Total',
  centerSuffix,
  centerPrefix,
  format,
  size,
  strokeWidth = 14,
  ringGap = 7,
  baseInnerRadius = 56,
  lineCap = 'round',
}) {
  if (!rings.length) return null;
  return (
    <RingChart
      data={rings}
      size={size}
      strokeWidth={strokeWidth}
      ringGap={ringGap}
      baseInnerRadius={baseInnerRadius}
    >
      {rings.map((_, i) => (
        <Ring key={i} index={i} lineCap={lineCap} />
      ))}
      <RingCenter
        defaultLabel={centerLabel}
        suffix={centerSuffix}
        prefix={centerPrefix}
        formatOptions={format || { notation: 'compact', maximumFractionDigits: 1 }}
      />
    </RingChart>
  );
}
