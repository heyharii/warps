import { getDb } from './db';
import { encrypt, decrypt } from './crypto';

const TOKEN_URL  = 'https://oauth2.googleapis.com/token';
const AUTH_URL   = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPE      = 'https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/userinfo.email';
const ADS_BASE   = 'https://googleads.googleapis.com/v23';

// ───── App credentials ─────

export function getGoogleAdsCredentials() {
  const db = getDb();
  const rows = db.prepare(
    "SELECT key, value FROM app_settings WHERE key IN ('gads_client_id','gads_client_secret')"
  ).all();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    clientId: decrypt(map.gads_client_id),
    clientSecret: decrypt(map.gads_client_secret),
  };
}

export function saveGoogleAdsCredentials({ clientId, clientSecret }) {
  const db = getDb();
  const up = db.prepare(`
    INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  up.run('gads_client_id', encrypt(clientId));
  up.run('gads_client_secret', encrypt(clientSecret));
}

export function isGoogleAdsConfigured() {
  const { clientId, clientSecret } = getGoogleAdsCredentials();
  return !!(clientId && clientSecret);
}

// ───── Developer token (stored separately, not per user) ─────

export function getGoogleAdsDeveloperToken() {
  const db = getDb();
  const row = db.prepare("SELECT value FROM google_ads_settings WHERE key = 'developer_token'").get();
  return row ? decrypt(row.value) : null;
}

export function saveGoogleAdsDeveloperToken(token) {
  const db = getDb();
  db.prepare(`
    INSERT INTO google_ads_settings (key, value, updated_at) VALUES ('developer_token', ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(encrypt(token));
}

// ───── Redirect URI ─────

export function getGoogleAdsRedirectUri(req) {
  const proto = (req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http')).split(',')[0].trim();
  const host  = (req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000').split(',')[0].trim();
  return `${proto}://${host}/api/auth/google-ads/callback`;
}

// ───── OAuth ─────

export function buildGoogleAdsAuthUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleAdsCode({ code, redirectUri }) {
  const { clientId, clientSecret } = getGoogleAdsCredentials();
  if (!clientId || !clientSecret) throw new Error('Google Ads not configured');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  return res.json();
}

export async function refreshGoogleAdsToken(refreshToken) {
  const { clientId, clientSecret } = getGoogleAdsCredentials();
  if (!clientId || !clientSecret) throw new Error('Google Ads not configured');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

export async function fetchGoogleAdsUserEmail(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.email || null;
}

// ───── Ads API: list accessible accounts ─────

export async function listGoogleAdsAccounts({ accessToken, developerToken }) {
  // List accessible customers for this login credential
  const url = `${ADS_BASE}/customers:listAccessibleCustomers`;
  console.log(`[Google Ads] Calling: ${url}`);
  console.log(`[Google Ads] Access token prefix: ${accessToken?.slice(0, 10)}...`);
  console.log(`[Google Ads] Developer token prefix: ${developerToken?.slice(0, 5)}...`);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
    },
  });

  const responseText = await res.text();
  console.log(`[Google Ads] Response status: ${res.status}`);
  console.log(`[Google Ads] Response body: ${responseText.slice(0, 500)}`);

  if (!res.ok) throw new Error(`List accounts failed: ${res.status} ${responseText}`);
  const data = JSON.parse(responseText);
  const resourceNames = data.resourceNames || [];
  // Fetch basic info for each
  const accounts = await Promise.all(
    resourceNames.slice(0, 20).map(async (rn) => {
      const customerId = rn.split('/').pop();
      try {
        const info = await queryGads({ accessToken, developerToken, customerId }, `SELECT customer.id, customer.descriptive_name, customer.currency_code FROM customer LIMIT 1`);
        const row = info[0]?.customer || {};
        return { customerId, name: row.descriptiveName || `Account ${customerId}`, currency: row.currencyCode || 'USD' };
      } catch {
        return { customerId, name: `Account ${customerId}`, currency: 'USD' };
      }
    })
  );
  return accounts;
}

// ───── Ads API: campaign performance ─────

async function queryGads({ accessToken, developerToken, customerId, loginCustomerId }, gaql) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': developerToken,
    'Content-Type': 'application/json',
  };
  if (loginCustomerId) headers['login-customer-id'] = loginCustomerId;
  const res = await fetch(`${ADS_BASE}/customers/${customerId}/googleAds:search`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: gaql }),
  });
  if (!res.ok) throw new Error(`Google Ads query failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.results || [];
}

export async function fetchGoogleAdsDailyStats({ accessToken, developerToken, customerId, startDate, endDate }) {
  const gaql = `
    SELECT
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.conversions,
      metrics.all_conversions,
      metrics.cost_micros,
      metrics.interactions,
      metrics.view_through_conversions
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status != 'REMOVED'
    ORDER BY segments.date ASC
  `;
  const results = await queryGads({ accessToken, developerToken, customerId }, gaql);

  // Group by date
  const byDate = {};
  for (const r of results) {
    const date = r.segments?.date;
    if (!date) continue;
    if (!byDate[date]) {
      byDate[date] = { date, impressions: 0, clicks: 0, ctr: 0, conversions: 0, cost_micros: 0, page_views: 0 };
    }
    const m = r.metrics || {};
    byDate[date].impressions  += Number(m.impressions  || 0);
    byDate[date].clicks       += Number(m.clicks       || 0);
    byDate[date].conversions  += Number(m.conversions  || 0) + Number(m.allConversions || 0);
    byDate[date].cost_micros  += Number(m.costMicros   || 0);
    byDate[date].page_views   += Number(m.interactions || 0);
  }

  return Object.values(byDate).map((d) => ({
    ...d,
    ctr: d.impressions > 0 ? d.clicks / d.impressions : 0,
    conversion_rate: d.clicks > 0 ? d.conversions / d.clicks : 0,
  }));
}

// ───── User connection (DB) ─────

export function getGoogleAdsUserConn(userId) {
  const db = getDb();
  return db.prepare('SELECT * FROM google_ads_connections WHERE user_id = ?').get(userId);
}

export function saveGoogleAdsUserConn({ userId, refreshToken, googleEmail }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO google_ads_connections (user_id, refresh_token, google_email, connected_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      refresh_token = excluded.refresh_token,
      google_email = excluded.google_email,
      connected_at = excluded.connected_at
  `).run(userId, encrypt(refreshToken), googleEmail);
}

export function deleteGoogleAdsUserConn(userId) {
  const db = getDb();
  const siteIds = db.prepare('SELECT id FROM sites WHERE user_id = ?').all(userId).map((r) => r.id);
  const tx = db.transaction(() => {
    for (const sid of siteIds) {
      db.prepare('DELETE FROM google_ads_site_links WHERE site_id = ?').run(sid);
      db.prepare('DELETE FROM google_ads_daily WHERE site_id = ?').run(sid);
    }
    db.prepare('DELETE FROM google_ads_connections WHERE user_id = ?').run(userId);
  });
  tx();
}

export function getGoogleAdsDecryptedToken(conn) {
  return conn?.refresh_token ? decrypt(conn.refresh_token) : null;
}

// ───── Site link (DB) ─────

export function getGoogleAdsSiteLink(siteId) {
  const db = getDb();
  return db.prepare('SELECT * FROM google_ads_site_links WHERE site_id = ?').get(siteId);
}

export function linkGoogleAdsSite(siteId, { customerId, accountName }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO google_ads_site_links (site_id, customer_id, account_name, status, linked_at, last_error)
    VALUES (?, ?, ?, 'active', datetime('now'), NULL)
    ON CONFLICT(site_id) DO UPDATE SET
      customer_id = excluded.customer_id,
      account_name = excluded.account_name,
      status = 'active',
      last_error = NULL
  `).run(siteId, customerId, accountName || null);
}

export function unlinkGoogleAdsSite(siteId) {
  const db = getDb();
  db.prepare('DELETE FROM google_ads_site_links WHERE site_id = ?').run(siteId);
  db.prepare('DELETE FROM google_ads_daily WHERE site_id = ?').run(siteId);
}

// ───── DB read helpers ─────

export function getGoogleAdsDailyRows(siteId, { startDate, endDate } = {}) {
  const db = getDb();
  let q = 'SELECT * FROM google_ads_daily WHERE site_id = ?';
  const params = [siteId];
  if (startDate) { q += ' AND date >= ?'; params.push(startDate); }
  if (endDate) { q += ' AND date <= ?'; params.push(endDate); }
  q += ' ORDER BY date ASC';
  return db.prepare(q).all(...params);
}

export function getGoogleAdsSummary(siteId, { startDate, endDate } = {}) {
  const db = getDb();
  let q = `
    SELECT
      SUM(impressions)     AS total_impressions,
      SUM(clicks)          AS total_clicks,
      SUM(conversions)     AS total_conversions,
      SUM(cost_micros)     AS total_cost_micros,
      SUM(page_views)      AS total_page_views,
      AVG(ctr)             AS avg_ctr,
      AVG(conversion_rate) AS avg_cvr
    FROM google_ads_daily WHERE site_id = ?
  `;
  const params = [siteId];
  if (startDate) { q += ' AND date >= ?'; params.push(startDate); }
  if (endDate) { q += ' AND date <= ?'; params.push(endDate); }
  return db.prepare(q).get(...params);
}
