import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface GitStatus {
  isRepo: boolean;
  repoRoot?: string | undefined;
  branch?: string | undefined;
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

export interface GitDiff {
  file: string;
  additions: number;
  deletions: number;
  diff: string;
}

export class GitService {
  private repoRoot: string | null = null;

  constructor(private workingDir: string = process.cwd()) {}

  /**
   * Check if current directory is in a git repository
   */
  isGitRepository(): boolean {
    try {
      execSync('git rev-parse --git-dir', {
        cwd: this.workingDir,
        stdio: 'ignore',
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find the root of the git repository
   */
  getRepoRoot(): string | null {
    if (this.repoRoot) return this.repoRoot;

    try {
      const result = execSync('git rev-parse --show-toplevel', {
        cwd: this.workingDir,
        encoding: 'utf8',
      });
      this.repoRoot = result.trim();
      return this.repoRoot;
    } catch {
      return null;
    }
  }

  /**
   * Get current branch name
   */
  getCurrentBranch(): string | null {
    try {
      const result = execSync('git branch --show-current', {
        cwd: this.workingDir,
        encoding: 'utf8',
      });
      return result.trim();
    } catch {
      return null;
    }
  }

  /**
   * Get git status information
   */
  getStatus(): GitStatus {
    const isRepo = this.isGitRepository();

    if (!isRepo) {
      return {
        isRepo: false,
        staged: [],
        unstaged: [],
        untracked: [],
      };
    }

    const repoRoot = this.getRepoRoot();
    const branch = this.getCurrentBranch();

    try {
      const result = execSync('git status --porcelain', {
        cwd: this.workingDir,
        encoding: 'utf8',
      });

      const staged: string[] = [];
      const unstaged: string[] = [];
      const untracked: string[] = [];

      result.split('\n').forEach((line) => {
        if (!line.trim()) return;

        const statusCode = line.substring(0, 2);
        const filePath = line.substring(3);

        // First character: staged changes
        if (statusCode[0] !== ' ' && statusCode[0] !== '?') {
          staged.push(filePath);
        }

        // Second character: unstaged changes
        if (statusCode[1] !== ' ') {
          if (statusCode[1] === '?') {
            untracked.push(filePath);
          } else {
            unstaged.push(filePath);
          }
        }
      });

      return {
        isRepo,
        repoRoot: repoRoot || undefined,
        branch: branch || undefined,
        staged,
        unstaged,
        untracked,
      };
    } catch {
      return {
        isRepo,
        repoRoot: repoRoot || undefined,
        branch: branch || undefined,
        staged: [],
        unstaged: [],
        untracked: [],
      };
    }
  }

  /**
   * Get diff for a specific file
   */
  getFileDiff(filePath: string, staged = false): GitDiff | null {
    try {
      const command = staged ? 'git diff --cached' : 'git diff';
      const result = execSync(`${command} --numstat "${filePath}"`, {
        cwd: this.workingDir,
        encoding: 'utf8',
      });

      const diffContent = execSync(`${command} "${filePath}"`, {
        cwd: this.workingDir,
        encoding: 'utf8',
      });

      if (!result.trim()) {
        return null; // No changes
      }

      const [addStr, delStr] = result.split('\t');
      const additions = parseInt(addStr || '0') || 0;
      const deletions = parseInt(delStr || '0') || 0;

      return {
        file: filePath,
        additions,
        deletions,
        diff: diffContent,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get diff for multiple files
   */
  getFilesDiff(filePaths: string[], staged = false): GitDiff[] {
    return filePaths
      .map((file) => this.getFileDiff(file, staged))
      .filter((diff): diff is GitDiff => diff !== null);
  }

  /**
   * Get a summary of changes for a file
   */
  getChangeSummary(filePath: string): string {
    const unstagedDiff = this.getFileDiff(filePath, false);
    const stagedDiff = this.getFileDiff(filePath, true);

    const parts: string[] = [];

    if (stagedDiff) {
      parts.push(`+${stagedDiff.additions} -${stagedDiff.deletions} (staged)`);
    }

    if (unstagedDiff) {
      parts.push(`+${unstagedDiff.additions} -${unstagedDiff.deletions} (unstaged)`);
    }

    return parts.length > 0 ? parts.join(', ') : 'No changes';
  }

  /**
   * Check if a file is ignored by git
   */
  isIgnored(filePath: string): boolean {
    try {
      execSync(`git check-ignore "${filePath}"`, {
        cwd: this.workingDir,
        stdio: 'ignore',
      });
      return true;
    } catch {
      return false;
    }
  }
}
