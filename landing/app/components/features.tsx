const browserFeatures = [
  {
    title: "37 CLI Commands",
    description:
      "Navigate, click, fill, type, hover, drag, screenshot, and more. Full Playwright power from the terminal.",
  },
  {
    title: "REPL Mode",
    description:
      "Interactive browser sessions for exploration and debugging. Auto-snapshot diffs after every action.",
  },
  {
    title: "Dual Targeting",
    description:
      "Target elements by accessibility refs (fast) or natural language descriptions (AI-powered semantic selection).",
  },
];

const testingFeatures = [
  {
    title: "YAML Test Definitions",
    description:
      "Human-readable, version-controllable. 40+ actions, AI assertions, variable interpolation.",
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

function FeatureGrid({
  label,
  features,
}: {
  label: string;
  features: { title: string; description: string }[];
}) {
  return (
    <div>
      <h3 className="mb-4 font-mono text-base tracking-wide text-brand-cyan">
        ## {label}
      </h3>
      <div className="grid gap-px border border-border-subtle md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="border border-border-subtle p-8 transition-colors hover:border-brand-yellow/30"
          >
            <h4 className="mb-3 font-mono text-lg font-medium text-brand-white">
              {feature.title}
            </h4>
            <p className="text-sm leading-relaxed text-text-muted">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section className="px-6 py-24 md:py-36">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-12 font-mono text-lg tracking-wide text-brand-cyan">
          # Features
        </h2>

        <div className="space-y-16">
          <FeatureGrid label="Browser Automation" features={browserFeatures} />
          <FeatureGrid label="E2E Testing" features={testingFeatures} />
        </div>
      </div>
    </section>
  );
}
