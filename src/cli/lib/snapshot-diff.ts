/**
 * Snapshot diff formatting utilities
 */

import type { SnapshotDiff, SnapshotDiffChange } from '../../../lib/api/browser-types.js';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const MAX_CHANGES_SHOWN = 25;

export function formatSnapshotDiff(diff: SnapshotDiff): string {
  const lines: string[] = [];

  // Summary line
  lines.push(`${colors.cyan}Changes:${colors.reset} ${diff.summary}`);
  lines.push('');

  // Format changes (limited to MAX_CHANGES_SHOWN)
  const totalChanges = diff.changes.length;
  const changesToShow = diff.changes.slice(0, MAX_CHANGES_SHOWN);

  for (const change of changesToShow) {
    lines.push(formatChange(change));
  }

  // Add truncation note if there are more changes
  if (totalChanges > MAX_CHANGES_SHOWN) {
    const remaining = totalChanges - MAX_CHANGES_SHOWN;
    lines.push('');
    lines.push(
      `${colors.gray}... and ${remaining} more change${remaining === 1 ? '' : 's'}. Run 'snapshot' to see full page state.${colors.reset}`
    );
  }

  return lines.join('\n');
}

function formatChange(change: SnapshotDiffChange): string {
  const refStr = `${colors.yellow}[${change.ref}]${colors.reset}`;
  const roleStr = `${colors.gray}${change.role}${colors.reset}`;

  switch (change.change_type) {
    case 'added':
      return (
        `${colors.green}+ ${refStr} ${roleStr} "${change.name}"${colors.reset}` +
        (change.parent_ref ? ` (in ${change.parent_ref})` : '')
      );

    case 'removed':
      return `${colors.red}- ${refStr} ${roleStr} "${change.name}"${colors.reset}`;

    case 'modified': {
      let result = `${colors.yellow}~ ${refStr} ${roleStr} "${change.name}"${colors.reset}`;
      if (change.attribute_changes) {
        const { added, removed } = change.attribute_changes;
        if (added.length > 0) {
          result += `\n    ${colors.green}+attrs: ${added.join(', ')}${colors.reset}`;
        }
        if (removed.length > 0) {
          result += `\n    ${colors.red}-attrs: ${removed.join(', ')}${colors.reset}`;
        }
      }
      return result;
    }

    default:
      return `  ${refStr} ${roleStr} "${change.name}"`;
  }
}
