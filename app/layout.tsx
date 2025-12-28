import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { Toaster } from 'react-hot-toast';
import SupportAssistant from '@/components/support-assistant';

const inter = Inter({ subsets: ['latin'] });
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'DevisFact - Devis et factures pour artisans',
  description: 'Créez vos devis et factures professionnels en quelques clics. Solution simple et intuitive pour artisans.',
  keywords: ['devis', 'factures', 'artisans', 'gestion', 'facturation'],
  authors: [{ name: 'DevisFact' }],
  icons: {
    icon: '/icon.svg',
    shortcut: '/favicon.svg',
  },
  themeColor: '#FF7A00',
  viewport: 'width=device-width, initial-scale=1',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: siteUrl,
    title: 'DevisFact - Devis et factures pour artisans',
    description: 'Créez vos devis et factures professionnels en quelques clics',
    siteName: 'DevisFact',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <Toaster position="top-right" />
          <SupportAssistant />
        </AuthProvider>
      </body>
    </html>
  );
}
