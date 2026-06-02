'use client';
// Reusable bklit time-series chart (visx ComposedChart) for line / area / bar / stacked-bar.
// Client-only — dynamic-import with { ssr: false } in pages.
//
// Props:
//   data        array of rows; each row needs a date-parseable `xKey` value
//   xKey        x-axis key (default 'date')
//   series      [{ key, type:'line'|'area'|'bar', color, label, format, fillOpacity, strokeWidth, radius }]
//   stacked     stack bar series (default false)
//   barGap      px gap between grouped bars (default 4)
//   barSize     target bar width in px
//   aspectRatio CSS aspect-ratio string (default '2.4 / 1')
//   yFormat     fn(value)->string for Y-axis ticks (default: k-abbreviated)
//   numXTicks   x-axis tick count (default 5)
//   showGrid / showXAxis / showYAxis / showTooltip   toggles (default true) — turn off for sparklines
import { useMemo } from 'react';
import { ComposedChart } from './composed-chart';
import { Line } from './line';
import { Area } from './area';
import { SeriesBar } from './series-bar';
import { XAxis } from './x-axis';
import { YAxis } from './y-axis';
import { Grid } from './grid';
import { ChartTooltip } from './tooltip';

// bklit parses x with `new Date(v)` — a date-only string is read as UTC and can
// render a day off in western timezones. Coerce 'YYYY-MM-DD' to local midnight.
function toDate(v) {
  if (v instanceof Date) return v;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T00:00:00`);
  return new Date(v);
}

function renderSeries(series) {
  // Paint order: bars (back) → areas → lines (front). Stacking follows bar order.
  const bars = series.filter((s) => s.type === 'bar');
  const areas = series.filter((s) => s.type === 'area');
  const lines = series.filter((s) => !s.type || s.type === 'line');
  return [
    ...bars.map((s) => (
      <SeriesBar key={s.key} dataKey={s.key} fill={s.color} radius={s.radius ?? 3} />
    )),
    ...areas.map((s) => (
      <Area
        key={s.key}
        dataKey={s.key}
        fill={s.color}
        stroke={s.color}
        fillOpacity={s.fillOpacity ?? 0.25}
        strokeWidth={s.strokeWidth ?? 2}
      />
    )),
    ...lines.map((s) => (
      <Line key={s.key} dataKey={s.key} stroke={s.color} strokeWidth={s.strokeWidth ?? 2.25} />
    )),
  ];
}

export default function BklitComposed({
  data = [],
  xKey = 'date',
  series = [],
  stacked = false,
  barGap = 4,
  barSize,
  aspectRatio = '2.4 / 1',
  yFormat,
  numXTicks = 5,
  showGrid = true,
  showXAxis = true,
  showYAxis = true,
  showTooltip = true,
  animate = true,
}) {
  const rows = useMemo(
    () => (data || []).map((d) => ({ ...d, [xKey]: toDate(d[xKey]) })),
    [data, xKey]
  );

  if (!data || data.length === 0) {
    return <div className="empty-state"><p>No data for this period</p></div>;
  }

  const tooltipRows = (point) =>
    series.map((s) => {
      const v = point[s.key];
      const value = s.format && typeof v === 'number' ? s.format(v) : (v ?? 0);
      return { color: s.color, label: s.label ?? s.key, value };
    });

  return (
    <ComposedChart
      data={rows}
      xDataKey={xKey}
      stacked={stacked}
      barGap={barGap}
      barSize={barSize}
      aspectRatio={aspectRatio}
      animationDuration={animate ? 1100 : 0}
    >
      {showGrid && <Grid horizontal />}
      {renderSeries(series)}
      {showXAxis && <XAxis numTicks={numXTicks} />}
      {showYAxis && <YAxis formatValue={yFormat} />}
      {showTooltip && <ChartTooltip rows={tooltipRows} />}
    </ComposedChart>
  );
}
