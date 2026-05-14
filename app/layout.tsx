import '@/app/global.css';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { Figtree } from 'next/font/google';
import { AISearchTrigger } from '@/components/search';
import type { Metadata } from 'next';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';
import { baseOptions } from '@/lib/layout.shared';
import { source } from '@/lib/source';

const figtree = Figtree({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://docs.vlayer.xyz'),
  icons: {
    icon: '/favicon.svg',
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${figtree.className} dark`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              document.documentElement.classList.add('dark');
            `,
          }}
        />
      </head>
      <body className="flex flex-col min-h-screen">
        <RootProvider
          theme={{
            forcedTheme: 'dark',
            defaultTheme: 'dark',
            attribute: 'class',
          }}
        >
          <DocsLayout tree={source.pageTree} {...baseOptions()}>
            {children}
          </DocsLayout>
        </RootProvider>
        <AISearchTrigger />
      </body>
    </html>
  );
}
