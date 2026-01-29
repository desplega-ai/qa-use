/**
 * qa-use browser mfa-totp - Generate TOTP code and optionally fill into input
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { error, info, success } from '../../lib/output.js';

interface MfaTotpOptions {
  sessionId?: string;
  text?: string;
}

/**
 * Normalize ref by stripping leading @ if present
 */
function normalizeRef(ref: string): string {
  return ref.startsWith('@') ? ref.slice(1) : ref;
}

/**
 * Check if a string looks like a valid TOTP secret (base32 encoded)
 */
function isValidTotpSecret(value: string): boolean {
  // TOTP secrets are base32 encoded (A-Z, 2-7), typically 16-32 chars
  // They can include spaces or dashes which should be stripped
  const cleaned = value.replace(/[\s-]/g, '').toUpperCase();
  return /^[A-Z2-7]{16,}$/.test(cleaned);
}

export const mfaTotpCommand = new Command('mfa-totp')
  .description('Generate TOTP code and optionally fill into input element')
  .argument('<ref-or-secret>', 'Element ref or TOTP secret (if only secret, generates code only)')
  .argument('[secret]', 'TOTP secret (if ref is provided)')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('-t, --text <description>', 'Semantic element description (AI-based)')
  .action(async (refOrSecret: string, secret: string | undefined, options: MfaTotpOptions) => {
    try {
      const config = await loadConfig();
      if (!config.api_key) {
        console.log(error('API key not configured. Run `qa-use setup` first.'));
        process.exit(1);
      }

      const client = new BrowserApiClient(config.api_url);
      client.setApiKey(config.api_key);

      const resolved = await resolveSessionId({
        explicitId: options.sessionId,
        client,
      });

      // Determine if we're in "generate only" mode or "fill" mode
      // Cases:
      // 1. mfa-totp <secret> - generate only (refOrSecret is the secret)
      // 2. mfa-totp <ref> <secret> - fill by ref
      // 3. mfa-totp -t "text" <secret> - fill by text (refOrSecret is the secret)
      let actualSecret: string;
      let ref: string | undefined;
      const text: string | undefined = options.text;

      if (secret) {
        // Case 2: ref + secret
        ref = normalizeRef(refOrSecret);
        actualSecret = secret;
      } else if (text) {
        // Case 3: -t "text" + secret (refOrSecret is the secret)
        actualSecret = refOrSecret;
      } else {
        // Could be case 1 (generate only) or case 2 without explicit ref
        // If refOrSecret looks like a TOTP secret, it's generate only
        // Otherwise, it's an error (ref without secret)
        if (isValidTotpSecret(refOrSecret)) {
          // Case 1: generate only
          actualSecret = refOrSecret;
        } else {
          console.log(
            error(
              'Usage: mfa-totp <secret> or mfa-totp <ref> <secret> or mfa-totp -t "description" <secret>'
            )
          );
          process.exit(1);
        }
      }

      // Build action
      const action: {
        type: 'mfa_totp';
        secret: string;
        ref?: string;
        text?: string;
      } = {
        type: 'mfa_totp',
        secret: actualSecret,
      };

      if (ref) {
        action.ref = ref;
      }
      if (text) {
        action.text = text;
      }

      const result = await client.executeAction(resolved.id, action);

      if (result.success) {
        // The API may return the generated code in the result data
        const code =
          result.data && typeof result.data === 'object' && 'code' in result.data
            ? (result.data as { code: string }).code
            : undefined;

        if (ref || text) {
          const target = ref ? `element ${ref}` : `"${text}"`;
          if (code) {
            console.log(success(`Generated TOTP code ${code} and filled into ${target}`));
          } else {
            console.log(success(`Generated TOTP code and filled into ${target}`));
          }
        } else {
          if (code) {
            console.log(info(`Generated TOTP code: ${code}`));
          } else {
            console.log(success('Generated TOTP code'));
          }
        }
        await touchSession(resolved.id);
      } else {
        const hint = result.error || 'MFA TOTP failed';
        console.log(error(hint));
        process.exit(1);
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to generate TOTP code'));
      process.exit(1);
    }
  });
