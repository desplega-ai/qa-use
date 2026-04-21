import { Header } from "./components/header";
import { Hero } from "./components/hero";
import { Features } from "./components/features";
import { GettingStarted } from "./components/getting-started";
import { Footer } from "./components/footer";

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
