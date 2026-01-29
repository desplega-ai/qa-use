import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json from the project root
const packageJsonPath = join(__dirname, '../../package.json');

interface PackageJson {
  name: string;
  version: string;
  description: string;
  [key: string]: unknown;
}

let packageJson: PackageJson | null = null;

export function getPackageInfo(): PackageJson {
  if (!packageJson) {
    try {
      const packageContent = readFileSync(packageJsonPath, 'utf-8');
      packageJson = JSON.parse(packageContent);
    } catch {
      // Fallback values if package.json can't be read
      packageJson = {
        name: 'qa-use-mcp',
        version: '1.0.0',
        description: 'MCP server for browser automation and QA testing',
      };
    }
  }
  return packageJson!;
}

export function getVersion(): string {
  return getPackageInfo().version;
}

export function getName(): string {
  return getPackageInfo().name;
}

export function getDescription(): string {
  return getPackageInfo().description;
}
