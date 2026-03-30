import { ArrowUpRight } from "./icons";

export function Hero() {
  return (
    <section className="relative px-6 pt-32 pb-24 md:pt-44 md:pb-36">
      <div className="mx-auto max-w-5xl">
        <p className="mb-6 font-mono text-sm tracking-wide text-brand-cyan">
          @desplega.ai/qa-use
        </p>

        <h1 className="text-5xl font-medium tracking-tight md:text-7xl lg:text-8xl">
          qa-use
        </h1>

        <p className="mt-6 max-w-2xl text-xl font-medium leading-snug text-brand-yellow md:text-2xl">
          AI-first browser testing for your CI/CD pipeline
        </p>

        <p className="mt-4 max-w-xl text-base leading-relaxed text-text-muted md:text-lg">
          Create, run, and manage E2E tests with YAML definitions. Works with
          Claude, VS Code Copilot, Cursor, and any MCP client.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <a
            href="#getting-started"
            className="inline-flex items-center border border-brand-yellow px-5 py-2.5 text-sm font-medium uppercase tracking-wider text-brand-yellow transition-colors hover:bg-brand-yellow hover:text-brand-black"
          >
            Get Started
          </a>
          <a
            href="https://github.com/desplega-ai/qa-use"
            className="inline-flex items-center gap-1.5 border border-border-subtle px-5 py-2.5 text-sm font-medium uppercase tracking-wider text-brand-white transition-colors hover:border-brand-white"
          >
            GitHub
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
          <a
            href="https://www.npmjs.com/package/@desplega.ai/qa-use"
            className="inline-flex items-center gap-1.5 border border-border-subtle px-5 py-2.5 text-sm font-medium uppercase tracking-wider text-text-muted transition-colors hover:border-brand-white hover:text-brand-white"
          >
            npm
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="mt-10">
          <div className="inline-block bg-surface-code px-4 py-2.5 font-mono text-sm text-text-muted">
            <span className="text-brand-yellow">$</span>{" "}
            <span className="text-brand-white">npm install -g</span>{" "}
            <span className="text-brand-cyan">@desplega.ai/qa-use</span>
          </div>
        </div>
      </div>
    </section>
  );
}
