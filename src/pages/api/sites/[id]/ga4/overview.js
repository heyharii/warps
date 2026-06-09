import { withAuth } from '@/lib/withAuth';
import { getDb } from '@/lib/db';
import {
  getGa4SiteLink,
  getGa4AccessTokenForSite,
  runReport,
  rowsFromReport,
} from '@/lib/ga4';

function shiftDate(d, days) {
  const dt = new Date(d);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function parsePeriod(period) {
  const today = new Date().toISOString().slice(0, 10);
  const map = { '1d': 1, '7d': 7, '30d': 30, '90d': 90, '12m': 365 };
  const days = map[period] || 30;
  const start = shiftDate(today, -(days - 1));
  return {
    startDate: start,
    endDate: today,
    prevStartDate: shiftDate(start, -days),
    prevEndDate: shiftDate(start, -1),
  };
}

export default withAuth(async function handler(req, res) {
  const { id } = req.query;
  const siteId = parseInt(id, 10);
  const db = getDb();
  const site = db.prepare('SELECT id, domain, name FROM sites WHERE id = ?').get(siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  const link = getGa4SiteLink(siteId);
  if (!link) return res.status(400).json({ error: 'No GA4 property linked', needsLink: true });

  const range = parsePeriod(req.query.period || '30d');

  let accessToken;
  try {
    accessToken = await getGa4AccessTokenForSite(siteId);
  } catch (err) {
    return res.status(400).json({ error: err.message, needsReauth: true });
  }

  const propertyId = link.property_id;

  try {
    const [totalsCurr, totalsPrev, timeSeries, sources, countries, devices, browsers, oses, pages] = await Promise.all([
      runReport({ accessToken, propertyId, startDate: range.startDate, endDate: range.endDate,
        metrics: ['activeUsers', 'sessions', 'screenPageViews', 'bounceRate', 'averageSessionDuration'] }),
      runReport({ accessToken, propertyId, startDate: range.prevStartDate, endDate: range.prevEndDate,
        metrics: ['activeUsers', 'sessions', 'screenPageViews', 'bounceRate', 'averageSessionDuration'] }),
      runReport({ accessToken, propertyId, startDate: range.startDate, endDate: range.endDate,
        dimensions: ['date'], metrics: ['activeUsers', 'screenPageViews'],
        orderBys: [{ dimension: { dimensionName: 'date' } }] }),
      runReport({ accessToken, propertyId, startDate: range.startDate, endDate: range.endDate,
        dimensions: ['sessionDefaultChannelGroup'], metrics: ['sessions'],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 20 }),
      runReport({ accessToken, propertyId, startDate: range.startDate, endDate: range.endDate,
        dimensions: ['countryId', 'country'], metrics: ['activeUsers'],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 50 }),
      runReport({ accessToken, propertyId, startDate: range.startDate, endDate: range.endDate,
        dimensions: ['deviceCategory'], metrics: ['activeUsers'],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }] }),
      runReport({ accessToken, propertyId, startDate: range.startDate, endDate: range.endDate,
        dimensions: ['browser'], metrics: ['activeUsers'],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 20 }),
      runReport({ accessToken, propertyId, startDate: range.startDate, endDate: range.endDate,
        dimensions: ['operatingSystem'], metrics: ['activeUsers'],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 20 }),
      runReport({ accessToken, propertyId, startDate: range.startDate, endDate: range.endDate,
        dimensions: ['pagePath'], metrics: ['activeUsers', 'screenPageViews'],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 50 }),
    ]);

    db.prepare("UPDATE ga4_site_links SET last_sync_at = datetime('now'), last_error = NULL WHERE site_id = ?").run(siteId);

    const curr = rowsFromReport(totalsCurr)[0] || {};
    const prev = rowsFromReport(totalsPrev)[0] || {};

    const pctChange = (a, b) => (!b || b === 0) ? (a > 0 ? 100 : 0) : +(((a - b) / b) * 100).toFixed(1);

    return res.status(200).json({
      source: 'ga4',
      property: { id: link.property_id, name: link.property_name, account: link.account_name },
      site: { id: site.id, name: site.name, domain: site.domain },
      range,
      current: {
        visitors: Math.round(curr.activeUsers || 0),
        sessions: Math.round(curr.sessions || 0),
        pageViews: Math.round(curr.screenPageViews || 0),
        bounceRate: +((curr.bounceRate || 0) * 100).toFixed(1),
        avgDuration: Math.round(curr.averageSessionDuration || 0),
      },
      changes: {
        visitors: pctChange(curr.activeUsers, prev.activeUsers),
        sessions: pctChange(curr.sessions, prev.sessions),
        pageViews: pctChange(curr.screenPageViews, prev.screenPageViews),
        bounceRate: pctChange(curr.bounceRate, prev.bounceRate),
        avgDuration: pctChange(curr.averageSessionDuration, prev.averageSessionDuration),
      },
      timeSeries: rowsFromReport(timeSeries).map((r) => ({
        date: r.date ? `${r.date.slice(0, 4)}-${r.date.slice(4, 6)}-${r.date.slice(6, 8)}` : null,
        visitors: Math.round(r.activeUsers || 0),
        pageViews: Math.round(r.screenPageViews || 0),
      })),
      sources: rowsFromReport(sources).map((r) => ({ channel: r.sessionDefaultChannelGroup || 'Unassigned', visitors: Math.round(r.sessions || 0) })),
      countries: rowsFromReport(countries).map((r) => ({ countryId: r.countryId, country: r.country, visitors: Math.round(r.activeUsers || 0) })),
      devices: rowsFromReport(devices).map((r) => ({ device: r.deviceCategory, visitors: Math.round(r.activeUsers || 0) })),
      browsers: rowsFromReport(browsers).map((r) => ({ browser: r.browser, visitors: Math.round(r.activeUsers || 0) })),
      oses: rowsFromReport(oses).map((r) => ({ os: r.operatingSystem, visitors: Math.round(r.activeUsers || 0) })),
      pages: rowsFromReport(pages).map((r) => ({ page: r.pagePath, visitors: Math.round(r.activeUsers || 0), pageViews: Math.round(r.screenPageViews || 0) })),
    });
  } catch (err) {
    const msg = err.message || String(err);
    db.prepare('UPDATE ga4_site_links SET last_error = ? WHERE site_id = ?').run(msg, siteId);
    const needsReauth = /insufficient|scope|invalid_grant|401|403/i.test(msg);
    return res.status(500).json({ error: msg, needsReauth });
  }
});
