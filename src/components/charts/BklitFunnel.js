'use client';
// bklit funnel-chart. Takes funnel stages [{ label, value, color }] (volume per stage).
import { FunnelChart } from './funnel-chart';

export default function BklitFunnel({ stages = [], orientation = 'horizontal', height = 260, maxWidth = 920 }) {
  const filtered = (stages || []).filter((s) => s.value != null && s.value > 0);
  if (filtered.length < 2) return null;

  // bklit normalizes every segment against the FIRST stage, so a later value larger
  // than the first overflows the frame. Cap each value at the first stage to prevent
  // that, but keep honest mid-funnel proportions + percentages (e.g. clicks > opens in
  // email funnels). The real count is preserved in the label via displayValue.
  const firstVal = filtered[0].value;
  const data = filtered.map((s) => ({
    label: s.label,
    value: Math.min(s.value, firstVal),
    displayValue: Number(s.value).toLocaleString(),
    color: s.color,
  }));

  return (
    <FunnelChart
      data={data}
      orientation={orientation}
      layers={3}
      showValues
      showPercentage
      showLabels
      labelLayout="grouped"
      formatValue={(v) => Number(v).toLocaleString()}
      style={{ aspectRatio: 'auto', height, maxWidth, margin: '0 auto' }}
    />
  );
}
