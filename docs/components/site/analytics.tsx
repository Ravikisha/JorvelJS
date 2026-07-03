import Script from 'next/script';

/**
 * Google Analytics 4 (gtag.js). The measurement ID is sourced from
 * `process.env.NEXT_PUBLIC_GA_ID` (build-inlined) with a hard-coded fallback
 * for the production deploy. Renders nothing in development unless the env
 * var is explicitly set.
 *
 * Strategy: `afterInteractive` — script loads after the page becomes
 * interactive (does not block initial paint). Per Next 16 docs, this is the
 * recommended GA placement.
 */
const FALLBACK_GA_ID = 'G-WPKL7MS43C';

export function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID || FALLBACK_GA_ID;
  if (!id) return null;
  // Skip during local dev unless the env var is explicitly set — keeps the GA
  // dashboard clean of localhost noise. Override by setting NEXT_PUBLIC_GA_ID.
  if (process.env.NODE_ENV !== 'production' && !process.env.NEXT_PUBLIC_GA_ID) {
    return null;
  }
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${id}', {
            anonymize_ip: true,
            transport_type: 'beacon',
          });
        `}
      </Script>
    </>
  );
}
