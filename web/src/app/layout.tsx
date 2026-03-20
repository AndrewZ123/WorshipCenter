import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "WorshipCenter — Worship Planning Without the Chaos",
  description: "Plan services, schedule your team, manage your song library, and track CCLI usage — all in one simple place. Built for worship leaders.",
  openGraph: {
    title: "WorshipCenter — Worship Planning Without the Chaos",
    description: "The all-in-one worship planning tool for churches of every size.",
    url: "https://worshipcenter.app",
    siteName: "WorshipCenter",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WorshipCenter",
    description: "Worship planning without the chaos.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}