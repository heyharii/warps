'use client';
// Visitors / pageviews (and optional revenue) over time, on bklit charts.
// Revenue uses its own chart because bklit composed charts are single-Y-axis.
import BklitComposed from './BklitComposed';

export default function CombinedChart({ trafficData, revenueData }) {
  const merged = mergeByDate(trafficData, revenueData);

  if (!merged || merged.length === 0) {
    return (
      <div className="empty-state">
        <p>No data for this period</p>
      </div>
    );
  }

  const hasRevenue = merged.some((d) => d.revenue > 0);
  const hasVisitors = merged.some((d) => d.visitors > 0);

  const series = [{ key: 'page_views', type: 'bar', color: '#6366f1', label: 'Pageviews' }];
  if (hasVisitors) series.push({ key: 'visitors', type: 'bar', color: '#22c55e', label: 'Visitors' });

  return (
    <>
      <BklitComposed data={merged} aspectRatio="2.6 / 1" barGap={3} series={series} />
      {hasRevenue && (
        <>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', margin: '14px 0 4px' }}>Revenue</div>
          <BklitComposed
            data={merged}
            aspectRatio="4 / 1"
            yFormat={(v) => '$' + (v / 100).toFixed(0)}
            series={[
              { key: 'revenue', type: 'area', color: '#f59e0b', label: 'Revenue', format: (v) => '$' + (v / 100).toFixed(2) },
            ]}
          />
        </>
      )}
    </>
  );
}

function mergeByDate(traffic = [], revenue = []) {
  const map = {};
  for (const t of traffic) {
    map[t.date] = { ...t, revenue: 0 };
  }
  for (const r of revenue) {
    if (map[r.date]) {
      map[r.date].revenue = r.revenue || 0;
    } else {
      map[r.date] = { date: r.date, page_views: 0, visitors: 0, sessions: 0, revenue: r.revenue || 0 };
    }
  }
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}
