// Wrapper around the bklit ScatterChart (registry: @bklit/scatter-chart).
// NOTE: bklit's ScatterChart x-axis is time-based (scaleTime), so this plots a
// daily metric over time as points, coloured low→high (red→green) via yGradient.
import { ScatterChart, Scatter } from './scatter-chart';
import { Grid } from './grid';
import { XAxis } from './x-axis';
import { ChartTooltip } from './tooltip';

export default function BklitDailyScatter({
  data = [],
  dataKey,
  label,
  // explicit hex stops so we don't depend on Tailwind's --color-red-500 palette
  yGradient = { from: '#ef4444', to: '#22c55e' },
  radius = 5,
  aspectRatio = '5 / 2',
  numFmt = (v) => Number(v).toLocaleString(),
}) {
  // Only keep rows where the metric is a real number so the y-scale is honest.
  const rows = data
    .filter((d) => typeof d[dataKey] === 'number' && !Number.isNaN(d[dataKey]))
    .map((d) => ({ ...d, date: d.date }));
  if (rows.length < 2) return null;

  return (
    <ScatterChart data={rows} xDataKey="date" aspectRatio={aspectRatio}>
      <Grid horizontal stroke="var(--chart-grid)" strokeDasharray="3 3" />
      <Scatter dataKey={dataKey} yGradient={yGradient} radius={radius} />
      <XAxis />
      <ChartTooltip
        rows={(p) => [{ label: label || dataKey, value: numFmt(p[dataKey]) }]}
      />
    </ScatterChart>
  );
}
