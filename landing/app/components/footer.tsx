import { DesplegaWordmark, GitHubIcon, NpmIcon, ArrowUpRight } from "./icons";

export function Footer() {
  return (
    <footer className="border-t border-border-subtle px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between">
          <div className="space-y-6">
            <DesplegaWordmark className="h-6 text-brand-yellow" />
            <p className="font-mono text-xs uppercase tracking-widest text-text-muted">
              Made by builders for builders
            </p>
            <p className="text-sm text-text-muted">
              Built by{" "}
              <a
                href="https://desplega.sh"
                className="text-brand-yellow transition-colors hover:text-brand-white"
              >
                desplega labs
              </a>
            </p>
          </div>

          <div className="flex flex-col gap-8 sm:flex-row sm:gap-16">
            <div>
              <h4 className="mb-3 font-mono text-xs uppercase tracking-widest text-text-muted">
                Resources
              </h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="https://github.com/desplega-ai/qa-use#readme"
                    className="inline-flex items-center gap-1 text-sm text-brand-white transition-colors hover:text-brand-yellow"
                  >
                    Documentation
                    <ArrowUpRight className="h-3 w-3 text-text-muted" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/desplega-ai/qa-use"
                    className="inline-flex items-center gap-1 text-sm text-brand-white transition-colors hover:text-brand-yellow"
                  >
                    GitHub
                    <ArrowUpRight className="h-3 w-3 text-text-muted" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.npmjs.com/package/@desplega.ai/qa-use"
                    className="inline-flex items-center gap-1 text-sm text-brand-white transition-colors hover:text-brand-yellow"
                  >
                    npm
                    <ArrowUpRight className="h-3 w-3 text-text-muted" />
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 font-mono text-xs uppercase tracking-widest text-text-muted">
                Company
              </h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="https://app.desplega.sh"
                    className="inline-flex items-center gap-1 text-sm text-brand-white transition-colors hover:text-brand-yellow"
                  >
                    Get API Key
                    <ArrowUpRight className="h-3 w-3 text-text-muted" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://desplega.ai"
                    className="inline-flex items-center gap-1 text-sm text-brand-white transition-colors hover:text-brand-yellow"
                  >
                    desplega.ai
                    <ArrowUpRight className="h-3 w-3 text-text-muted" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://desplega.sh"
                    className="inline-flex items-center gap-1 text-sm text-brand-white transition-colors hover:text-brand-yellow"
                  >
                    desplega.sh
                    <ArrowUpRight className="h-3 w-3 text-text-muted" />
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border-subtle pt-8 sm:flex-row sm:items-center">
          <p className="text-xs text-text-muted">
            MIT License &middot; &copy; {new Date().getFullYear()} desplega labs
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/desplega-ai/qa-use"
              className="text-text-muted transition-colors hover:text-brand-white"
              aria-label="GitHub"
            >
              <GitHubIcon className="h-4 w-4" />
            </a>
            <a
              href="https://www.npmjs.com/package/@desplega.ai/qa-use"
              className="text-text-muted transition-colors hover:text-brand-white"
              aria-label="npm"
            >
              <NpmIcon className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
