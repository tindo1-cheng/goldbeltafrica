// GoldBelt Africa — newsletter signup (Vercel serverless function)
// Requires SENDGRID_API_KEY and NOTIFY_EMAIL set in Vercel environment variables.
// Sends the signup to your inbox; swap for a SendGrid contact-list call later if you prefer.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { email } = req.body || {};
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'valid email required' });
  }

  try {
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: process.env.NOTIFY_EMAIL }] }],
        from: { email: process.env.NOTIFY_EMAIL, name: 'GoldBelt Africa' },
        subject: 'New newsletter signup — GoldBelt Africa',
        content: [{ type: 'text/plain', value: `New subscriber: ${email}` }]
      })
    });
    if (!r.ok) throw new Error('sendgrid failed');
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'subscription failed' });
  }
}
