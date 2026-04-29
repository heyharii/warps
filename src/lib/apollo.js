import { getDb } from './db';
import { encrypt, decrypt } from './crypto';

const APOLLO_BASE = 'https://api.apollo.io/api/v1';

// ───── Connection (site-level API key) ─────

export function getApolloConnection(siteId) {
  const db = getDb();
  return db.prepare('SELECT * FROM apollo_connections WHERE site_id = ?').get(siteId);
}

export function saveApolloConnection(siteId, apiKey) {
  const db = getDb();
  db.prepare(`
    INSERT INTO apollo_connections (site_id, api_key, connected_at, last_error)
    VALUES (?, ?, datetime('now'), NULL)
    ON CONFLICT(site_id) DO UPDATE SET
      api_key = excluded.api_key,
      connected_at = excluded.connected_at,
      last_error = NULL
  `).run(siteId, encrypt(apiKey));
}

export function deleteApolloConnection(siteId) {
  const db = getDb();
  db.prepare('DELETE FROM apollo_connections WHERE site_id = ?').run(siteId);
  db.prepare('DELETE FROM apollo_daily WHERE site_id = ?').run(siteId);
}

export function getDecryptedApiKey(conn) {
  return conn?.api_key ? decrypt(conn.api_key) : null;
}

// ───── Apollo API calls ─────

/**
 * Fetch all campaigns with their stats.
 * Apollo API: POST /api/v1/emailer_campaigns/search
 * Auth: X-Api-Key header
 */
export async function fetchApolloSequences(apiKey) {
  const res = await fetch(`${APOLLO_BASE}/emailer_campaigns/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Apollo API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.emailer_campaigns || [];
}

/**
 * Fetch per-day stats by summing all campaign metrics.
 * Apollo does not provide a daily breakdown per date — we return one aggregate row.
 * Real field names confirmed from API:
 *   unique_scheduled, unique_delivered, unique_opened, unique_clicked,
 *   unique_replied, unique_bounced, unique_hard_bounced, unique_unsubscribed,
 *   open_rate, click_rate, reply_rate, bounce_rate
 */
export async function fetchApolloDailyStats(apiKey, { fromDate, toDate } = {}) {
  const campaigns = await fetchApolloSequences(apiKey);
  return normaliseFromCampaigns(campaigns);
}

function normaliseFromCampaigns(campaigns) {
  const today = new Date().toISOString().slice(0, 10);
  let scheduled = 0, delivered = 0, opens = 0, clicks = 0, replies = 0, bounces = 0, unsubscribes = 0;
  let open_rate_sum = 0, click_rate_sum = 0, reply_rate_sum = 0, count = 0;

  for (const c of campaigns) {
    scheduled    += c.unique_scheduled    || 0;
    delivered    += c.unique_delivered    || 0;
    opens        += c.unique_opened       || 0;
    clicks       += c.unique_clicked      || 0;
    replies      += c.unique_replied      || 0;
    bounces      += (c.unique_bounced || 0) + (c.unique_hard_bounced || 0);
    unsubscribes += c.unique_unsubscribed || 0;
    open_rate_sum  += c.open_rate   || 0;
    click_rate_sum += c.click_rate  || 0;
    reply_rate_sum += c.reply_rate  || 0;
    count++;
  }

  const open_rate  = count ? open_rate_sum  / count : (delivered ? opens  / delivered : 0);
  const click_rate = count ? click_rate_sum / count : (delivered ? clicks / delivered : 0);

  return [{
    date: today,
    sent: scheduled,
    delivered,
    opens,
    open_rate,
    clicks,
    click_rate,
    replies,
    bounces,
    unsubscribes,
  }];
}

// ───── DB read helpers ─────

export function getApolloDailyTotals(siteId, { startDate, endDate } = {}) {
  const db = getDb();
  let q = 'SELECT * FROM apollo_daily WHERE site_id = ?';
  const params = [siteId];
  if (startDate) { q += ' AND date >= ?'; params.push(startDate); }
  if (endDate) { q += ' AND date <= ?'; params.push(endDate); }
  q += ' ORDER BY date ASC';
  return db.prepare(q).all(...params);
}

export function getApolloSummary(siteId, { startDate, endDate } = {}) {
  const db = getDb();
  let q = `
    SELECT
      SUM(sent)         AS total_sent,
      SUM(delivered)    AS total_delivered,
      SUM(opens)        AS total_opens,
      SUM(clicks)       AS total_clicks,
      SUM(replies)      AS total_replies,
      SUM(bounces)      AS total_bounces,
      SUM(unsubscribes) AS total_unsubscribes,
      AVG(open_rate)    AS avg_open_rate,
      AVG(click_rate)   AS avg_click_rate
    FROM apollo_daily WHERE site_id = ?
  `;
  const params = [siteId];
  if (startDate) { q += ' AND date >= ?'; params.push(startDate); }
  if (endDate) { q += ' AND date <= ?'; params.push(endDate); }
  return db.prepare(q).get(...params);
}
