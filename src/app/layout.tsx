import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const monoFont = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Nucleus — Campus Intelligence Platform",
  description:
    "The Nucleus is the intelligence layer for educational institutions. Connect your ERP, attendance, and fee systems to get student risk alerts, financial health dashboards, and real-time campus intelligence.",
  openGraph: {
    title: "The Nucleus — Campus Intelligence Platform",
    description:
      "Your ERP stores records. The Nucleus makes sense of them. Student risk alerts, financial dashboards, and campus intelligence — built for Indian institutions.",
    siteName: "The Nucleus",
    locale: "en_IN",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${spaceGrotesk.variable} ${monoFont.variable} font-sans antialiased`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
