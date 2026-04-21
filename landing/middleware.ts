import { NextRequest, NextResponse } from "next/server";
import { markdownContent, plainTextContent } from "./app/content";

const SUPPORTED = ["text/html", "text/markdown"] as const;
type Supported = (typeof SUPPORTED)[number];

type Offer = { type: string; q: number; specificity: 0 | 1 | 2 };

function parseAccept(header: string): Offer[] {
  const trimmed = header.trim();
  if (!trimmed) return [{ type: "*/*", q: 1, specificity: 0 }];
  const offers: Offer[] = [];
  for (const part of trimmed.split(",")) {
    const [typeRaw, ...params] = part.trim().split(";");
    const type = typeRaw?.trim().toLowerCase();
    if (!type) continue;
    let q = 1;
    for (const p of params) {
      const [k, v] = p.trim().split("=");
      if (k?.trim().toLowerCase() === "q") {
        const parsed = Number.parseFloat(v ?? "");
        if (Number.isFinite(parsed))
          q = Math.max(0, Math.min(1, parsed));
      }
    }
    const specificity: 0 | 1 | 2 =
      type === "*/*" ? 0 : type.endsWith("/*") ? 1 : 2;
    offers.push({ type, q, specificity });
  }
  return offers;
}

function offerMatches(offer: string, supported: Supported): boolean {
  if (offer === "*/*") return true;
  const [oType, oSub] = offer.split("/");
  const [sType, sSub] = supported.split("/");
  return oType === sType && (oSub === "*" || oSub === sSub);
}

function negotiate(acceptHeader: string): Supported | null {
  const offers = parseAccept(acceptHeader);
  let best: { type: Supported; q: number; specificity: number } | null = null;
  for (const type of SUPPORTED) {
    let bestForType: Offer | null = null;
    for (const offer of offers) {
      if (!offerMatches(offer.type, type)) continue;
      if (
        !bestForType ||
        offer.specificity > bestForType.specificity ||
        (offer.specificity === bestForType.specificity &&
          offer.q > bestForType.q)
      ) {
        bestForType = offer;
      }
    }
    if (!bestForType || bestForType.q <= 0) continue;
    const candidate = {
      type,
      q: bestForType.q,
      specificity: bestForType.specificity,
    };
    if (
      !best ||
      candidate.q > best.q ||
      (candidate.q === best.q &&
        SUPPORTED.indexOf(candidate.type) < SUPPORTED.indexOf(best.type))
    ) {
      best = candidate;
    }
  }
  return best ? best.type : null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname !== "/") {
    return NextResponse.redirect(new URL("/", request.url), 301);
  }

  const accept = request.headers.get("accept") ?? "";
  const chosen = negotiate(accept);

  if (!chosen) {
    return new NextResponse("Not Acceptable", {
      status: 406,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        vary: "Accept",
      },
    });
  }

  if (chosen === "text/markdown") {
    return new NextResponse(markdownContent, {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        vary: "Accept",
      },
    });
  }

  const ua = (request.headers.get("user-agent") ?? "").toLowerCase();
  const isCli =
    ua.includes("curl") || ua.includes("wget") || ua.includes("httpie");
  if (isCli) {
    return new NextResponse(plainTextContent, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        vary: "Accept, User-Agent",
      },
    });
  }

  const res = NextResponse.next();
  res.headers.append("Vary", "Accept");
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/|favicon\\.ico|sitemap\\.xml|robots\\.txt|cli-schema\\.json).*)",
  ],
};
