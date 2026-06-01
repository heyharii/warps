import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { LuTarget, LuEye, LuMousePointerClick, LuTrendingUp, LuDollarSign, LuFileText, LuCircleCheck, LuCircleAlert, LuX, LuShoppingCart } from 'react-icons/lu';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, BarChart, Bar } from 'recharts';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useDateRange } from '@/contexts/DateRangeContext';

const BklitGauge = dynamic(() => import('@/components/charts/BklitGauge'), { ssr: false });
const BklitDailyScatter = dynamic(() => import('@/components/charts/BklitDailyScatter'), { ssr: false });

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
function pct(n) { return n == null ? '—' : (Number(n) * 100).toFixed(2) + '%'; }
function currency(micros) {
  if (micros == null) return '—';
  return '$' + (Number(micros) / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function GoogleAdsPage() {
  const router = useRouter();
  const { siteId } = router.query;
  const { period } = useDateRange();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState(null);
  const [acctLoading, setAcctLoading] = useState(false);
  const [pageErr, setPageErr] = useState('');

  const load = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    const r = await fetch(`/api/sites/${siteId}/google-ads/data?period=${period}`);
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, [siteId, period]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.adsConnected && !data?.linked && !accounts) loadAccounts();
  }, [data]);

  const loadAccounts = async () => {
    setAcctLoading(true);
    const r = await fetch(`/api/sites/${siteId}/google-ads/accounts`);
    const d = await r.json();
    setAcctLoading(false);
    if (!r.ok) { setPageErr(d.error); return; }
    setAccounts(d.accounts);
  };

  const handleLinkAccount = async (acct) => {
    const r = await fetch(`/api/sites/${siteId}/google-ads/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: acct.customerId, accountName: acct.name }),
    });
    if (r.ok) load();
    else { const d = await r.json(); setPageErr(d.error); }
  };

  const handleUnlink = async () => {
    if (!confirm('Unlink this Google Ads account?')) return;
    await fetch(`/api/sites/${siteId}/google-ads/link`, { method: 'DELETE' });
    load();
  };

  const handleConnectGoogle = async () => {
    const r = await fetch('/api/settings/integrations/google-ads/connect');
    const d = await r.json();
    if (!r.ok) { setPageErr(d.error); return; }
    window.location.href = d.url;
  };

  const s = data?.summary || {};

  return (
    <>
      <Head><title>Google Ads — Traffic Source</title></Head>
      <DashboardLayout siteId={siteId}>
        <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LuTarget size={20} /> Google Ads Analytics
        </h2>

        {pageErr && <div className="auth-error" style={{ marginBottom: 16 }}>{pageErr}</div>}

        {/* Step 1: Connect Google Ads */}
        {!loading && !data?.adsConnected && (
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Step 1: Connect Google Ads</button></div></div>
            <div className="panel-body" style={{ padding: 20 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Connect your Google Ads account to track campaign performance (impressions, clicks, CTR, conversions, cost).
                Make sure your Google Ads OAuth credentials and Developer Token are saved in <strong>Account Settings → Integrations</strong> first.
              </p>
              <button className="btn btn-primary" onClick={handleConnectGoogle}>
                Connect Google Ads Account
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Link Ads account */}
        {!loading && data?.adsConnected && !data?.linked && (
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Step 2: Select Ads Account</button></div></div>
            <div className="panel-body" style={{ padding: 20 }}>
              {acctLoading && <div className="loading-inline"><div className="loading-spinner" /></div>}
              {!acctLoading && accounts?.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No Google Ads accounts found for this Google account.</p>
              )}
              {!acctLoading && accounts && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {accounts.map((acct) => (
                    <div key={acct.customerId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{acct.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>ID: {acct.customerId} · {acct.currency}</div>
                      </div>
                      <button className="btn btn-primary btn-sm" onClick={() => handleLinkAccount(acct)}>Link</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dashboard */}
        {!loading && data?.linked && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: data?.status === 'error' ? 'var(--danger)' : 'var(--success)' }}>
                {data?.status === 'error' ? <LuCircleAlert size={15} /> : <LuCircleCheck size={15} />}
                {data?.accountName || 'Google Ads Account'} · {data?.status === 'error' ? data.lastError : 'Syncing daily'}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={handleUnlink} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <LuX size={13} /> Unlink
              </button>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 16, marginBottom: 24 }}>
              <MetricCard icon={<LuEye size={14} />} label="Impressions" value={fmt(s.total_impressions)} color="#6366f1" />
              <MetricCard icon={<LuMousePointerClick size={14} />} label="Clicks" value={fmt(s.total_clicks)} sub={'CTR ' + pct(s.avg_ctr)} color="#8b5cf6" />
              <MetricCard icon={<LuTrendingUp size={14} />} label="Conversions" value={fmt(s.total_conversions ? Math.round(s.total_conversions) : null)} sub={'CVR ' + pct(s.avg_cvr)} color="#10b981" />
              <MetricCard icon={<LuFileText size={14} />} label="Page Views" value={fmt(s.total_page_views)} color="#06b6d4" />
              <MetricCard icon={<LuDollarSign size={14} />} label="Ad Spend" value={currency(s.total_cost_micros)} color="#f59e0b" />
              <MetricCard icon={<LuShoppingCart size={14} />} label="Add to Cart" value="— (Future)" color="var(--text-muted)" />
            </div>

            {/* Efficiency gauges + daily conversions scatter — bklit */}
            {(s.avg_ctr != null || s.avg_cvr != null) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 16 }}>
                <div className="panel">
                  <div className="panel-header" style={{ padding: '12px 18px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Efficiency Rates</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '4px 12px 12px', justifyItems: 'center' }}>
                    <div style={{ width: '100%', maxWidth: 240 }}>
                      <BklitGauge value={(s.avg_ctr || 0) * 100} centerValue={(s.avg_ctr || 0) * 100} label="CTR" suffix="%" format={{ maximumFractionDigits: 2 }} activeGradient={['#c4b5fd', '#8b5cf6']} />
                    </div>
                    <div style={{ width: '100%', maxWidth: 240 }}>
                      <BklitGauge value={(s.avg_cvr || 0) * 100} centerValue={(s.avg_cvr || 0) * 100} label="CVR" suffix="%" format={{ maximumFractionDigits: 2 }} activeGradient={['#bef264', '#10b981']} />
                    </div>
                  </div>
                </div>
                {data.daily?.length > 1 && (
                  <div className="panel">
                    <div className="panel-header" style={{ padding: '12px 18px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Daily Conversions</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Each dot = a day · low→high coloured red→green</div>
                    </div>
                    <div style={{ padding: 16 }}>
                      <BklitDailyScatter data={data.daily} dataKey="conversions" label="Conversions" aspectRatio="2 / 1" numFmt={(v) => Math.round(v).toLocaleString()} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Performance over time */}
            {data.daily?.length > 0 && (
              <div className="panel" style={{ marginBottom: 16 }}>
                <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Campaign Performance</button></div></div>
                <div className="panel-body" style={{ padding: 20 }}>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={data.daily} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={(d) => d.slice(5)} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        formatter={(v, name) => [Number(v).toLocaleString(), name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line yAxisId="left" type="monotone" dataKey="impressions" stroke="#6366f1" dot={false} strokeWidth={2} name="Impressions" />
                      <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#8b5cf6" dot={false} strokeWidth={2} name="Clicks" />
                      <Line yAxisId="right" type="monotone" dataKey="conversions" stroke="#10b981" dot={false} strokeWidth={2} name="Conversions" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* CTR & CVR */}
            {data.daily?.length > 0 && (
              <div className="panel" style={{ marginBottom: 16 }}>
                <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">CTR & Conversion Rate</button></div></div>
                <div className="panel-body" style={{ padding: 20 }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={data.daily.map((d) => ({ ...d, ctr_pct: +(d.ctr * 100).toFixed(3), cvr_pct: +(d.conversion_rate * 100).toFixed(3) }))} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={(d) => d.slice(5)} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} unit="%" />
                      <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v) => [v + '%']} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="ctr_pct" stroke="#8b5cf6" dot={false} strokeWidth={2} name="CTR %" />
                      <Line type="monotone" dataKey="cvr_pct" stroke="#10b981" dot={false} strokeWidth={2} name="CVR %" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Daily spend bar */}
            {data.daily?.length > 0 && (
              <div className="panel">
                <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Daily Ad Spend</button></div></div>
                <div className="panel-body" style={{ padding: 20 }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={data.daily.map((d) => ({ ...d, spend: +(d.cost_micros / 1_000_000).toFixed(2) }))} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={(d) => d.slice(5)} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} unit="$" />
                      <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v) => ['$' + v, 'Spend']} />
                      <Bar dataKey="spend" fill="#f59e0b" name="Spend ($)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}

        {loading && <div className="loading-inline"><div className="loading-spinner" /></div>}
      </DashboardLayout>
    </>
  );
}
