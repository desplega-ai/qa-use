import type { TestAgentV2Data, IssueReport, DoneIntent, Block, HistoryItem } from '../types.js';
import { isTestCreatorDoneIntent } from '../types.js';

export interface BlockSummary {
  id: number;
  name: string;
  action: string;
  status: 'completed' | 'failed' | 'skipped';
  confidence?: string;
  error?: string;
}

export interface EnhancedTestSummary {
  testId: string;
  modelName: string;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  totalDuration: number;
  testResult?: {
    status: 'success' | 'failure';
    message: string;
    explanation: string;
    isPositiveTest: boolean;
    successCriteria: string;
  };
  discoveredIssues: IssueReport[];
  stuckStates: string[];
  finalUrl: string;
  blocks: BlockSummary[];
}

export function generateEnhancedTestSummary(data: TestAgentV2Data): EnhancedTestSummary {
  const { test_id, model_name, history, blocks, last_done } = data;

  // Calculate totals from history
  const completedSteps = history.filter((h) => h.status === 'completed').length;
  const failedSteps = history.filter((h) => h.status === 'failed').length;

  // Calculate total duration
  const totalDuration = history.reduce((acc, item) => {
    return acc + (item.elapsed_ms || 0);
  }, 0);

  // Process test result if available
  let testResult: EnhancedTestSummary['testResult'] | undefined;
  let discoveredIssues: IssueReport[] = [];

  if (last_done && isTestCreatorDoneIntent(last_done)) {
    testResult = {
      status: last_done.status,
      message: last_done.message,
      explanation: last_done.explanation,
      isPositiveTest: last_done.is_positive,
      successCriteria: last_done.success_criteria,
    };
    discoveredIssues = last_done.issues || [];
  }

  // Extract stuck states
  const stuckStates: string[] = [];

  history.forEach((item) => {
    // Check intents for stuck states
    item.intents.forEach((intent) => {
      if (intent.intent && 'reasoning' in intent.intent) {
        const reasoning = intent.intent.reasoning.toLowerCase();
        if (reasoning.includes('stuck') || reasoning.includes('switching organization')) {
          stuckStates.push(intent.intent.reasoning);
        }
      }
    });
  });

  // Get final URL from last completed history item
  const lastCompleted = [...history].reverse().find((h) => h.status === 'completed');
  const finalUrl = lastCompleted?.end_url || '';

  // Process blocks into summary
  const blockSummaries: BlockSummary[] = blocks.map((block) => {
    const relatedHistory = history.filter((h) => h.block_ids.includes(block.id));
    const hasFailure = relatedHistory.some((h) => h.status === 'failed');
    const allCompleted = relatedHistory.every((h) => h.status === 'completed');

    return {
      id: block.id,
      name: block.name,
      action: (block.action as any)?.action || 'unknown',
      status: block.skipped
        ? 'skipped'
        : hasFailure
          ? 'failed'
          : allCompleted
            ? 'completed'
            : 'skipped',
      confidence: block.confidence,
      error: block.last_error || undefined,
    };
  });

  return {
    testId: test_id,
    modelName: model_name,
    totalSteps: history.length,
    completedSteps,
    failedSteps,
    totalDuration,
    testResult,
    discoveredIssues,
    stuckStates: [...new Set(stuckStates)],
    finalUrl,
    blocks: blockSummaries,
  };
}

// Helper function to format issues by severity
export function categorizeIssues(issues: IssueReport[]): {
  critical: IssueReport[];
  high: IssueReport[];
  medium: IssueReport[];
  low: IssueReport[];
} {
  const categorized = {
    critical: [] as IssueReport[],
    high: [] as IssueReport[],
    medium: [] as IssueReport[],
    low: [] as IssueReport[],
  };

  issues.forEach((issue) => {
    const severity = issue.severity || 'low';
    if (severity === 'critical' || severity === 'blocker') {
      categorized.critical.push(issue);
    } else if (severity === 'high' || severity === 'major') {
      categorized.high.push(issue);
    } else if (severity === 'medium' || severity === 'minor') {
      categorized.medium.push(issue);
    } else {
      categorized.low.push(issue);
    }
  });

  return categorized;
}

// Enhanced report formatter
export function formatEnhancedTestReport(summary: EnhancedTestSummary): string {
  const successRate = ((summary.completedSteps / summary.totalSteps) * 100).toFixed(1);
  const durationSeconds = (summary.totalDuration / 1000).toFixed(2);

  let report = `# Test Execution Report\n\n`;
  report += `**Test ID:** ${summary.testId}\n`;
  report += `**Model:** ${summary.modelName}\n`;
  report += `**Success Rate:** ${successRate}% (${summary.completedSteps}/${summary.totalSteps} steps)\n`;
  report += `**Total Duration:** ${durationSeconds} seconds\n`;
  report += `**Final URL:** ${summary.finalUrl}\n\n`;

  // Add test result section if available
  if (summary.testResult) {
    const statusIcon = summary.testResult.status === 'success' ? '✅' : '❌';
    const testType = summary.testResult.isPositiveTest ? 'Positive' : 'Negative';

    report += `## Test Result ${statusIcon}\n`;
    report += `**Test Type:** ${testType} Test\n`;
    report += `**Status:** ${summary.testResult.status.toUpperCase()}\n`;
    report += `**Message:** ${summary.testResult.message}\n`;
    report += `**Success Criteria:** ${summary.testResult.successCriteria}\n\n`;
    report += `### Explanation\n${summary.testResult.explanation}\n\n`;
  }

  // Add discovered issues section
  if (summary.discoveredIssues.length > 0) {
    report += `## Discovered Issues (${summary.discoveredIssues.length})\n\n`;

    const categorized = categorizeIssues(summary.discoveredIssues);

    (['critical', 'high', 'medium', 'low'] as const).forEach((severity) => {
      const issues = categorized[severity];
      if (issues.length > 0) {
        report += `### ${severity.toUpperCase()} Severity (${issues.length})\n`;
        issues.forEach((issue) => {
          report += `- **${issue.title}** [${issue.issue_type || 'observation'}]\n`;
          report += `  ${issue.description}\n`;
          if (issue.url) {
            report += `  URL: ${issue.url}\n`;
          }
          if (issue.recommendations && issue.recommendations.length > 0) {
            report += `  Recommendations:\n`;
            issue.recommendations.forEach((rec) => {
              report += `    - ${rec}\n`;
            });
          }
        });
        report += `\n`;
      }
    });
  }

  if (summary.stuckStates.length > 0) {
    report += `## Stuck States Detected\n`;
    summary.stuckStates.forEach((state) => {
      report += `- ${state.substring(0, 150)}...\n`;
    });
    report += `\n`;
  }

  report += `## Test Blocks\n`;
  summary.blocks.forEach((block) => {
    const statusIcon =
      block.status === 'completed' ? '✅' : block.status === 'failed' ? '❌' : '⏭️';
    report += `${statusIcon} **${block.name}** (${block.action})`;
    if (block.confidence) {
      report += ` - Confidence: ${block.confidence}`;
    }
    if (block.error) {
      report += `\n   Error: ${block.error}`;
    }
    report += `\n`;
  });

  return report;
}

// Function to generate issue statistics
export function generateIssueStatistics(issues: IssueReport[]): {
  totalIssues: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  criticalCount: number;
  hasBlockers: boolean;
  mostCommonType: string | null;
} {
  const bySeverity: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let criticalCount = 0;
  let hasBlockers = false;

  issues.forEach((issue) => {
    // Count by severity
    const severity = issue.severity || 'low';
    bySeverity[severity] = (bySeverity[severity] || 0) + 1;

    if (severity === 'critical' || severity === 'blocker') {
      criticalCount++;
      if (severity === 'blocker') hasBlockers = true;
    }

    // Count by type
    const type = issue.issue_type || 'observation';
    byType[type] = (byType[type] || 0) + 1;
  });

  // Find most common type
  const mostCommonType =
    Object.keys(byType).length > 0
      ? Object.entries(byType).sort((a, b) => b[1] - a[1])[0][0]
      : null;

  return {
    totalIssues: issues.length,
    bySeverity,
    byType,
    criticalCount,
    hasBlockers,
    mostCommonType,
  };
}
