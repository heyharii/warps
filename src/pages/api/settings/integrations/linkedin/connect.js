import { withAuth } from '@/lib/withAuth';
import { getLinkedinCredentials, getLinkedinRedirectUri, buildLinkedinAuthUrl, isLinkedinConfigured } from '@/lib/linkedin-organic';
import crypto from 'crypto';

export default withAuth(function handler(req, res) {
  if (!isLinkedinConfigured()) return res.status(400).json({ error: 'Add LinkedIn OAuth credentials first.' });
  const { clientId } = getLinkedinCredentials();
  const state = crypto.randomBytes(16).toString('hex') + '.' + req.user.userId;
  res.setHeader('Set-Cookie', `li_state=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`);
  const url = buildLinkedinAuthUrl({ clientId, redirectUri: getLinkedinRedirectUri(req), state });
  return res.status(200).json({ url });
});
