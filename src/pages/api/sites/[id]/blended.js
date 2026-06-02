import { withAuth } from '@/lib/withAuth';
import { getDb } from '@/lib/db';
import { getApolloConnection, getApolloDailyTotals, getApolloSummary } from '@/lib/apollo';
import { getLinkedinSiteLink, getLinkedinUserConn, getLinkedinDailyRows, getLinkedinSummary } from '@/lib/linkedin-organic';
import { getGoogleAdsUserConn, getGoogleAdsSiteLink, getGoogleAdsDailyRows, getGoogleAdsSummary } from '@/lib/google-ads';
import { getInstagramUserConn, getInstagramSiteLink, getInstagramDailyRows, getInstagramSummary } from '@/lib/instagram';
import { getTiktokUserConn, getTiktokSiteLink, getTiktokDailyRows, getTiktokSummary } from '@/lib/tiktok';
import { getGa4SiteLink, getGa4AccessTokenForSite, runReport, rowsFromReport } from '@/lib/ga4';
import { readGa4DailyCache, syncGa4Site } from '@/lib/ga4-sync';
import { getFormSubmissionCount, getPurchaseStats, isWebsiteSite } from '@/lib/website-supabase';

function dateRange(period) {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const map = { '24h': 1, '7d': 7, '30d': 30, '90d': 90, '12m': 365 };
  const days = map[period] || 30;
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - days);
  // Previous comparable window
  const prevEnd = new Date(start);
  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevStart.getUTCDate() - days);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end,
    prevStartDate: prevStart.toISOString().slice(0, 10),
    prevEndDate: prevEnd.toISOString().slice(0, 10),
    days,
  };
}

// Heuristic path matchers for funnel mid-stages (case-insensitive substring).
const FUNNEL_PATH_PATTERNS = {
  leadForm:  ['/lead', '/contact', '/signup', '/sign-up', '/get-started', '/demo', '/quote', '/form'],
  reportPage:['/report', '/product', '/pricing', '/plans', '/buy', '/shop'],
  checkout:  ['/checkout', '/cart', '/payment', '/billing', '/subscribe'],
};

function pctChange(curr, prev) {
  // When there's no prior data, return null so the UI can show "—" instead of a
  // misleading "+100%". A jump from 0 to anything isn't a percentage.
  if (!prev || prev === 0) return null;
  return +(((curr - prev) / prev) * 100).toFixed(1);
}

function mergeDailyByDate(apolloRows, linkedinRows, googleAdsRows, igRows, ttRows, gscRows) {
  const all = {};
  const ensure = (date) => {
    if (!all[date]) all[date] = {
      date,
      email_sent: 0, email_opens: 0, email_clicks: 0, email_open_rate: 0, email_click_rate: 0, email_replies: 0,
      li_impressions: 0, li_clicks: 0, li_likes: 0, li_comments: 0, li_shares: 0, li_ctr: 0,
      ads_impressions: 0, ads_clicks: 0, ads_ctr: 0, ads_conversions: 0, ads_cvr: 0, ads_spend: 0,
      ig_reach: 0, ig_impressions: 0, ig_followers: 0, ig_likes: 0, ig_comments: 0, ig_shares: 0, ig_saves: 0,
      tt_followers: 0, tt_views: 0, tt_likes: 0, tt_comments: 0, tt_shares: 0,
      gsc_clicks: 0, gsc_impressions: 0, gsc_ctr: 0, gsc_position: 0,
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
  for (const r of igRows) {
    const d = ensure(r.date);
    d.ig_reach = r.reach; d.ig_impressions = r.impressions; d.ig_followers = r.followers;
    d.ig_likes = r.likes; d.ig_comments = r.comments; d.ig_shares = r.shares; d.ig_saves = r.saves;
  }
  for (const r of ttRows) {
    const d = ensure(r.date);
    d.tt_followers = r.followers; d.tt_views = r.views;
    d.tt_likes = r.video_likes; d.tt_comments = r.video_comments; d.tt_shares = r.video_shares;
  }
  for (const r of gscRows) {
    const d = ensure(r.date);
    d.gsc_clicks = r.clicks; d.gsc_impressions = r.impressions;
    d.gsc_ctr = r.ctr; d.gsc_position = r.position;
  }
  return Object.values(all).sort((a, b) => a.date.localeCompare(b.date));
}

export default withAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { id: siteId, period = '30d' } = req.query;

  const db = getDb();
  const site = db.prepare('SELECT * FROM sites WHERE id = ? AND user_id = ?').get(siteId, req.user.userId);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  // This site IS the marketing website when its domain matches WEBSITE_SUPABASE_SITE_DOMAIN
  // (e.g. theravenry.com) and the website Supabase is configured. Drives real leads/purchases.
  const siteIsWebsite = isWebsiteSite(site.domain);

  const { startDate, endDate, prevStartDate, prevEndDate } = dateRange(period);

  const apolloConn    = getApolloConnection(siteId);
  const linkedinConn  = getLinkedinUserConn(req.user.userId);
  const linkedinLink  = getLinkedinSiteLink(siteId);
  const googleConn    = getGoogleAdsUserConn(req.user.userId);
  const googleLink    = getGoogleAdsSiteLink(siteId);
  const igConn        = getInstagramUserConn(req.user.userId);
  const igLink        = getInstagramSiteLink(siteId);
  const ttConn        = getTiktokUserConn(req.user.userId);
  const ttLink        = getTiktokSiteLink(siteId);

  const apolloRows    = apolloConn ? getApolloDailyTotals(siteId, { startDate, endDate }) : [];
  const linkedinRows  = linkedinConn && linkedinLink ? getLinkedinDailyRows(siteId, { startDate, endDate }) : [];
  const googleAdsRows = googleConn && googleLink ? getGoogleAdsDailyRows(siteId, { startDate, endDate }) : [];
  const igRows        = igConn && igLink ? getInstagramDailyRows(siteId, { startDate, endDate }) : [];
  const ttRows        = ttConn && ttLink ? getTiktokDailyRows(siteId, { startDate, endDate }) : [];

  const apolloSummary   = apolloConn ? getApolloSummary(siteId, { startDate, endDate }) : null;
  const linkedinSummary = linkedinConn && linkedinLink ? getLinkedinSummary(siteId, { startDate, endDate }) : null;
  const googleSummary   = googleConn && googleLink ? getGoogleAdsSummary(siteId, { startDate, endDate }) : null;
  const igSummary       = igConn && igLink ? getInstagramSummary(siteId, { startDate, endDate }) : null;
  const ttSummary       = ttConn && ttLink ? getTiktokSummary(siteId, { startDate, endDate }) : null;

  let gscDailyRows = [];
  try {
    gscDailyRows = db.prepare(
      `SELECT date, clicks, impressions, ctr, position
       FROM gsc_daily_totals
       WHERE site_id = ? AND date BETWEEN ? AND ?
       ORDER BY date ASC`
    ).all(siteId, startDate, endDate);
  } catch {
    // table not yet created
  }

  const daily = mergeDailyByDate(apolloRows, linkedinRows, googleAdsRows, igRows, ttRows, gscDailyRows);

  // ── Web analytics totals + per-channel sessions (for Sankey funnel) ──
  const dateEnd = endDate + ' 23:59:59';
  const prevDateEnd = prevEndDate + ' 23:59:59';

  const siteTotalsQ = db.prepare(
    `SELECT
       COUNT(*) AS total_sessions,
       COALESCE(SUM(is_bounce), 0) AS total_bounces
     FROM sessions
     WHERE site_id = ? AND datetime(started_at) BETWEEN ? AND ?`
  );
  const siteTotals = siteTotalsQ.get(siteId, startDate, dateEnd);
  const prevSiteTotals = siteTotalsQ.get(siteId, prevStartDate, prevDateEnd);

  const convTotalsQ = db.prepare(
    `SELECT COUNT(*) AS total_conversions, COALESCE(SUM(amount), 0) AS total_revenue
     FROM conversions
     WHERE site_id = ? AND status = 'completed'
     AND datetime(created_at) BETWEEN ? AND ?`
  );
  const convTotals = convTotalsQ.get(siteId, startDate, dateEnd);
  const prevConvTotals = convTotalsQ.get(siteId, prevStartDate, prevDateEnd);

  // Pull both utm_source and utm_medium so we can distinguish ads vs organic per channel.
  const webSources = db.prepare(
    `SELECT
       COALESCE(LOWER(utm_source), '') AS source,
       COALESCE(LOWER(utm_medium), '') AS medium,
       COALESCE(LOWER(referrer_domain), '') AS referrer,
       COUNT(*) AS sessions,
       COALESCE(SUM(is_bounce), 0) AS bounces
     FROM sessions
     WHERE site_id = ? AND datetime(started_at) BETWEEN ? AND ?
     GROUP BY source, medium, referrer`
  ).all(siteId, startDate, dateEnd);

  const convBySource = db.prepare(
    `SELECT
       COALESCE(LOWER(s.utm_source), '') AS source,
       COALESCE(LOWER(s.utm_medium), '') AS medium,
       COALESCE(LOWER(s.referrer_domain), '') AS referrer,
       COUNT(*) AS conversions,
       COALESCE(SUM(c.amount), 0) AS revenue
     FROM conversions c
     INNER JOIN sessions s ON s.site_id = c.site_id AND s.id = c.session_id
     WHERE c.site_id = ? AND c.status = 'completed'
     AND datetime(c.created_at) BETWEEN ? AND ?
     GROUP BY source, medium, referrer`
  ).all(siteId, startDate, dateEnd);

  // ── GSC (organic search) totals ──
  let gscTotals = { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  let prevGscTotals = { clicks: 0 };
  try {
    const gscQ = db.prepare(
      `SELECT
         COALESCE(SUM(clicks), 0) AS clicks,
         COALESCE(SUM(impressions), 0) AS impressions,
         CASE WHEN SUM(impressions) > 0
           THEN SUM(position * impressions) * 1.0 / SUM(impressions)
           ELSE 0 END AS position,
         CASE WHEN SUM(impressions) > 0
           THEN SUM(clicks) * 1.0 / SUM(impressions)
           ELSE 0 END AS ctr
       FROM gsc_daily_totals
       WHERE site_id = ? AND date BETWEEN ? AND ?`
    );
    gscTotals = gscQ.get(siteId, startDate, endDate) || gscTotals;
    prevGscTotals = gscQ.get(siteId, prevStartDate, prevEndDate) || prevGscTotals;
  } catch {
    // gsc_daily_totals table may not exist on older deployments — silently fall back
  }

  // ── Real funnel mid-stages from page_views (heuristic path match) ──
  function pageViewsWhere(patterns) {
    return patterns.map(() => 'LOWER(pathname) LIKE ?').join(' OR ');
  }
  function pageViewsParams(patterns) {
    return patterns.map((p) => `%${p}%`);
  }
  function countPageViews(patterns, sStart, sEnd) {
    if (!patterns.length) return 0;
    const row = db.prepare(
      `SELECT COUNT(*) AS n FROM page_views
       WHERE site_id = ? AND datetime(timestamp) BETWEEN ? AND ?
       AND (${pageViewsWhere(patterns)})`
    ).get(siteId, sStart, sEnd, ...pageViewsParams(patterns));
    return row?.n || 0;
  }
  let leadFormViewsReal  = countPageViews(FUNNEL_PATH_PATTERNS.leadForm,   startDate, dateEnd);
  let reportPageViewsReal = countPageViews(FUNNEL_PATH_PATTERNS.reportPage, startDate, dateEnd);
  let checkoutViewsReal  = countPageViews(FUNNEL_PATH_PATTERNS.checkout,   startDate, dateEnd);
  let prevLeadFormViews  = countPageViews(FUNNEL_PATH_PATTERNS.leadForm,   prevStartDate, prevDateEnd);
  let prevReportPageViews = countPageViews(FUNNEL_PATH_PATTERNS.reportPage, prevStartDate, prevDateEnd);
  let prevCheckoutViews  = countPageViews(FUNNEL_PATH_PATTERNS.checkout,   prevStartDate, prevDateEnd);

  // ── If GA4 is linked, override sessions/bounces/path-view counts with GA4 data ──
  // Conversions/revenue stay from Stripe; channel attribution still uses our CHANNEL_DEFS
  // matchers (fed with GA4 sessionSource/sessionMedium instead of tracker UTMs).
  const ga4Link = getGa4SiteLink(siteId);
  let ga4Used = false;
  if (ga4Link) {
    try {
      // Read cached daily rows first — populated by the ga4-sync cron.
      // If the cache covers the requested range, skip the live totals + timeseries calls.
      let cacheCurr = readGa4DailyCache(siteId, startDate, endDate);
      let cachePrev = readGa4DailyCache(siteId, prevStartDate, prevEndDate);

      // Cold-start fallback: no cache row yet → trigger a one-off sync (blocking)
      // so the first request still gets data. Subsequent requests use the cache.
      if (cacheCurr.length === 0) {
        // Best-effort: a sync failure must NOT abort the GA4 override — the live totals
        // below still populate the KPIs even if the daily cache can't be written.
        try {
          await syncGa4Site(siteId, { backfill: true });
          cacheCurr = readGa4DailyCache(siteId, startDate, endDate);
          cachePrev = readGa4DailyCache(siteId, prevStartDate, prevEndDate);
        } catch (e) {
          console.error('[Blended GA4 sync]', e.message);
        }
      }

      const accessToken = await getGa4AccessTokenForSite(siteId);
      const propertyId = ga4Link.property_id;
      const pathFilter = (patterns) => ({
        orGroup: {
          expressions: patterns.map((p) => ({
            filter: { fieldName: 'pagePath', stringFilter: { matchType: 'CONTAINS', value: p, caseSensitive: false } },
          })),
        },
      });
      // Live calls only for breakdowns we don't cache (per-source, per-path).
      const [sourcesCurr, leadCurr, reportCurr, checkoutCurr, leadPrev, reportPrev, checkoutPrev, engagedCurr, engagedPrev] = await Promise.all([
        runReport({ accessToken, propertyId, startDate, endDate,
          dimensions: ['sessionSource', 'sessionMedium', 'sessionDefaultChannelGroup'], metrics: ['sessions', 'bounceRate'], limit: 500 }),
        runReport({ accessToken, propertyId, startDate, endDate, metrics: ['screenPageViews'], dimensionFilter: pathFilter(FUNNEL_PATH_PATTERNS.leadForm) }),
        runReport({ accessToken, propertyId, startDate, endDate, metrics: ['screenPageViews'], dimensionFilter: pathFilter(FUNNEL_PATH_PATTERNS.reportPage) }),
        runReport({ accessToken, propertyId, startDate, endDate, metrics: ['screenPageViews'], dimensionFilter: pathFilter(FUNNEL_PATH_PATTERNS.checkout) }),
        runReport({ accessToken, propertyId, startDate: prevStartDate, endDate: prevEndDate, metrics: ['screenPageViews'], dimensionFilter: pathFilter(FUNNEL_PATH_PATTERNS.leadForm) }),
        runReport({ accessToken, propertyId, startDate: prevStartDate, endDate: prevEndDate, metrics: ['screenPageViews'], dimensionFilter: pathFilter(FUNNEL_PATH_PATTERNS.reportPage) }),
        runReport({ accessToken, propertyId, startDate: prevStartDate, endDate: prevEndDate, metrics: ['screenPageViews'], dimensionFilter: pathFilter(FUNNEL_PATH_PATTERNS.checkout) }),
        runReport({ accessToken, propertyId, startDate, endDate, metrics: ['sessions', 'bounceRate', 'engagedSessions'] }),
        runReport({ accessToken, propertyId, startDate: prevStartDate, endDate: prevEndDate, metrics: ['sessions', 'bounceRate', 'engagedSessions'] }),
      ]);

      // Sum cached daily rows to get totals (saves 2 GA4 API calls).
      const sumRows = (rows) => rows.reduce((acc, r) => {
        acc.sessions += r.sessions || 0;
        acc.users    += r.users || 0;
        acc.bouncedSessions += Math.round((r.bounce_rate || 0) * (r.sessions || 0));
        // engagedSessions ~ sessions - bouncedSessions (good enough; GA4 also gives this directly if needed)
        acc.engagedSessions += Math.max(0, (r.sessions || 0) - Math.round((r.bounce_rate || 0) * (r.sessions || 0)));
        return acc;
      }, { sessions: 0, users: 0, bouncedSessions: 0, engagedSessions: 0 });
      const cur = sumRows(cacheCurr);
      const pre = sumRows(cachePrev);
      // Totals come from a LIVE GA4 report so the funnel KPIs (sessions, bounce, engaged)
      // match the /analytics GA4 overview even when the daily cache is empty. Fall back to
      // the summed cache if a live value is missing.
      const liveCur = rowsFromReport(engagedCurr)[0] || {};
      const livePre = rowsFromReport(engagedPrev)[0] || {};
      siteTotals.total_sessions   = Math.round(liveCur.sessions || cur.sessions || 0);
      siteTotals.total_bounces    = liveCur.sessions != null ? Math.round((liveCur.bounceRate || 0) * liveCur.sessions) : (cur.bouncedSessions || 0);
      siteTotals.engaged_sessions = Math.round(liveCur.engagedSessions || cur.engagedSessions || 0);
      prevSiteTotals.total_sessions   = Math.round(livePre.sessions || pre.sessions || 0);
      prevSiteTotals.total_bounces    = livePre.sessions != null ? Math.round((livePre.bounceRate || 0) * livePre.sessions) : (pre.bouncedSessions || 0);
      prevSiteTotals.engaged_sessions = Math.round(livePre.engagedSessions || pre.engagedSessions || 0);

      // Daily GA4 sessions/users — read from cache
      const ga4DailyRows = cacheCurr.map((r) => ({
        date: r.date,
        ga_sessions: r.sessions,
        ga_users: r.users,
        ga_engaged: Math.max(0, (r.sessions || 0) - Math.round((r.bounce_rate || 0) * (r.sessions || 0))),
      }));
      // Merge into existing `daily` (mergeDailyByDate already ran with empty GA placeholder)
      for (const r of ga4DailyRows) {
        const existing = daily.find((d) => d.date === r.date);
        if (existing) Object.assign(existing, r);
        else daily.push({ date: r.date, ...r });
      }
      daily.sort((a, b) => a.date.localeCompare(b.date));

      // Replace tracker-derived webSources with GA4 source/medium rows so existing
      // CHANNEL_DEFS attribution logic picks them up unchanged.
      webSources.length = 0;
      for (const r of rowsFromReport(sourcesCurr)) {
        webSources.push({
          source:       (r.sessionSource || '').toLowerCase(),
          medium:       (r.sessionMedium || '').toLowerCase(),
          referrer:     (r.sessionSource || '').toLowerCase(),
          channelGroup: r.sessionDefaultChannelGroup || '',
          sessions: Math.round(r.sessions || 0),
          bounces:  Math.round((r.bounceRate || 0) * (r.sessions || 0)),
        });
      }

      leadFormViewsReal   = Math.round(rowsFromReport(leadCurr)[0]?.screenPageViews   || 0);
      reportPageViewsReal = Math.round(rowsFromReport(reportCurr)[0]?.screenPageViews || 0);
      checkoutViewsReal   = Math.round(rowsFromReport(checkoutCurr)[0]?.screenPageViews || 0);
      prevLeadFormViews   = Math.round(rowsFromReport(leadPrev)[0]?.screenPageViews   || 0);
      prevReportPageViews = Math.round(rowsFromReport(reportPrev)[0]?.screenPageViews || 0);
      prevCheckoutViews   = Math.round(rowsFromReport(checkoutPrev)[0]?.screenPageViews || 0);
      ga4Used = true;
    } catch (err) {
      console.error('[Blended GA4 override]', err.message);
    }
  }

  // ── Split total conversions across Lead vs Purchase paths ──
  // Set logic:
  //   purchase     = conversions whose session viewed any /checkout* page (B)
  //   formSubmitted = conversions whose session viewed any /lead* page AND no /checkout* page (A \ B)
  // This guarantees the two sets are disjoint, so there's no double-counting.
  function convWithAnyPath(includePatterns, excludePatterns, sStart, sEnd) {
    if (!includePatterns.length) return { count: 0, revenue: 0 };
    const incWhere = includePatterns.map(() => 'LOWER(pv.pathname) LIKE ?').join(' OR ');
    const incParams = includePatterns.map(p => `%${p}%`);
    let excludeClause = '';
    const excludeParams = [];
    if (excludePatterns && excludePatterns.length) {
      const excWhere = excludePatterns.map(() => 'LOWER(pv2.pathname) LIKE ?').join(' OR ');
      excludeClause = `AND NOT EXISTS (
        SELECT 1 FROM page_views pv2
        WHERE pv2.site_id = c.site_id AND pv2.session_id = c.session_id
        AND (${excWhere})
      )`;
      excludeParams.push(...excludePatterns.map(p => `%${p}%`));
    }
    const row = db.prepare(
      `SELECT COUNT(DISTINCT c.id) AS n, COALESCE(SUM(c.amount), 0) AS revenue
       FROM conversions c
       INNER JOIN page_views pv ON pv.site_id = c.site_id AND pv.session_id = c.session_id
       WHERE c.site_id = ? AND c.status = 'completed'
       AND datetime(c.created_at) BETWEEN ? AND ?
       AND (${incWhere})
       ${excludeClause}`
    ).get(siteId, sStart, sEnd, ...incParams, ...excludeParams);
    return { count: row?.n || 0, revenue: row?.revenue || 0 };
  }
  const purchaseConv     = convWithAnyPath(FUNNEL_PATH_PATTERNS.checkout, null, startDate, dateEnd);
  const formSubmittedRaw = convWithAnyPath(FUNNEL_PATH_PATTERNS.leadForm, FUNNEL_PATH_PATTERNS.checkout, startDate, dateEnd);
  let formSubmittedReal = formSubmittedRaw.count;
  let purchaseReal        = purchaseConv.count;
  let purchaseRevenueReal = purchaseConv.revenue;
  const prevPurchaseConv     = convWithAnyPath(FUNNEL_PATH_PATTERNS.checkout, null, prevStartDate, prevDateEnd);
  const prevFormSubmittedRaw = convWithAnyPath(FUNNEL_PATH_PATTERNS.leadForm, FUNNEL_PATH_PATTERNS.checkout, prevStartDate, prevDateEnd);
  let prevFormSubmitted = prevFormSubmittedRaw.count;
  let prevPurchase      = prevPurchaseConv.count;

  // When this site IS the marketing website (domain match), use first-party data:
  // Leads from Supabase form submissions, Purchases + revenue from Stripe (orders table).
  let stripeRevenue = null;
  let prevStripeRevenue = null;
  if (siteIsWebsite) {
    try {
      const [realLeads, prevRealLeads, purch, prevPurch] = await Promise.all([
        getFormSubmissionCount({ startDate, endDate }),
        getFormSubmissionCount({ startDate: prevStartDate, endDate: prevEndDate }),
        getPurchaseStats({ startDate, endDate }),
        getPurchaseStats({ startDate: prevStartDate, endDate: prevEndDate }),
      ]);
      if (realLeads > 0) {
        formSubmittedReal = realLeads;
        leadFormViewsReal = Math.max(leadFormViewsReal, realLeads); // ensure the lead branch renders
      }
      if (prevRealLeads > 0) {
        prevFormSubmitted = prevRealLeads;
        prevLeadFormViews = Math.max(prevLeadFormViews, prevRealLeads);
      }
      purchaseReal        = purch.count;
      purchaseRevenueReal = purch.revenue;
      stripeRevenue       = purch.revenue;
      prevPurchase        = prevPurch.count;
      prevStripeRevenue   = prevPurch.revenue;
    } catch (err) {
      console.error('[Blended website Supabase]', err.message);
    }
  }

  // ── Strict channel attribution by (utm_source, utm_medium, referrer, [GA4 channelGroup]) ──
  // First-match wins, so no double-counting. When GA4 is the source, channelGroup is
  // preferred because GA4 already does smart classification (Organic Search, Paid Social, etc.).
  const PAID_MEDIUMS = ['cpc', 'ppc', 'paid', 'paid_social', 'paidsocial', 'paid-social', 'display'];
  const isPaid    = (m) => PAID_MEDIUMS.includes(m);
  const inSource  = (r, sub) => (r.source || '').includes(sub);
  const inRef     = (r, sub) => (r.referrer || '').includes(sub);
  const inGroup   = (r, ...groups) => groups.includes(r.channelGroup);

  // GSC is connected if there is recorded GSC data for this site (gsc_daily_totals has rows).
  const gscConnected = (gscTotals.clicks || 0) > 0 || (gscTotals.impressions || 0) > 0;

  const CHANNEL_DEFS = [
    { key: 'googleAds',    name: 'Google Ads',       color: '#f59e0b', connected: !!(googleConn && googleLink),
      match: (r) => inGroup(r, 'Paid Search', 'Cross-network')
        || ((inSource(r, 'google') || inSource(r, 'gads') || inSource(r, 'adwords')) && isPaid(r.medium)),
      platformClicks: googleSummary?.total_clicks || 0,
      platformImpressions: googleSummary?.total_impressions || 0,
      platformConversions: Math.round(googleSummary?.total_conversions || 0) },
    { key: 'gsc',          name: 'Organic Search',   color: '#10b981', connected: gscConnected,
      match: (r) => inGroup(r, 'Organic Search')
        || (!isPaid(r.medium) && (r.medium === 'organic' || inSource(r, 'google') || inSource(r, 'bing') || inSource(r, 'duckduckgo') || inRef(r, 'google.') || inRef(r, 'bing.') || inRef(r, 'duckduckgo.'))),
      platformClicks: gscTotals.clicks || 0,
      platformImpressions: gscTotals.impressions || 0,
      platformConversions: 0 },
    { key: 'linkedinAds',  name: 'LinkedIn Ads',     color: '#0e76a8', connected: false, isAd: true,
      match: (r) => (inGroup(r, 'Paid Social') && (inSource(r, 'linkedin') || inRef(r, 'linkedin.')))
        || (inSource(r, 'linkedin') && isPaid(r.medium)),
      platformClicks: 0, platformImpressions: 0, platformConversions: 0 },
    { key: 'linkedin',     name: 'LinkedIn Organic', color: '#0a66c2', connected: !!(linkedinConn && linkedinLink),
      match: (r) => (inGroup(r, 'Organic Social', 'Referral') && (inSource(r, 'linkedin') || inRef(r, 'linkedin.') || inRef(r, 'lnkd.')))
        || ((inSource(r, 'linkedin') || inRef(r, 'linkedin.')) && !isPaid(r.medium)),
      platformClicks: linkedinSummary?.total_clicks || 0,
      platformImpressions: linkedinSummary?.total_impressions || 0,
      platformConversions: 0 },
    { key: 'instagramAds', name: 'Instagram Ads',    color: '#c13584', connected: false, isAd: true,
      match: (r) => (inGroup(r, 'Paid Social') && (inSource(r, 'instagram') || inSource(r, 'ig')))
        || ((inSource(r, 'instagram') || inSource(r, 'ig')) && isPaid(r.medium)),
      platformClicks: 0, platformImpressions: 0, platformConversions: 0 },
    { key: 'instagram',    name: 'Instagram',        color: '#e1306c', connected: !!(igConn && igLink),
      match: (r) => (inGroup(r, 'Organic Social', 'Referral') && (inSource(r, 'instagram') || inRef(r, 'instagram.') || inRef(r, 'l.instagram.')))
        || ((inSource(r, 'instagram') || inRef(r, 'instagram.') || inRef(r, 'l.instagram.')) && !isPaid(r.medium)),
      platformClicks: 0,
      platformImpressions: igSummary?.total_reach || 0,
      platformConversions: 0 },
    { key: 'tiktokAds',    name: 'TikTok Ads',       color: '#25F4EE', connected: false, isAd: true,
      match: (r) => (inGroup(r, 'Paid Social') && (inSource(r, 'tiktok') || inSource(r, 'tt')))
        || ((inSource(r, 'tiktok') || inSource(r, 'tt')) && isPaid(r.medium)),
      platformClicks: 0, platformImpressions: 0, platformConversions: 0 },
    { key: 'tiktok',       name: 'TikTok',           color: '#69C9D0', connected: !!(ttConn && ttLink),
      match: (r) => (inGroup(r, 'Organic Social', 'Referral') && (inSource(r, 'tiktok') || inRef(r, 'tiktok.')))
        || ((inSource(r, 'tiktok') || inRef(r, 'tiktok.')) && !isPaid(r.medium)),
      platformClicks: 0,
      platformImpressions: ttSummary?.total_views || 0,
      platformConversions: 0 },
    { key: 'apollo',       name: 'Apollo Email',     color: '#6366f1', connected: !!apolloConn,
      match: (r) => inGroup(r, 'Email') || inSource(r, 'apollo') || r.medium === 'email',
      platformClicks: apolloSummary?.total_clicks || 0,
      platformImpressions: apolloSummary?.total_sent || 0,
      platformConversions: apolloSummary?.total_replies || 0 },
  ];

  const buckets = Object.fromEntries(CHANNEL_DEFS.map(c => [c.key, { sessions: 0, bounces: 0, conversions: 0, revenue: 0 }]));
  let directSessions = 0, directBounces = 0, directConversions = 0, directRevenue = 0;
  for (const r of webSources) {
    const def = CHANNEL_DEFS.find(c => c.match(r));
    if (def) { buckets[def.key].sessions += r.sessions || 0; buckets[def.key].bounces += r.bounces || 0; }
    else     { directSessions += r.sessions || 0; directBounces += r.bounces || 0; }
  }
  for (const r of convBySource) {
    const def = CHANNEL_DEFS.find(c => c.match(r));
    if (def) { buckets[def.key].conversions += r.conversions || 0; buckets[def.key].revenue += r.revenue || 0; }
    else     { directConversions += r.conversions || 0; directRevenue += r.revenue || 0; }
  }

  const channels = CHANNEL_DEFS
    .map(def => {
      const b = buckets[def.key];
      return {
        key: def.key, name: def.name, color: def.color, connected: def.connected, isAd: !!def.isAd,
        sessions:    b.sessions    || def.platformClicks      || 0,
        bounces:     b.bounces,
        conversions: b.conversions || def.platformConversions || 0,
        revenue:     b.revenue,
        platformClicks: def.platformClicks,
        platformImpressions: def.platformImpressions,
      };
    })
    // Hide synthetic ad-only channels with zero activity
    .filter(c => !c.isAd || c.sessions > 0 || c.conversions > 0);

  if (directSessions > 0 || directConversions > 0) {
    channels.push({
      key: 'direct', name: 'Direct / Other', color: '#6b7280', connected: true, isAd: false,
      sessions: directSessions, bounces: directBounces,
      conversions: directConversions, revenue: directRevenue,
      platformClicks: 0, platformImpressions: 0,
    });
  }

  // Prefer the GA4 (or tracker) site total for the headline Sessions KPI + all
  // session-based rates, so it matches the /analytics GA4 overview and is consistent
  // with engaged/bounces (which already use siteTotals). Channel breakdown still uses
  // each channel's own sessions.
  const channelSessions = channels.reduce((a, c) => a + c.sessions, 0);
  const totalSessions = siteTotals.total_sessions || channelSessions;
  const totalConversions = channels.reduce((a, c) => a + c.conversions, 0);
  const totalBounces = siteTotals.total_bounces || channels.reduce((a, c) => a + (c.bounces || 0), 0);

  // Previous totals (for deltas)
  const prevTotalConversions = prevConvTotals.total_conversions || 0;
  const prevTotalSessions = prevSiteTotals.total_sessions || 0;
  const prevVisitsToCTA = Math.max(0, prevTotalSessions - (prevSiteTotals.total_bounces || 0));

  return res.status(200).json({
    meta: { ga4Used },
    sources: {
      apollo:    { connected: !!apolloConn,                     summary: apolloSummary },
      linkedin:  { connected: !!(linkedinConn && linkedinLink), summary: linkedinSummary, orgName: linkedinLink?.org_name },
      googleAds: { connected: !!(googleConn && googleLink),     summary: googleSummary,   accountName: googleLink?.account_name },
      instagram: { connected: !!(igConn && igLink),             summary: igSummary,       igUsername: igLink?.ig_username },
      tiktok:    { connected: !!(ttConn && ttLink),             summary: ttSummary,       tiktokUsername: ttLink?.tiktok_username },
      gsc:       { connected: gscConnected,                     summary: gscTotals },
    },
    funnel: {
      totals: {
        sessions: totalSessions,
        bounces: totalBounces,
        engagedSessions: siteTotals.engaged_sessions ?? null,
        conversions: totalConversions,
        revenue: stripeRevenue != null ? stripeRevenue : (convTotals.total_revenue || 0),
      },
      // Real volumes from page_views (heuristic path match). UI can prefer these
      // over the dummy ratios when they are non-zero.
      stages: {
        leadFormView: leadFormViewsReal,
        reportPageView: reportPageViewsReal,
        checkoutView: checkoutViewsReal,
        formSubmitted: formSubmittedReal,
        purchase: purchaseReal,
        purchaseRevenue: purchaseRevenueReal,
        gscClicks: gscTotals.clicks || 0,
        gscImpressions: gscTotals.impressions || 0,
      },
      previous: {
        sessions: prevTotalSessions,
        bounces: prevSiteTotals.total_bounces || 0,
        conversions: prevTotalConversions,
        revenue: prevStripeRevenue != null ? prevStripeRevenue : (prevConvTotals.total_revenue || 0),
        visitsToCTA: prevVisitsToCTA,
        leadFormView: prevLeadFormViews,
        reportPageView: prevReportPageViews,
        checkoutView: prevCheckoutViews,
        formSubmitted: prevFormSubmitted,
        purchase: prevPurchase,
        gscClicks: prevGscTotals.clicks || 0,
      },
      changes: {
        sessions:       pctChange(totalSessions, prevTotalSessions),
        conversions:    pctChange(totalConversions, prevTotalConversions),
        revenue:        pctChange(
          stripeRevenue != null ? stripeRevenue : (convTotals.total_revenue || 0),
          prevStripeRevenue != null ? prevStripeRevenue : (prevConvTotals.total_revenue || 0),
        ),
        ctaRate:        pctChange(
          // Prefer GA4 engagedSessions when available; else fall back to non-bounce ratio.
          totalSessions ? (siteTotals.engaged_sessions ?? (totalSessions - totalBounces)) / totalSessions : 0,
          prevTotalSessions ? (prevSiteTotals.engaged_sessions ?? (prevTotalSessions - (prevSiteTotals.total_bounces || 0))) / prevTotalSessions : 0,
        ),
        leadCVR:        pctChange(
          totalSessions ? totalConversions / totalSessions : 0,
          prevTotalSessions ? prevTotalConversions / prevTotalSessions : 0,
        ),
        checkoutRate:   pctChange(
          reportPageViewsReal ? checkoutViewsReal / reportPageViewsReal : 0,
          prevReportPageViews ? prevCheckoutViews / prevReportPageViews : 0,
        ),
      },
      channels,
    },
    daily,
  });
});
