import type { Metadata } from "next";
import "./globals.css";
import Toaster from "@/components/shared/Toaster";
import { SessionProvider } from "@/components/shared/SessionProvider";
import { PresenceProvider } from "@/components/shared/PresenceProvider";

export const metadata: Metadata = {
  title: "UniConnect - University Communication Platform",
  description: "University communication and management platform",
};

const THEME_SCRIPT = `
try {
  var t = localStorage.getItem('uniconnect-theme');
  document.documentElement.dataset.theme = (t === 'dark' || t === 'ocean-dark') ? 'ocean-dark' : 'ocean-light';
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen" style={{ fontFamily: "'Poppins', sans-serif" }}>
        <SessionProvider>
          <PresenceProvider>{children}</PresenceProvider>
        </SessionProvider>
        <Toaster />
      </body>
    </html>
  );
}