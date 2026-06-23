/**
 * Checkout routes.
 * Serves the post-payment success page and handles Stripe webhook.
 */
const express = require('express');
const router = express.Router();

const pixelHelper = `
<script src="/js/pixel.js"></script>
<script>
(function () {
  var params = new URLSearchParams(window.location.search);
  var amount = params.get('amount') || '0';
  var currency = params.get('currency') || 'EUR';
  var plan = params.get('plan') || 'unknown';
  var billing = params.get('billing') || 'annual';

  if (typeof window._nexecutivePixel !== 'undefined') {
    var amountNum = parseFloat(amount);
    if (!isNaN(amountNum)) {
      window._nexecutivePixel.firePurchase(amountNum, currency, plan, billing);
    }
  }
})();
</script>
`;

// Stripe webhook endpoint
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  // Webhook handler would go here for production Stripe integration
  // For now, the success page fires Purchase via pixel.js
  res.json({ received: true });
});

// Checkout success page
router.get('/success', (req, res) => {
  const { amount, currency, plan, billing } = req.query;

  const body = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Confirmed — Nexecutive</title>
  <style>
    body { font-family: 'DM Sans', sans-serif; background: #F5EFEA; color: #0F2D1F; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #fff; border-radius: 12px; padding: 3rem; max-width: 480px; text-align: center; box-shadow: 0 4px 24px rgba(15,45,31,0.08); }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-family: 'Fraunces', serif; font-size: 1.8rem; font-weight: 600; margin: 0 0 0.75rem; color: #0F2D1F; }
    p { color: #2A4A37; font-size: 1rem; line-height: 1.6; margin: 0 0 2rem; }
    a { display: inline-block; background: #C9A84C; color: #0F2D1F; text-decoration: none; padding: 0.8rem 1.5rem; border-radius: 4px; font-weight: 500; }
    a:hover { background: #d4b35a; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#10004;</div>
    <h1>Payment Confirmed</h1>
    <p>Thank you! Your subscription is active. Nexecutive is now monitoring M&A targets for your team.</p>
    <a href="/">Back to Nexecutive</a>
  </div>
  ${pixelHelper}
</body>
</html>
`;
  res.send(body);
});

module.exports = router;