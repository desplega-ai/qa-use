import { ArrowUpRight } from "./icons";
import { InstallCommand } from "./install-command";

export function Hero() {
  return (
    <section className="relative flex min-h-svh items-center px-6">
      <div className="mx-auto w-full max-w-5xl">
        <p className="mb-6 font-mono text-sm tracking-wide text-brand-cyan">
          @desplega.ai/qa-use
        </p>

        <h1 className="font-mono text-5xl font-medium tracking-tight md:text-7xl lg:text-8xl">
          qa-use
        </h1>

        <p className="mt-6 max-w-2xl text-xl font-medium leading-snug text-brand-yellow md:text-2xl">
          AI-powered browser automation and E2E testing
        </p>

        <p className="mt-4 max-w-xl text-base leading-relaxed text-text-muted md:text-lg">
          Automate browsers with 37 CLI commands. Define and run E2E tests with
          YAML. Works with Claude, Cursor, and any MCP client.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <a
            href="#getting-started"
            className="inline-flex items-center border border-border-subtle px-5 py-2.5 text-sm font-medium uppercase tracking-wider text-brand-white transition-colors hover:border-brand-white"
          >
            Get Started
          </a>
          <a
            href="https://app.desplega.ai"
            className="inline-flex items-center gap-1.5 border border-brand-yellow px-5 py-2.5 text-sm font-medium uppercase tracking-wider text-brand-yellow transition-colors hover:bg-brand-yellow hover:text-brand-black"
          >
            Get API Key
            <ArrowUpRight className="h-3.5 w-3.5" />
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
          <InstallCommand command="npm install -g @desplega.ai/qa-use" />
        </div>
      </div>
    </section>
  );
}
