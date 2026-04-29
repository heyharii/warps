import { withAuth } from '@/lib/withAuth';
import { getDb } from '@/lib/db';
import { getApolloConnection, getApolloDailyTotals, getApolloSummary } from '@/lib/apollo';
import { getLinkedinSiteLink, getLinkedinUserConn, getLinkedinDailyRows, getLinkedinSummary } from '@/lib/linkedin-organic';
import { getGoogleAdsUserConn, getGoogleAdsSiteLink, getGoogleAdsDailyRows, getGoogleAdsSummary } from '@/lib/google-ads';

function dateRange(period) {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const map = { '24h': 1, '7d': 7, '30d': 30, '90d': 90, '12m': 365 };
  const days = map[period] || 30;
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - days);
  return { startDate: start.toISOString().slice(0, 10), endDate: end };
}

function mergeDailyByDate(apolloRows, linkedinRows, googleAdsRows) {
  const all = {};
  const ensure = (date) => {
    if (!all[date]) all[date] = {
      date,
      // Apollo
      email_sent: 0, email_opens: 0, email_clicks: 0, email_open_rate: 0, email_click_rate: 0, email_replies: 0,
      // LinkedIn
      li_impressions: 0, li_clicks: 0, li_likes: 0, li_comments: 0, li_shares: 0, li_ctr: 0,
      // Google Ads
      ads_impressions: 0, ads_clicks: 0, ads_ctr: 0, ads_conversions: 0, ads_cvr: 0, ads_spend: 0,
    };
    return all[date];
  };
  for (const r of apolloRows) {
    const d = ensure(r.date);
    d.email_sent = r.sent; d.email_opens = r.opens; d.email_clicks = r.clicks;
    d.email_open_rate = r.open_rate; d.email_click_rate = r.click_rate; d.email_replies = r.replies;
  }
  for (const r of linkedinRows) {
    const d = ensure(r.date);
    d.li_impressions = r.impressions; d.li_clicks = r.clicks; d.li_likes = r.likes;
    d.li_comments = r.comments; d.li_shares = r.shares; d.li_ctr = r.ctr;
  }
  for (const r of googleAdsRows) {
    const d = ensure(r.date);
    d.ads_impressions = r.impressions; d.ads_clicks = r.clicks; d.ads_ctr = r.ctr;
    d.ads_conversions = r.conversions; d.ads_cvr = r.conversion_rate;
    d.ads_spend = +(r.cost_micros / 1_000_000).toFixed(2);
  }
  return Object.values(all).sort((a, b) => a.date.localeCompare(b.date));
}

export default withAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { id: siteId, period = '30d' } = req.query;

  const db = getDb();
  const site = db.prepare('SELECT * FROM sites WHERE id = ? AND user_id = ?').get(siteId, req.user.userId);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  const { startDate, endDate } = dateRange(period);

  const apolloConn    = getApolloConnection(siteId);
  const linkedinConn  = getLinkedinUserConn(req.user.userId);
  const linkedinLink  = getLinkedinSiteLink(siteId);
  const googleConn    = getGoogleAdsUserConn(req.user.userId);
  const googleLink    = getGoogleAdsSiteLink(siteId);

  const apolloRows    = apolloConn ? getApolloDailyTotals(siteId, { startDate, endDate }) : [];
  const linkedinRows  = linkedinConn && linkedinLink ? getLinkedinDailyRows(siteId, { startDate, endDate }) : [];
  const googleAdsRows = googleConn && googleLink ? getGoogleAdsDailyRows(siteId, { startDate, endDate }) : [];

  const apolloSummary   = apolloConn ? getApolloSummary(siteId, { startDate, endDate }) : null;
  const linkedinSummary = linkedinConn && linkedinLink ? getLinkedinSummary(siteId, { startDate, endDate }) : null;
  const googleSummary   = googleConn && googleLink ? getGoogleAdsSummary(siteId, { startDate, endDate }) : null;

  const daily = mergeDailyByDate(apolloRows, linkedinRows, googleAdsRows);

  return res.status(200).json({
    sources: {
      apollo:    { connected: !!apolloConn,                   summary: apolloSummary },
      linkedin:  { connected: !!(linkedinConn && linkedinLink), summary: linkedinSummary, orgName: linkedinLink?.org_name },
      googleAds: { connected: !!(googleConn && googleLink),    summary: googleSummary,   accountName: googleLink?.account_name },
    },
    daily,
  });
});
