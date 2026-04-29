import { getDb } from './db';
import { getApolloConnection, getDecryptedApiKey, fetchApolloDailyStats } from './apollo';

function fmtDate(d) { return d.toISOString().slice(0, 10); }
function daysAgo(n) { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d; }

export async function syncApolloSite(siteId, { backfill = false } = {}) {
  const db = getDb();
  const conn = getApolloConnection(siteId);
  if (!conn) return { skipped: true };
  const apiKey = getDecryptedApiKey(conn);
  if (!apiKey) return { skipped: true };

  const endDate   = fmtDate(daysAgo(1));
  const startDate = backfill ? fmtDate(daysAgo(90)) : fmtDate(daysAgo(7));

  let rows;
  try {
    rows = await fetchApolloDailyStats(apiKey, { fromDate: startDate, toDate: endDate });
  } catch (err) {
    db.prepare("UPDATE apollo_connections SET last_error=? WHERE site_id=?").run(err.message, siteId);
    return { error: err.message };
  }

  const upsert = db.prepare(`
    INSERT INTO apollo_daily (site_id, date, sent, delivered, opens, open_rate, clicks, click_rate, replies, bounces, unsubscribes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(site_id, date) DO UPDATE SET
      sent = excluded.sent, delivered = excluded.delivered,
      opens = excluded.opens, open_rate = excluded.open_rate,
      clicks = excluded.clicks, click_rate = excluded.click_rate,
      replies = excluded.replies, bounces = excluded.bounces,
      unsubscribes = excluded.unsubscribes
  `);

  const tx = db.transaction(() => {
    for (const r of rows) {
      upsert.run(siteId, r.date, r.sent, r.delivered, r.opens, r.open_rate, r.clicks, r.click_rate, r.replies, r.bounces, r.unsubscribes);
    }
  });
  tx();

  db.prepare("DELETE FROM apollo_daily WHERE site_id = ? AND date < date('now','-90 days')").run(siteId);
  db.prepare("UPDATE apollo_connections SET last_sync_at=datetime('now'), last_error=NULL WHERE site_id=?").run(siteId);
  return { rows: rows.length };
}

export async function syncAllApollo() {
  const db = getDb();
  const conns = db.prepare('SELECT site_id, last_sync_at FROM apollo_connections').all();
  const results = [];
  for (const c of conns) {
    if (c.last_sync_at) {
      const last = new Date(c.last_sync_at + 'Z').getTime();
      if (Date.now() - last < 12 * 60 * 60 * 1000) continue;
    }
    try {
      const r = await syncApolloSite(c.site_id, { backfill: !c.last_sync_at });
      results.push({ siteId: c.site_id, ...r });
    } catch (err) {
      results.push({ siteId: c.site_id, error: err.message });
    }
  }
  return { synced: results.length, results };
}
