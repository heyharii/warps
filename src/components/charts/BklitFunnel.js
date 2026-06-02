'use client';
// bklit funnel-chart. Takes funnel stages [{ label, value, color }] (volume per stage).
import { FunnelChart } from './funnel-chart';

export default function BklitFunnel({ stages = [], orientation = 'horizontal' }) {
  const data = (stages || [])
    .filter((s) => s.value != null && s.value > 0)
    .map((s) => ({ label: s.label, value: s.value, color: s.color }));

  if (data.length < 2) return null;

  return (
    <FunnelChart
      data={data}
      orientation={orientation}
      layers={3}
      showValues
      showPercentage
      showLabels
      formatValue={(v) => Number(v).toLocaleString()}
    />
  );
}
