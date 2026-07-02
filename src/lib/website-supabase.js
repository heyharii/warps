// Read-only access to the marketing website's Supabase (form submissions / leads).
// Configured via WEBSITE_SUPABASE_URL + WEBSITE_SUPABASE_ANON_KEY (server-side env).
import { createClient } from '@supabase/supabase-js';

let _client = null;

export function getWebsiteSupabase() {
  const url = process.env.WEBSITE_SUPABASE_URL;
  const key = process.env.WEBSITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!_client) _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

// Normalize a domain for comparison (strip protocol, www, trailing slash, lowercase).
export function normDomain(d) {
  return (d || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
}

// Whether the website domain gate is configured at all.
export function websiteDomainConfigured() {
  return !!normDomain(process.env.WEBSITE_SUPABASE_SITE_DOMAIN);
}

// True when this site IS the marketing website (domain matches WEBSITE_SUPABASE_SITE_DOMAIN
// and the website Supabase is configured). Drives the real leads/purchases overrides.
export function isWebsiteSite(siteDomain) {
  const configured = normDomain(process.env.WEBSITE_SUPABASE_SITE_DOMAIN);
  return !!(configured && getWebsiteSupabase() && normDomain(siteDomain) === configured);
}

// Real Stripe purchases (paid orders) + revenue (cents) in a date window — for the funnel "Purchases" stage.
export async function getPurchaseStats({ startDate, endDate } = {}) {
  const sb = getWebsiteSupabase();
  if (!sb) return { count: 0, revenue: 0 };
  let q = sb.from('orders').select('amount_total,created_at').eq('payment_status', 'paid');
  if (startDate) q = q.gte('created_at', startDate);
  if (endDate) q = q.lte('created_at', `${endDate}T23:59:59`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = data || [];
  const revenue = rows.reduce((s, r) => s + (r.amount_total || 0), 0);
  return { count: rows.length, revenue };
}

// Real count of website form submissions in a date window (for the blended funnel "Leads" stage).
export async function getFormSubmissionCount({ startDate, endDate } = {}) {
  const sb = getWebsiteSupabase();
  if (!sb) return 0;
  let q = sb.from('website_form_submissions').select('*', { count: 'exact', head: true });
  if (startDate) q = q.gte('created_at', startDate);
  if (endDate) q = q.lte('created_at', `${endDate}T23:59:59`);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count || 0;
}

const SELECT_COLS =
  'id,form_type,created_at,email_sent,email_opened,download_link_clicked,download_accessed,source,company,industry_interest,first_name,last_name,email,insight_title';

export async function getLeadsData({ startDate, endDate } = {}) {
  const sb = getWebsiteSupabase();
  if (!sb) return { connected: false };

  let q = sb
    .from('website_form_submissions')
    .select(SELECT_COLS)
    .order('created_at', { ascending: false })
    .limit(5000);
  if (startDate) q = q.gte('created_at', startDate);
  if (endDate) q = q.lte('created_at', `${endDate}T23:59:59`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = data || [];

  let contact = 0, insight = 0, sample = 0;
  let downloadLeads = 0, sent = 0, opened = 0, clicked = 0, downloaded = 0;
  const dayMap = {};
  const srcMap = {};

  for (const r of rows) {
    if (r.form_type === 'contact') contact++;
    else if (r.form_type === 'insight_download') insight++;
    else if (r.form_type === 'sample_download') sample++;

    const isDownload = r.form_type === 'insight_download' || r.form_type === 'sample_download';
    if (isDownload) {
      downloadLeads++;
      if (r.email_sent) sent++;
      if (r.email_opened) opened++;
      if (r.download_link_clicked) clicked++;
      if (r.download_accessed) downloaded++;
    }

    const d = (r.created_at || '').slice(0, 10);
    if (d) {
      if (!dayMap[d]) dayMap[d] = { date: d, submissions: 0, contact: 0, downloads: 0 };
      dayMap[d].submissions++;
      if (r.form_type === 'contact') dayMap[d].contact++;
      else dayMap[d].downloads++;
    }

    const s = (r.source || '').trim() || 'Unknown';
    srcMap[s] = (srcMap[s] || 0) + 1;
  }

  const total = rows.length;
  const daily = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
  const bySource = Object.entries(srcMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const byType = [
    { name: 'Contact', count: contact, color: '#6366f1' },
    { name: 'Insight Download', count: insight, color: '#22c55e' },
    { name: 'Sample Download', count: sample, color: '#f59e0b' },
  ].filter((t) => t.count > 0);

  // Download-request email → download funnel (contact forms excluded — they get no download email).
  const funnel = [
    { label: 'Download Requests', value: downloadLeads, color: '#6366f1' },
    { label: 'Email Sent', value: sent, color: '#8b5cf6' },
    { label: 'Opened', value: opened, color: '#0ea5e9' },
    { label: 'Link Clicked', value: clicked, color: '#22c55e' },
    { label: 'Downloaded', value: downloaded, color: '#16a34a' },
  ];

  const recent = rows.slice(0, 50).map((r) => ({
    created_at: r.created_at,
    form_type: r.form_type,
    name: [r.first_name, r.last_name].filter(Boolean).join(' ') || null,
    email: r.email || null,
    company: r.company || null,
    industry: r.industry_interest || null,
    source: r.source || null,
    insight: r.insight_title || null,
  }));

  return {
    connected: true,
    summary: {
      total,
      contact,
      downloadLeads,
      sent,
      opened,
      clicked,
      downloaded,
      openRate: sent ? (opened / sent) * 100 : 0,
      downloadRate: downloadLeads ? (downloaded / downloadLeads) * 100 : 0,
    },
    daily,
    byType,
    bySource,
    funnel,
    recent,
  };
}

const CHECKOUT_EVENT_NAMES = [
  'checkout_opened',
  'checkout_embedded_mounted',
  'checkout_form_engaged',
  'checkout_abandoned',
  'checkout_completed',
  'checkout_session_expired',
  'checkout_embedded_unavailable',
];

function props(row) {
  return row && row.properties && typeof row.properties === 'object' ? row.properties : {};
}

function sessionKey(row) {
  const p = props(row);
  return p.checkout_session_id || row.session_id || row.distinct_id || `event-${row.id}`;
}

function reportLabel(row) {
  const p = props(row);
  return p.report_title || row.slug || p.slug || 'Unknown report';
}

export async function getCheckoutEventsData({ startDate, endDate } = {}) {
  const sb = getWebsiteSupabase();
  if (!sb) return { connected: false };

  let q = sb
    .from('analytics_events')
    .select('id, distinct_id, event_name, slug, session_id, properties, timestamp')
    .in('event_name', CHECKOUT_EVENT_NAMES)
    .order('timestamp', { ascending: false })
    .limit(10000);

  if (startDate) q = q.gte('timestamp', startDate);
  if (endDate) q = q.lte('timestamp', `${endDate}T23:59:59.999`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = data || [];

  const journeys = new Map();
  const dayMap = {};
  const slugMap = {};
  const eventCounts = {};

  for (const row of rows) {
    eventCounts[row.event_name] = (eventCounts[row.event_name] || 0) + 1;

    const key = sessionKey(row);
    if (!journeys.has(key)) {
      journeys.set(key, {
        sessionKey: key,
        browserSessionId: row.session_id || null,
        stripeSessionId: props(row).checkout_session_id || null,
        slug: row.slug || props(row).slug || null,
        reportTitle: reportLabel(row),
        openedAt: null,
        lastEventAt: row.timestamp,
        engaged: false,
        mounted: false,
        outcome: 'unknown',
        email: null,
        emailProvided: false,
        company: null,
        phone: null,
        closeReason: null,
        timeOnPageMs: null,
        checkoutSurface: null,
        events: [],
      });
    }

    const journey = journeys.get(key);
    const p = props(row);
    journey.events.push({ event: row.event_name, at: row.timestamp });
    journey.lastEventAt = row.timestamp;
    if (row.slug) journey.slug = row.slug;
    if (p.report_title) journey.reportTitle = p.report_title;
    if (p.checkout_surface) journey.checkoutSurface = p.checkout_surface;
    if (p.checkout_session_id) journey.stripeSessionId = p.checkout_session_id;
    if (row.session_id) journey.browserSessionId = row.session_id;

    if (row.event_name === 'checkout_opened' && !journey.openedAt) {
      journey.openedAt = row.timestamp;
    }
    if (row.event_name === 'checkout_embedded_mounted') journey.mounted = true;
    if (row.event_name === 'checkout_form_engaged') journey.engaged = true;
    if (row.event_name === 'checkout_abandoned') {
      journey.outcome = 'abandoned';
      journey.closeReason = p.close_reason || p.engagement || null;
      if (p.time_on_page_ms != null) journey.timeOnPageMs = p.time_on_page_ms;
    }
    if (row.event_name === 'checkout_completed') journey.outcome = 'completed';
    if (row.event_name === 'checkout_session_expired' && journey.outcome !== 'completed') {
      journey.outcome = 'expired';
    }

    if (p.email_provided || p.email) {
      journey.emailProvided = !!p.email_provided || !!p.email;
      if (p.email) journey.email = p.email;
    }
    if (p.company) journey.company = p.company;
    if (p.phone) journey.phone = p.phone;

    const day = (row.timestamp || '').slice(0, 10);
    if (day) {
      if (!dayMap[day]) {
        dayMap[day] = {
          date: day,
          opened: 0,
          engaged: 0,
          abandoned: 0,
          completed: 0,
        };
      }
      if (row.event_name === 'checkout_opened') dayMap[day].opened++;
      if (row.event_name === 'checkout_form_engaged') dayMap[day].engaged++;
      if (row.event_name === 'checkout_abandoned') dayMap[day].abandoned++;
      if (row.event_name === 'checkout_completed') dayMap[day].completed++;
    }

    const slugKey = row.slug || props(row).slug || 'unknown';
    if (!slugMap[slugKey]) slugMap[slugKey] = { name: slugKey, count: 0 };
    if (row.event_name === 'checkout_opened') slugMap[slugKey].count++;
  }

  const journeyList = Array.from(journeys.values()).sort(
    (a, b) => String(b.lastEventAt).localeCompare(String(a.lastEventAt))
  );

  for (const journey of journeyList) {
    if (journey.outcome === 'unknown' && journey.openedAt) journey.outcome = 'opened';
    journey.events.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  }

  const openedSessions = journeyList.filter((j) => j.events.some((e) => e.event === 'checkout_opened')).length;
  const engagedSessions = journeyList.filter((j) => j.engaged).length;
  const abandonedSessions = journeyList.filter((j) => j.outcome === 'abandoned' || j.outcome === 'expired').length;
  const completedSessions = journeyList.filter((j) => j.outcome === 'completed').length;
  const abandonedWithEmail = journeyList.filter(
    (j) => (j.outcome === 'abandoned' || j.outcome === 'expired') && j.emailProvided
  ).length;
  const openDenominator = openedSessions || eventCounts.checkout_opened || 0;

  const funnel = [
    { label: 'Checkout Opened', value: eventCounts.checkout_opened || openedSessions, color: '#6366f1' },
    { label: 'Form Mounted', value: eventCounts.checkout_embedded_mounted || 0, color: '#8b5cf6' },
    { label: 'Form Engaged', value: engagedSessions, color: '#0ea5e9' },
    { label: 'Abandoned', value: abandonedSessions, color: '#f59e0b' },
    { label: 'Completed', value: completedSessions, color: '#16a34a' },
  ].filter((s) => s.value > 0);

  const daily = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
  const byReport = Object.values(slugMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const recent = journeyList.slice(0, 100).map((j) => ({
    sessionKey: j.sessionKey,
    browserSessionId: j.browserSessionId,
    stripeSessionId: j.stripeSessionId,
    slug: j.slug,
    reportTitle: j.reportTitle,
    openedAt: j.openedAt || j.lastEventAt,
    lastEventAt: j.lastEventAt,
    outcome: j.outcome,
    engaged: j.engaged,
    mounted: j.mounted,
    emailProvided: j.emailProvided,
    email: j.email,
    company: j.company,
    phone: j.phone,
    closeReason: j.closeReason,
    timeOnPageMs: j.timeOnPageMs,
    checkoutSurface: j.checkoutSurface,
    eventTrail: j.events.map((e) => e.event).join(' → '),
  }));

  return {
    connected: true,
    summary: {
      totalEvents: rows.length,
      opened: eventCounts.checkout_opened || 0,
      mounted: eventCounts.checkout_embedded_mounted || 0,
      engaged: eventCounts.checkout_form_engaged || 0,
      abandoned: eventCounts.checkout_abandoned || 0,
      expired: eventCounts.checkout_session_expired || 0,
      completed: eventCounts.checkout_completed || 0,
      sessions: journeyList.length,
      engagedSessions,
      abandonedSessions,
      completedSessions,
      abandonedWithEmail,
      abandonRate: openDenominator ? (abandonedSessions / openDenominator) * 100 : 0,
      completionRate: openDenominator ? (completedSessions / openDenominator) * 100 : 0,
    },
    eventCounts,
    funnel,
    daily,
    byReport,
    recent,
  };
}

const CHECKOUT_LEAD_EVENT_NAMES = ['checkout_abandoned', 'checkout_session_expired'];

const CHECKOUT_LEAD_SAFE_FIELDS = new Set([
  'email',
  'name',
  'phone',
  'company',
  'email_provided',
  'name_provided',
  'phone_provided',
  'company_provided',
  'address_provided',
  'report_title',
  'slug',
  'checkout_session_id',
  'checkout_surface',
  'close_reason',
  'engagement',
  'form_engaged',
  'time_on_page_ms',
  'ab_variant',
  'ab_industry',
  'ab_tier',
  'payment_status',
  'session_status',
  'source_page',
]);

function hasLeadEmail(p) {
  const email = String(p.email || '').trim();
  return !!p.email_provided || (email.includes('@') && email.length > 3);
}

function sanitizeCheckoutLeadProperties(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const safe = {};
  for (const key of CHECKOUT_LEAD_SAFE_FIELDS) {
    if (source[key] != null && source[key] !== '') safe[key] = source[key];
  }
  return safe;
}

function leadDedupeKey(row) {
  const p = props(row);
  if (p.checkout_session_id) return `stripe:${p.checkout_session_id}`;
  const email = String(p.email || '').trim().toLowerCase();
  const slug = row.slug || p.slug || '';
  const day = (row.timestamp || '').slice(0, 10);
  if (email) return `email:${email}:${slug}:${day}`;
  return `event:${row.id}`;
}

function toCheckoutLeadRow(row) {
  const p = sanitizeCheckoutLeadProperties(props(row));
  const slug = row.slug || p.slug || null;
  return {
    id: row.id,
    capturedAt: row.timestamp,
    eventName: row.event_name,
    slug,
    reportTitle: p.report_title || slug || 'Industry Report',
    email: p.email || null,
    name: p.name || null,
    phone: p.phone || null,
    company: p.company || null,
    emailProvided: !!p.email_provided || hasLeadEmail(p),
    nameProvided: !!p.name_provided,
    phoneProvided: !!p.phone_provided,
    companyProvided: !!p.company_provided,
    checkoutSessionId: p.checkout_session_id || null,
    browserSessionId: row.session_id || null,
    closeReason: p.close_reason || (row.event_name === 'checkout_session_expired' ? 'session_expired' : null),
    timeOnPageMs: p.time_on_page_ms ?? null,
    checkoutSurface: p.checkout_surface || null,
    abVariant: p.ab_variant || null,
    abIndustry: p.ab_industry || null,
    abTier: p.ab_tier || null,
    paymentStatus: p.payment_status || null,
    sessionStatus: p.session_status || null,
  };
}

export async function getCheckoutAbandonLeadsData({ startDate, endDate } = {}) {
  const sb = getWebsiteSupabase();
  if (!sb) return { connected: false };

  let q = sb
    .from('analytics_events')
    .select('id, distinct_id, event_name, slug, session_id, properties, timestamp')
    .in('event_name', CHECKOUT_LEAD_EVENT_NAMES)
    .order('timestamp', { ascending: false })
    .limit(10000);

  if (startDate) q = q.gte('timestamp', startDate);
  if (endDate) q = q.lte('timestamp', `${endDate}T23:59:59.999`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const deduped = new Map();
  for (const row of data || []) {
    if (!hasLeadEmail(props(row))) continue;
    const key = leadDedupeKey(row);
    const lead = toCheckoutLeadRow(row);
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, lead);
      continue;
    }
    const existingScore = [existing.email, existing.name, existing.phone, existing.company].filter(Boolean).length;
    const nextScore = [lead.email, lead.name, lead.phone, lead.company].filter(Boolean).length;
    if (nextScore > existingScore || String(lead.capturedAt).localeCompare(String(existing.capturedAt)) > 0) {
      deduped.set(key, lead);
    }
  }

  const leads = Array.from(deduped.values()).sort(
    (a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt))
  );

  const dayMap = {};
  const slugMap = {};
  let withCompany = 0;
  let withPhone = 0;
  let expiredCount = 0;

  for (const lead of leads) {
    if (lead.company) withCompany++;
    if (lead.phone) withPhone++;
    if (lead.eventName === 'checkout_session_expired') expiredCount++;

    const day = (lead.capturedAt || '').slice(0, 10);
    if (day) dayMap[day] = (dayMap[day] || 0) + 1;

    const slugKey = lead.slug || 'unknown';
    slugMap[slugKey] = (slugMap[slugKey] || 0) + 1;
  }

  const daily = Object.entries(dayMap)
    .map(([date, count]) => ({ date, leads: count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byReport = Object.entries(slugMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return {
    connected: true,
    summary: {
      total: leads.length,
      withCompany,
      withPhone,
      expired: expiredCount,
      abandoned: leads.length - expiredCount,
    },
    daily,
    byReport,
    leads,
  };
}
