import { syncAllLinkedin } from '@/lib/linkedin-sync';

export default async function handler(req, res) {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const result = await syncAllLinkedin();
  return res.status(200).json(result);
}
