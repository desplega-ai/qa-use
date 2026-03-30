import { DesplegaIsotype, GitHubIcon } from "./icons";

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border-subtle bg-brand-black/90 px-6 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between">
        <a href="/" className="flex items-center gap-2.5">
          <DesplegaIsotype className="h-5 w-5 text-brand-yellow" />
          <span className="font-mono text-sm font-medium tracking-tight text-brand-white">
            qa-use
          </span>
        </a>

        <nav className="flex items-center gap-6">
          <a
            href="https://github.com/desplega-ai/qa-use#readme"
            className="text-sm text-text-muted transition-colors hover:text-brand-white"
          >
            Docs
          </a>
          <a
            href="https://desplega.ai"
            className="text-sm text-text-muted transition-colors hover:text-brand-white"
          >
            desplega.ai
          </a>
          <a
            href="https://github.com/desplega-ai/qa-use"
            className="text-text-muted transition-colors hover:text-brand-white"
            aria-label="GitHub"
          >
            <GitHubIcon className="h-5 w-5" />
          </a>
        </nav>
      </div>
    </header>
  );
}
