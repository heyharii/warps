import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  LuCamera, LuEye, LuHeart, LuMessageSquare, LuShare2, LuBookmark,
  LuUsers, LuCircleCheck, LuCircleAlert, LuX,
} from 'react-icons/lu';
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

const IG_COLOR = '#e1306c';

export default function InstagramPage() {
  const router = useRouter();
  const { siteId } = router.query;
  const { period } = useDateRange();
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [accounts, setAccounts]   = useState(null);
  const [acctLoading, setAcctLoading] = useState(false);
  const [pageErr, setPageErr]     = useState('');

  const load = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    const r = await fetch(`/api/sites/${siteId}/instagram/data?period=${period}`);
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, [siteId, period]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.igConnected && !data?.linked && !accounts) loadAccounts();
  }, [data]);

  const loadAccounts = async () => {
    setAcctLoading(true);
    const r = await fetch(`/api/sites/${siteId}/instagram/accounts`);
    const d = await r.json();
    setAcctLoading(false);
    if (!r.ok) { setPageErr(d.error); return; }
    setAccounts(d.accounts);
  };

  const handleLinkAccount = async (acct) => {
    const r = await fetch(`/api/sites/${siteId}/instagram/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ igUserId: acct.igUserId, igUsername: acct.igUsername, igName: acct.igName, pageId: acct.pageId }),
    });
    if (r.ok) { setAccounts(null); load(); }
    else { const d = await r.json(); setPageErr(d.error); }
  };

  const handleUnlink = async () => {
    if (!confirm('Unlink Instagram account?')) return;
    await fetch(`/api/sites/${siteId}/instagram/link`, { method: 'DELETE' });
    load();
  };

  const handleConnect = async () => {
    const r = await fetch('/api/settings/integrations/instagram/connect');
    const d = await r.json();
    if (!r.ok) { setPageErr(d.error); return; }
    window.location.href = d.url;
  };

  const s = data?.summary || {};

  return (
    <>
      <Head><title>Instagram Analytics — Traffic Source</title></Head>
      <DashboardLayout siteId={siteId}>
        <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LuCamera size={20} /> Instagram Analytics
        </h2>

        {pageErr && <div className="auth-error" style={{ marginBottom: 16 }}>{pageErr}</div>}

        {/* Step 1: Connect Facebook/Instagram */}
        {!loading && !data?.igConnected && (
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Step 1: Connect Instagram</button></div></div>
            <div className="panel-body" style={{ padding: 20 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Connect your Facebook account to access Instagram Business analytics (reach, impressions, engagement).
                Make sure your Facebook App credentials are saved in <strong>Account Settings → Integrations</strong> first.
                Your Instagram account must be a Business account linked to a Facebook Page.
              </p>
              <button className="btn btn-primary" onClick={handleConnect}>
                Connect Facebook / Instagram Account
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Select Instagram account */}
        {!loading && data?.igConnected && !data?.linked && (
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Step 2: Select Instagram Account</button></div></div>
            <div className="panel-body" style={{ padding: 20 }}>
              {acctLoading && <div className="loading-inline"><div className="loading-spinner" /></div>}
              {!acctLoading && accounts?.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  No Instagram Business accounts found. Your Instagram account must be a Business or Creator account linked to a Facebook Page.
                </p>
              )}
              {!acctLoading && accounts && accounts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {accounts.map((acct) => (
                    <div key={acct.igUserId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>@{acct.igUsername || acct.igName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>via {acct.pageName}</div>
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
                {data?.igName || data?.igUsername ? `@${data.igUsername || data.igName}` : 'Instagram'}
                {' · '}
                {data?.status === 'error' ? data.lastError : 'Syncing daily'}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={handleUnlink} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <LuX size={13} /> Unlink
              </button>
            </div>

            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 16, marginBottom: 24 }}>
              <MetricCard icon={<LuUsers size={14} />}         label="Followers"    value={fmt(s.latest_followers)}    color={IG_COLOR} />
              <MetricCard icon={<LuEye size={14} />}           label="Reach"        value={fmt(s.total_reach)}         color="#8b5cf6" />
              <MetricCard icon={<LuEye size={14} />}           label="Impressions"  value={fmt(s.total_impressions)}   color="#6366f1" />
              <MetricCard icon={<LuHeart size={14} />}         label="Likes"        value={fmt(s.total_likes)}         color="#ef4444" />
              <MetricCard icon={<LuMessageSquare size={14} />} label="Comments"     value={fmt(s.total_comments)}      color="#f59e0b" />
              <MetricCard icon={<LuShare2 size={14} />}        label="Shares"       value={fmt(s.total_shares)}        color="#10b981" />
              <MetricCard icon={<LuBookmark size={14} />}      label="Saves"        value={fmt(s.total_saves)}         color="#06b6d4" />
            </div>

            {/* Reach & Impressions chart */}
            {data.daily?.length > 0 && (
              <div className="panel" style={{ marginBottom: 16 }}>
                <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Reach & Impressions</button></div></div>
                <div className="panel-body" style={{ padding: 20 }}>
                  <BklitComposed
                    data={data.daily}
                    aspectRatio="2.6 / 1"
                    series={[
                      { key: 'reach', type: 'line', color: IG_COLOR, label: 'Reach' },
                      { key: 'impressions', type: 'line', color: '#6366f1', label: 'Impressions' },
                      { key: 'followers', type: 'line', color: '#8b5cf6', label: 'Followers' },
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
                      { key: 'saves', type: 'bar', color: '#06b6d4', label: 'Saves' },
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
