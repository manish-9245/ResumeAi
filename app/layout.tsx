import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { AppProvider } from "@/lib/store";
import { PwaRegister } from "@/components/pwa";

const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700", "800"] });
const body = Inter({ variable: "--font-body", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-data", subsets: ["latin"] });

import { siteUrl } from "@/lib/site";

const SITE_URL = siteUrl();
const SITE_NAME = "ResumeAI";
const SITE_DESC =
  "Upload one PDF and get a resume health score, exact job-match percentages, skill gaps with priorities, a learn-first roadmap, verification quizzes and a career assistant.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ResumeAI — From PDF to Career Plan",
    template: "%s · ResumeAI",
  },
  description: SITE_DESC,
  keywords: [
    "resume analyzer", "resume health score", "job match", "skill gap analysis",
    "career roadmap", "resume checker for students", "ATS resume check",
    "internship preparation", "AI career assistant",
  ],
  authors: [{ name: "ResumeAI" }],
  creator: "ResumeAI",
  applicationName: "ResumeAI",
  alternates: { canonical: "/" },
  openGraph: {
    title: "ResumeAI — From PDF to Career Plan",
    description: SITE_DESC,
    url: "/",
    siteName: SITE_NAME,
    locale: "en_US",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "ResumeAI — your resume, measured like an instrument" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ResumeAI — From PDF to Career Plan",
    description: SITE_DESC,
    images: ["/og.png"],
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/logo.png" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/icon",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ResumeAI",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B1220",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        <AuthProvider>
          <AppProvider>{children}</AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
