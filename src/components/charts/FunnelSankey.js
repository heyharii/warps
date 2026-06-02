'use client';
// Dual-goal conversion funnel rendered with bklit's SankeyChart (visx + d3-sankey).
// Node/link derivation is unchanged; bklit handles layout, animation and tooltips.
import { useMemo } from 'react';
import { SankeyChart } from './sankey';
import { SankeyLink } from './sankey';
import { SankeyNode } from './sankey';
import { SankeyTooltip } from './sankey';

const DROPOFF_COLOR  = '#4b5563';
const LEAD_COLOR     = '#22c55e';
const PURCHASE_COLOR = '#6366f1';

function fmt(n) {
  if (n == null) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return Math.round(n).toLocaleString();
}

function pctOf(part, whole) {
  if (!whole || whole === 0) return null;
  return ((part / whole) * 100).toFixed(1) + '%';
}

export default function FunnelSankey({ channels = [], totals = {}, mode = 'both', stages = {}, estimated = false }) {
  const { nodes, links } = useMemo(() => {
    const liveChannels = channels.filter((c) => (c.sessions || 0) > 0);
    if (!liveChannels.length) return { nodes: [], links: [] };

    const totalSessions = liveChannels.reduce((a, c) => a + c.sessions, 0);
    const totalBounces  = totals.bounces ?? 0;
    const visitsToCTA   = Math.max(0, totalSessions - totalBounces);

    const leadFormView    = stages.leadFormView    ?? null;
    const formSubmitted   = stages.formSubmitted   ?? null;
    const formAbandoned   = stages.formAbandoned   ?? null;
    const reportView      = stages.reportView      ?? null;
    const checkout        = stages.checkout        ?? null;
    const reportBounce    = stages.reportBounce    ?? null;
    const purchase        = stages.purchase        ?? null;
    const checkoutAbandon = stages.checkoutAbandon ?? null;

    const showLead     = mode === 'both' || mode === 'lead';
    const showPurchase = mode === 'both' || mode === 'purchase';

    const nodeList = [];
    const nodeIdx = {};
    const addNode = (id, label, color, category) => {
      if (nodeIdx[id] != null) return nodeIdx[id];
      nodeIdx[id] = nodeList.length;
      nodeList.push({ name: label, color, category });
      return nodeIdx[id];
    };

    liveChannels.forEach((c) => addNode(`src:${c.key}`, c.name, c.color, 'source'));
    addNode('visits',  'Website Visits', '#6b7280', 'stage');
    addNode('bounced', 'Bounced',        DROPOFF_COLOR, 'dropoff');
    addNode('cta',     'CTA Clicked',    '#9ca3af', 'stage');

    if (showLead && leadFormView > 0) {
      addNode('leadView',   'Lead Form View',  LEAD_COLOR, 'lead');
      if (formAbandoned > 0) addNode('formAbandon', 'Form Abandoned', DROPOFF_COLOR, 'dropoff');
      if (formSubmitted > 0) addNode('formSubmit',  'Form Submitted', '#16a34a',    'lead');
    }
    if (showPurchase && reportView > 0) {
      addNode('reportView', 'Report Page', PURCHASE_COLOR, 'purchase');
      if (reportBounce > 0)    addNode('reportBounce',    'Report Bounce',      DROPOFF_COLOR, 'dropoff');
      if (checkout > 0)        addNode('checkout',        'Checkout',           '#4f46e5',     'purchase');
      if (checkoutAbandon > 0) addNode('checkoutAbandon', 'Checkout Abandoned', DROPOFF_COLOR, 'dropoff');
      if (purchase > 0)        addNode('purchase',        'Purchase',           '#3730a3',     'purchase');
    }

    const linkList = [];
    liveChannels.forEach((c) => {
      linkList.push({ source: nodeIdx[`src:${c.key}`], target: nodeIdx.visits, value: c.sessions, color: c.color, pctOfPrev: pctOf(c.sessions, totalSessions) });
    });
    if (totalBounces > 0) linkList.push({ source: nodeIdx.visits, target: nodeIdx.bounced, value: totalBounces, color: DROPOFF_COLOR, pctOfPrev: pctOf(totalBounces, totalSessions) });
    if (visitsToCTA > 0)  linkList.push({ source: nodeIdx.visits, target: nodeIdx.cta,     value: visitsToCTA,  color: '#9ca3af',     pctOfPrev: pctOf(visitsToCTA, totalSessions) });

    if (showLead && leadFormView > 0) {
      linkList.push({ source: nodeIdx.cta, target: nodeIdx.leadView, value: leadFormView, color: LEAD_COLOR, pctOfPrev: pctOf(leadFormView, visitsToCTA) });
      if (formAbandoned > 0) linkList.push({ source: nodeIdx.leadView, target: nodeIdx.formAbandon, value: formAbandoned, color: DROPOFF_COLOR, pctOfPrev: pctOf(formAbandoned, leadFormView) });
      if (formSubmitted > 0) linkList.push({ source: nodeIdx.leadView, target: nodeIdx.formSubmit,  value: formSubmitted, color: LEAD_COLOR,    pctOfPrev: pctOf(formSubmitted, leadFormView) });
    }
    if (showPurchase && reportView > 0) {
      linkList.push({ source: nodeIdx.cta, target: nodeIdx.reportView, value: reportView, color: PURCHASE_COLOR, pctOfPrev: pctOf(reportView, visitsToCTA) });
      if (reportBounce > 0)    linkList.push({ source: nodeIdx.reportView, target: nodeIdx.reportBounce,    value: reportBounce,    color: DROPOFF_COLOR,  pctOfPrev: pctOf(reportBounce, reportView) });
      if (checkout > 0)        linkList.push({ source: nodeIdx.reportView, target: nodeIdx.checkout,        value: checkout,        color: PURCHASE_COLOR, pctOfPrev: pctOf(checkout, reportView) });
      if (checkoutAbandon > 0) linkList.push({ source: nodeIdx.checkout,   target: nodeIdx.checkoutAbandon, value: checkoutAbandon, color: DROPOFF_COLOR,  pctOfPrev: pctOf(checkoutAbandon, checkout) });
      if (purchase > 0)        linkList.push({ source: nodeIdx.checkout,   target: nodeIdx.purchase,        value: purchase,        color: PURCHASE_COLOR, pctOfPrev: pctOf(purchase, checkout) });
    }

    return { nodes: nodeList, links: linkList };
  }, [channels, totals, mode, stages]);

  if (!nodes.length) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No funnel data for this period — connect a channel or wait for tracking data.
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {estimated && (
        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px' }}>
          Estimated
        </div>
      )}
      <SankeyChart
        data={{ nodes, links }}
        aspectRatio="2.2 / 1"
        nodeWidth={14}
        nodePadding={16}
        margin={{ top: 24, right: 150, bottom: 24, left: 150 }}
      >
        <SankeyLink getLinkColor={(l) => l.color || '#9ca3af'} strokeOpacity={0.45} />
        <SankeyNode getNodeColor={(n) => n.color || '#6b7280'} lineCap={3} />
        <SankeyTooltip
          formatValue={fmt}
          linkContent={({ link }) => (
            <div style={{ padding: '8px 10px' }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>
                {link.source?.name} → {link.target?.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {fmt(link.value)}{link.pctOfPrev ? ` · ${link.pctOfPrev}` : ''}
              </div>
            </div>
          )}
        />
      </SankeyChart>
    </div>
  );
}
