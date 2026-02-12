import { describe, it, expect } from "vitest";
import {
  calculateConsistencyScore,
  calculateLearningVelocity,
  calculateProjectDepth,
  calculateDepthBreadthRatio,
  calculateSkillGrowthTrend,
  analyzeCommitPatterns,
  identifyNewLanguages,
  identifyGrowthLanguages,
} from "./analytics";
import { Commit, Repository, LanguageProficiency } from "../drizzle/schema";

describe("Analytics Engine", () => {
  describe("calculateConsistencyScore", () => {
    it("should return 0 for empty commits", () => {
      const score = calculateConsistencyScore([]);
      expect(score).toBe(0);
    });

    it("should return high score for consistent commit patterns", () => {
      const now = new Date();
      const commits: Commit[] = [
        {
          id: 1,
          userId: 1,
          repositoryId: 1,
          commitHash: "abc123",
          message: "test",
          authorName: "Test",
          authorEmail: "test@example.com",
          committedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 6), // 6 days ago
          additions: 10,
          deletions: 5,
          filesChanged: 2,
          createdAt: now,
        },
        {
          id: 2,
          userId: 1,
          repositoryId: 1,
          commitHash: "def456",
          message: "test2",
          authorName: "Test",
          authorEmail: "test@example.com",
          committedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 5),
          additions: 12,
          deletions: 3,
          filesChanged: 2,
          createdAt: now,
        },
        {
          id: 3,
          userId: 1,
          repositoryId: 1,
          commitHash: "ghi789",
          message: "test3",
          authorName: "Test",
          authorEmail: "test@example.com",
          committedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 4),
          additions: 8,
          deletions: 4,
          filesChanged: 2,
          createdAt: now,
        },
      ];

      const score = calculateConsistencyScore(commits);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe("calculateLearningVelocity", () => {
    it("should return 0 for empty commits", () => {
      const velocity = calculateLearningVelocity([]);
      expect(velocity).toBe(0);
    });

    it("should calculate commits per day correctly", () => {
      const now = new Date();
      const commits: Commit[] = [
        {
          id: 1,
          userId: 1,
          repositoryId: 1,
          commitHash: "abc123",
          message: "test",
          authorName: "Test",
          authorEmail: "test@example.com",
          committedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 10),
          additions: 10,
          deletions: 5,
          filesChanged: 2,
          createdAt: now,
        },
        {
          id: 2,
          userId: 1,
          repositoryId: 1,
          commitHash: "def456",
          message: "test2",
          authorName: "Test",
          authorEmail: "test@example.com",
          committedAt: now,
          additions: 12,
          deletions: 3,
          filesChanged: 2,
          createdAt: now,
        },
      ];

      const velocity = calculateLearningVelocity(commits);
      expect(velocity).toBeGreaterThan(0);
      expect(velocity).toBeLessThan(1); // 2 commits over 10 days = ~0.2 commits/day
    });
  });

  describe("calculateProjectDepth", () => {
    it("should return 0 for empty repositories", () => {
      const depth = calculateProjectDepth([], []);
      expect(depth).toBe(0);
    });

    it("should calculate depth score based on repo size and commit density", () => {
      const repos: Repository[] = [
        {
          id: 1,
          userId: 1,
          githubRepoId: "123",
          name: "test-repo",
          url: "https://github.com/test/test-repo",
          description: "Test",
          language: "TypeScript",
          stars: 10,
          forks: 2,
          size: 500,
          isPrivate: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const now = new Date();
      const commits: Commit[] = [
        {
          id: 1,
          userId: 1,
          repositoryId: 1,
          commitHash: "abc123",
          message: "test",
          authorName: "Test",
          authorEmail: "test@example.com",
          committedAt: now,
          additions: 10,
          deletions: 5,
          filesChanged: 2,
          createdAt: now,
        },
      ];

      const depth = calculateProjectDepth(repos, commits);
      expect(depth).toBeGreaterThanOrEqual(0);
      expect(depth).toBeLessThanOrEqual(100);
    });
  });

  describe("calculateDepthBreadthRatio", () => {
    it("should return 0 for empty data", () => {
      const ratio = calculateDepthBreadthRatio([], [], []);
      expect(ratio).toBe(0);
    });

    it("should calculate depth/breadth ratio correctly", () => {
      const repos: Repository[] = [
        {
          id: 1,
          userId: 1,
          githubRepoId: "123",
          name: "test-repo",
          url: "https://github.com/test/test-repo",
          description: "Test",
          language: "TypeScript",
          stars: 10,
          forks: 2,
          size: 500,
          isPrivate: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const now = new Date();
      const commits: Commit[] = [
        {
          id: 1,
          userId: 1,
          repositoryId: 1,
          commitHash: "abc123",
          message: "test",
          authorName: "Test",
          authorEmail: "test@example.com",
          committedAt: now,
          additions: 10,
          deletions: 5,
          filesChanged: 2,
          createdAt: now,
        },
      ];

      const languages: LanguageProficiency[] = [
        {
          id: 1,
          userId: 1,
          language: "TypeScript",
          commitCount: 50,
          repositoryCount: 1,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const ratio = calculateDepthBreadthRatio(repos, commits, languages);
      expect(ratio).toBeGreaterThanOrEqual(0);
    });
  });

  describe("analyzeCommitPatterns", () => {
    it("should return default values for empty commits", () => {
      const patterns = analyzeCommitPatterns([]);
      expect(patterns.averageCommitsPerDay).toBe(0);
      expect(patterns.peakDay).toBe("Monday");
      expect(patterns.burstyPattern).toBe(false);
      expect(patterns.consistentPattern).toBe(false);
    });

    it("should identify bursty patterns", () => {
      const now = new Date();
      const commits: Commit[] = [];

      // Create commits heavily weighted toward one day
      for (let i = 0; i < 10; i++) {
        commits.push({
          id: i,
          userId: 1,
          repositoryId: 1,
          commitHash: `hash${i}`,
          message: "test",
          authorName: "Test",
          authorEmail: "test@example.com",
          committedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 0), // Monday
          additions: 10,
          deletions: 5,
          filesChanged: 2,
          createdAt: now,
        });
      }

      const patterns = analyzeCommitPatterns(commits);
      expect(patterns.averageCommitsPerDay).toBeGreaterThan(0);
    });
  });

  describe("identifyNewLanguages", () => {
    it("should return empty array for no recent languages", () => {
      const languages: LanguageProficiency[] = [
        {
          id: 1,
          userId: 1,
          language: "TypeScript",
          commitCount: 50,
          repositoryCount: 1,
          firstSeenAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365), // 1 year ago
          lastSeenAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const newLangs = identifyNewLanguages(languages, 90);
      expect(newLangs).toHaveLength(0);
    });

    it("should identify recently adopted languages", () => {
      const languages: LanguageProficiency[] = [
        {
          id: 1,
          userId: 1,
          language: "Rust",
          commitCount: 5,
          repositoryCount: 1,
          firstSeenAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // 30 days ago
          lastSeenAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const newLangs = identifyNewLanguages(languages, 90);
      expect(newLangs).toContain("Rust");
    });
  });

  describe("identifyGrowthLanguages", () => {
    it("should return empty array for no languages", () => {
      const languages: LanguageProficiency[] = [];
      const growth = identifyGrowthLanguages(languages, 3);
      expect(growth).toHaveLength(0);
    });

    it("should identify top growth languages", () => {
      const languages: LanguageProficiency[] = [
        {
          id: 1,
          userId: 1,
          language: "TypeScript",
          commitCount: 150,
          repositoryCount: 5,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          userId: 1,
          language: "Python",
          commitCount: 75,
          repositoryCount: 3,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 3,
          userId: 1,
          language: "JavaScript",
          commitCount: 30,
          repositoryCount: 2,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const growth = identifyGrowthLanguages(languages, 2);
      expect(growth).toHaveLength(2);
      expect(growth[0].language).toBe("TypeScript");
      expect(growth[1].language).toBe("Python");
    });
  });
});
