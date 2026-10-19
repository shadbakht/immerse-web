/**
 * The Pro price a web visitor pays, formatted for their UI language.
 *
 * Web sells Pro through Stripe at one USD price worldwide (STRIPE_PRICE_ID), so
 * unlike the app stores, which charge in local currency, a single figure is
 * accurate for everyone here. Copy that quotes a price takes it from this
 * helper rather than carrying "$0.99" inside the translated string; the mobile
 * app passes the store's own localized price into the same strings.
 */
export const WEB_PRO_MONTHLY_USD = 0.99;

export function webProPrice(locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      numberingSystem: 'latn',
    }).format(WEB_PRO_MONTHLY_USD);
  } catch {
    return `$${WEB_PRO_MONTHLY_USD}`;
  }
}
