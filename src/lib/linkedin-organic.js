import { getDb } from './db';
import { encrypt, decrypt } from './crypto';

const AUTH_URL   = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL  = 'https://www.linkedin.com/oauth/v2/accessToken';
const API_BASE   = 'https://api.linkedin.com/v2';
// Scopes for reading company page organic stats
const SCOPES     = 'r_organization_social r_organization_admin r_ads_reporting openid profile email';

// ───── App credentials (stored encrypted in app_settings) ─────

export function getLinkedinCredentials() {
  const db = getDb();
  const rows = db.prepare(
    "SELECT key, value FROM app_settings WHERE key IN ('li_client_id','li_client_secret')"
  ).all();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    clientId: decrypt(map.li_client_id),
    clientSecret: decrypt(map.li_client_secret),
  };
}

export function saveLinkedinCredentials({ clientId, clientSecret }) {
  const db = getDb();
  const up = db.prepare(`
    INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  up.run('li_client_id', encrypt(clientId));
  up.run('li_client_secret', encrypt(clientSecret));
}

export function clearLinkedinCredentials() {
  const db = getDb();
  db.prepare("DELETE FROM app_settings WHERE key IN ('li_client_id','li_client_secret')").run();
}

export function isLinkedinConfigured() {
  const { clientId, clientSecret } = getLinkedinCredentials();
  return !!(clientId && clientSecret);
}

// ───── Redirect URI ─────

export function getLinkedinRedirectUri(req) {
  const proto = (req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http')).split(',')[0].trim();
  const host  = (req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000').split(',')[0].trim();
  return `${proto}://${host}/api/auth/linkedin/callback`;
}

// ───── OAuth flow ─────

export function buildLinkedinAuthUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: SCOPES,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeLinkedinCode({ code, redirectUri }) {
  const { clientId, clientSecret } = getLinkedinCredentials();
  if (!clientId || !clientSecret) throw new Error('LinkedIn not configured');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`LinkedIn token exchange failed: ${await res.text()}`);
  return res.json();
}

export async function refreshLinkedinToken(refreshToken) {
  const { clientId, clientSecret } = getLinkedinCredentials();
  if (!clientId || !clientSecret) throw new Error('LinkedIn not configured');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`LinkedIn token refresh failed: ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

// ───── User info ─────

export async function fetchLinkedinUserName(accessToken) {
  const res = await fetch(`${API_BASE}/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.name || data.localizedFirstName || data.email || null;
}

// ───── Organization listing ─────

export async function listLinkedinOrgs(accessToken) {
  // Get orgs the user is an admin of
  const url = `${API_BASE}/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&count=50&projection=(elements*(organization~(id,name,localizedName)))`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, 'LinkedIn-Version': '202404', 'X-Restli-Protocol-Version': '2.0.0' },
  });
  if (!res.ok) throw new Error(`LinkedIn org listing failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data.elements || []).map((el) => {
    const org = el['organization~'] || {};
    const rawOrg = el.organization || '';
    const id = org.id || rawOrg.split(':').pop();
    return {
      urn: `urn:li:organization:${id}`,
      name: org.localizedName || org.name?.localized?.en_US || `Org ${id}`,
    };
  });
}

// ───── Organic analytics ─────

function toMs(dateStr) {
  return new Date(dateStr).getTime();
}

/**
 * Fetch organic share statistics (impressions, clicks, likes, comments, shares)
 * for a given organization URN over a date range.
 */
export async function fetchLinkedinShareStats({ accessToken, orgUrn, startDate, endDate }) {
  const startMs = toMs(startDate);
  const endMs   = toMs(endDate) + 86400000; // include end day

  // Try with timeIntervals in RESTli unencoded parentheses notation
  const timeIntervals = `(timeGranularityType:DAY,timeRange:(start:${startMs},end:${endMs}))`;
  let url = `${API_BASE}/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(orgUrn)}&timeIntervals=${timeIntervals}`;
  let res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, 'LinkedIn-Version': '202404', 'X-Restli-Protocol-Version': '2.0.0' },
  });

  // Fallback: some API versions don't accept timeIntervals on this finder
  if (!res.ok) {
    const errText = await res.text();
    // If invalid params or unpermitted fields, retry without timeIntervals
    if (res.status === 400 || (res.status === 403 && errText.includes('timeIntervals'))) {
      url = `${API_BASE}/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(orgUrn)}`;
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}`, 'LinkedIn-Version': '202404', 'X-Restli-Protocol-Version': '2.0.0' },
      });
    }
    if (!res.ok) throw new Error(`LinkedIn share stats failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const elements = data.elements || [];

  // If no daily timeRange data, synthesize one aggregated row for the requested range
  if (elements.length && !elements[0].timeRange) {
    let totalImp = 0, totalClk = 0, totalLikes = 0, totalComments = 0, totalShares = 0;
    for (const el of elements) {
      const s = el.totalShareStatistics || {};
      totalImp      += Number(s.impressionCount || 0);
      totalClk      += Number(s.clickCount || 0);
      totalLikes    += Number(s.likeCount || 0);
      totalComments += Number(s.commentCount || 0);
      totalShares   += Number(s.shareCount || 0);
    }
    // Spread evenly across the date range (naive daily split)
    const days = Math.max(1, Math.round((endMs - startMs) / 86400000));
    const rows = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startMs + i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      rows.push({
        date: dateStr,
        impressions: Math.round(totalImp / days),
        clicks: Math.round(totalClk / days),
        ctr: totalImp > 0 ? totalClk / totalImp : 0,
        likes: Math.round(totalLikes / days),
        comments: Math.round(totalComments / days),
        shares: Math.round(totalShares / days),
      });
    }
    return rows;
  }

  return elements.map((el) => {
    const s = el.totalShareStatistics || {};
    const dateStr = el.timeRange?.start ? new Date(el.timeRange.start).toISOString().slice(0, 10) : startDate;
    const imp = s.impressionCount || 0;
    const clk = s.clickCount || 0;
    return {
      date: dateStr,
      impressions: imp,
      clicks: clk,
      ctr: imp > 0 ? clk / imp : 0,
      likes: s.likeCount || 0,
      comments: s.commentCount || 0,
      shares: s.shareCount || 0,
    };
  });
}

/**
 * Fetch page view statistics.
 */
export async function fetchLinkedinPageViews({ accessToken, orgUrn, startDate, endDate }) {
  const startMs = toMs(startDate);
  const endMs   = toMs(endDate) + 86400000;
  const orgId = orgUrn.split(':').pop();
  const timeIntervals = encodeURIComponent(`(timeGranularityType:DAY,timeRange:(start:${startMs},end:${endMs}))`);
  const url = `${API_BASE}/organizationPageStatistics?q=organization&organization=urn:li:organization:${orgId}&timeIntervals=${timeIntervals}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, 'LinkedIn-Version': '202404', 'X-Restli-Protocol-Version': '2.0.0' },
  });
  if (!res.ok) return []; // page view stats may need extra scope; degrade gracefully
  const data = await res.json();
  return (data.elements || []).map((el) => {
    const views = el.totalPageStatistics?.views?.allPageViews?.pageViews || 0;
    const dateStr = el.timeRange?.start ? new Date(el.timeRange.start).toISOString().slice(0, 10) : startDate;
    return { date: dateStr, page_views: views };
  });
}

// ───── User connection (DB) ─────

export function getLinkedinUserConn(userId) {
  const db = getDb();
  return db.prepare('SELECT * FROM linkedin_connections WHERE user_id = ?').get(userId);
}

export function saveLinkedinUserConn({ userId, refreshToken, linkedinName }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO linkedin_connections (user_id, refresh_token, linkedin_name, connected_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      refresh_token = excluded.refresh_token,
      linkedin_name = excluded.linkedin_name,
      connected_at = excluded.connected_at
  `).run(userId, encrypt(refreshToken), linkedinName);
}

export function deleteLinkedinUserConn(userId) {
  const db = getDb();
  const siteIds = db.prepare('SELECT id FROM sites WHERE user_id = ?').all(userId).map((r) => r.id);
  const tx = db.transaction(() => {
    for (const sid of siteIds) {
      db.prepare('DELETE FROM linkedin_site_links WHERE site_id = ?').run(sid);
      db.prepare('DELETE FROM linkedin_daily WHERE site_id = ?').run(sid);
    }
    db.prepare('DELETE FROM linkedin_connections WHERE user_id = ?').run(userId);
  });
  tx();
}

export function getLinkedinDecryptedToken(conn) {
  return conn?.refresh_token ? decrypt(conn.refresh_token) : null;
}

// ───── Site link (DB) ─────

export function getLinkedinSiteLink(siteId) {
  const db = getDb();
  return db.prepare('SELECT * FROM linkedin_site_links WHERE site_id = ?').get(siteId);
}

export function linkLinkedinSite(siteId, { orgUrn, orgName }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO linkedin_site_links (site_id, org_urn, org_name, status, linked_at, last_error)
    VALUES (?, ?, ?, 'active', datetime('now'), NULL)
    ON CONFLICT(site_id) DO UPDATE SET
      org_urn = excluded.org_urn,
      org_name = excluded.org_name,
      status = 'active',
      last_error = NULL
  `).run(siteId, orgUrn, orgName || null);
}

export function unlinkLinkedinSite(siteId) {
  const db = getDb();
  db.prepare('DELETE FROM linkedin_site_links WHERE site_id = ?').run(siteId);
  db.prepare('DELETE FROM linkedin_daily WHERE site_id = ?').run(siteId);
}

// ───── DB read helpers ─────

export function getLinkedinDailyRows(siteId, { startDate, endDate } = {}) {
  const db = getDb();
  let q = 'SELECT * FROM linkedin_daily WHERE site_id = ?';
  const params = [siteId];
  if (startDate) { q += ' AND date >= ?'; params.push(startDate); }
  if (endDate) { q += ' AND date <= ?'; params.push(endDate); }
  q += ' ORDER BY date ASC';
  return db.prepare(q).all(...params);
}

export function getLinkedinSummary(siteId, { startDate, endDate } = {}) {
  const db = getDb();
  let q = `
    SELECT
      SUM(impressions) AS total_impressions,
      SUM(clicks)      AS total_clicks,
      SUM(likes)       AS total_likes,
      SUM(comments)    AS total_comments,
      SUM(shares)      AS total_shares,
      SUM(page_views)  AS total_page_views,
      AVG(ctr)         AS avg_ctr
    FROM linkedin_daily WHERE site_id = ?
  `;
  const params = [siteId];
  if (startDate) { q += ' AND date >= ?'; params.push(startDate); }
  if (endDate) { q += ' AND date <= ?'; params.push(endDate); }
  return db.prepare(q).get(...params);
}
