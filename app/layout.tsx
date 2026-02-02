import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ReactQueryProvider } from '@/providers/ReactQueryProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const baseUrl = 'https://veenzo.app';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'Veenzo | Gestión de equipos y proyectos',
    template: '%s | Veenzo',
  },
  description:
    'Aplicación todo-en-uno para gestión de equipos, proyectos, chat y calendario compartido.',
  keywords: [
    'gestión de equipos',
    'gestión de proyectos',
    'software colaborativo',
    'kanban',
    'tareas',
    'chat en tiempo real',
    'calendario compartido',
    'productividad',
  ],
  applicationName: 'Veenzo',
  category: 'Business',
  creator: 'Veenzo',
  publisher: 'Veenzo',
  manifest: '/manifest.json',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: baseUrl,
    title: 'Veenzo | Gestión de equipos y proyectos',
    description:
      'Aplicación todo-en-uno para gestión de equipos, proyectos, chat y calendario compartido.',
    siteName: 'Veenzo',
    locale: 'es_ES',
    images: [
      {
        url: '/veenzo-logo-square.png',
        width: 512,
        height: 512,
        alt: 'Veenzo',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Veenzo | Gestión de equipos y proyectos',
    description:
      'Aplicación todo-en-uno para gestión de equipos, proyectos, chat y calendario compartido.',
    images: ['/veenzo-logo-square.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Veenzo',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: [{ url: '/veenzo-logo-square.png' }],
    apple: [{ url: '/icons/apple-touch-icon.png' }],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#6366f1',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Veenzo',
      url: baseUrl,
      logo: `${baseUrl}/veenzo-logo-square.png`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Veenzo',
      url: baseUrl,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description:
        'Aplicación todo-en-uno para gestión de equipos, proyectos, chat y calendario compartido.',
      featureList: [
        'Gestión de proyectos y tareas',
        'Kanban y responsables',
        'Chat en tiempo real',
        'Calendario compartido',
        'Base de conocimiento',
      ],
    },
  ];

  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="canonical" href="https://veenzo.app/" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Veenzo" />
        <meta name="theme-color" content="#6366f1" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ReactQueryProvider>
          <ThemeProvider>
            <AuthProvider>
              {children}
              <ToastContainer
                position="bottom-right"
                autoClose={2000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="colored"
              />
            </AuthProvider>
          </ThemeProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
