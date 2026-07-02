import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { LuMail, LuUserX, LuBuilding2, LuPhone, LuShieldCheck } from 'react-icons/lu';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useDateRange } from '@/contexts/DateRangeContext';

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
function relDate(s) {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function BreakdownPanel({ title, rows }) {
  return (
    <div className="panel">
      <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">{title}</button></div></div>
      <div className="panel-body" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No data</div>}
        {rows.map((r) => (
          <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{r.name}</span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{fmt(r.count)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CheckoutLeadsPage() {
  const router = useRouter();
  const { siteId } = router.query;
  const { period } = useDateRange();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    const r = await fetch(`/api/sites/${siteId}/checkout-leads/data?period=${period}`);
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, [siteId, period]);

  useEffect(() => { load(); }, [load]);

  const s = data?.summary || {};

  return (
    <>
      <Head><title>Checkout Abandon Leads</title></Head>
      <DashboardLayout siteId={siteId}>
        <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LuMail size={20} /> Checkout Abandon Leads
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -8, marginBottom: 12 }}>
          Contacts captured when someone typed their email in checkout but did not complete payment.
        </p>
        <div className="panel" style={{ marginBottom: 20, borderColor: 'rgba(34,197,94,0.25)', background: 'rgba(34,197,94,0.06)' }}>
          <div className="panel-body" style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--text-secondary)' }}>
            <LuShieldCheck size={18} style={{ flexShrink: 0, marginTop: 2, color: '#16a34a' }} />
            <span>
              Only contact fields are shown here (email, name, phone, company). Payment card details are never stored or displayed.
            </span>
          </div>
        </div>

        {loading && <div className="loading-inline"><div className="loading-spinner" /></div>}

        {!loading && data && !data.connected && (
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-body" style={{ padding: 20 }}>
              {data.reason === 'not_website_site' ? (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Checkout abandon leads are tracked on <strong>{data.websiteDomain}</strong>.
                </p>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Website Supabase is not configured.
                </p>
              )}
            </div>
          </div>
        )}

        {!loading && data?.connected && (
          <>
            {data.error && (
              <div className="auth-error" style={{ marginBottom: 16 }}>Could not load checkout leads: {data.error}</div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 16, marginBottom: 24 }}>
              <MetricCard icon={<LuMail size={14} />} label="Leads with Email" value={fmt(s.total)} sub="Unique abandon/expired sessions" color="#6366f1" />
              <MetricCard icon={<LuBuilding2 size={14} />} label="With Company" value={fmt(s.withCompany)} color="#8b5cf6" />
              <MetricCard icon={<LuPhone size={14} />} label="With Phone" value={fmt(s.withPhone)} color="#0ea5e9" />
              <MetricCard icon={<LuUserX size={14} />} label="Page Abandon" value={fmt(s.abandoned)} sub={`${fmt(s.expired)} expired via webhook`} color="#f59e0b" />
            </div>

            {data.daily?.length > 0 && (
              <div className="panel" style={{ marginBottom: 16 }}>
                <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Leads Over Time</button></div></div>
                <div className="panel-body" style={{ padding: 20 }}>
                  <BklitComposed
                    data={data.daily}
                    aspectRatio="3 / 1"
                    series={[{ key: 'leads', type: 'bar', color: '#6366f1', label: 'Leads' }]}
                  />
                </div>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <BreakdownPanel title="Leads by Report" rows={data.byReport || []} />
            </div>

            <div className="panel">
              <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Captured Leads</button></div></div>
              <div className="panel-body" style={{ padding: 0, overflowX: 'auto' }}>
                {!(data.leads || []).length ? (
                  <div style={{ padding: 24, fontSize: 13, color: 'var(--text-muted)' }}>
                    No checkout abandon leads with email yet for this period. They appear after someone fills email in Stripe checkout and leaves without paying.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        <th style={{ padding: '10px 16px' }}>When</th>
                        <th style={{ padding: '10px 16px' }}>Email</th>
                        <th style={{ padding: '10px 16px' }}>Name</th>
                        <th style={{ padding: '10px 16px' }}>Company</th>
                        <th style={{ padding: '10px 16px' }}>Phone</th>
                        <th style={{ padding: '10px 16px' }}>Report</th>
                        <th style={{ padding: '10px 16px' }}>Source</th>
                        <th style={{ padding: '10px 16px' }}>Variant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.leads.map((r) => (
                        <tr key={`${r.id}-${r.checkoutSessionId || r.email}`} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{relDate(r.capturedAt)}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--text)', fontWeight: 600 }}>{r.email || '—'}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{r.name || '—'}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{r.company || '—'}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{r.phone || '—'}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--text)' }}>
                            <div style={{ fontWeight: 600 }}>{r.reportTitle}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.slug || '—'}</div>
                          </td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>
                            {r.eventName === 'checkout_session_expired' ? 'Session expired' : (r.closeReason || 'Abandoned')}
                          </td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{r.abVariant || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </DashboardLayout>
    </>
  );
}
