/**
 * qa-use docs - Access bundled documentation and reference guides
 */

import { Command } from 'commander';
import { MAIN_DOC, REFERENCE_DOCS, TEMPLATES } from '../generated/docs-content.js';
import { error, info } from '../lib/output.js';

const TOPIC_KEYS = Object.keys(REFERENCE_DOCS);
const TEMPLATE_KEYS = Object.keys(TEMPLATES);

function printList(): void {
  console.log(info('Available documentation topics:\n'));

  console.log('  Reference Guides:');
  for (const key of TOPIC_KEYS) {
    console.log(`    ${key.padEnd(22)} ${REFERENCE_DOCS[key].title}`);
  }

  console.log('\n  Templates:');
  console.log(`    ${'templates'.padEnd(22)} List all test templates`);
  for (const key of TEMPLATE_KEYS) {
    console.log(`    template:${key.padEnd(14)} ${TEMPLATES[key].title}`);
  }

  console.log('\n  API:');
  console.log(`    ${'api ls'.padEnd(22)} List available API endpoints`);
  console.log(`    ${'api info <route>'.padEnd(22)} Route details (input/output types)`);
  console.log(`    ${'api examples'.padEnd(22)} API usage examples`);
  console.log(`    ${'api openapi'.padEnd(22)} OpenAPI spec URL (--raw for JSON)`);

  console.log(`
Usage:
  qa-use docs                      Main documentation
  qa-use docs browser-commands     Browser commands reference
  qa-use docs templates            List all templates
  qa-use docs template:auth-flow   Show auth flow template
  qa-use api info /api/v1/tests    Route input/output types
  qa-use api examples              API usage examples`);
}

export const docsCommand = new Command('docs')
  .description('Show documentation and reference guides')
  .argument('[topic]', 'Topic to display (use --list to see available topics)')
  .option('--list', 'List available documentation topics')
  .action(async (topic: string | undefined, options: { list?: boolean }) => {
    if (options.list) {
      printList();
      return;
    }

    // No topic: show main doc
    if (!topic) {
      process.stdout.write(`${MAIN_DOC}\n`);
      return;
    }

    // Check reference docs
    if (topic in REFERENCE_DOCS) {
      process.stdout.write(`${REFERENCE_DOCS[topic].content}\n`);
      return;
    }

    // "templates" lists available templates
    if (topic === 'templates') {
      console.log(info('Available test templates:\n'));
      for (const key of TEMPLATE_KEYS) {
        console.log(`  ${key.padEnd(16)} ${TEMPLATES[key].title}`);
      }
      console.log('\nUsage: qa-use docs template:<name>');
      return;
    }

    // "template:<name>" shows a specific template
    if (topic.startsWith('template:')) {
      const name = topic.slice('template:'.length);
      if (name in TEMPLATES) {
        process.stdout.write(`${TEMPLATES[name].content}\n`);
        return;
      }
      console.log(error(`Unknown template: "${name}"`));
      console.log(`Available: ${TEMPLATE_KEYS.join(', ')}`);
      process.exit(1);
    }

    // Unknown topic
    console.log(error(`Unknown topic: "${topic}"`));
    console.log("Run 'qa-use docs --list' to see available topics.");
    process.exit(1);
  });
