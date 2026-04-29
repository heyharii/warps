import { parse } from 'cookie';
import { exchangeLinkedinCode, getLinkedinRedirectUri, fetchLinkedinUserName, saveLinkedinUserConn } from '@/lib/linkedin-organic';

export default async function handler(req, res) {
  const { code, state, error: oauthError } = req.query;
  if (oauthError) return res.redirect(`/settings?li_error=${encodeURIComponent(oauthError)}`);
  if (!code || !state) return res.redirect('/settings?li_error=missing_params');

  const cookies = parse(req.headers.cookie || '');
  const storedState = cookies.li_state;
  if (!storedState || storedState !== state) return res.redirect('/settings?li_error=state_mismatch');

  const userId = parseInt(state.split('.')[1], 10);
  if (!userId) return res.redirect('/settings?li_error=invalid_state');

  let tokens;
  try {
    tokens = await exchangeLinkedinCode({ code, redirectUri: getLinkedinRedirectUri(req) });
  } catch (err) {
    return res.redirect(`/settings?li_error=${encodeURIComponent(err.message)}`);
  }

  const linkedinName = await fetchLinkedinUserName(tokens.access_token);
  saveLinkedinUserConn({ userId, refreshToken: tokens.refresh_token || tokens.access_token, linkedinName });

  res.setHeader('Set-Cookie', 'li_state=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
  return res.redirect('/settings?li_connected=1');
}
