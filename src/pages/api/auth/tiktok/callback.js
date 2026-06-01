import { parse } from 'cookie';
import {
  exchangeTiktokCode,
  fetchTiktokUserInfo,
  saveTiktokUserConn,
  getTiktokRedirectUri,
} from '@/lib/tiktok';

export default async function handler(req, res) {
  const { code, state, error: oauthError } = req.query;
  if (oauthError) return res.redirect(`/settings?tt_error=${encodeURIComponent(oauthError)}`);
  if (!code || !state) return res.redirect('/settings?tt_error=missing_params');

  const cookies = parse(req.headers.cookie || '');
  const storedState = cookies.tt_state;
  if (!storedState || storedState !== state) return res.redirect('/settings?tt_error=state_mismatch');

  const userId = parseInt(state.split('.')[1], 10);
  if (!userId) return res.redirect('/settings?tt_error=invalid_state');

  let tokenData;
  try {
    tokenData = await exchangeTiktokCode({ code, redirectUri: getTiktokRedirectUri(req) });
  } catch (err) {
    return res.redirect(`/settings?tt_error=${encodeURIComponent(err.message)}`);
  }

  let userInfo;
  try {
    userInfo = await fetchTiktokUserInfo(tokenData.access_token);
  } catch (err) {
    return res.redirect(`/settings?tt_error=${encodeURIComponent(err.message)}`);
  }

  saveTiktokUserConn({
    userId,
    openId:         userInfo.open_id,
    accessToken:    tokenData.access_token,
    refreshToken:   tokenData.refresh_token,
    tiktokName:     userInfo.display_name,
    tiktokUsername: userInfo.username || '',
    expiresIn:      tokenData.expires_in || 86400,
  });

  res.setHeader('Set-Cookie', 'tt_state=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
  return res.redirect('/settings?tt_connected=1');
}
