import type { Metadata } from "next";
import { Providers } from './providers';
import './globals.css';
import RouteGuard from './components/auth/RouteGuard';

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
    <html lang='en' suppressHydrationWarning>
      <body className='font-sans antialiased'>
        <Providers>
          <RouteGuard>{children}</RouteGuard>
        </Providers>
      </body>
    </html>
  );
}
