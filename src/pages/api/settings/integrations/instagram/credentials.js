import { withAuth } from '@/lib/withAuth';
import { getInstagramCredentials, saveInstagramCredentials, isInstagramConfigured } from '@/lib/instagram';

export default withAuth(function handler(req, res) {
  if (req.method === 'GET') {
    const { appId } = getInstagramCredentials();
    return res.status(200).json({ configured: isInstagramConfigured(), appIdMasked: appId ? appId.slice(0, 4) + '••••' : null });
  }

  if (req.method === 'POST') {
    const { appId, appSecret } = req.body || {};
    if (!appId || !appSecret) return res.status(400).json({ error: 'appId and appSecret required' });
    saveInstagramCredentials({ appId, appSecret });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { clearInstagramCredentials } = require('@/lib/instagram');
    clearInstagramCredentials();
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
});
