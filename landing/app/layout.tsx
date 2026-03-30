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
  title: "qa-use — AI-powered browser automation and E2E testing",
  description:
    "Automate browsers with 37 CLI commands. Define and run E2E tests with YAML. Works with Claude, Cursor, and any MCP client. Built by desplega labs.",
  metadataBase: new URL("https://qa-use.dev"),
  keywords: [
    "qa-use",
    "browser automation",
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
    title: "qa-use — Browser automation and E2E testing",
    description:
      "Automate browsers with 37 CLI commands. Define and run E2E tests with YAML. Works with Claude, Cursor, and any MCP client.",
    url: "https://qa-use.dev",
    siteName: "qa-use",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "qa-use — Browser automation and E2E testing",
    description:
      "Automate browsers with 37 CLI commands. E2E tests with YAML. Works with Claude, Cursor, and any MCP client.",
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
                "AI-powered browser automation and E2E testing CLI. 37 browser commands, YAML test definitions, and MCP server integration.",
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
        {/* Privacy-friendly analytics by Plausible */}
        <script async src="https://plausible.io/js/pa-tMneNum4z1yJmyUAFcxCn.js" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()`,
          }}
        />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
