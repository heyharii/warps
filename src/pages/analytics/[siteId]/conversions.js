import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  LuDollarSign, LuShoppingCart, LuTrendingUp, LuPercent, LuClock, LuRotateCcw,
} from 'react-icons/lu';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ConversionJourneyTable from '@/components/ui/ConversionJourneyTable';
import FlowView from '@/components/ui/FlowView';
import { useDateRange } from '@/contexts/DateRangeContext';

function fmt(n) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString();
}

function currency(cents) {
  if (cents == null) return '—';
  const v = Number(cents) / 100;
  return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function pct(n) {
  if (n == null || isNaN(n)) return '—';
  return (Number(n) * 100).toFixed(2) + '%';
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function MetricCard({ icon, label, value, sub, color = 'var(--accent)' }) {
  return (
    <div className="metric-card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        <span style={{ color }}>{icon}</span>{label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

export default function Conversions() {
  const router = useRouter();
  const { siteId } = router.query;
  const { getParams } = useDateRange();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState('journey');

  const fetchData = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...getParams(),
        page: String(page),
        limit: '25',
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/analytics/${siteId}/conversions?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [siteId, page, search, JSON.stringify(getParams())]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Debounced search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const s = data?.summary || {};
  const daily = data?.daily || [];
  const topSources = data?.topSources || [];
  const maxRevenue = topSources.reduce((m, t) => Math.max(m, t.revenue || 0), 0);

  return (
    <>
      <Head>
        <title>Conversions — Traffic Source</title>
      </Head>
      <DashboardLayout siteId={siteId} siteName={data?.site?.name} siteDomain={data?.site?.domain}>
        <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LuDollarSign size={20} /> Conversions
        </h2>

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          <MetricCard
            icon={<LuShoppingCart size={14} />}
            label="Conversions"
            value={fmt(s.totalConversions)}
            sub={s.totalSessions ? `from ${fmt(s.totalSessions)} sessions` : null}
          />
          <MetricCard
            icon={<LuDollarSign size={14} />}
            label="Revenue"
            value={currency(s.totalRevenue)}
            color="var(--success)"
            sub={s.totalConversions > 0 ? `${currency(s.avgOrderValue)} avg order` : null}
          />
          <MetricCard
            icon={<LuTrendingUp size={14} />}
            label="AOV"
            value={currency(s.avgOrderValue)}
            color="#f59e0b"
          />
          <MetricCard
            icon={<LuPercent size={14} />}
            label="Conv. Rate"
            value={pct(s.conversionRate)}
            color="#8b5cf6"
            sub="of all sessions"
          />
          <MetricCard
            icon={<LuClock size={14} />}
            label="Avg. Time to Convert"
            value={formatDuration(s.avgTimeToComplete)}
            color="#6366f1"
          />
          <MetricCard
            icon={<LuRotateCcw size={14} />}
            label="Refunds"
            value={fmt(s.refunds)}
            color="var(--danger)"
            sub={s.refunds > 0 ? currency(s.refundRevenue) + ' refunded' : null}
          />
        </div>

        {/* Daily revenue chart */}
        {daily.length > 0 && (
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-header">
              <div className="panel-tabs">
                <button className="panel-tab active">Revenue & Conversions Over Time</button>
              </div>
            </div>
            <div className="panel-body" style={{ padding: 20 }}>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={daily.map(d => ({ ...d, revenue_dollars: +((d.revenue || 0) / 100).toFixed(2) }))}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={(d) => d.slice(5)} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v, name) => {
                      if (name === 'Revenue') return ['$' + Number(v).toLocaleString(), name];
                      return [Number(v).toLocaleString(), name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line yAxisId="left" type="monotone" dataKey="conversions" stroke="#6366f1" dot={false} strokeWidth={2} name="Conversions" />
                  <Line yAxisId="right" type="monotone" dataKey="revenue_dollars" stroke="#22c55e" dot={false} strokeWidth={2} name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top sources */}
        {topSources.length > 0 && (
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-header">
              <div className="panel-tabs">
                <button className="panel-tab active">Top Sources by Revenue</button>
              </div>
            </div>
            <div className="panel-body" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topSources.map((t) => {
                const share = maxRevenue > 0 ? (t.revenue || 0) / maxRevenue : 0;
                return (
                  <div key={t.source}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, color: 'var(--text-secondary)' }}>
                      <span style={{ fontWeight: 500 }}>{t.source}</span>
                      <span>{currency(t.revenue)} · {fmt(t.conversions)} conv</span>
                    </div>
                    <div style={{ height: 5, background: 'var(--bg-surface)', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${Math.max(2, share * 100)}%`, background: '#6366f1', borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabs panel — Journey + Funnel */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div className="panel-tabs">
              <button
                className={`panel-tab ${activeTab === 'journey' ? 'active' : ''}`}
                onClick={() => setActiveTab('journey')}
              >
                Journey for payment
              </button>
              <button
                className={`panel-tab ${activeTab === 'funnel' ? 'active' : ''}`}
                onClick={() => setActiveTab('funnel')}
              >
                Funnel
              </button>
            </div>

            {activeTab === 'journey' && (
              <div className="search-input-wrap">
                <input
                  type="text"
                  placeholder="Search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="search-input"
                />
              </div>
            )}
          </div>

          <div className="panel-body" style={{ padding: 0 }}>
            {activeTab === 'journey' ? (
              loading ? (
                <div className="loading-inline"><div className="loading-spinner" /></div>
              ) : (
                <ConversionJourneyTable
                  conversions={data?.conversions || []}
                  siteId={siteId}
                />
              )
            ) : (
              <FlowView siteId={siteId} />
            )}
          </div>

          {activeTab === 'journey' && data?.pagination && data.pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {data.pagination.page} of {data.pagination.totalPages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </DashboardLayout>
    </>
  );
}
