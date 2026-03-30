export function GettingStarted() {
  return (
    <section id="getting-started" className="scroll-mt-16 px-6 py-24 md:py-36">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-4 font-mono text-sm tracking-wide text-brand-cyan">
          Getting Started
        </h2>
        <p className="mb-12 max-w-lg text-lg text-text-muted">
          Three commands to your first test. Works with any web application.
        </p>

        <div className="space-y-12">
          {/* Install & Setup */}
          <div>
            <h3 className="mb-4 text-base font-medium text-brand-white">
              Install and configure
            </h3>
            <CodeBlock
              lines={[
                { type: "comment", text: "# Install globally" },
                {
                  type: "command",
                  prompt: "$",
                  text: "npm install -g @desplega.ai/qa-use",
                },
                { type: "blank" },
                { type: "comment", text: "# Configure your API key" },
                { type: "command", prompt: "$", text: "qa-use setup" },
                { type: "blank" },
                { type: "comment", text: "# Initialize test directory" },
                { type: "command", prompt: "$", text: "qa-use test init" },
              ]}
            />
          </div>

          {/* First Test */}
          <div>
            <h3 className="mb-4 text-base font-medium text-brand-white">
              Write your first test
            </h3>
            <CodeBlock
              lang="yaml"
              filename="qa-tests/login.yaml"
              lines={[
                { type: "key", text: "name", value: "Login Test" },
                { type: "key", text: "steps", value: "" },
                { type: "action", text: "  - action", value: "goto" },
                { type: "key", text: "    url", value: "/login" },
                { type: "action", text: "  - action", value: "fill" },
                { type: "key", text: "    target", value: "email input" },
                {
                  type: "key",
                  text: "    value",
                  value: "test@example.com",
                },
                { type: "action", text: "  - action", value: "click" },
                { type: "key", text: "    target", value: "login button" },
                {
                  type: "action",
                  text: "  - action",
                  value: "to_be_visible",
                },
                { type: "key", text: "    target", value: "dashboard" },
              ]}
            />
          </div>

          {/* Run */}
          <div>
            <h3 className="mb-4 text-base font-medium text-brand-white">
              Run it
            </h3>
            <CodeBlock
              lines={[
                { type: "command", prompt: "$", text: "qa-use test run login" },
                { type: "blank" },
                {
                  type: "output",
                  text: "  \u2713 Login Test passed (3.2s)",
                },
              ]}
            />
          </div>

          {/* MCP Integration */}
          <div>
            <h3 className="mb-4 text-base font-medium text-brand-white">
              Add to your AI assistant
            </h3>
            <CodeBlock
              lines={[
                {
                  type: "comment",
                  text: "# Claude Code",
                },
                {
                  type: "command",
                  prompt: "$",
                  text: "claude mcp add desplega-qa -- npx @desplega.ai/qa-use mcp",
                },
                { type: "blank" },
                {
                  type: "comment",
                  text: "# Or run standalone MCP server",
                },
                {
                  type: "command",
                  prompt: "$",
                  text: "npx @desplega.ai/qa-use mcp",
                },
              ]}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

type Line =
  | { type: "comment"; text: string }
  | { type: "command"; prompt: string; text: string }
  | { type: "output"; text: string }
  | { type: "blank" }
  | { type: "key"; text: string; value: string }
  | { type: "action"; text: string; value: string };

function CodeBlock({
  lines,
  filename,
}: {
  lines: Line[];
  lang?: string;
  filename?: string;
}) {
  return (
    <div className="overflow-hidden border border-border-subtle">
      {filename && (
        <div className="border-b border-border-subtle bg-surface-code px-4 py-2 font-mono text-xs text-text-muted">
          {filename}
        </div>
      )}
      <pre className="overflow-x-auto bg-surface-code p-5 font-mono text-sm leading-relaxed">
        <code>
          {lines.map((line, i) => (
            <span key={i} className="block">
              {line.type === "comment" && (
                <span className="token-comment">{line.text}</span>
              )}
              {line.type === "command" && (
                <>
                  <span className="token-command">{line.prompt}</span>{" "}
                  <span className="text-brand-white">{line.text}</span>
                </>
              )}
              {line.type === "output" && (
                <span className="text-green-400">{line.text}</span>
              )}
              {line.type === "blank" && "\u00A0"}
              {line.type === "key" && (
                <>
                  <span className="token-key">{line.text}</span>
                  <span className="text-text-muted">:</span>{" "}
                  <span className="token-value">{line.value}</span>
                </>
              )}
              {line.type === "action" && (
                <>
                  <span className="token-key">{line.text}</span>
                  <span className="text-text-muted">:</span>{" "}
                  <span className="token-action">{line.value}</span>
                </>
              )}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
