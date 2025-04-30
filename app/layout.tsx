import type { Metadata } from "next";
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Energy Dashboard',
  description: 'Modern energy consumption monitoring dashboard',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className='font-sans antialiased'>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
