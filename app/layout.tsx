import type { Metadata } from "next";
import { Instrument_Sans } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';
import RouteGuard from './components/auth/RouteGuard';
import { MeshBackground } from './components/ui/MeshBackground';

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Taskmaster',
  description: 'Simple and efficient task management application',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' className={instrumentSans.variable} suppressHydrationWarning>
      <body className='font-sans antialiased' suppressHydrationWarning>
        {/* bg-background here is a guaranteed-dark fallback behind the
            shader canvas itself — belt-and-suspenders in case the canvas
            fails to initialize (e.g. no WebGL2 support) or has any gap,
            so nothing white can ever show through. */}
        <div className='fixed inset-0 -z-10 pointer-events-none bg-background'>
          <MeshBackground />
        </div>
        <Providers>
          <RouteGuard>{children}</RouteGuard>
        </Providers>
      </body>
    </html>
  );
}
