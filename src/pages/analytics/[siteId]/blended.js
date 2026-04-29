import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  LuLayers, LuMail, LuLinkedin, LuTarget,
  LuEye, LuMousePointerClick, LuTrendingUp, LuHeart, LuDollarSign, LuCircleCheck, LuCircleAlert,
} from 'react-icons/lu';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  BarChart, Bar,
} from 'recharts';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useDateRange } from '@/contexts/DateRangeContext';

const COLORS = {
  apollo:   { primary: '#6366f1', secondary: '#a5b4fc' },
  linkedin: { primary: '#0a66c2', secondary: '#93c5fd' },
  gads:     { primary: '#f59e0b', secondary: '#fcd34d' },
};

function fmt(n, decimals = 0) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: decimals });
}
function pct(n) { return n == null ? '—' : (Number(n) * 100).toFixed(1) + '%'; }
function currency(n) { return n == null ? '—' : '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function SourceBadge({ icon, label, connected, detail }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
      border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-card)',
      opacity: connected ? 1 : 0.45,
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
        <div style={{ fontSize: 11, color: connected ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {connected ? <LuCircleCheck size={11} /> : <LuCircleAlert size={11} />}
          {connected ? (detail || 'Connected') : 'Not connected'}
        </div>
      </div>
    </div>
  );
}

function KpiRow({ icon, label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
        <span style={{ color }}>{icon}</span>{label}
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{value}</div>
    </div>
  );
}

export default function BlendedDashboard() {
  const router = useRouter();
  const { siteId } = router.query;
  const { period } = useDateRange();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeChart, setActiveChart] = useState('impressions');

  const load = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    const r = await fetch(`/api/sites/${siteId}/blended?period=${period}`);
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, [siteId, period]);

  useEffect(() => { load(); }, [load]);

  const { sources = {}, daily = [] } = data || {};
  const { apollo, linkedin, googleAds } = sources;

  const chartTabs = [
    { key: 'impressions', label: 'Impressions' },
    { key: 'clicks',      label: 'Clicks' },
    { key: 'conversions', label: 'Conversions' },
    { key: 'email',       label: 'Email' },
  ];

  const chartConfig = {
    impressions: [
      { key: 'li_impressions',  name: 'LinkedIn Impressions',  color: COLORS.linkedin.primary },
      { key: 'ads_impressions', name: 'Google Ads Impressions', color: COLORS.gads.primary },
    ],
    clicks: [
      { key: 'li_clicks',  name: 'LinkedIn Clicks',  color: COLORS.linkedin.primary },
      { key: 'ads_clicks', name: 'Google Ads Clicks', color: COLORS.gads.primary },
    ],
    conversions: [
      { key: 'ads_conversions', name: 'Google Ads Conversions', color: COLORS.gads.primary },
      { key: 'email_replies',   name: 'Email Replies',          color: COLORS.apollo.primary },
    ],
    email: [
      { key: 'email_sent',   name: 'Sent',   color: COLORS.apollo.primary },
      { key: 'email_opens',  name: 'Opens',  color: '#10b981' },
      { key: 'email_clicks', name: 'Clicks', color: '#8b5cf6' },
    ],
  };

  return (
    <>
      <Head><title>Blended Dashboard — Traffic Source</title></Head>
      <DashboardLayout siteId={siteId}>
        <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LuLayers size={20} /> Blended Dashboard
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
          All channels in one view — LinkedIn Organic + Google Ads + Apollo Email.
        </p>

        {/* Source status row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 28 }}>
          <SourceBadge icon={<LuLinkedin />} label="LinkedIn Organic" connected={!!linkedin?.connected} detail={linkedin?.orgName} />
          <SourceBadge icon={<LuTarget />}   label="Google Ads"       connected={!!googleAds?.connected} detail={googleAds?.accountName} />
          <SourceBadge icon={<LuMail />}     label="Apollo Email"     connected={!!apollo?.connected} detail={apollo?.connected ? 'API key active' : null} />
        </div>

        {/* Summary columns */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 28 }}>
          {/* LinkedIn summary */}
          <div className="panel">
            <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active" style={{ color: COLORS.linkedin.primary }}>LinkedIn Organic</button></div></div>
            <div className="panel-body" style={{ padding: '12px 16px' }}>
              {linkedin?.connected ? <>
                <KpiRow icon={<LuEye size={13} />}              label="Impressions"   value={fmt(linkedin.summary?.total_impressions)} color={COLORS.linkedin.primary} />
                <KpiRow icon={<LuMousePointerClick size={13} />} label="Clicks"        value={fmt(linkedin.summary?.total_clicks)} color={COLORS.linkedin.primary} />
                <KpiRow icon={<LuEye size={13} />}              label="CTR"           value={pct(linkedin.summary?.avg_ctr)} color={COLORS.linkedin.primary} />
                <KpiRow icon={<LuHeart size={13} />}            label="Likes"         value={fmt(linkedin.summary?.total_likes)} color="#ef4444" />
                <KpiRow icon={<LuTrendingUp size={13} />}       label="Comments"      value={fmt(linkedin.summary?.total_comments)} color="#f59e0b" />
                <KpiRow icon={<LuTrendingUp size={13} />}       label="Shares"        value={fmt(linkedin.summary?.total_shares)} color="#10b981" />
              </> : <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>Not connected. Go to <strong>LinkedIn</strong> tab to set up.</p>}
            </div>
          </div>

          {/* Google Ads summary */}
          <div className="panel">
            <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active" style={{ color: COLORS.gads.primary }}>Google Ads</button></div></div>
            <div className="panel-body" style={{ padding: '12px 16px' }}>
              {googleAds?.connected ? <>
                <KpiRow icon={<LuEye size={13} />}              label="Impressions"   value={fmt(googleAds.summary?.total_impressions)} color={COLORS.gads.primary} />
                <KpiRow icon={<LuMousePointerClick size={13} />} label="Clicks"        value={fmt(googleAds.summary?.total_clicks)} color={COLORS.gads.primary} />
                <KpiRow icon={<LuEye size={13} />}              label="CTR"           value={pct(googleAds.summary?.avg_ctr)} color={COLORS.gads.primary} />
                <KpiRow icon={<LuTrendingUp size={13} />}       label="Conversions"   value={fmt(googleAds.summary?.total_conversions, 1)} color="#10b981" />
                <KpiRow icon={<LuTrendingUp size={13} />}       label="CVR"           value={pct(googleAds.summary?.avg_cvr)} color="#10b981" />
                <KpiRow icon={<LuDollarSign size={13} />}       label="Ad Spend"      value={currency(googleAds.summary?.total_cost_micros ? googleAds.summary.total_cost_micros / 1_000_000 : null)} color="#f59e0b" />
              </> : <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>Not connected. Go to <strong>Google Ads</strong> tab to set up.</p>}
            </div>
          </div>

          {/* Apollo summary */}
          <div className="panel">
            <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active" style={{ color: COLORS.apollo.primary }}>Apollo Email</button></div></div>
            <div className="panel-body" style={{ padding: '12px 16px' }}>
              {apollo?.connected ? <>
                <KpiRow icon={<LuMail size={13} />}             label="Sent"          value={fmt(apollo.summary?.total_sent)} color={COLORS.apollo.primary} />
                <KpiRow icon={<LuEye size={13} />}              label="Open Rate"     value={pct(apollo.summary?.avg_open_rate)} color="#10b981" />
                <KpiRow icon={<LuMousePointerClick size={13} />} label="CTR"           value={pct(apollo.summary?.avg_click_rate)} color="#8b5cf6" />
                <KpiRow icon={<LuTrendingUp size={13} />}       label="Replies"       value={fmt(apollo.summary?.total_replies)} color="#10b981" />
                <KpiRow icon={<LuTrendingUp size={13} />}       label="Bounces"       value={fmt(apollo.summary?.total_bounces)} color="var(--danger)" />
                <KpiRow icon={<LuTrendingUp size={13} />}       label="Unsubscribes"  value={fmt(apollo.summary?.total_unsubscribes)} color="var(--text-muted)" />
              </> : <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>Not connected. Go to <strong>Apollo</strong> tab to set up.</p>}
            </div>
          </div>
        </div>

        {/* Blended chart */}
        {daily.length > 0 && (
          <div className="panel">
            <div className="panel-header">
              <div className="panel-tabs">
                {chartTabs.map((t) => (
                  <button key={t.key} className={`panel-tab ${activeChart === t.key ? 'active' : ''}`} onClick={() => setActiveChart(t.key)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="panel-body" style={{ padding: 20 }}>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={daily} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={(d) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v, name) => [Number(v).toLocaleString(), name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {(chartConfig[activeChart] || []).map((cfg) => (
                    <Line key={cfg.key} type="monotone" dataKey={cfg.key} stroke={cfg.color} dot={false} strokeWidth={2} name={cfg.name} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Funnel bar: Total reach vs clicks vs conversions */}
        {daily.length > 0 && (
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="panel-header"><div className="panel-tabs"><button className="panel-tab active">Full-Funnel Summary</button></div></div>
            <div className="panel-body" style={{ padding: 20 }}>
              {(() => {
                const totals = daily.reduce((acc, d) => {
                  acc.reach += (d.li_impressions || 0) + (d.ads_impressions || 0) + (d.email_sent || 0);
                  acc.clicks += (d.li_clicks || 0) + (d.ads_clicks || 0) + (d.email_clicks || 0);
                  acc.conversions += (d.ads_conversions || 0) + (d.email_replies || 0);
                  return acc;
                }, { reach: 0, clicks: 0, conversions: 0 });
                const funnelData = [
                  { stage: 'Reach / Impressions', value: totals.reach, fill: '#6366f1' },
                  { stage: 'Clicks / Opens',       value: totals.clicks, fill: '#8b5cf6' },
                  { stage: 'Conversions / Replies', value: totals.conversions, fill: '#10b981' },
                ];
                return (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={funnelData} layout="vertical" margin={{ left: 20, right: 30 }}>
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                      <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={160} />
                      <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v) => [Number(v).toLocaleString()]} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {funnelData.map((entry, i) => (
                          <rect key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </div>
        )}

        {loading && <div className="loading-inline"><div className="loading-spinner" /></div>}
        {!loading && daily.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <LuLayers size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p>Connect at least one source (LinkedIn, Google Ads, or Apollo) to see blended data.</p>
          </div>
        )}
      </DashboardLayout>
    </>
  );
}
