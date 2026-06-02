import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { LuMail, LuMousePointerClick, LuEye, LuTrendingUp, LuCircleAlert, LuCircleCheck, LuX, LuRefreshCw } from 'react-icons/lu';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useDateRange } from '@/contexts/DateRangeContext';

const BklitGauge = dynamic(() => import('@/components/charts/BklitGauge'), { ssr: false });
const BklitComposed = dynamic(() => import('@/components/charts/BklitComposed'), { ssr: false });

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

function fmt(n) { return n == null ? '—' : Number(n).toLocaleString(); }
function pct(n) { return n == null ? '—' : (Number(n) * 100).toFixed(1) + '%'; }

export default function ApolloPage() {
  const router = useRouter();
  const { siteId } = router.query;
  const { period } = useDateRange();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    const r = await fetch(`/api/sites/${siteId}/apollo/data?period=${period}`);
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, [siteId, period]);

  useEffect(() => { load(); }, [load]);

  const handleSaveKey = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg(''); setErr('');
    const r = await fetch('/api/settings/integrations/apollo/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId, apiKey }),
    });
    const d = await r.json();
    if (!r.ok) { setErr(d.error); setSaving(false); return; }
    setMsg('Apollo API key saved! Syncing data…');
    setApiKey('');
    setSaving(false);
    setTimeout(() => load(), 1500);
  };

  const handleDisconnect = async () => {
    if (!confirm('Remove Apollo API key?')) return;
    await fetch('/api/settings/integrations/apollo/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId }),
    });
    setData(null);
    load();
  };

  const s = data?.summary || {};

  return (
    <>
      <Head><title>Apollo Email — Traffic Source</title></Head>
      <DashboardLayout siteId={siteId}>
        <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LuMail size={20} /> Apollo Email Analytics
        </h2>

        {/* Connect panel */}
        {!data?.connected && (
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Connect Apollo</button></div></div>
            <div className="panel-body" style={{ padding: 20 }}>
              {msg && <div style={{ background: 'var(--success-light)', color: 'var(--success)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{msg}</div>}
              {err && <div className="auth-error" style={{ marginBottom: 12 }}>{err}</div>}
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Paste your Apollo.io API key. Find it under <strong>Settings → API</strong> in your Apollo account.
              </p>
              <form onSubmit={handleSaveKey} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Apollo API Key</label>
                  <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="xxxxxxxxxxxxxxxx" required />
                </div>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ height: 38 }}>
                  {saving ? 'Saving…' : 'Connect'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Connected state */}
        {data?.connected && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--success)' }}>
                <LuCircleCheck size={15} /> Connected · key {data.maskedKey}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={handleDisconnect} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <LuX size={13} /> Disconnect
              </button>
            </div>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
              <MetricCard icon={<LuMail size={14} />} label="Sent" value={fmt(s.total_sent)} />
              <MetricCard icon={<LuCircleCheck size={14} />} label="Delivered" value={fmt(s.total_delivered)} color="var(--success)" />
              <MetricCard icon={<LuEye size={14} />} label="Opens" value={fmt(s.total_opens)} sub={pct(s.avg_open_rate) + ' open rate'} color="#f59e0b" />
              <MetricCard icon={<LuMousePointerClick size={14} />} label="Clicks" value={fmt(s.total_clicks)} sub={pct(s.avg_click_rate) + ' CTR'} color="#8b5cf6" />
              <MetricCard icon={<LuTrendingUp size={14} />} label="Replies" value={fmt(s.total_replies)} color="#10b981" />
              <MetricCard icon={<LuCircleAlert size={14} />} label="Bounces" value={fmt(s.total_bounces)} color="var(--danger)" />
              <MetricCard icon={<LuX size={14} />} label="Unsubscribes" value={fmt(s.total_unsubscribes)} color="var(--text-muted)" />
            </div>

            {/* Engagement gauges — bklit gauge-chart */}
            {(s.avg_open_rate != null || s.avg_click_rate != null) && (
              <div className="panel" style={{ marginBottom: 24 }}>
                <div className="panel-header" style={{ padding: '12px 18px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Engagement Rates</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, padding: '4px 12px 12px', justifyItems: 'center' }}>
                  <div style={{ width: '100%', maxWidth: 300 }}>
                    <BklitGauge value={(s.avg_open_rate || 0) * 100} centerValue={(s.avg_open_rate || 0) * 100} label="Open Rate" suffix="%" activeGradient={['#fcd34d', '#f59e0b']} />
                  </div>
                  <div style={{ width: '100%', maxWidth: 300 }}>
                    <BklitGauge value={(s.avg_click_rate || 0) * 100} centerValue={(s.avg_click_rate || 0) * 100} label="Click Rate" suffix="%" activeGradient={['#c4b5fd', '#8b5cf6']} />
                  </div>
                </div>
              </div>
            )}

            {/* Time series chart */}
            {data.daily?.length > 0 && (
              <div className="panel">
                <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Email Performance Over Time</button></div></div>
                <div className="panel-body" style={{ padding: 20 }}>
                  <BklitComposed
                    data={data.daily}
                    aspectRatio="2.6 / 1"
                    series={[
                      { key: 'sent', type: 'line', color: '#6366f1', label: 'Sent' },
                      { key: 'opens', type: 'line', color: '#f59e0b', label: 'Opens' },
                      { key: 'clicks', type: 'line', color: '#8b5cf6', label: 'Clicks' },
                      { key: 'replies', type: 'line', color: '#10b981', label: 'Replies' },
                    ]}
                  />
                </div>
              </div>
            )}

            {/* Rates chart */}
            {data.daily?.length > 0 && (
              <div className="panel" style={{ marginTop: 16 }}>
                <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Open Rate & CTR</button></div></div>
                <div className="panel-body" style={{ padding: 20 }}>
                  <BklitComposed
                    data={data.daily.map((d) => ({ ...d, open_rate_pct: +(d.open_rate * 100).toFixed(2), click_rate_pct: +(d.click_rate * 100).toFixed(2) }))}
                    aspectRatio="3 / 1"
                    yFormat={(v) => v + '%'}
                    series={[
                      { key: 'open_rate_pct', type: 'line', color: '#f59e0b', label: 'Open Rate %', format: (v) => v + '%' },
                      { key: 'click_rate_pct', type: 'line', color: '#8b5cf6', label: 'CTR %', format: (v) => v + '%' },
                    ]}
                  />
                </div>
              </div>
            )}

            {data.daily?.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
                <LuRefreshCw size={24} style={{ marginBottom: 12, opacity: 0.4 }} />
                <p>No email data found for this period. Data syncs automatically every 6 hours.</p>
              </div>
            )}
          </>
        )}

        {loading && (
          <div className="loading-inline"><div className="loading-spinner" /></div>
        )}
      </DashboardLayout>
    </>
  );
}
