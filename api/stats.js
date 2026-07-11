// GoldBelt Africa — back-office stats (Vercel serverless function)
// Reads Stripe securely server-side. Requires two environment variables in Vercel:
//   STRIPE_SECRET_KEY   — your Stripe *secret* key (sk_live_...)  [Stripe → Developers → API keys]
//   DASHBOARD_PASSWORD  — a password you choose, to protect this page
export default async function handler(req, res) {
  // simple password gate
  const given = (req.query.pw || '').toString();
  if (!process.env.DASHBOARD_PASSWORD || given !== process.env.DASHBOARD_PASSWORD) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(500).json({ error: 'STRIPE_SECRET_KEY not set' });

  const H = { 'Authorization': 'Bearer ' + key };
  const money = c => (c / 100);

  try {
    // Active subscriptions (paginated)
    let subs = [], starting_after = null, guard = 0;
    do {
      const u = new URL('https://api.stripe.com/v1/subscriptions');
      u.searchParams.set('status', 'active');
      u.searchParams.set('limit', '100');
      if (starting_after) u.searchParams.set('starting_after', starting_after);
      const r = await fetch(u, { headers: H });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      subs = subs.concat(j.data || []);
      starting_after = j.has_more ? j.data[j.data.length - 1].id : null;
      guard++;
    } while (starting_after && guard < 20);

    // Monthly recurring revenue from active subs
    let mrr = 0;
    for (const s of subs) {
      for (const it of (s.items?.data || [])) {
        const p = it.price;
        if (!p || !p.unit_amount) continue;
        let monthly = p.unit_amount;
        const iv = p.recurring?.interval;
        if (iv === 'year') monthly = p.unit_amount / 12;
        else if (iv === 'week') monthly = p.unit_amount * 4.33;
        mrr += monthly * (it.quantity || 1);
      }
    }

    // Recent successful payments (last 100) → gross + lifetime one-offs + activity
    const rp = await fetch('https://api.stripe.com/v1/charges?limit=100', { headers: H });
    const rj = await rp.json();
    if (rj.error) throw new Error(rj.error.message);
    const charges = (rj.data || []).filter(c => c.paid && c.status === 'succeeded' && !c.refunded);
    const now = Math.floor(Date.now() / 1000);
    const since30 = now - 30 * 86400;
    let gross30 = 0;
    const recent = [];
    for (const c of charges) {
      if (c.created >= since30) gross30 += c.amount;
      if (recent.length < 8) recent.push({
        amt: money(c.amount), cur: (c.currency || 'usd').toUpperCase(),
        email: c.billing_details?.email || c.receipt_email || '—',
        date: new Date(c.created * 1000).toISOString().slice(0, 10),
        desc: c.description || ''
      });
    }

    // Total customers
    const cr = await fetch('https://api.stripe.com/v1/customers?limit=1', { headers: H });
    const cj = await cr.json();

    return res.status(200).json({
      active_subscriptions: subs.length,
      mrr: Math.round(mrr) / 100,
      gross_30d: money(gross30),
      recent
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'stats failed' });
  }
}
