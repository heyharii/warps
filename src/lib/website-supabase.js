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
