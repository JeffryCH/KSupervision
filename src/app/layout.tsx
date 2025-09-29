import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import UserProfileMenu from "@/components/UserProfileMenu";
import { ThemeProvider } from "@/components/ThemeProvider";

const themeInitializer = `(() => {
  try {
    const storedTheme = window.localStorage.getItem('app-theme');
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    const theme = storedTheme === 'day' || storedTheme === 'night' ? storedTheme : (prefersLight ? 'day' : 'night');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (_error) {
    document.documentElement.setAttribute('data-theme', 'night');
  }
})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Herramienta de supervision y seguimiento - K",
  description: "Servicio de supervision y seguimiento",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-theme="night" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Script id="theme-initializer" strategy="beforeInteractive">
          {themeInitializer}
        </Script>
        <ThemeProvider>
          <UserProfileMenu />
          <Script
            src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"
            strategy="afterInteractive"
            crossOrigin="anonymous"
          />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
