/**
 * Analytics engine for calculating developer growth metrics
 */

import { Commit, Repository, LanguageProficiency } from "../drizzle/schema";

interface AnalyticsMetrics {
  consistencyScore: number; // 0-100, based on commit frequency variance
  skillGrowthTrend: number; // percentage change in unique languages
  learningVelocity: number; // commits per day average
  projectDepth: number; // 0-100, based on repo size and commit density
  depthBreadthRatio: number; // depth/breadth ratio
  totalCommits: number;
  totalRepositories: number;
  uniqueLanguages: number;
}

/**
 * Calculate consistency score based on commit frequency variance
 * Lower variance = higher consistency
 */
export function calculateConsistencyScore(commits: Commit[]): number {
  if (commits.length === 0) return 0;

  // Group commits by day
  const commitsByDay: Record<string, number> = {};
  commits.forEach(commit => {
    const day = commit.committedAt.toISOString().split('T')[0];
    commitsByDay[day] = (commitsByDay[day] || 0) + 1;
  });

  const dailyCounts = Object.values(commitsByDay);
  if (dailyCounts.length === 0) return 0;

  // Calculate mean
  const mean = dailyCounts.reduce((a, b) => a + b, 0) / dailyCounts.length;

  // Calculate variance
  const variance = dailyCounts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / dailyCounts.length;
  const stdDev = Math.sqrt(variance);

  // Coefficient of variation (normalized std dev)
  const cv = mean === 0 ? 0 : stdDev / mean;

  // Convert to 0-100 score (lower CV = higher score)
  // cv of 0 = 100, cv of 2+ = 0
  const score = Math.max(0, Math.min(100, 100 - (cv * 50)));
  return Math.round(score);
}

/**
 * Calculate learning velocity (commits per day)
 */
export function calculateLearningVelocity(commits: Commit[]): number {
  if (commits.length === 0) return 0;

  // Get date range
  const dates = commits.map(c => c.committedAt.getTime());
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));

  const daysDiff = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff === 0) return commits.length;

  return parseFloat((commits.length / daysDiff).toFixed(2));
}

/**
 * Calculate project depth score based on repository metrics
 * Considers average repo size and commit density
 */
export function calculateProjectDepth(repositories: Repository[], commits: Commit[]): number {
  if (repositories.length === 0) return 0;

  // Average repo size (normalized to 0-100)
  const avgSize = repositories.reduce((sum, repo) => sum + repo.size, 0) / repositories.length;
  const sizeScore = Math.min(100, (avgSize / 1000) * 100); // Normalize to 1MB = 100

  // Commit density (commits per repo)
  const commitDensity = commits.length / repositories.length;
  const densityScore = Math.min(100, commitDensity * 5); // 20 commits per repo = 100

  // Weighted average
  const depthScore = (sizeScore * 0.4 + densityScore * 0.6);
  return Math.round(depthScore);
}

/**
 * Calculate depth vs breadth ratio
 * Depth = average commits per repo
 * Breadth = number of unique languages
 */
export function calculateDepthBreadthRatio(
  repositories: Repository[],
  commits: Commit[],
  languages: LanguageProficiency[]
): number {
  if (repositories.length === 0 || languages.length === 0) return 0;

  const depth = commits.length / repositories.length;
  const breadth = languages.length;

  return parseFloat((depth / breadth).toFixed(2));
}

/**
 * Calculate skill growth trend (percentage change in languages)
 */
export function calculateSkillGrowthTrend(
  currentLanguages: LanguageProficiency[],
  commits: Commit[],
  timeWindowDays: number = 90
): number {
  if (currentLanguages.length === 0) return 0;

  // Count commits in the time window
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeWindowDays);

  const recentCommits = commits.filter(c => c.committedAt >= cutoffDate);

  if (recentCommits.length === 0) return 0;

  // Estimate growth as percentage of recent commits to total
  const growthPercentage = (recentCommits.length / commits.length) * 100;
  return Math.min(100, Math.round(growthPercentage));
}

/**
 * Analyze commit patterns to detect productivity trends
 */
export function analyzeCommitPatterns(commits: Commit[]): {
  averageCommitsPerDay: number;
  peakDay: string; // day of week with most commits
  burstyPattern: boolean; // true if commits are clustered (burst productivity)
  consistentPattern: boolean; // true if commits are spread evenly
} {
  if (commits.length === 0) {
    return {
      averageCommitsPerDay: 0,
      peakDay: "Monday",
      burstyPattern: false,
      consistentPattern: false,
    };
  }

  // Commits by day of week
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const commitsByDayOfWeek: Record<number, number> = {};

  commits.forEach(commit => {
    const dayOfWeek = commit.committedAt.getDay();
    commitsByDayOfWeek[dayOfWeek] = (commitsByDayOfWeek[dayOfWeek] || 0) + 1;
  });

  // Find peak day
  let peakDay = 0;
  let maxCommits = 0;
  Object.entries(commitsByDayOfWeek).forEach(([day, count]) => {
    if (count > maxCommits) {
      maxCommits = count;
      peakDay = parseInt(day);
    }
  });

  // Analyze pattern
  const values = Object.values(commitsByDayOfWeek);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // High std dev = bursty, low std dev = consistent
  const burstyPattern = stdDev > mean * 0.5;
  const consistentPattern = stdDev < mean * 0.3;

  return {
    averageCommitsPerDay: parseFloat((commits.length / 7).toFixed(2)),
    peakDay: dayNames[peakDay],
    burstyPattern,
    consistentPattern,
  };
}

/**
 * Identify newly adopted languages (learned in the last N days)
 */
export function identifyNewLanguages(
  languages: LanguageProficiency[],
  timeWindowDays: number = 90
): string[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeWindowDays);

  return languages
    .filter(lang => lang.firstSeenAt >= cutoffDate)
    .map(lang => lang.language);
}

/**
 * Identify languages with highest growth
 */
export function identifyGrowthLanguages(
  languages: LanguageProficiency[],
  topN: number = 3
): Array<{ language: string; commitCount: number; growth: string }> {
  return languages
    .sort((a, b) => b.commitCount - a.commitCount)
    .slice(0, topN)
    .map(lang => ({
      language: lang.language,
      commitCount: lang.commitCount,
      growth: lang.commitCount > 100 ? "High" : lang.commitCount > 50 ? "Medium" : "Low",
    }));
}

/**
 * Calculate comprehensive metrics
 */
export function calculateMetrics(
  repositories: Repository[],
  commits: Commit[],
  languages: LanguageProficiency[]
): AnalyticsMetrics {
  return {
    consistencyScore: calculateConsistencyScore(commits),
    skillGrowthTrend: calculateSkillGrowthTrend(languages, commits),
    learningVelocity: calculateLearningVelocity(commits),
    projectDepth: calculateProjectDepth(repositories, commits),
    depthBreadthRatio: calculateDepthBreadthRatio(repositories, commits, languages),
    totalCommits: commits.length,
    totalRepositories: repositories.length,
    uniqueLanguages: languages.length,
  };
}
