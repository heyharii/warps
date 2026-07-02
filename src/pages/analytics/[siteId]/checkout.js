import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { LuCreditCard, LuUserX, LuUserCheck, LuMail, LuMousePointerClick } from 'react-icons/lu';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useDateRange } from '@/contexts/DateRangeContext';

const BklitFunnel = dynamic(() => import('@/components/charts/BklitFunnel'), { ssr: false });
const BklitComposed = dynamic(() => import('@/components/charts/BklitComposed'), { ssr: false });

function MetricCard({ icon, label, value, sub, color = 'var(--accent)' }) {
  return (
    <div className="metric-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
        <span style={{ color }}>{icon}</span>{label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function fmt(n) { return n == null ? '—' : Number(n).toLocaleString(); }
function pct(n) { return n == null ? '—' : Number(n).toFixed(1) + '%'; }
function relDate(s) {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return '—';
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

const OUTCOME_LABEL = {
  completed: 'Completed',
  abandoned: 'Abandoned',
  expired: 'Expired',
  opened: 'Opened only',
  unknown: 'Unknown',
};

const OUTCOME_COLOR = {
  completed: '#16a34a',
  abandoned: '#f59e0b',
  expired: '#ef4444',
  opened: '#6366f1',
  unknown: '#94a3b8',
};

function BreakdownPanel({ title, rows }) {
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
  return (
    <div className="panel">
      <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">{title}</button></div></div>
      <div className="panel-body" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No data</div>}
        {rows.map((r) => (
          <div key={r.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{r.name}</span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{fmt(r.count)}</span>
            </div>
            <div style={{ height: 6, background: 'var(--bg-hover, rgba(127,127,127,0.12))', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${(r.count / max) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CheckoutEventsPage() {
  const router = useRouter();
  const { siteId } = router.query;
  const { period } = useDateRange();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    const r = await fetch(`/api/sites/${siteId}/checkout/data?period=${period}`);
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, [siteId, period]);

  useEffect(() => { load(); }, [load]);

  const s = data?.summary || {};

  return (
    <>
      <Head><title>Checkout Events — Embedded Checkout Funnel</title></Head>
      <DashboardLayout siteId={siteId}>
        <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LuCreditCard size={20} /> Checkout Events
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -8, marginBottom: 20 }}>
          Pulled from website Supabase <code>analytics_events</code> — opened, engaged, abandoned, and completed checkout sessions.
        </p>

        {loading && <div className="loading-inline"><div className="loading-spinner" /></div>}

        {!loading && data && !data.connected && (
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-body" style={{ padding: 20 }}>
              {data.reason === 'not_website_site' ? (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Checkout events are tracked on <strong>{data.websiteDomain}</strong>. Open that site to view checkout analytics.
                </p>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Website Supabase is not configured. Set <strong>WEBSITE_SUPABASE_URL</strong> and <strong>WEBSITE_SUPABASE_ANON_KEY</strong>.
                </p>
              )}
            </div>
          </div>
        )}

        {!loading && data?.connected && (
          <>
            {data.error && (
              <div className="auth-error" style={{ marginBottom: 16 }}>Could not load checkout events: {data.error}</div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 16, marginBottom: 24 }}>
              <MetricCard icon={<LuCreditCard size={14} />} label="Checkout Opened" value={fmt(s.opened)} sub={`${fmt(s.sessions)} sessions grouped`} color="#6366f1" />
              <MetricCard icon={<LuMousePointerClick size={14} />} label="Form Engaged" value={fmt(s.engagedSessions)} sub={`${fmt(s.engaged)} engage events`} color="#0ea5e9" />
              <MetricCard icon={<LuUserX size={14} />} label="Abandoned" value={fmt(s.abandonedSessions)} sub={`${pct(s.abandonRate)} of opens`} color="#f59e0b" />
              <MetricCard icon={<LuUserCheck size={14} />} label="Completed" value={fmt(s.completedSessions)} sub={`${pct(s.completionRate)} conversion`} color="#16a34a" />
              <MetricCard icon={<LuMail size={14} />} label="Abandon w/ Email" value={fmt(s.abandonedWithEmail)} sub="From Stripe-enriched properties" color="#8b5cf6" />
            </div>

            {data.funnel?.some((f) => f.value > 0) && (
              <div className="panel" style={{ marginBottom: 16 }}>
                <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Checkout Funnel</button></div></div>
                <div className="panel-body" style={{ padding: '12px 24px 20px' }}>
                  <BklitFunnel stages={data.funnel} />
                </div>
              </div>
            )}

            {data.daily?.length > 0 && (
              <div className="panel" style={{ marginBottom: 16 }}>
                <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Checkout Activity</button></div></div>
                <div className="panel-body" style={{ padding: 20 }}>
                  <BklitComposed
                    data={data.daily}
                    aspectRatio="3 / 1"
                    series={[
                      { key: 'opened', type: 'bar', color: '#6366f1', label: 'Opened' },
                      { key: 'engaged', type: 'bar', color: '#0ea5e9', label: 'Engaged' },
                      { key: 'abandoned', type: 'bar', color: '#f59e0b', label: 'Abandoned' },
                      { key: 'completed', type: 'bar', color: '#16a34a', label: 'Completed' },
                    ]}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
              <BreakdownPanel title="Opens by Report" rows={data.byReport || []} />
              <div className="panel">
                <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Raw Event Counts</button></div></div>
                <div className="panel-body" style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)', display: 'grid', gap: 8 }}>
                  {Object.entries(data.eventCounts || {}).map(([name, count]) => (
                    <div key={name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{name}</span><strong style={{ color: 'var(--text)' }}>{fmt(count)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {data.recent?.length > 0 && (
              <div className="panel">
                <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Recent Checkout Sessions</button></div></div>
                <div className="panel-body" style={{ padding: 0, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        <th style={{ padding: '10px 16px' }}>When</th>
                        <th style={{ padding: '10px 16px' }}>Report</th>
                        <th style={{ padding: '10px 16px' }}>Outcome</th>
                        <th style={{ padding: '10px 16px' }}>Engaged</th>
                        <th style={{ padding: '10px 16px' }}>Email</th>
                        <th style={{ padding: '10px 16px' }}>Time on page</th>
                        <th style={{ padding: '10px 16px' }}>Event trail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent.map((r) => (
                        <tr key={r.sessionKey} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{relDate(r.openedAt)}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--text)', maxWidth: 220 }}>
                            <div style={{ fontWeight: 600 }}>{r.reportTitle}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.slug || '—'}</div>
                          </td>
                          <td style={{ padding: '10px 16px' }}>
                            <span style={{ color: OUTCOME_COLOR[r.outcome] || '#888', fontWeight: 600 }}>
                              {OUTCOME_LABEL[r.outcome] || r.outcome}
                            </span>
                          </td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{r.engaged ? 'Yes' : 'No'}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{r.email || (r.emailProvided ? '(provided)' : '—')}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{formatDuration(r.timeOnPageMs)}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: 11, maxWidth: 320 }}>{r.eventTrail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </DashboardLayout>
    </>
  );
}
