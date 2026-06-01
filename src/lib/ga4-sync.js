import { getDb } from './db';
import { getGa4SiteLink, getGa4AccessTokenForSite, runReport, rowsFromReport } from './ga4';

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}
function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

/**
 * Sync one site's GA4 daily metrics into the ga4_daily cache table.
 * `backfill=true` pulls the last 365 days; otherwise just the last 3
 * (re-write recent days in case GA4 numbers settle late).
 */
export async function syncGa4Site(siteId, { backfill = false } = {}) {
  const db = getDb();
  const link = getGa4SiteLink(siteId);
  if (!link) return { skipped: true, reason: 'no GA4 link' };

  let accessToken;
  try {
    accessToken = await getGa4AccessTokenForSite(siteId);
  } catch (err) {
    db.prepare("UPDATE ga4_site_links SET status='error', last_error=? WHERE site_id=?").run(err.message, siteId);
    return { error: err.message };
  }

  const endDate = fmtDate(daysAgo(0));
  const startDate = backfill ? fmtDate(daysAgo(365)) : fmtDate(daysAgo(3));

  let report;
  try {
    report = await runReport({
      accessToken,
      propertyId: link.property_id,
      startDate,
      endDate,
      dimensions: ['date'],
      metrics: ['sessions', 'activeUsers', 'newUsers', 'screenPageViews', 'bounceRate', 'averageSessionDuration', 'conversions', 'totalRevenue', 'engagedSessions'],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    });
  } catch (err) {
    db.prepare('UPDATE ga4_site_links SET last_error = ? WHERE site_id = ?').run(err.message, siteId);
    return { error: err.message };
  }

  const rows = rowsFromReport(report);
  const insert = db.prepare(`
    INSERT INTO ga4_daily
      (site_id, date, sessions, users, new_users, pageviews, bounce_rate, avg_duration, conversions, revenue)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(site_id, date) DO UPDATE SET
      sessions = excluded.sessions,
      users = excluded.users,
      new_users = excluded.new_users,
      pageviews = excluded.pageviews,
      bounce_rate = excluded.bounce_rate,
      avg_duration = excluded.avg_duration,
      conversions = excluded.conversions,
      revenue = excluded.revenue
  `);
  const tx = db.transaction(() => {
    for (const r of rows) {
      if (!r.date) continue;
      const isoDate = `${r.date.slice(0, 4)}-${r.date.slice(4, 6)}-${r.date.slice(6, 8)}`;
      insert.run(
        siteId,
        isoDate,
        Math.round(r.sessions || 0),
        Math.round(r.activeUsers || 0),
        Math.round(r.newUsers || 0),
        Math.round(r.screenPageViews || 0),
        +(r.bounceRate || 0).toFixed(4),
        +(r.averageSessionDuration || 0).toFixed(2),
        Math.round(r.conversions || 0),
        +(r.totalRevenue || 0).toFixed(2),
      );
    }
  });
  tx();

  db.prepare("UPDATE ga4_site_links SET status='active', last_sync_at=datetime('now'), last_error=NULL WHERE site_id=?").run(siteId);

  return { siteId, rows: rows.length, startDate, endDate, backfill };
}

export async function syncAllGa4() {
  const db = getDb();
  const links = db.prepare("SELECT site_id FROM ga4_site_links WHERE status != 'disabled'").all();
  const results = [];
  for (const l of links) {
    try {
      results.push(await syncGa4Site(l.site_id));
    } catch (err) {
      results.push({ siteId: l.site_id, error: err.message });
    }
  }
  return { sites: links.length, results };
}

/**
 * Read cached daily rows for a site within a date range.
 * Returns [] if cache is empty (caller can decide to call live API).
 */
export function readGa4DailyCache(siteId, startDate, endDate) {
  return getDb().prepare(`
    SELECT date, sessions, users, new_users, pageviews, bounce_rate, avg_duration, conversions, revenue
    FROM ga4_daily
    WHERE site_id = ? AND date BETWEEN ? AND ?
    ORDER BY date ASC
  `).all(siteId, startDate, endDate);
}

export function ga4CacheCovers(siteId, startDate, endDate) {
  const rows = readGa4DailyCache(siteId, startDate, endDate);
  if (rows.length === 0) return false;
  // Treat cache as covering the range if the most recent row is within 2 days of endDate.
  const latest = rows[rows.length - 1].date;
  const latestDt = new Date(latest);
  const endDt = new Date(endDate);
  const diffDays = Math.round((endDt - latestDt) / (1000 * 60 * 60 * 24));
  return diffDays <= 2;
}
