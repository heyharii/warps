import { withAuth } from '@/lib/withAuth';
import { getTiktokCredentials, saveTiktokCredentials, clearTiktokCredentials, isTiktokConfigured } from '@/lib/tiktok';

export default withAuth(function handler(req, res) {
  if (req.method === 'GET') {
    const { clientId } = getTiktokCredentials();
    return res.status(200).json({ configured: isTiktokConfigured(), clientIdMasked: clientId ? clientId.slice(0, 4) + '••••' : null });
  }

  if (req.method === 'POST') {
    const { clientId, clientSecret } = req.body || {};
    if (!clientId || !clientSecret) return res.status(400).json({ error: 'clientId and clientSecret required' });
    saveTiktokCredentials({ clientId, clientSecret });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    clearTiktokCredentials();
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
});
