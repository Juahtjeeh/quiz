import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ALLOWED_ORIGINS = [
  'https://juahtjeeh.github.io',
  'https://juanitaexplores.com'
];

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex');

  if (req.method === 'POST') {
    const { nickname, score, difficulty, correct, total } = req.body;

    if (!nickname || !/^[a-zA-Z0-9]{2,20}$/.test(nickname))
      return res.status(400).json({ error: 'Ongeldige nickname' });
    if (!['easy','medium','hard'].includes(difficulty))
      return res.status(400).json({ error: 'Ongeldige moeilijkheidsgraad' });
    if (typeof score !== 'number' || score < 0 || score > 9999)
      return res.status(400).json({ error: 'Ongeldige score' });

    const { data: allowed } = await supabase
      .rpc('check_quiz_rate_limit', { p_ip_hash: ipHash, p_difficulty: difficulty });
    if (!allowed)
      return res.status(429).json({ error: 'Te veel submissions, probeer later.' });

    const { error } = await supabase.from('quiz_scores').insert({
      nickname, score, difficulty, correct, total, ip_hash: ipHash
    });
    if (error) return res.status(500).json({ error: 'Opslaan mislukt' });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'GET') {
    const { difficulty = 'medium' } = req.query;
    const { data, error } = await supabase
      .from('quiz_scores')
      .select('nickname, score, correct, total')
      .eq('difficulty', difficulty)
      .order('score', { ascending: false })
      .limit(10);
    if (error) return res.status(500).json({ error: 'Ophalen mislukt' });
    return res.status(200).json(data);
  }
}
