import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import {
  LuLayers, LuMail, LuLinkedin, LuTarget, LuCamera, LuMusic,
  LuTrendingUp, LuTrendingDown, LuDollarSign, LuCircleCheck, LuCircleAlert,
  LuMove, LuPalette, LuSquare, LuShuffle, LuSearch, LuMinus,
} from 'react-icons/lu';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useDateRange } from '@/contexts/DateRangeContext';

// d3-sankey is SVG-heavy and browser-only
const FunnelSankey = dynamic(() => import('@/components/charts/FunnelSankey'), { ssr: false });
// bklit registry charts — visx/motion based, browser-only
const BklitGauge = dynamic(() => import('@/components/charts/BklitGauge'), { ssr: false });
const BklitRing  = dynamic(() => import('@/components/charts/BklitRing'),  { ssr: false });
const BklitComposed = dynamic(() => import('@/components/charts/BklitComposed'), { ssr: false });
const BklitRadar = dynamic(() => import('@/components/charts/BklitRadar'), { ssr: false });
const BklitFunnel = dynamic(() => import('@/components/charts/BklitFunnel'), { ssr: false });

const COLORS = {
  apollo:    { primary: '#6366f1', secondary: '#a5b4fc' },
  linkedin:  { primary: '#0a66c2', secondary: '#93c5fd' },
  gads:      { primary: '#f59e0b', secondary: '#fcd34d' },
  instagram: { primary: '#e1306c', secondary: '#f9a8d4' },
  tiktok:    { primary: '#69C9D0', secondary: '#a5f3fc' },
};

function fmt(n, decimals = 0) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: decimals });
}
function pct(n) { return n == null ? '—' : (Number(n) * 100).toFixed(1) + '%'; }
function pctOf(part, whole, digits = 1) {
  if (!whole || whole === 0) return '—';
  return ((part / whole) * 100).toFixed(digits) + '%';
}
function currency(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function DeltaChip({ change, unit = '%' }) {
  if (change == null || isNaN(change)) return null;
  const up = change > 0;
  const flat = change === 0;
  const color = flat ? 'var(--text-muted)' : up ? 'var(--success)' : 'var(--danger)';
  const Icon = flat ? LuMinus : up ? LuTrendingUp : LuTrendingDown;
  const sign = up ? '+' : '';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color, fontSize: 11, fontWeight: 600 }}>
      <Icon size={11} />
      {sign}{Math.abs(change).toFixed(1)}{unit} vs prev
    </span>
  );
}

function KpiCard({ label, value, sub, accent, change, invertDelta = false }) {
  const displayChange = invertDelta && change != null ? -change : change;
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '14px 16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2, background: accent }} />
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-muted)', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
      {displayChange != null && (
        <div style={{ marginTop: 6 }}>
          <DeltaChip change={displayChange} />
        </div>
      )}
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function HowToItem({ icon, title, desc }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 180 }}>
      <span style={{ color: 'var(--text-muted)', marginTop: 1 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.45 }}>{desc}</div>
      </div>
    </div>
  );
}

function StageRow({ dot, name, goal, volume, fromPrev, dropoff, dropoffPct, conv, convColor, time, action, rowTint }) {
  return (
    <tr style={rowTint ? { background: rowTint } : undefined}>
      <td>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, display: 'inline-block', flexShrink: 0 }} />
          {name}
        </span>
      </td>
      <td>
        <span style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
          background: goal === 'Goal A' ? 'rgba(34,197,94,.12)' : goal === 'Goal B' ? 'rgba(99,102,241,.15)' : goal === 'Drop-off' ? 'rgba(75,85,99,.18)' : 'rgba(255,255,255,.06)',
          color:      goal === 'Goal A' ? '#6ee7b7' : goal === 'Goal B' ? '#a5b4fc' : goal === 'Drop-off' ? '#9ca3af' : 'var(--text-muted)',
        }}>{goal}</span>
      </td>
      <td style={{ fontWeight: 600 }}>{volume}</td>
      <td style={{ color: 'var(--text-muted)' }}>{fromPrev || '—'}</td>
      <td style={{ color: 'var(--text-muted)' }}>{dropoff || '—'}</td>
      <td>{dropoffPct ? <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{dropoffPct}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
      <td>{conv ? <span style={{ color: convColor || 'var(--success)', fontWeight: 600 }}>{conv}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
      <td style={{ color: 'var(--text-muted)' }}>{time || '—'}</td>
      <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{action}</td>
    </tr>
  );
}

// Real bklit funnel-chart (dynamic-imported BklitFunnel).
function VisualFunnelChart({ stages }) {
  return <BklitFunnel stages={stages} />;
}

export default function BlendedFunnelPage() {
  const router = useRouter();
  const { siteId } = router.query;
  const { period } = useDateRange();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [goalMode, setGoalMode] = useState('both');
  const [activeChart, setActiveChart] = useState('traffic');

  const load = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    const r = await fetch(`/api/sites/${siteId}/blended?period=${period}`);
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, [siteId, period]);

  useEffect(() => { load(); }, [load]);

  const { sources = {}, funnel = {}, daily = [] } = data || {};
  const channels = funnel.channels || [];
  const totals = funnel.totals || { sessions: 0, bounces: 0, conversions: 0, revenue: 0 };
  const stagesReal = funnel.stages || {};
  const changes = funnel.changes || {};

  // ── Funnel volumes — real data only, no fallback ratios ──
  // Values are null when the underlying source (page_views or Stripe) has no rows.
  // The UI skips nodes/KPIs that lack real data instead of fabricating them.
  // Prefer GA4 engagedSessions when present (more accurate than non-bounce).
  const visitsToCTA   = totals.engagedSessions != null
    ? totals.engagedSessions
    : Math.max(0, (totals.sessions || 0) - (totals.bounces || 0));
  const ctaRate       = totals.sessions > 0 ? visitsToCTA / totals.sessions : null;

  const leadFormView    = stagesReal.leadFormView ?? null;
  const formSubmitted   = stagesReal.formSubmitted ?? null;
  const formAbandoned   = (leadFormView != null && formSubmitted != null)
    ? Math.max(0, leadFormView - formSubmitted) : null;
  const reportView      = stagesReal.reportPageView ?? null;
  const checkout        = stagesReal.checkoutView ?? null;
  const reportBounce    = (reportView != null && checkout != null)
    ? Math.max(0, reportView - checkout) : null;
  const purchase        = stagesReal.purchase ?? null;
  const checkoutAbandon = (checkout != null && purchase != null)
    ? Math.max(0, checkout - purchase) : null;
  const purchaseRevenue = stagesReal.purchaseRevenue || 0;

  // CRM stages have no real source yet — leave null until an integration ships.
  const crmQualified = null;
  const crmLost      = null;

  const stagesAreReal = (stagesReal.leadFormView || 0) > 0 || (stagesReal.reportPageView || 0) > 0;
  const ga4Used = data?.meta?.ga4Used || false;

  // ── Creative chart data ──
  const funnelStages = [
    { label: 'Sessions',  value: totals.sessions,  color: '#6b7280' },
    { label: 'Engaged',   value: visitsToCTA,       color: '#3b82f6' },
    ...(formSubmitted != null && formSubmitted > 0 ? [{ label: 'Leads',     value: formSubmitted, color: '#22c55e' }] : []),
    ...(purchase != null  && purchase > 0           ? [{ label: 'Purchases', value: purchase,      color: '#6366f1' }] : []),
  ].filter(s => s.value > 0);

  const reachSeries = [
    { key: 'gsc_impressions', name: 'Organic Search', color: '#10b981' },
    { key: 'li_impressions',  name: 'LinkedIn',        color: COLORS.linkedin.primary },
    { key: 'ads_impressions', name: 'Google Ads',      color: COLORS.gads.primary },
    { key: 'ig_reach',        name: 'Instagram',       color: COLORS.instagram.primary },
    { key: 'tt_views',        name: 'TikTok',          color: COLORS.tiktok.primary },
  ].filter(s => daily.some(d => (d[s.key] || 0) > 0));

  const radarData = (() => {
    if (channels.length < 2) return [];
    const norm = arr => { const m = Math.max(...arr, 1); return arr.map(v => Math.round(v / m * 100)); };
    const CHAN_REACH = { gsc: 'gsc_impressions', gads: 'ads_impressions', googleAds: 'ads_impressions', linkedin: 'li_impressions', apollo: 'email_sent', instagram: 'ig_reach', tiktok: 'tt_views' };
    const sess  = norm(channels.map(c => c.sessions    || 0));
    const convs = norm(channels.map(c => c.conversions || 0));
    const reach = norm(channels.map(c => { const dk = CHAN_REACH[c.key]; return dk ? daily.reduce((s, d) => s + (d[dk] || 0), 0) : 0; }));
    return [
      { subject: 'Sessions',    ...Object.fromEntries(channels.map((c, i) => [c.key, sess[i]])) },
      { subject: 'Conversions', ...Object.fromEntries(channels.map((c, i) => [c.key, convs[i]])) },
      { subject: 'Reach',       ...Object.fromEntries(channels.map((c, i) => [c.key, reach[i]])) },
    ];
  })();

  // Channel session-share rings (concentric) — combines every connected channel
  const channelRings = channels
    .filter((c) => c.connected && (c.sessions || 0) > 0)
    .sort((a, b) => (b.sessions || 0) - (a.sessions || 0))
    .map((c) => ({ label: c.name, value: c.sessions || 0, maxValue: Math.max(totals.sessions || 0, 1), color: c.color }));

  const totalConversions = (formSubmitted || 0) + (purchase || 0);
  const leadCVR = (totals.sessions && formSubmitted != null) ? formSubmitted / totals.sessions : null;
  const checkoutRate = (reportView && checkout != null) ? checkout / reportView : null;

  // Funnel health gauges (rates, 0–100) — defined after the rates above
  const healthGauges = [
    { label: 'Engagement Rate', val: ctaRate != null ? ctaRate * 100 : null, grad: ['#a5b4fc', '#6366f1'] },
    { label: 'Lead CVR',        val: leadCVR != null ? leadCVR * 100 : null, grad: ['#bef264', '#22c55e'] },
    { label: 'Checkout Rate',   val: checkoutRate != null ? checkoutRate * 100 : null, grad: ['#fcd34d', '#f59e0b'] },
  ];

  // ── Chart configs ──
  // Show GA4 Traffic tab first when GA4 is the data source
  const hasGa4Daily = daily.some((d) => d.ga_sessions != null && d.ga_sessions > 0);
  const chartTabs = [
    ...(hasGa4Daily ? [{ key: 'traffic', label: 'Traffic (GA4)' }] : []),
    { key: 'impressions', label: 'Reach' },
    { key: 'clicks',      label: 'Clicks' },
    { key: 'conversions', label: 'Conversions' },
    { key: 'email',       label: 'Email' },
    { key: 'social',      label: 'Social Engagement' },
  ];
  const chartConfig = {
    traffic: [
      { key: 'ga_sessions', name: 'Sessions',         color: '#22c55e' },
      { key: 'ga_users',    name: 'Visitors',         color: '#3b82f6' },
      { key: 'ga_engaged',  name: 'Engaged Sessions', color: '#f59e0b' },
    ],
    impressions: [
      { key: 'gsc_impressions', name: 'Organic Search',  color: '#10b981' },
      { key: 'li_impressions',  name: 'LinkedIn',        color: COLORS.linkedin.primary },
      { key: 'ads_impressions', name: 'Google Ads',      color: COLORS.gads.primary },
      { key: 'ig_reach',        name: 'Instagram Reach', color: COLORS.instagram.primary },
      { key: 'tt_views',        name: 'TikTok Views',    color: COLORS.tiktok.primary },
    ],
    clicks: [
      { key: 'gsc_clicks', name: 'Organic Search Clicks', color: '#10b981' },
      { key: 'li_clicks',  name: 'LinkedIn Clicks',       color: COLORS.linkedin.primary },
      { key: 'ads_clicks', name: 'Google Ads Clicks',     color: COLORS.gads.primary },
    ],
    conversions: [
      { key: 'ads_conversions', name: 'Google Ads Conversions', color: COLORS.gads.primary },
      { key: 'email_replies',   name: 'Email Replies',          color: COLORS.apollo.primary },
    ],
    email: [
      { key: 'email_sent',   name: 'Sent',   color: COLORS.apollo.primary },
      { key: 'email_opens',  name: 'Opens',  color: '#22c55e' },
      { key: 'email_clicks', name: 'Clicks', color: '#8b5cf6' },
    ],
    social: [
      { key: 'ig_likes',    name: 'Instagram Likes',    color: COLORS.instagram.primary },
      { key: 'tt_likes',    name: 'TikTok Likes',       color: COLORS.tiktok.primary },
      { key: 'li_likes',    name: 'LinkedIn Likes',     color: COLORS.linkedin.primary },
      { key: 'ig_comments', name: 'Instagram Comments', color: '#f59e0b' },
      { key: 'tt_comments', name: 'TikTok Comments',    color: '#fb923c' },
    ],
  };

  // ── Biggest drop-offs (computed) ──
  const dropoffs = [
    {
      label: 'Bounce on Landing Page',
      desc: `${fmt(totals.bounces)} visitors leave immediately`,
      value: totals.sessions ? (totals.bounces / totals.sessions) : 0,
      color: '#ef4444',
    },
    {
      label: 'Report Page → No Checkout',
      desc: `${fmt(reportBounce)} read but don't buy`,
      value: reportView ? (reportBounce / reportView) : 0,
      color: '#ef4444',
    },
    {
      label: 'Lead Form Abandonment',
      desc: `${fmt(formAbandoned)} views but no submit`,
      value: leadFormView ? (formAbandoned / leadFormView) : 0,
      color: '#f59e0b',
    },
  ].sort((a, b) => b.value - a.value);

  return (
    <>
      <Head><title>Blended Funnel — Traffic Source</title></Head>
      <DashboardLayout siteId={siteId}>
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
          <div>
            <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <LuLayers size={20} /> Blended Funnel
              {ga4Used && (
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, padding: '3px 8px', borderRadius: 10, background: 'rgba(245,158,11,.12)', color: '#fbbf24' }}>GA4</span>
              )}
            </h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              All channels in one view · {ga4Used ? 'Traffic from GA4' : 'Traffic from tracker'} · Conversions from Stripe
            </div>
          </div>
        </div>

        {/* ── KPI cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
          <KpiCard
            label="Total Sessions"
            value={fmt(totals.sessions)}
            change={changes.sessions}
            sub={`${channels.filter(c => c.connected).length} channels combined`}
            accent="linear-gradient(90deg, var(--success), var(--accent))"
          />
          <KpiCard
            label="Engagement Rate"
            value={pct(ctaRate)}
            change={changes.ctaRate}
            sub={totals.engagedSessions != null
              ? `${fmt(visitsToCTA)} engaged sessions (GA4)`
              : `${fmt(visitsToCTA)} of ${fmt(totals.sessions)} didn't bounce`}
            accent={COLORS.gads.primary}
          />
          <KpiCard
            label="Lead CVR"
            value={leadCVR == null ? '—' : pct(leadCVR)}
            change={changes.leadCVR}
            sub={formSubmitted != null
              ? `${fmt(formSubmitted)} leads of ${fmt(totals.sessions)} sessions`
              : 'No /lead* page views tracked'}
            accent="var(--success)"
          />
          <KpiCard
            label="Checkout Rate"
            value={checkoutRate == null ? '—' : pct(checkoutRate)}
            change={changes.checkoutRate}
            sub={(checkout != null && reportView != null && reportView > 0)
              ? `${fmt(checkout)} of ${fmt(reportView)} report page views`
              : 'No /report* or /checkout* page views tracked'}
            accent={COLORS.apollo.primary}
          />
          <KpiCard
            label="Total Conversions"
            value={fmt(totalConversions)}
            change={changes.conversions}
            sub={`${fmt(formSubmitted)} leads + ${fmt(purchase)} purchases`}
            accent="linear-gradient(90deg, var(--success), #6366f1)"
          />
          <KpiCard
            label="Revenue"
            value={currency(totals.revenue / 100)}
            change={changes.revenue}
            sub={totals.conversions > 0 ? `${currency(totals.revenue / 100 / totals.conversions)} avg order` : 'No completed purchases'}
            accent="linear-gradient(90deg, #6366f1, #f59e0b)"
          />
        </div>

        {/* ── Funnel Health gauges — bklit gauge-chart ── */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header" style={{ padding: '12px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Funnel Health</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Conversion rates across the blended funnel</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, padding: '4px 12px 12px', justifyItems: 'center' }}>
            {healthGauges.map((g) => (
              <div key={g.label} style={{ width: '100%', maxWidth: 300 }}>
                {g.val != null ? (
                  <BklitGauge value={g.val} centerValue={g.val} label={g.label} suffix="%" activeGradient={g.grad} format={{ maximumFractionDigits: 1 }} />
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '56px 0' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{g.label}</div>
                    No data tracked yet
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Multi-Channel Reach — bklit area-chart style ── */}
        {reachSeries.length > 0 && daily.length > 0 && (
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-header" style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Multi-Channel Reach Trend</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Impressions & reach stacked — wider = more visibility</div>
              </div>
            </div>
            <div className="panel-body" style={{ padding: '0 18px 18px' }}>
              <BklitComposed
                data={daily}
                stacked
                aspectRatio="3 / 1"
                series={reachSeries.map(s => ({ key: s.key, type: 'bar', color: s.color, label: s.name }))}
              />
            </div>
          </div>
        )}

        {/* ── How to read ── */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
          padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 28, flexWrap: 'wrap',
        }}>
          <HowToItem icon={<LuMove size={16} />}    title="Flow width = volume"        desc="Wider = more people at that stage. Hover any flow or node to see exact numbers and drop-off %." />
          <HowToItem icon={<LuPalette size={16} />} title="Color = source channel"     desc="Traffic retains its source color through the funnel. Green = Goal A (Lead). Purple = Goal B (Purchase)." />
          <HowToItem icon={<LuSquare size={16} />}  title="Grey nodes = drop-off"      desc="People who left at that stage and didn't continue. These are your biggest optimization opportunities." />
          <HowToItem icon={<LuShuffle size={16} />} title="Branch = two conversion goals" desc="After CTA Click, traffic splits: left = Lead Form (Goal A), right = Report Purchase (Goal B)." />
        </div>

        {/* ── Sankey chart card ── */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header" style={{ alignItems: 'flex-start', padding: '14px 18px', minHeight: 0, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                Customer Journey Funnel
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                  background: stagesAreReal ? 'var(--success-light)' : 'rgba(245,158,11,.12)',
                  color: stagesAreReal ? 'var(--success)' : '#f59e0b',
                  letterSpacing: '.3px', textTransform: 'uppercase',
                }}>
                  {stagesAreReal ? 'Live from page_views' : 'Mid-funnel estimated'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {stagesAreReal
                  ? 'Lead form, report page & checkout matched from real page views. Hover any node to inspect.'
                  : 'No matching pages yet — mid-funnel uses standard ratios. Add /lead, /report, or /checkout paths to your site for real numbers.'}
              </div>
            </div>
            <div style={{ display: 'flex', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 3, gap: 2 }}>
              {[
                { k: 'both',     label: 'Both Goals',    icon: <LuShuffle size={12} /> },
                { k: 'lead',     label: 'Lead Gen',      icon: <LuTarget size={12} /> },
                { k: 'purchase', label: 'Report Purchase', icon: <LuDollarSign size={12} /> },
              ].map(b => (
                <button
                  key={b.k}
                  onClick={() => setGoalMode(b.k)}
                  style={{
                    padding: '6px 12px', border: 'none', cursor: 'pointer',
                    background: goalMode === b.k ? 'var(--bg-card)' : 'transparent',
                    color: goalMode === b.k ? 'var(--text)' : 'var(--text-muted)',
                    fontWeight: goalMode === b.k ? 600 : 500,
                    fontSize: 12, borderRadius: 6,
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontFamily: 'inherit',
                    boxShadow: goalMode === b.k ? 'var(--shadow-sm)' : 'none',
                  }}
                >
                  {b.icon} {b.label}
                </button>
              ))}
            </div>
          </div>
          <div className="panel-body" style={{ padding: 16 }}>
            <FunnelSankey
              channels={channels}
              totals={totals}
              mode={goalMode}
              stages={{
                leadFormView, formSubmitted, formAbandoned, crmQualified, crmLost,
                reportView, checkout, reportBounce, purchase, checkoutAbandon,
              }}
              estimated={!stagesAreReal}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '12px 18px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 600 }}>Channels:</span>
            {channels.map(c => (
              <span key={c.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: c.color, display: 'inline-block' }} />
                {c.name}
              </span>
            ))}
            <span style={{ color: 'var(--border)' }}>|</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#22c55e', display: 'inline-block' }} /> Goal A: Lead
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#6366f1', display: 'inline-block' }} /> Goal B: Purchase
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#4b5563', display: 'inline-block' }} /> Drop-off
            </span>
          </div>
        </div>

        {/* ── Stage-by-stage table ── */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header" style={{ padding: '12px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Stage-by-Stage Breakdown</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface)' }}>
                  {['Stage', 'Goal', 'Volume', 'From Previous', 'Drop-off', 'Drop-off %', 'Conversion to Next', 'Avg Time', 'Key Action'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700,
                      color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px',
                      borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <StageRow
                  dot="#6b7280" name="Website Visits" goal="Both"
                  volume={<strong>{fmt(totals.sessions)}</strong>}
                  dropoff={fmt(totals.bounces)}
                  dropoffPct={pctOf(totals.bounces, totals.sessions)}
                  conv={pctOf(visitsToCTA, totals.sessions)}
                  convColor="var(--text-muted)"
                  time="—"
                  action="Reduce bounce rate · Improve landing page relevance"
                />
                <StageRow
                  dot="#9ca3af" name="Bounced" goal="Drop-off"
                  volume={fmt(totals.bounces)}
                  fromPrev={`of ${fmt(totals.sessions)}`}
                  time="< 10s"
                  action="A/B test hero section · Improve ad-to-page message match"
                />
                <StageRow
                  dot="#9ca3af" name="Engaged Session" goal="Both"
                  volume={<strong>{fmt(visitsToCTA)}</strong>}
                  fromPrev={`${pctOf(visitsToCTA, totals.sessions)} of visits`}
                  conv="Splits into Lead + Purchase paths"
                  convColor="var(--text)"
                  action="Sessions that didn't bounce — proxy for engagement"
                />
                {leadFormView != null && leadFormView > 0 && (
                  <StageRow
                    rowTint="rgba(34,197,94,.04)"
                    dot="#22c55e" name="Lead Form View" goal="Goal A"
                    volume={<strong>{fmt(leadFormView)}</strong>}
                    fromPrev={`${pctOf(leadFormView, visitsToCTA)} of engaged`}
                    dropoff={fmt(formAbandoned)}
                    dropoffPct={pctOf(formAbandoned, leadFormView)}
                    conv={pctOf(formSubmitted, leadFormView)}
                    action="Reduce form fields · Add social proof · A/B test form copy"
                  />
                )}
                {formSubmitted != null && formSubmitted > 0 && (
                  <StageRow
                    rowTint="rgba(34,197,94,.04)"
                    dot="#16a34a" name="Form Submitted" goal="Goal A"
                    volume={<strong>{fmt(formSubmitted)}</strong>}
                    fromPrev={`${pctOf(formSubmitted, leadFormView)} of form views`}
                    conv="100%"
                    action="Lead captured — wire CRM integration to track downstream"
                  />
                )}
                {/* CRM stages removed — no real CRM integration yet. */}
                {reportView != null && reportView > 0 && (
                  <StageRow
                    rowTint="rgba(99,102,241,.04)"
                    dot="#6366f1" name="Report Page View" goal="Goal B"
                    volume={<strong>{fmt(reportView)}</strong>}
                    fromPrev={`${pctOf(reportView, visitsToCTA)} of engaged`}
                    dropoff={fmt(reportBounce)}
                    dropoffPct={pctOf(reportBounce, reportView)}
                    conv={pctOf(checkout, reportView)}
                    action="Biggest drop-off · Add trust signals · Testimonials · Preview content"
                  />
                )}
                {checkout != null && checkout > 0 && (
                  <StageRow
                    rowTint="rgba(99,102,241,.04)"
                    dot="#4f46e5" name="Checkout Initiated" goal="Goal B"
                    volume={<strong>{fmt(checkout)}</strong>}
                    fromPrev={`${pctOf(checkout, reportView)} of page views`}
                    dropoff={fmt(checkoutAbandon)}
                    dropoffPct={pctOf(checkoutAbandon, checkout)}
                    conv={pctOf(purchase, checkout)}
                    action="Checkout abandon — add urgency, simplify payment, A/B test CTA"
                  />
                )}
                {purchase != null && purchase > 0 && (
                  <StageRow
                    rowTint="rgba(99,102,241,.04)"
                    dot="#3730a3" name="Purchase Complete" goal="Goal B"
                    volume={<strong>{fmt(purchase)}</strong>}
                    fromPrev={`${pctOf(purchase, checkout)} of checkouts`}
                    action="Stripe checkout.session.completed · Revenue attributed to last UTM source"
                  />
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Visual Funnel — bklit funnel-chart style ── */}
        {funnelStages.length >= 2 && (
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-header" style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Conversion Funnel</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Hover segments · width = volume · right = drop-off %</div>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)' }}>
                {funnelStages.map((s, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: 'inline-block' }} />
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="panel-body" style={{ padding: '12px 24px 20px' }}>
              <VisualFunnelChart stages={funnelStages} />
            </div>
          </div>
        )}

        {/* ── Biggest drop-offs + Channel contribution + Radar ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, marginBottom: 20 }}>
          <div className="panel">
            <div className="panel-header" style={{ padding: '12px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)' }} />
                Biggest Drop-off Points
              </div>
            </div>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dropoffs.map((d, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', background: 'var(--bg-surface)', borderRadius: 8,
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{d.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{d.desc}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: d.color }}>{(d.value * 100).toFixed(1)}%</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>drop-off</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header" style={{ padding: '12px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <LuTrendingUp size={14} /> Channel Contribution to Conversions
              </div>
            </div>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {channels.map((c) => {
                const share = totalConversions > 0 ? c.conversions / totalConversions : 0;
                return (
                  <div key={c.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} />
                        {c.name}
                      </span>
                      <span>{fmt(c.conversions)} conv · {fmt(c.sessions)} sessions</span>
                    </div>
                    <div style={{ height: 5, background: 'var(--bg-surface)', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${Math.max(2, share * 100)}%`, background: c.color, borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Channel Radar — normalized 0–100 per metric ── */}
          {radarData.length > 0 && (
            <div className="panel">
              <div className="panel-header" style={{ padding: '12px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Channel Performance Radar
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Normalized 0–100 per dimension</div>
              </div>
              <div style={{ padding: '0 14px 14px' }}>
                <BklitRadar subjects={radarData} series={channels} />
              </div>
            </div>
          )}

          {/* ── Channel Mix rings — bklit ring-chart ── */}
          {channelRings.length > 0 && (
            <div className="panel">
              <div className="panel-header" style={{ padding: '12px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Channel Mix</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Session share by channel · hover a ring</div>
              </div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ width: '100%', maxWidth: 260 }}>
                  <BklitRing rings={channelRings} centerLabel="Sessions" format={{ notation: 'compact', maximumFractionDigits: 1 }} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                  {channelRings.map((r) => (
                    <span key={r.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, display: 'inline-block' }} />
                      {r.label} · {pctOf(r.value, totals.sessions)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Source connection status ── */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header" style={{ padding: '12px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Source Connections</div>
          </div>
          <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {[
              { icon: <LuSearch />,   label: 'Organic Search (GSC)', conn: sources.gsc?.connected,       detail: sources.gsc?.connected ? `${fmt(sources.gsc.summary?.clicks)} clicks` : null },
              { icon: <LuTarget />,   label: 'Google Ads',           conn: sources.googleAds?.connected, detail: sources.googleAds?.accountName },
              { icon: <LuLinkedin />, label: 'LinkedIn Organic',     conn: sources.linkedin?.connected,  detail: sources.linkedin?.orgName },
              { icon: <LuMail />,     label: 'Apollo Email',         conn: sources.apollo?.connected,    detail: sources.apollo?.connected ? 'API key active' : null },
              { icon: <LuCamera />,   label: 'Instagram',            conn: sources.instagram?.connected, detail: sources.instagram?.igUsername ? `@${sources.instagram.igUsername}` : null },
              { icon: <LuMusic />,    label: 'TikTok',               conn: sources.tiktok?.connected,    detail: sources.tiktok?.tiktokUsername ? `@${sources.tiktok.tiktokUsername}` : null },
            ].map((s, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-surface)',
                  opacity: s.conn ? 1 : 0.55,
                }}
              >
                <span style={{ fontSize: 18, color: 'var(--text-secondary)' }}>{s.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)' }}>{s.label}</div>
                  <div style={{ fontSize: 10.5, color: s.conn ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                    {s.conn ? <LuCircleCheck size={10} /> : <LuCircleAlert size={10} />}
                    {s.conn ? (s.detail || 'Connected') : 'Not connected'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Daily blended trend ── */}
        {daily.length > 0 && (
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-header" style={{ padding: '0 18px' }}>
              <div className="panel-tabs">
                {chartTabs.map((t) => (
                  <button key={t.key} className={`panel-tab ${(activeChart === t.key || (!chartTabs.find(x => x.key === activeChart) && t === chartTabs[0])) ? 'active' : ''}`} onClick={() => setActiveChart(t.key)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="panel-body" style={{ padding: 18 }}>
              {(() => {
                const activeCfg = chartConfig[chartTabs.find(t => t.key === activeChart) ? activeChart : chartTabs[0]?.key] || [];
                return (
                  <BklitComposed
                    data={daily}
                    aspectRatio="2.8 / 1"
                    series={activeCfg.map(cfg => ({ key: cfg.key, type: 'area', color: cfg.color, label: cfg.name }))}
                  />
                );
              })()}
            </div>
          </div>
        )}

        {loading && <div className="loading-inline"><div className="loading-spinner" /></div>}
        {!loading && totals.sessions === 0 && channels.every(c => !c.connected) && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <LuLayers size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p>Connect at least one source to see blended funnel data.</p>
          </div>
        )}
      </DashboardLayout>
    </>
  );
}
