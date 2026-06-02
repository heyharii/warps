import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { LuInbox, LuDownload, LuMailOpen, LuFileCheck, LuMessageSquare } from 'react-icons/lu';
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

const TYPE_LABEL = { contact: 'Contact', insight_download: 'Insight', sample_download: 'Sample' };
const TYPE_COLOR = { contact: '#6366f1', insight_download: '#22c55e', sample_download: '#f59e0b' };

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
              <span style={{ color: 'var(--text)' }}>{r.name}</span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{fmt(r.count)}</span>
            </div>
            <div style={{ height: 6, background: 'var(--bg-hover, rgba(127,127,127,0.12))', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${(r.count / max) * 100}%`, height: '100%', background: r.color || 'var(--accent)', borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const router = useRouter();
  const { siteId } = router.query;
  const { period } = useDateRange();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    const r = await fetch(`/api/sites/${siteId}/leads/data?period=${period}`);
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, [siteId, period]);

  useEffect(() => { load(); }, [load]);

  const s = data?.summary || {};

  return (
    <>
      <Head><title>Leads — Website Form Submissions</title></Head>
      <DashboardLayout siteId={siteId}>
        <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LuInbox size={20} /> Website Leads
        </h2>

        {loading && <div className="loading-inline"><div className="loading-spinner" /></div>}

        {!loading && data && !data.connected && (
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-body" style={{ padding: 20 }}>
              {data.reason === 'not_website_site' ? (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Form-submission leads are tracked on <strong>{data.websiteDomain}</strong>, not this site. Open that site to see its leads.
                </p>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Website Supabase isn’t configured. Set <strong>WEBSITE_SUPABASE_URL</strong> and <strong>WEBSITE_SUPABASE_ANON_KEY</strong> in the environment to pull form submissions.
                </p>
              )}
            </div>
          </div>
        )}

        {!loading && data?.connected && (
          <>
            {data.error && (
              <div className="auth-error" style={{ marginBottom: 16 }}>Couldn’t load leads: {data.error}</div>
            )}

            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 16, marginBottom: 24 }}>
              <MetricCard icon={<LuInbox size={14} />} label="Total Leads" value={fmt(s.total)} sub={`${fmt(s.contact)} contact · ${fmt(s.downloadLeads)} downloads`} color="#6366f1" />
              <MetricCard icon={<LuDownload size={14} />} label="Download Requests" value={fmt(s.downloadLeads)} color="#22c55e" />
              <MetricCard icon={<LuMailOpen size={14} />} label="Email Open Rate" value={pct(s.openRate)} sub={`${fmt(s.opened)} of ${fmt(s.sent)} sent`} color="#0ea5e9" />
              <MetricCard icon={<LuFileCheck size={14} />} label="Download Rate" value={pct(s.downloadRate)} sub={`${fmt(s.downloaded)} downloaded`} color="#16a34a" />
            </div>

            {/* Funnel */}
            {data.funnel?.some((f) => f.value > 0) && (
              <div className="panel" style={{ marginBottom: 16 }}>
                <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Download Funnel</button></div></div>
                <div className="panel-body" style={{ padding: '12px 24px 20px' }}>
                  <BklitFunnel stages={data.funnel} />
                </div>
              </div>
            )}

            {/* Daily submissions */}
            {data.daily?.length > 0 && (
              <div className="panel" style={{ marginBottom: 16 }}>
                <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Submissions Over Time</button></div></div>
                <div className="panel-body" style={{ padding: 20 }}>
                  <BklitComposed
                    data={data.daily}
                    stacked
                    aspectRatio="3 / 1"
                    series={[
                      { key: 'contact', type: 'bar', color: '#6366f1', label: 'Contact' },
                      { key: 'downloads', type: 'bar', color: '#22c55e', label: 'Downloads' },
                    ]}
                  />
                </div>
              </div>
            )}

            {/* Breakdowns */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
              <BreakdownPanel title="By Form Type" rows={data.byType || []} />
              <BreakdownPanel title="Top Sources" rows={data.bySource || []} />
            </div>

            {/* Recent leads */}
            {data.recent?.length > 0 && (
              <div className="panel">
                <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Recent Leads</button></div></div>
                <div className="panel-body" style={{ padding: 0, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        <th style={{ padding: '10px 16px' }}>When</th>
                        <th style={{ padding: '10px 16px' }}>Type</th>
                        <th style={{ padding: '10px 16px' }}>Name</th>
                        <th style={{ padding: '10px 16px' }}>Company</th>
                        <th style={{ padding: '10px 16px' }}>Email</th>
                        <th style={{ padding: '10px 16px' }}>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent.map((r, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{relDate(r.created_at)}</td>
                          <td style={{ padding: '10px 16px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: 2, background: TYPE_COLOR[r.form_type] || '#888' }} />
                              {TYPE_LABEL[r.form_type] || r.form_type}
                            </span>
                          </td>
                          <td style={{ padding: '10px 16px', color: 'var(--text)' }}>{r.name || '—'}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{r.company || '—'}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{r.email || '—'}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{r.source || '—'}</td>
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
