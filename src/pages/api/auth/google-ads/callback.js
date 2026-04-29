import { parse } from 'cookie';
import { exchangeGoogleAdsCode, getGoogleAdsRedirectUri, fetchGoogleAdsUserEmail, saveGoogleAdsUserConn } from '@/lib/google-ads';

export default async function handler(req, res) {
  const { code, state, error: oauthError } = req.query;
  if (oauthError) return res.redirect(`/settings?gads_error=${encodeURIComponent(oauthError)}`);
  if (!code || !state) return res.redirect('/settings?gads_error=missing_params');

  const cookies = parse(req.headers.cookie || '');
  if (!cookies.gads_state || cookies.gads_state !== state) return res.redirect('/settings?gads_error=state_mismatch');

  const userId = parseInt(state.split('.')[1], 10);
  if (!userId) return res.redirect('/settings?gads_error=invalid_state');

  let tokens;
  try {
    tokens = await exchangeGoogleAdsCode({ code, redirectUri: getGoogleAdsRedirectUri(req) });
  } catch (err) {
    return res.redirect(`/settings?gads_error=${encodeURIComponent(err.message)}`);
  }

  const googleEmail = await fetchGoogleAdsUserEmail(tokens.access_token);
  saveGoogleAdsUserConn({ userId, refreshToken: tokens.refresh_token, googleEmail });

  res.setHeader('Set-Cookie', 'gads_state=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
  return res.redirect('/settings?gads_connected=1');
}
