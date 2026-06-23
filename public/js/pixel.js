/**
 * Meta Pixel event helpers.
 * Lead fires on CTA click (pricing page). Purchase fires on checkout success page.
 */

(function () {
  window._nexecutivePixel = window._nexecutivePixel || {};

  /**
   * Fire Lead event when a user clicks a pricing CTA.
   * @param {string} plan - 'solo', 'team', or 'enterprise'
   * @param {string} billing - 'annual' or 'monthly'
   */
  window._nexecutivePixel.fireLead = function (plan, billing) {
    if (typeof fbq !== 'undefined') {
      fbq('track', 'Lead', {
        content_name: plan + ' — ' + billing,
        content_category: 'subscription',
      });
    }
  };

  /**
   * Fire Purchase event after a confirmed Stripe payment.
   * @param {number} amount - Amount in dollars (e.g., 149.00 for $149)
   * @param {string} currency - ISO 4217 currency code (e.g., 'EUR', 'USD')
   * @param {string} plan - 'solo', 'team', or 'enterprise'
   * @param {string} billing - 'annual' or 'monthly'
   */
  window._nexecutivePixel.firePurchase = function (amount, currency, plan, billing) {
    if (typeof fbq !== 'undefined') {
      fbq('track', 'Purchase', {
        value: amount,
        currency: currency,
        content_name: plan + ' — ' + billing,
        content_category: 'subscription',
      });
    }
  };
})();