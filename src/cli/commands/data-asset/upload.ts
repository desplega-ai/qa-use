/**
 * qa-use data-asset upload - Upload a data asset (multipart/form-data)
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Command } from 'commander';
import { collectFields, requireApiKey } from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, success } from '../../lib/output.js';

export const uploadCommand = new Command('upload')
  .description('Upload a data asset')
  .argument('<file>', 'Local file path to upload')
  .option('-F, --field <key=value>', 'Set field (e.g. name=<name>)', collectFields, [])
  .option('--json', 'Output as JSON')
  .action(async (filePath: string, options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      // Resolve and validate file
      const resolvedPath = path.resolve(filePath);
      try {
        await fs.access(resolvedPath);
      } catch {
        console.log(error(`File not found: ${resolvedPath}`));
        process.exit(1);
      }

      const fileName = path.basename(resolvedPath);

      // Parse fields to extract name override
      let name: string | undefined;
      for (const entry of options.field) {
        const idx = entry.indexOf('=');
        if (idx > 0) {
          const key = entry.slice(0, idx).trim();
          const value = entry.slice(idx + 1).trim();
          if (key === 'name') {
            name = value;
          }
        }
      }

      // Build multipart form
      const fileBuffer = await fs.readFile(resolvedPath);
      const blob = new Blob([fileBuffer]);
      const form = new FormData();
      form.append('file', blob, fileName);
      if (name) {
        form.append('name', name);
      }

      const apiUrl = config.api_url || 'https://api.desplega.ai';
      const headers: Record<string, string> = { 'x-api-key': config.api_key as string };
      if (config.headers) {
        Object.assign(headers, config.headers);
      }

      const response = await fetch(`${apiUrl}/api/v1/data-assets`, {
        method: 'POST',
        headers,
        body: form,
      });

      if (!response.ok) {
        const body = await response.text();
        let detail: string;
        try {
          const parsed = JSON.parse(body);
          detail = parsed.detail || parsed.message || body;
        } catch {
          detail = body;
        }
        throw new Error(`${response.status} ${response.statusText}: ${detail}`);
      }

      const result = (await response.json()) as Record<string, unknown>;

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(
        success(`Data asset uploaded (ID: ${result.id}, Name: ${result.name ?? fileName})`)
      );
    } catch (err) {
      console.log(error(`Failed to upload data asset: ${formatError(err)}`));
      process.exit(1);
    }
  });
