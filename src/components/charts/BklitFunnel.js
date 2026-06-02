'use client';
// bklit funnel-chart. Takes funnel stages [{ label, value, color }] (volume per stage).
import { FunnelChart } from './funnel-chart';

export default function BklitFunnel({ stages = [], orientation = 'horizontal' }) {
  const filtered = (stages || []).filter((s) => s.value != null && s.value > 0);
  if (filtered.length < 2) return null;

  // Clamp the *geometry* so a segment never widens past the previous one (a funnel
  // can't grow), while keeping the real count in the label via displayValue. Guards
  // against mixed data sources, e.g. Leads (Supabase) > Sessions (site tracking).
  let prev = Number.POSITIVE_INFINITY;
  const data = filtered.map((s) => {
    const geom = Math.min(s.value, prev);
    prev = geom;
    return { label: s.label, value: geom, displayValue: Number(s.value).toLocaleString(), color: s.color };
  });

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
