import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "qa-use — AI-first browser testing for your CI/CD pipeline",
  description:
    "Create, run, and manage E2E tests with YAML definitions. Works with Claude, VS Code Copilot, Cursor, and any MCP client. Built by desplega labs.",
  metadataBase: new URL("https://qa-use.dev"),
  keywords: [
    "qa-use",
    "browser testing",
    "E2E testing",
    "end-to-end testing",
    "playwright",
    "MCP server",
    "AI testing",
    "YAML tests",
    "CI/CD",
    "desplega",
    "qa automation",
    "claude",
    "cursor",
    "copilot",
  ],
  authors: [{ name: "desplega labs", url: "https://desplega.sh" }],
  openGraph: {
    title: "qa-use — AI-first browser testing",
    description:
      "Create, run, and manage E2E tests with YAML definitions. Works with Claude, VS Code Copilot, Cursor, and any MCP client.",
    url: "https://qa-use.dev",
    siteName: "qa-use",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "qa-use — AI-first browser testing",
    description:
      "E2E tests with YAML. Works with Claude, Copilot, Cursor, and any MCP client.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://qa-use.dev",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "qa-use",
              description:
                "AI-first browser testing CLI for E2E test management using YAML definitions and MCP server integration.",
              url: "https://qa-use.dev",
              applicationCategory: "DeveloperApplication",
              operatingSystem: "macOS, Linux, Windows",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              author: {
                "@type": "Organization",
                name: "desplega labs",
                url: "https://desplega.sh",
              },
              license: "https://opensource.org/licenses/MIT",
              downloadUrl:
                "https://www.npmjs.com/package/@desplega.ai/qa-use",
              softwareVersion: "2.9.0",
              codeRepository: "https://github.com/desplega-ai/qa-use",
            }),
          }}
        />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
