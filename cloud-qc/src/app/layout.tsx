import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

import { auth } from "@/lib/auth";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import { THEMES } from "@/lib/profile-schema";

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Cloud QC",
  description: "QC operations for Young Muslim neighbornets.",
  applicationName: "Cloud QC",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "Cloud QC",
    statusBarStyle: "black-translucent",
  },
};

export async function generateViewport(): Promise<Viewport> {
  const session = await auth();
  const themeKey = session?.user?.theme || "default";
  const bg = THEMES.find((t) => t.key === themeKey)?.bg ?? THEMES[0].bg;
  return { themeColor: bg };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  const theme = session?.user?.theme || "default";

  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
      data-theme={theme}
    >
      <body>
        <AuthSessionProvider session={session}>
          {children}
        </AuthSessionProvider>
      </body>
    </html>
  );
}
