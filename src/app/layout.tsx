import type { Metadata } from 'next';
import { Fraunces, Jost } from 'next/font/google';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { ThemeProvider } from '@/components/theme-provider';
import { config } from '@/config/companion.config';
import './globals.css';

/** Editorial display serif. Headings only, never body and never a button. */
const display = Fraunces({ subsets: ['latin'], variable: '--font-display-var', display: 'swap' });

/** Body and interface. */
const sans = Jost({ subsets: ['latin'], variable: '--font-sans-var', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(config.siteUrl),
  title: { default: `${config.name}, ${config.tagline}`, template: `%s | ${config.name}` },
  description: config.description,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: config.name,
    url: config.siteUrl,
    title: `${config.name}, ${config.tagline}`,
    description: config.description,
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SiteHeader />
          {/* No container here on purpose: `Section` owns the full width band AND the container
              inside it, so a wash reaches the viewport edge while its content stays on the same
              grid as the header and the footer. Pages never set a width. */}
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
