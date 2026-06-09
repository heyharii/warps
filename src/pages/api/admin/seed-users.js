import { getDb } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

const SEED_SECRET = process.env.SEED_SECRET || 'd44e11ba-6299-46af-9f3d-63f1d3e64f39';

const USERS = [
  { email: 'adit@theravenry.com', name: 'Adit', password: 'Password01' },
  { email: 'ricky@int-labs.com', name: 'Ricky', password: 'Password01' },
  { email: 'bella@theravenry.com', name: 'Bella', password: 'Password01' },
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (req.headers['x-seed-secret'] !== SEED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = getDb();
  const results = [];

  for (const u of USERS) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email.toLowerCase());
    if (existing) {
      results.push({ email: u.email, status: 'skipped (already exists)' });
      continue;
    }
    const passwordHash = await hashPassword(u.password);
    db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)').run(
      u.email.toLowerCase(),
      passwordHash,
      u.name
    );
    results.push({ email: u.email, status: 'created' });
  }

  return res.status(200).json({ results });
}
