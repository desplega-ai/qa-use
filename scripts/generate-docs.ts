#!/usr/bin/env tsx

/**
 * Generate bundled documentation content from skill markdown files.
 *
 * Reads from plugins/qa-use/skills/qa-use/ and writes a TypeScript module
 * at src/cli/generated/docs-content.ts that can be imported at runtime.
 *
 * Usage: bun run generate:docs
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SKILL_DIR = path.join(ROOT, 'plugins/qa-use/skills/qa-use');
const OUTPUT_PATH = path.join(ROOT, 'src/cli/generated/docs-content.ts');

/** Escape content for embedding inside a JS template literal. */
function escapeForTemplateLiteral(content: string): string {
  return content.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

/** Extract the first `# Heading` from markdown content. */
function extractTitle(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

/** Convert a filename like "browser-commands.md" to a title like "Browser Commands". */
function filenameToTitle(filename: string): string {
  return filename
    .replace(/\.(md|yaml|yml)$/, '')
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function readFileContent(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}

async function generateDocs(): Promise<void> {
  console.log('📚 Generating docs content...');

  // Read main SKILL.md
  const mainDocPath = path.join(SKILL_DIR, 'SKILL.md');
  const mainDoc = await readFileContent(mainDocPath);
  console.log(`  ✓ SKILL.md (${mainDoc.split('\n').length} lines)`);

  // Read reference docs
  const refsDir = path.join(SKILL_DIR, 'references');
  const refFiles = (await fs.readdir(refsDir)).filter((f) => f.endsWith('.md')).sort();

  const references: Array<{ key: string; title: string; content: string }> = [];
  for (const file of refFiles) {
    const content = await readFileContent(path.join(refsDir, file));
    const key = file.replace(/\.md$/, '');
    const title = extractTitle(content, filenameToTitle(file));
    references.push({ key, title, content });
    console.log(`  ✓ references/${file} (${content.split('\n').length} lines)`);
  }

  // Read templates
  const templatesDir = path.join(SKILL_DIR, 'templates');
  const templateFiles = (await fs.readdir(templatesDir))
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .sort();

  const templates: Array<{ key: string; title: string; content: string }> = [];
  for (const file of templateFiles) {
    const content = await readFileContent(path.join(templatesDir, file));
    const key = file.replace(/\.(yaml|yml)$/, '');
    const title = `${filenameToTitle(file)} Template`;
    templates.push({ key, title, content });
    console.log(`  ✓ templates/${file} (${content.split('\n').length} lines)`);
  }

  // Generate output
  const output = `/**
 * Auto-generated documentation content for the docs command.
 * DO NOT EDIT MANUALLY — Generated from plugins/qa-use/skills/qa-use/
 * Run 'bun run generate:docs' to regenerate.
 */

export const MAIN_DOC = \`${escapeForTemplateLiteral(mainDoc)}\`;

export const REFERENCE_DOCS: Record<string, { title: string; content: string }> = {
${references.map((r) => `  '${r.key}': { title: '${r.title.replace(/'/g, "\\'")}', content: \`${escapeForTemplateLiteral(r.content)}\` },`).join('\n')}
};

export const TEMPLATES: Record<string, { title: string; content: string }> = {
${templates.map((t) => `  '${t.key}': { title: '${t.title.replace(/'/g, "\\'")}', content: \`${escapeForTemplateLiteral(t.content)}\` },`).join('\n')}
};
`;

  // Ensure output directory exists
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });

  // Write generated file
  await fs.writeFile(OUTPUT_PATH, output, 'utf-8');

  // Format with biome so the output is stable across check:docs runs
  execSync(`npx biome check --write ${OUTPUT_PATH}`, { stdio: 'ignore' });

  console.log(`\n✓ Generated ${OUTPUT_PATH}`);
  console.log(
    `  ${references.length} reference docs, ${templates.length} templates`
  );
}

generateDocs().catch((err) => {
  console.error('❌ Failed to generate docs:', err);
  process.exit(1);
});
