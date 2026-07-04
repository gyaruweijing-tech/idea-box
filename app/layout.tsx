import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Idea Box — 妄想の宝箱',
  description:
    'タスクじゃない。いつかやるかもしれない、馬鹿げた・想像的なアイディアを放り込んでおく箱。',
};

export const viewport: Viewport = {
  themeColor: '#ffd54f',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
