export function GettingStarted() {
  return (
    <section id="getting-started" className="scroll-mt-16 px-6 py-24 md:py-36">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-4 font-mono text-lg tracking-wide text-brand-cyan">
          # Getting Started
        </h2>
        <p className="mb-12 max-w-lg text-lg text-text-muted">
          Install, automate a browser, or write your first test. Works with any
          web application.
        </p>

        <div className="space-y-12">
          {/* Install & Setup */}
          <div>
            <h3 className="mb-4 font-mono text-base font-medium text-brand-white">
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
                {
                  type: "comment",
                  text: "# Configure your API key (get one at app.desplega.sh)",
                },
                { type: "command", prompt: "$", text: "qa-use setup" },
              ]}
            />
          </div>

          {/* Browser Automation */}
          <div>
            <h3 className="mb-1 font-mono text-base font-medium text-brand-white">
              Automate a browser
            </h3>
            <p className="mb-4 text-sm text-text-muted">
              37 commands for interactive browser control.
            </p>
            <CodeBlock
              lines={[
                {
                  type: "comment",
                  text: "# Start a browser session (visible)",
                },
                {
                  type: "command",
                  prompt: "$",
                  text: "qa-use browser create --no-headless",
                },
                { type: "blank" },
                { type: "comment", text: "# Navigate to your app" },
                {
                  type: "command",
                  prompt: "$",
                  text: "qa-use browser goto https://myapp.com",
                },
                { type: "blank" },
                {
                  type: "comment",
                  text: "# See what's on the page (ARIA snapshot)",
                },
                {
                  type: "command",
                  prompt: "$",
                  text: "qa-use browser snapshot",
                },
                { type: "blank" },
                { type: "comment", text: "# Interact with elements" },
                {
                  type: "command",
                  prompt: "$",
                  text: 'qa-use browser click "Sign In"',
                },
                {
                  type: "command",
                  prompt: "$",
                  text: 'qa-use browser fill e12 "user@example.com"',
                },
                {
                  type: "command",
                  prompt: "$",
                  text: "qa-use browser screenshot /tmp/shot.png",
                },
                { type: "blank" },
                { type: "comment", text: "# Done" },
                {
                  type: "command",
                  prompt: "$",
                  text: "qa-use browser close",
                },
              ]}
            />
          </div>

          {/* Write a Test */}
          <div>
            <h3 className="mb-1 font-mono text-base font-medium text-brand-white">
              Write a test
            </h3>
            <p className="mb-4 text-sm text-text-muted">
              YAML definitions with variables and AI assertions.
            </p>
            <CodeBlock
              lang="yaml"
              filename="qa-tests/login.yaml"
              lines={[
                { type: "key", text: "name", value: "Login Test" },
                { type: "key", text: "variables", value: "" },
                {
                  type: "key",
                  text: "  base_url",
                  value: "http://localhost:3000",
                },
                {
                  type: "key",
                  text: "  email",
                  value: "test@example.com",
                },
                { type: "key", text: "  password", value: "secret123" },
                { type: "key", text: "steps", value: "" },
                { type: "action", text: "  - action", value: "goto" },
                { type: "key", text: "    url", value: "$base_url/login" },
                { type: "action", text: "  - action", value: "fill" },
                { type: "key", text: "    target", value: "email input" },
                { type: "key", text: "    value", value: "$email" },
                { type: "action", text: "  - action", value: "fill" },
                { type: "key", text: "    target", value: "password input" },
                { type: "key", text: "    value", value: "$password" },
                { type: "action", text: "  - action", value: "click" },
                {
                  type: "key",
                  text: "    target",
                  value: "sign in button",
                },
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
            <h3 className="mb-4 font-mono text-base font-medium text-brand-white">
              Run it
            </h3>
            <CodeBlock
              lines={[
                {
                  type: "comment",
                  text: "# Run against your local app (tunnel mode)",
                },
                {
                  type: "command",
                  prompt: "$",
                  text: "qa-use test run login --tunnel",
                },
                { type: "blank" },
                {
                  type: "output",
                  text: "  \u2713 Login Test passed (3.2s)",
                },
              ]}
            />
          </div>

          {/* Claude */}
          <div>
            <h3 className="mb-1 font-mono text-base font-medium text-brand-white">
              Add to Claude
            </h3>
            <p className="mb-4 text-sm text-text-muted">
              Plugin, MCP server, or skill for Claude Code.
            </p>
            <CodeBlock
              lines={[
                {
                  type: "comment",
                  text: "# Add from the marketplace",
                },
                {
                  type: "command",
                  prompt: "$",
                  text: "claude plugin marketplace add desplega-ai/qa-use",
                },
                { type: "blank" },
                {
                  type: "comment",
                  text: "# Then install the plugin",
                },
                {
                  type: "command",
                  prompt: "$",
                  text: "claude plugin install qa-use@desplega.ai",
                },
                { type: "blank" },
                {
                  type: "comment",
                  text: "# Add as MCP server",
                },
                {
                  type: "command",
                  prompt: "$",
                  text: "claude mcp add desplega-qa -- npx @desplega.ai/qa-use mcp",
                },
              ]}
            />
          </div>

          {/* All other AI assistants */}
          <div>
            <h3 className="mb-1 font-mono text-base font-medium text-brand-white">
              Add to any other AI assistant
            </h3>
            <p className="mb-4 text-sm text-text-muted">
              Works with VS Code Copilot, Cursor, Gemini CLI, and any MCP
              client.
            </p>
            <CodeBlock
              lines={[
                {
                  type: "comment",
                  text: "# Run the MCP server",
                },
                {
                  type: "command",
                  prompt: "$",
                  text: "npx @desplega.ai/qa-use mcp",
                },
                { type: "blank" },
                {
                  type: "comment",
                  text: "# Install the skill",
                },
                {
                  type: "command",
                  prompt: "$",
                  text: "npx skills add https://github.com/desplega-ai/qa-use --skill qa-use",
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
                  <span className="token-command">{line.prompt} </span>
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
