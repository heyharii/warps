'use client';
// bklit radar (visx). Takes per-subject rows + a list of series (channels) and
// transposes to bklit's per-series polygon model. Values are expected 0–100.
import { RadarChart } from './radar-chart';
import { RadarGrid } from './radar-grid';
import { RadarAxis } from './radar-axis';
import { RadarLabels } from './radar-labels';
import { RadarArea } from './radar-area';

export default function BklitRadar({ subjects = [], series = [] }) {
  if (subjects.length === 0 || series.length === 0) {
    return <div className="empty-state"><p>No data for this period</p></div>;
  }

  const metrics = subjects.map((s) => ({ key: s.subject, label: s.subject }));
  const data = series.map((c) => ({
    label: c.name,
    color: c.color,
    values: Object.fromEntries(subjects.map((s) => [s.subject, s[c.key] ?? 0])),
  }));

  return (
    <RadarChart data={data} metrics={metrics} levels={4} margin={48}>
      <RadarGrid />
      <RadarAxis />
      <RadarLabels />
      {data.map((_, i) => (
        <RadarArea key={series[i].key} index={i} />
      ))}
    </RadarChart>
  );
}
