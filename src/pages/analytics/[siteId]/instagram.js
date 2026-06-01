import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  LuCamera, LuEye, LuHeart, LuMessageSquare, LuShare2, LuBookmark,
  LuUsers, LuCircleCheck, LuCircleAlert, LuX,
} from 'react-icons/lu';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Legend } from 'recharts';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useDateRange } from '@/contexts/DateRangeContext';

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
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={data.daily} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={(d) => d.slice(5)} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        formatter={(v, name) => [Number(v).toLocaleString(), name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="reach"       stroke={IG_COLOR}  dot={false} strokeWidth={2} name="Reach" />
                      <Line type="monotone" dataKey="impressions" stroke="#6366f1"   dot={false} strokeWidth={2} name="Impressions" />
                      <Line type="monotone" dataKey="followers"   stroke="#8b5cf6"   dot={false} strokeWidth={2} name="Followers" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Engagement breakdown */}
            {data.daily?.length > 0 && (
              <div className="panel">
                <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Engagement Breakdown</button></div></div>
                <div className="panel-body" style={{ padding: 20 }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.daily} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={(d) => d.slice(5)} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        formatter={(v, name) => [Number(v).toLocaleString(), name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="likes"    stackId="a" fill="#ef4444" name="Likes" />
                      <Bar dataKey="comments" stackId="a" fill="#f59e0b" name="Comments" />
                      <Bar dataKey="shares"   stackId="a" fill="#10b981" name="Shares" />
                      <Bar dataKey="saves"    stackId="a" fill="#06b6d4" name="Saves" />
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
