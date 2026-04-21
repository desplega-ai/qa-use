import { Header } from "./components/header";
import { Hero } from "./components/hero";
import { Features } from "./components/features";
import { GettingStarted } from "./components/getting-started";
import { Footer } from "./components/footer";

// Force dynamic rendering so middleware/CDN response headers (incl.
// Vary: Accept per acceptmarkdown.com) aren't baked into a static
// prerender that Vercel would serve with its own Vary header set.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Features />
        <GettingStarted />
      </main>
      <Footer />
    </>
  );
}
