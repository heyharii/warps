import { useMemo, useState } from 'react';
import { sankey, sankeyLinkHorizontal, sankeyJustify } from 'd3-sankey';

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

// Push overlapping labels apart vertically. Same-column nodes only.
// Assumes node.x0 grouping and walks top→bottom shifting collisions down.
function resolveLabelCollisions(nodes, lineHeight = 24) {
  const cols = {};
  nodes.forEach((n) => {
    const k = Math.round(n.x0);
    if (!cols[k]) cols[k] = [];
    cols[k].push(n);
  });
  Object.values(cols).forEach((col) => {
    col.sort((a, b) => a.y0 - b.y0);
    for (let i = 0; i < col.length; i++) {
      const cur = col[i];
      cur.labelY = (cur.y0 + cur.y1) / 2;
    }
    for (let i = 1; i < col.length; i++) {
      const prev = col[i - 1];
      const cur = col[i];
      const minY = prev.labelY + lineHeight;
      if (cur.labelY < minY) cur.labelY = minY;
    }
  });
}

export default function FunnelSankey({ channels = [], totals = {}, mode = 'both', stages = {}, estimated = false }) {
  const [hover, setHover] = useState(null); // { kind, x, y, html }

  const { nodes, links, width, height } = useMemo(() => {
    const W = 960;
    const H = 520;

    const liveChannels = channels.filter((c) => (c.sessions || 0) > 0);
    if (!liveChannels.length) return { nodes: [], links: [], width: W, height: H };

    const totalSessions = liveChannels.reduce((a, c) => a + c.sessions, 0);
    const totalBounces  = totals.bounces ?? 0;
    const visitsToCTA   = Math.max(0, totalSessions - totalBounces);

    // Real values only — null/missing stages cause nodes to be skipped (no fabricated ratios).
    const leadFormView    = stages.leadFormView    ?? null;
    const formSubmitted   = stages.formSubmitted   ?? null;
    const formAbandoned   = stages.formAbandoned   ?? null;
    const reportView      = stages.reportView      ?? null;
    const checkout        = stages.checkout        ?? null;
    const reportBounce    = stages.reportBounce    ?? null;
    const purchase        = stages.purchase        ?? null;
    const checkoutAbandon = stages.checkoutAbandon ?? null;
    // CRM nodes have no real source yet — always skipped.
    const crmQualified = null;
    const crmLost      = null;

    const showLead     = mode === 'both' || mode === 'lead';
    const showPurchase = mode === 'both' || mode === 'purchase';

    const nodeList = [];
    const nodeIdx = {};
    const addNode = (id, label, color, category) => {
      if (nodeIdx[id] != null) return nodeIdx[id];
      nodeIdx[id] = nodeList.length;
      nodeList.push({ id, label, color, category });
      return nodeIdx[id];
    };

    liveChannels.forEach((c) => addNode(`src:${c.key}`, c.name, c.color, 'source'));
    addNode('visits',  'Website Visits', '#6b7280', 'stage');
    addNode('bounced', 'Bounced',        DROPOFF_COLOR, 'dropoff');
    addNode('cta',     'CTA Clicked',    '#9ca3af', 'stage');

    if (showLead && leadFormView > 0) {
      addNode('leadView',   'Lead Form View',  LEAD_COLOR, 'lead');
      if (formAbandoned > 0) addNode('formAbandon','Form Abandoned',  DROPOFF_COLOR, 'dropoff');
      if (formSubmitted > 0) addNode('formSubmit', 'Form Submitted',  '#16a34a', 'lead');
    }
    if (showPurchase && reportView > 0) {
      addNode('reportView', 'Report Page',     PURCHASE_COLOR, 'purchase');
      if (reportBounce > 0)    addNode('reportBounce','Report Bounce',  DROPOFF_COLOR, 'dropoff');
      if (checkout > 0)        addNode('checkout',   'Checkout',        '#4f46e5', 'purchase');
      if (checkoutAbandon > 0) addNode('checkoutAbandon','Checkout Abandoned', DROPOFF_COLOR, 'dropoff');
      if (purchase > 0)        addNode('purchase',   'Purchase',        '#3730a3', 'purchase');
    }

    const linkList = [];
    liveChannels.forEach((c) => {
      linkList.push({
        source: nodeIdx[`src:${c.key}`],
        target: nodeIdx['visits'],
        value: c.sessions,
        color: c.color,
        pctOfPrev: pctOf(c.sessions, totalSessions),
      });
    });
    if (totalBounces > 0) linkList.push({ source: nodeIdx['visits'], target: nodeIdx['bounced'], value: totalBounces, color: DROPOFF_COLOR, pctOfPrev: pctOf(totalBounces, totalSessions) });
    if (visitsToCTA > 0)  linkList.push({ source: nodeIdx['visits'], target: nodeIdx['cta'],     value: visitsToCTA,  color: '#9ca3af', pctOfPrev: pctOf(visitsToCTA, totalSessions) });

    if (showLead && leadFormView > 0) {
      linkList.push({ source: nodeIdx['cta'], target: nodeIdx['leadView'], value: leadFormView, color: LEAD_COLOR, pctOfPrev: pctOf(leadFormView, visitsToCTA) });
      if (formAbandoned > 0) linkList.push({ source: nodeIdx['leadView'], target: nodeIdx['formAbandon'], value: formAbandoned, color: DROPOFF_COLOR, pctOfPrev: pctOf(formAbandoned, leadFormView) });
      if (formSubmitted > 0) linkList.push({ source: nodeIdx['leadView'], target: nodeIdx['formSubmit'],  value: formSubmitted, color: LEAD_COLOR,    pctOfPrev: pctOf(formSubmitted, leadFormView) });
    }
    if (showPurchase && reportView > 0) {
      linkList.push({ source: nodeIdx['cta'], target: nodeIdx['reportView'], value: reportView, color: PURCHASE_COLOR, pctOfPrev: pctOf(reportView, visitsToCTA) });
      if (reportBounce > 0)    linkList.push({ source: nodeIdx['reportView'], target: nodeIdx['reportBounce'],   value: reportBounce,    color: DROPOFF_COLOR,  pctOfPrev: pctOf(reportBounce, reportView) });
      if (checkout > 0)        linkList.push({ source: nodeIdx['reportView'], target: nodeIdx['checkout'],       value: checkout,        color: PURCHASE_COLOR, pctOfPrev: pctOf(checkout, reportView) });
      if (checkoutAbandon > 0) linkList.push({ source: nodeIdx['checkout'],   target: nodeIdx['checkoutAbandon'],value: checkoutAbandon, color: DROPOFF_COLOR,  pctOfPrev: pctOf(checkoutAbandon, checkout) });
      if (purchase > 0)        linkList.push({ source: nodeIdx['checkout'],   target: nodeIdx['purchase'],       value: purchase,        color: PURCHASE_COLOR, pctOfPrev: pctOf(purchase, checkout) });
    }

    const layout = sankey()
      .nodeId((d) => d.index)
      .nodeAlign(sankeyJustify)
      .nodeWidth(14)
      .nodePadding(12)
      .extent([[0, 12], [W, H - 12]]);

    const graph = layout({
      nodes: nodeList.map((n, i) => ({ ...n, index: i })),
      links: linkList.map((l) => ({ ...l })),
    });

    resolveLabelCollisions(graph.nodes);

    return { nodes: graph.nodes, links: graph.links, width: W, height: H };
  }, [channels, totals, mode, stages]);

  if (!nodes.length) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No funnel data for this period — connect a channel or wait for tracking data.
      </div>
    );
  }

  const showTooltip = (evt, html) => {
    const wrap = evt.currentTarget.closest('[data-funnel-wrap]');
    const rect = wrap?.getBoundingClientRect();
    if (!rect) return;
    setHover({ html, x: evt.clientX - rect.left, y: evt.clientY - rect.top });
  };
  const moveTooltip = (evt) => {
    if (!hover) return;
    const wrap = evt.currentTarget.closest('[data-funnel-wrap]');
    const rect = wrap?.getBoundingClientRect();
    if (!rect) return;
    setHover((h) => h && { ...h, x: evt.clientX - rect.left, y: evt.clientY - rect.top });
  };
  const hideTooltip = () => setHover(null);

  return (
    <div data-funnel-wrap style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', minWidth: 720, height: 'auto', display: 'block' }}>
        {links.map((link, i) => {
          const path = sankeyLinkHorizontal()(link);
          const isHover = hover && hover.id === `l:${i}`;
          const pctText = link.pctOfPrev ? ` (${link.pctOfPrev})` : '';
          const html = `<b>${link.source.label} → ${link.target.label}</b><br/>${fmt(link.value)}${pctText}`;
          return (
            <path
              key={i}
              d={path}
              fill="none"
              stroke={link.color}
              strokeWidth={Math.max(1, link.width)}
              strokeOpacity={isHover ? 0.7 : 0.28}
              style={{ transition: 'stroke-opacity .15s', cursor: 'pointer' }}
              onMouseEnter={(e) => { setHover({ id: `l:${i}` }); showTooltip(e, html); }}
              onMouseMove={moveTooltip}
              onMouseLeave={hideTooltip}
            />
          );
        })}

        {nodes.map((n) => {
          const h = Math.max(3, n.y1 - n.y0);
          const labelRight = n.x0 < width * 0.5;
          const isHover = hover && hover.id === `n:${n.id}`;
          const labelY = n.labelY ?? (n.y0 + h / 2);
          const html = `<b>${n.label}</b><br/>${fmt(n.value)}`;
          return (
            <g
              key={n.id}
              onMouseEnter={(e) => { setHover({ id: `n:${n.id}` }); showTooltip(e, html); }}
              onMouseMove={moveTooltip}
              onMouseLeave={hideTooltip}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={n.x0}
                y={n.y0}
                width={n.x1 - n.x0}
                height={h}
                fill={n.color}
                opacity={isHover ? 1 : 0.9}
                rx={2}
                style={{ transition: 'opacity .15s' }}
              />
              {Math.abs(labelY - (n.y0 + h / 2)) > 0.5 && (
                <line
                  x1={labelRight ? n.x1 : n.x0}
                  y1={n.y0 + h / 2}
                  x2={labelRight ? n.x1 + 4 : n.x0 - 4}
                  y2={labelY}
                  stroke={n.color}
                  strokeWidth={0.5}
                  opacity={0.4}
                />
              )}
              <text
                x={labelRight ? n.x1 + 6 : n.x0 - 6}
                y={labelY - 2}
                textAnchor={labelRight ? 'start' : 'end'}
                dominantBaseline="middle"
                fontSize={11}
                fontFamily="inherit"
                fill="currentColor"
                opacity={0.92}
                fontWeight={600}
                style={{ pointerEvents: 'none' }}
              >
                {n.label}
              </text>
              <text
                x={labelRight ? n.x1 + 6 : n.x0 - 6}
                y={labelY + 11}
                textAnchor={labelRight ? 'start' : 'end'}
                dominantBaseline="middle"
                fontSize={10}
                fontFamily="inherit"
                fill="currentColor"
                opacity={0.55}
                style={{ pointerEvents: 'none' }}
              >
                {fmt(n.value)}
              </text>
            </g>
          );
        })}
      </svg>

      {hover && hover.html && (
        <div
          style={{
            position: 'absolute',
            left: hover.x + 12,
            top: hover.y + 12,
            background: 'var(--bg-card, #111827)',
            border: '1px solid var(--border, #374151)',
            borderRadius: 6,
            padding: '8px 10px',
            fontSize: 12,
            color: 'var(--text, #e5e7eb)',
            boxShadow: '0 4px 12px rgba(0,0,0,.35)',
            pointerEvents: 'none',
            zIndex: 10,
            maxWidth: 260,
            lineHeight: 1.4,
          }}
          dangerouslySetInnerHTML={{ __html: hover.html }}
        />
      )}

      {estimated && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          fontSize: 10, padding: '3px 8px', borderRadius: 10,
          background: 'rgba(245,158,11,.12)', color: '#fbbf24', fontWeight: 600,
          pointerEvents: 'none',
        }}>
          ESTIMATED
        </div>
      )}
    </div>
  );
}
