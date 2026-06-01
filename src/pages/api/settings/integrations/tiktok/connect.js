import { withAuth } from '@/lib/withAuth';
import { getTiktokCredentials, getTiktokRedirectUri, buildTiktokAuthUrl, isTiktokConfigured } from '@/lib/tiktok';
import crypto from 'crypto';

export default withAuth(function handler(req, res) {
  if (!isTiktokConfigured()) return res.status(400).json({ error: 'Add TikTok app credentials first.' });
  const { clientId } = getTiktokCredentials();
  const state = crypto.randomBytes(16).toString('hex') + '.' + req.user.userId;
  res.setHeader('Set-Cookie', `tt_state=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`);
  const url = buildTiktokAuthUrl({ clientId, redirectUri: getTiktokRedirectUri(req), state });
  return res.status(200).json({ url });
});
