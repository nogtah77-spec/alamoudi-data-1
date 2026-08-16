import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Cairo } from 'next/font/google'
import './globals.css'

const cairo = Cairo({ subsets: ['arabic', 'latin'], variable: '--font-cairo' })

export const metadata: Metadata = {
  title: 'محلل بيانات العقار',
  description: 'رفع ملف عقار أو لصق تفاصيل غير مرتبة، وتحليلها تلقائيًا وتوزيعها في خانات منظمة جاهزة للتصدير بصيغ متعددة.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
        sizes: 'any',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#e7e1d3' },
    { media: '(prefers-color-scheme: dark)', color: '#172333' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl" className="bg-background" suppressHydrationWarning>
      <body className={`${cairo.variable} antialiased font-sans`}>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
              const key = 'property-analyzer-theme';
              const apply = (theme) => {
                document.documentElement.classList.toggle('dark', theme === 'dark');
                document.documentElement.style.colorScheme = theme;
              };
              apply(localStorage.getItem(key) === 'dark' ? 'dark' : 'light');
              document.addEventListener('click', (event) => {
                const button = event.target.closest('[data-theme-toggle]');
                if (!button) return;
                const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
                localStorage.setItem(key, next);
                apply(next);
              });
            })()`,
          }}
        />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
