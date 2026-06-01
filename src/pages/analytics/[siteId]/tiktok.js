import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  LuMusic, LuEye, LuHeart, LuMessageSquare, LuShare2,
  LuUsers, LuVideo, LuCircleCheck, LuCircleAlert, LuX,
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

const TT_COLOR = '#010101';
const TT_COLOR2 = '#69C9D0';

export default function TiktokPage() {
  const router = useRouter();
  const { siteId } = router.query;
  const { period } = useDateRange();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageErr, setPageErr] = useState('');

  const load = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    const r = await fetch(`/api/sites/${siteId}/tiktok/data?period=${period}`);
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, [siteId, period]);

  useEffect(() => { load(); }, [load]);

  const handleLink = async () => {
    const r = await fetch(`/api/sites/${siteId}/tiktok/link`, { method: 'POST' });
    const d = await r.json();
    if (!r.ok) { setPageErr(d.error); return; }
    load();
  };

  const handleUnlink = async () => {
    if (!confirm('Unlink TikTok account?')) return;
    await fetch(`/api/sites/${siteId}/tiktok/link`, { method: 'DELETE' });
    load();
  };

  const handleConnect = async () => {
    const r = await fetch('/api/settings/integrations/tiktok/connect');
    const d = await r.json();
    if (!r.ok) { setPageErr(d.error); return; }
    window.location.href = d.url;
  };

  const s = data?.summary || {};

  return (
    <>
      <Head><title>TikTok Analytics — Traffic Source</title></Head>
      <DashboardLayout siteId={siteId}>
        <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LuMusic size={20} /> TikTok Analytics
        </h2>

        {pageErr && <div className="auth-error" style={{ marginBottom: 16 }}>{pageErr}</div>}

        {/* Step 1: Connect TikTok */}
        {!loading && !data?.ttConnected && (
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Step 1: Connect TikTok</button></div></div>
            <div className="panel-body" style={{ padding: 20 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Connect your TikTok account to track followers, video views, and engagement.
                Make sure your TikTok app credentials are saved in <strong>Account Settings → Integrations</strong> first.
              </p>
              <button className="btn btn-primary" onClick={handleConnect}>
                Connect TikTok Account
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Link account to this site */}
        {!loading && data?.ttConnected && !data?.linked && (
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Step 2: Link TikTok Account</button></div></div>
            <div className="panel-body" style={{ padding: 20 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Your TikTok account is connected. Link it to this site to start tracking analytics.
              </p>
              <button className="btn btn-primary" onClick={handleLink}>
                Link TikTok Account to this Site
              </button>
            </div>
          </div>
        )}

        {/* Dashboard */}
        {!loading && data?.linked && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: data?.status === 'error' ? 'var(--danger)' : 'var(--success)' }}>
                {data?.status === 'error' ? <LuCircleAlert size={15} /> : <LuCircleCheck size={15} />}
                {data?.tiktokName || (data?.tiktokUsername ? `@${data.tiktokUsername}` : 'TikTok')}
                {data?.tiktokUsername ? ` (@${data.tiktokUsername})` : ''}
                {' · '}
                {data?.status === 'error' ? data.lastError : 'Syncing daily'}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={handleUnlink} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <LuX size={13} /> Unlink
              </button>
            </div>

            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 16, marginBottom: 24 }}>
              <MetricCard icon={<LuUsers size={14} />}         label="Followers"     value={fmt(s.latest_followers)}       color={TT_COLOR2} />
              <MetricCard icon={<LuHeart size={14} />}         label="Total Likes"   value={fmt(s.latest_total_likes)}     color="#ef4444" />
              <MetricCard icon={<LuVideo size={14} />}         label="Videos"        value={fmt(s.latest_video_count)}     color="#8b5cf6" />
              <MetricCard icon={<LuEye size={14} />}           label="Video Views"   value={fmt(s.total_views)}            color="#6366f1" />
              <MetricCard icon={<LuHeart size={14} />}         label="Video Likes"   value={fmt(s.total_video_likes)}      color="#f43f5e" />
              <MetricCard icon={<LuMessageSquare size={14} />} label="Comments"      value={fmt(s.total_video_comments)}   color="#f59e0b" />
              <MetricCard icon={<LuShare2 size={14} />}        label="Shares"        value={fmt(s.total_video_shares)}     color="#10b981" />
            </div>

            {/* Followers & Views chart */}
            {data.daily?.length > 0 && (
              <div className="panel" style={{ marginBottom: 16 }}>
                <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Followers & Views</button></div></div>
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
                      <Line type="monotone" dataKey="followers"   stroke={TT_COLOR2} dot={false} strokeWidth={2} name="Followers" />
                      <Line type="monotone" dataKey="views"       stroke="#6366f1"   dot={false} strokeWidth={2} name="Video Views" />
                      <Line type="monotone" dataKey="total_likes" stroke="#ef4444"   dot={false} strokeWidth={2} name="Total Likes" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Engagement breakdown */}
            {data.daily?.length > 0 && (
              <div className="panel">
                <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Video Engagement</button></div></div>
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
                      <Bar dataKey="video_likes"    stackId="a" fill="#ef4444" name="Likes" />
                      <Bar dataKey="video_comments" stackId="a" fill="#f59e0b" name="Comments" />
                      <Bar dataKey="video_shares"   stackId="a" fill="#10b981" name="Shares" />
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
