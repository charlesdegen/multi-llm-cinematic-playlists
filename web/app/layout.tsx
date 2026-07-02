import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Multi-LLM Cinematic Playlists',
  description:
    'Aggregate soundtrack recommendations from Claude, GPT, Gemini, Grok and more — curate one master tracklist and ship it as a real Spotify playlist.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#07080f' },
    { media: '(prefers-color-scheme: light)', color: '#eef0f6' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
