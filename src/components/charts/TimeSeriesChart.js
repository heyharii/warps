'use client';
// Single-series area over time, on a bklit chart.
import BklitComposed from './BklitComposed';

export default function TimeSeriesChart({ data, dataKey = 'page_views', color = '#3b82f6', label }) {
  return (
    <BklitComposed
      data={data}
      aspectRatio="2.2 / 1"
      series={[{ key: dataKey, type: 'area', color, label: label || dataKey }]}
    />
  );
}
