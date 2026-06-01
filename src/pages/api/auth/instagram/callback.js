import { parse } from 'cookie';
import {
  exchangeInstagramCode,
  getInstagramRedirectUri,
  fetchFbUserInfo,
  saveInstagramUserConn,
} from '@/lib/instagram';

export default async function handler(req, res) {
  const { code, state, error: oauthError } = req.query;
  if (oauthError) return res.redirect(`/settings?ig_error=${encodeURIComponent(oauthError)}`);
  if (!code || !state) return res.redirect('/settings?ig_error=missing_params');

  const cookies = parse(req.headers.cookie || '');
  const storedState = cookies.ig_state;
  if (!storedState || storedState !== state) return res.redirect('/settings?ig_error=state_mismatch');

  const userId = parseInt(state.split('.')[1], 10);
  if (!userId) return res.redirect('/settings?ig_error=invalid_state');

  let tokenData;
  try {
    tokenData = await exchangeInstagramCode({ code, redirectUri: getInstagramRedirectUri(req) });
  } catch (err) {
    return res.redirect(`/settings?ig_error=${encodeURIComponent(err.message)}`);
  }

  const { id: fbUserId, name: fbName } = await fetchFbUserInfo(tokenData.access_token);
  saveInstagramUserConn({
    userId,
    fbUserId,
    fbAccessToken: tokenData.access_token,
    fbName,
    expiresIn: tokenData.expires_in,
  });

  res.setHeader('Set-Cookie', 'ig_state=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
  return res.redirect('/settings?ig_connected=1');
}
