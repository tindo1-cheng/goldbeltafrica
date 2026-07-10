// GoldBelt Africa — AI district briefing (Vercel serverless function)
// Requires ANTHROPIC_API_KEY set in Vercel → Project → Settings → Environment Variables
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { district, country } = req.body || {};
  if (!district || !country) return res.status(400).json({ error: 'district and country required' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 700,
        system: 'You are the district briefing engine for GoldBelt Africa, a prospecting maps service. Write a concise plain-English intelligence briefing (max 200 words) on the requested African mining district using only well-established, documented geological knowledge. Structure it with short labelled lines: GEOLOGY, STYLE, HISTORY, APPROACH, LAW, VERDICT. Be honest: never guarantee finds, always note that a permit is required, and if you are not confident about the district, say the record is thin rather than inventing details.',
        messages: [{ role: 'user', content: `Briefing for the ${district} district, ${country}.` }]
      })
    });

    const data = await r.json();
    const briefing = (data.content || []).map(b => b.text || '').join('\n').trim();
    if (!briefing) throw new Error('empty');
    return res.status(200).json({ briefing });
  } catch (e) {
    return res.status(500).json({ error: 'briefing unavailable' });
  }
}
