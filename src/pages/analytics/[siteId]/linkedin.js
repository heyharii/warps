import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { LuLinkedin, LuEye, LuMousePointerClick, LuHeart, LuMessageSquare, LuShare2, LuFileText, LuCircleCheck, LuCircleAlert, LuX } from 'react-icons/lu';
import dynamic from 'next/dynamic';
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
function pct(n) { return n == null ? '—' : (Number(n) * 100).toFixed(2) + '%'; }

export default function LinkedInPage() {
  const router = useRouter();
  const { siteId } = router.query;
  const { period } = useDateRange();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState(null);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [pageErr, setPageErr] = useState('');

  const load = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    const r = await fetch(`/api/sites/${siteId}/linkedin/data?period=${period}`);
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, [siteId, period]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.linkedinConnected && !data?.linked && !orgs) loadOrgs();
  }, [data]);

  const loadOrgs = async () => {
    setOrgsLoading(true);
    const r = await fetch(`/api/sites/${siteId}/linkedin/orgs`);
    const d = await r.json();
    setOrgsLoading(false);
    if (!r.ok) { setPageErr(d.error); return; }
    setOrgs(d.orgs);
  };

  const handleLinkOrg = async (org) => {
    const r = await fetch(`/api/sites/${siteId}/linkedin/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgUrn: org.urn, orgName: org.name }),
    });
    if (r.ok) load();
  };

  const handleUnlink = async () => {
    if (!confirm('Unlink LinkedIn company page?')) return;
    await fetch(`/api/sites/${siteId}/linkedin/link`, { method: 'DELETE' });
    load();
  };

  const handleConnectLinkedin = async () => {
    const r = await fetch('/api/settings/integrations/linkedin/connect');
    const d = await r.json();
    if (!r.ok) { setPageErr(d.error); return; }
    window.location.href = d.url;
  };

  const s = data?.summary || {};

  return (
    <>
      <Head><title>LinkedIn Organic — Traffic Source</title></Head>
      <DashboardLayout siteId={siteId}>
        <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LuLinkedin size={20} /> LinkedIn Organic Analytics
        </h2>

        {pageErr && <div className="auth-error" style={{ marginBottom: 16 }}>{pageErr}</div>}

        {/* Step 1: Connect LinkedIn account */}
        {!loading && !data?.linkedinConnected && (
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Step 1: Connect LinkedIn</button></div></div>
            <div className="panel-body" style={{ padding: 20 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Connect your LinkedIn account to access company page organic analytics (impressions, engagement, CTR).
                Make sure your LinkedIn app credentials are saved in <strong>Account Settings → Integrations</strong> first.
              </p>
              <button className="btn btn-primary" onClick={handleConnectLinkedin}>
                Connect LinkedIn Account
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Link company page */}
        {!loading && data?.linkedinConnected && !data?.linked && (
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Step 2: Select Company Page</button></div></div>
            <div className="panel-body" style={{ padding: 20 }}>
              {orgsLoading && <div className="loading-inline"><div className="loading-spinner" /></div>}
              {!orgsLoading && orgs?.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No LinkedIn company pages found. You need to be an admin of a company page.</p>
              )}
              {!orgsLoading && orgs && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {orgs.map((org) => (
                    <div key={org.urn} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{org.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{org.urn}</div>
                      </div>
                      <button className="btn btn-primary btn-sm" onClick={() => handleLinkOrg(org)}>Link</button>
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
                {data?.orgName || 'LinkedIn Page'} · {data?.status === 'error' ? data.lastError : 'Syncing daily'}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={handleUnlink} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <LuX size={13} /> Unlink
              </button>
            </div>

            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 16, marginBottom: 24 }}>
              <MetricCard icon={<LuEye size={14} />} label="Impressions" value={fmt(s.total_impressions)} color="#6366f1" />
              <MetricCard icon={<LuMousePointerClick size={14} />} label="Clicks" value={fmt(s.total_clicks)} sub={'CTR ' + pct(s.avg_ctr)} color="#8b5cf6" />
              <MetricCard icon={<LuHeart size={14} />} label="Likes" value={fmt(s.total_likes)} color="#ef4444" />
              <MetricCard icon={<LuMessageSquare size={14} />} label="Comments" value={fmt(s.total_comments)} color="#f59e0b" />
              <MetricCard icon={<LuShare2 size={14} />} label="Shares/Saves" value={fmt(s.total_shares)} color="#10b981" />
              <MetricCard icon={<LuFileText size={14} />} label="Page Views" value={fmt(s.total_page_views)} color="#06b6d4" />
            </div>

            {/* Impressions & Engagement chart */}
            {data.daily?.length > 0 && (
              <div className="panel" style={{ marginBottom: 16 }}>
                <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Impressions & Clicks</button></div></div>
                <div className="panel-body" style={{ padding: 20 }}>
                  <BklitComposed
                    data={data.daily}
                    series={[
                      { key: 'impressions', type: 'line', color: '#6366f1', label: 'Impressions' },
                      { key: 'clicks', type: 'line', color: '#8b5cf6', label: 'Clicks' },
                      { key: 'page_views', type: 'line', color: '#06b6d4', label: 'Page Views' },
                    ]}
                  />
                </div>
              </div>
            )}

            {/* Engagement breakdown */}
            {data.daily?.length > 0 && (
              <div className="panel">
                <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Engagement Breakdown</button></div></div>
                <div className="panel-body" style={{ padding: 20 }}>
                  <BklitComposed
                    data={data.daily}
                    stacked
                    aspectRatio="3 / 1"
                    series={[
                      { key: 'likes', type: 'bar', color: '#ef4444', label: 'Likes' },
                      { key: 'comments', type: 'bar', color: '#f59e0b', label: 'Comments' },
                      { key: 'shares', type: 'bar', color: '#10b981', label: 'Shares' },
                    ]}
                  />
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
