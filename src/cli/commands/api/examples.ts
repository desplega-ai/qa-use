import { Command } from 'commander';

const EXAMPLES = `
API Command Examples
${'─'.repeat(50)}

List endpoints:
  qa-use api ls
  qa-use api ls --method GET
  qa-use api ls --tag "External API v1"
  qa-use api ls -q "tests"

Make GET requests:
  qa-use api /api/v1/tests
  qa-use api /api/v1/tests -f limit=5
  qa-use api /api/v1/app-configs

Make POST requests:
  qa-use api /api/v1/tests-actions/run -f test_ids='["id1"]'
  qa-use api /api/v1/tests-actions/run --input body.json

Inspect routes:
  qa-use api info /api/v1/tests
  qa-use api info /api/v1/tests-actions/run -X POST
  qa-use api info /api/v1/tests --json

Include response headers:
  qa-use api /api/v1/tests --include

Raw output (no formatting):
  qa-use api /api/v1/tests --raw

Custom headers:
  qa-use api /api/v1/tests -H "X-Custom:value"

OpenAPI spec:
  qa-use api openapi
  qa-use api openapi --raw

Offline mode (use cached spec):
  qa-use api ls --offline
  qa-use api /api/v1/tests --offline
`.trimStart();

export const examplesCommand = new Command('examples')
  .description('Show API command usage examples')
  .action(() => {
    console.log(EXAMPLES);
  });
