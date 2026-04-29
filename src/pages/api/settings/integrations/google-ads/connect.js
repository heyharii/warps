import { withAuth } from '@/lib/withAuth';
import { getGoogleAdsCredentials, getGoogleAdsRedirectUri, buildGoogleAdsAuthUrl, isGoogleAdsConfigured } from '@/lib/google-ads';
import crypto from 'crypto';

export default withAuth(function handler(req, res) {
  if (!isGoogleAdsConfigured()) return res.status(400).json({ error: 'Add Google Ads OAuth credentials first.' });
  const { clientId } = getGoogleAdsCredentials();
  const state = crypto.randomBytes(16).toString('hex') + '.' + req.user.userId;
  res.setHeader('Set-Cookie', `gads_state=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`);
  const url = buildGoogleAdsAuthUrl({ clientId, redirectUri: getGoogleAdsRedirectUri(req), state });
  return res.status(200).json({ url });
});
