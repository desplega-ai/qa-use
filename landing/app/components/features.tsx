const features = [
  {
    title: "AI-First Testing",
    description:
      "Verify features with natural language. Auto-generate tests from PRs. Let AI explore your app and find what breaks.",
  },
  {
    title: "YAML-Based Tests",
    description:
      "Human-readable, version-controllable test definitions. 40+ actions, AI assertions, variable interpolation.",
  },
  {
    title: "MCP Server",
    description:
      "Works with Claude, VS Code Copilot, Cursor, Gemini CLI, and any MCP-compatible AI client out of the box.",
  },
  {
    title: "Browser CLI",
    description:
      "29+ interactive commands for manual testing and debugging. REPL mode for rapid exploration.",
  },
  {
    title: "Cloud Execution",
    description:
      "Sync tests to desplega.ai. Run in CI/CD with GitHub Actions. Persistent storage and reporting.",
  },
  {
    title: "Self-Healing",
    description:
      "AI auto-fixes broken selectors with --autofix. Tests adapt as your UI evolves. No more flaky tests.",
  },
];

export function Features() {
  return (
    <section className="px-6 py-24 md:py-36">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-4 font-mono text-sm tracking-wide text-brand-cyan">
          Features
        </h2>

        <div className="grid gap-px border border-border-subtle md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="border border-border-subtle p-8 transition-colors hover:border-brand-yellow/30"
            >
              <h3 className="mb-3 text-lg font-medium text-brand-white">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-text-muted">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
