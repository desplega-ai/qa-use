import { NextRequest, NextResponse } from "next/server";
import { markdownContent, plainTextContent } from "./app/content";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect any non-root path to home (except Next.js internals & static files)
  if (pathname !== "/") {
    return NextResponse.redirect(new URL("/", request.url), 301);
  }

  const accept = request.headers.get("accept") || "";
  const ua = (request.headers.get("user-agent") || "").toLowerCase();

  // text/markdown takes priority
  if (accept.includes("text/markdown")) {
    return new NextResponse(markdownContent, {
      headers: { "content-type": "text/markdown; charset=utf-8" },
    });
  }

  // curl / wget / httpie get plain text
  const isCli =
    ua.includes("curl") || ua.includes("wget") || ua.includes("httpie");

  if (isCli) {
    return new NextResponse(plainTextContent, {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

export const config = {
  matcher: [
    // Match all paths except Next.js internals, static assets, and SEO files
    "/((?!_next/|favicon\\.ico|sitemap\\.xml|robots\\.txt).*)",
  ],
};
