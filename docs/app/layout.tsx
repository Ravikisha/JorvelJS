import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { NoFlashScript } from '@/components/theme-toggle';
import { SiteHeader } from '@/components/site/header';
import { SiteFooter } from '@/components/site/footer';
import { SearchDialog } from '@/components/site/search-dialog';
import { Analytics } from '@/components/site/analytics';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

const SITE_URL = 'https://jorveljs.vercel.app';
const SITE_NAME = 'JORVEL';
const SITE_TAGLINE = 'Production-grade micro-frontends';
const SITE_DESCRIPTION =
  'JORVEL is an opinionated, zero-config micro-frontend framework built on Rspack Module Federation. Typed federation contracts, file-based routing, SSR + streaming + SSG, edge adapters (Vercel, Cloudflare, Node), observability, security primitives (CSP, SRI, allowlists), and a CLI that scaffolds everything.';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  keywords: [
    'jorvel',
    'jorveljs',
    'micro-frontend',
    'micro-frontends',
    'module federation',
    'rspack',
    'react',
    'typescript',
    'ssr',
    'streaming ssr',
    'edge adapter',
    'vercel edge',
    'cloudflare workers',
    'csp',
    'sri',
    'observability',
    'event bus',
    'shared state',
    'file-based routing',
    'cli',
    'monorepo',
    'pnpm',
    'web framework',
    'frontend framework',
    'federation framework',
  ],
  authors: [{ name: 'Ravi Kishan', url: 'https://github.com/Ravikisha' }],
  creator: 'Ravi Kishan',
  publisher: 'JORVEL',
  category: 'Web Framework',
  classification: 'Software / Developer Tools / Web Frameworks',
  alternates: {
    canonical: SITE_URL,
  },
  icons: {
    icon: [
      { url: '/logojorvel.png', type: 'image/png' },
      { url: '/favicon.ico', sizes: '32x32' },
    ],
    shortcut: '/favicon.ico',
    apple: '/logojorvel.png',
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/logojorvel.png',
        width: 512,
        height: 512,
        alt: 'JORVEL — micro-frontend framework on Rspack Module Federation',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description:
      'Zero-config federation, file-based routing, SSR + streaming, edge adapters, observability. Next.js-level DX for micro-frontends.',
    images: ['/logojorvel.png'],
    creator: '@Ravikisha',
    site: '@Ravikisha',
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  other: {
    'theme-color': '#a3e635',
    'msapplication-TileColor': '#0a0a0a',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    alternateName: 'JorvelJS',
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    applicationCategory: 'DeveloperApplication',
    applicationSubCategory: 'Web Framework',
    operatingSystem: 'Cross-platform (Node.js >= 20)',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    license: 'https://opensource.org/licenses/MIT',
    author: {
      '@type': 'Person',
      name: 'Ravi Kishan',
      url: 'https://github.com/Ravikisha',
    },
    codeRepository: 'https://github.com/Ravikisha/JorvelJS',
    programmingLanguage: ['TypeScript', 'JavaScript'],
    softwareVersion: '0.2.0',
    keywords:
      'micro-frontend, module federation, rspack, react, typescript, ssr, edge, csp, observability',
  };
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <NoFlashScript />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider>
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
          <SearchDialog />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
