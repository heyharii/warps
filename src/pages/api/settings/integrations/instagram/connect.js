import { withAuth } from '@/lib/withAuth';
import { getInstagramCredentials, getInstagramRedirectUri, buildInstagramAuthUrl, isInstagramConfigured } from '@/lib/instagram';
import crypto from 'crypto';

export default withAuth(function handler(req, res) {
  if (!isInstagramConfigured()) return res.status(400).json({ error: 'Add Instagram (Facebook App) credentials first.' });
  const { appId } = getInstagramCredentials();
  const state = crypto.randomBytes(16).toString('hex') + '.' + req.user.userId;
  res.setHeader('Set-Cookie', `ig_state=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`);
  const url = buildInstagramAuthUrl({ appId, redirectUri: getInstagramRedirectUri(req), state });
  return res.status(200).json({ url });
});
