import { withAuth } from '@/lib/withAuth';
import { getGoogleAdsCredentials, saveGoogleAdsCredentials, isGoogleAdsConfigured, getGoogleAdsDeveloperToken, saveGoogleAdsDeveloperToken } from '@/lib/google-ads';

export default withAuth(function handler(req, res) {
  if (req.method === 'GET') {
    const { clientId } = getGoogleAdsCredentials();
    const devToken = getGoogleAdsDeveloperToken();
    return res.status(200).json({
      configured: isGoogleAdsConfigured(),
      clientIdMasked: clientId ? clientId.slice(0, 4) + '••••' : null,
      developerTokenSet: !!devToken,
    });
  }

  if (req.method === 'POST') {
    const { clientId, clientSecret, developerToken } = req.body || {};
    if (clientId && clientSecret) saveGoogleAdsCredentials({ clientId, clientSecret });
    if (developerToken) saveGoogleAdsDeveloperToken(developerToken);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
});
