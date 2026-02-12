import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { fetchGitHubUserData, GitHubClient } from "./github";
import * as db from "./db";
import * as analytics from "./analytics";
import { invokeLLM } from "./_core/llm";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  github: router({
    /**
     * Connect GitHub account
     */
    connect: protectedProcedure
      .input(z.object({ accessToken: z.string() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const client = new GitHubClient(input.accessToken);
          const user = await client.getUser();

          // Update user with GitHub data
          await db.updateUserGitHubData(ctx.user.id, {
            githubId: user.id.toString(),
            githubUsername: user.login,
            githubAccessToken: input.accessToken,
          });

          return {
            success: true,
            username: user.login,
          };
        } catch (error) {
          console.error("Failed to connect GitHub:", error);
          throw new Error("Failed to connect GitHub account");
        }
      }),

    /**
     * Sync GitHub data
     */
    sync: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        const user = await db.getUserById(ctx.user.id);
        if (!user || !user.githubAccessToken) {
          throw new Error("GitHub not connected");
        }

        // Fetch GitHub data
        const githubData = await fetchGitHubUserData(user.githubAccessToken);

        // Store repositories
        await db.upsertRepositories(ctx.user.id, githubData.repositories);

        // Store language proficiency
        for (const lang of githubData.languages) {
          await db.upsertLanguageProficiency(ctx.user.id, lang.language, {
            commitCount: lang.repositoryCount,
            repositoryCount: lang.repositoryCount,
            firstSeenAt: new Date(),
            lastSeenAt: new Date(),
          });
        }

        // Fetch and store commits for each repository
        const client = new GitHubClient(user.githubAccessToken);
        for (const repo of githubData.repositories) {
          const [owner, repoName] = repo.name.split("/");
          const commits = await client.getRepositoryCommits(owner || user.githubUsername || "", repoName);

          if (commits.length > 0) {
            const dbRepo = await db.getUserRepositories(ctx.user.id);
            const matchingRepo = dbRepo.find(r => r.githubRepoId === repo.githubRepoId);

            if (matchingRepo) {
              await db.upsertCommits(
                ctx.user.id,
                commits.map(c => ({
                  repositoryId: matchingRepo.id,
                  commitHash: c.sha,
                  message: c.commit.message,
                  authorName: c.commit.author.name,
                  authorEmail: c.commit.author.email,
                  committedAt: new Date(c.commit.author.date),
                  additions: c.stats?.additions || 0,
                  deletions: c.stats?.deletions || 0,
                  filesChanged: 0,
                }))
              );
            }
          }
        }

        return { success: true };
      } catch (error) {
        console.error("Failed to sync GitHub data:", error);
        throw new Error("Failed to sync GitHub data");
      }
    }),

    /**
     * Get GitHub connection status
     */
    status: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      return {
        connected: user?.githubConnected || false,
        username: user?.githubUsername || null,
        lastSync: user?.lastGitHubSync || null,
      };
    }),
  }),

  analytics: router({
    /**
     * Get user metrics
     */
    metrics: protectedProcedure.query(async ({ ctx }) => {
      const metrics = await db.getUserMetrics(ctx.user.id);
      if (!metrics) {
        return null;
      }

      return {
        consistencyScore: parseFloat(metrics.consistencyScore as any),
        skillGrowthTrend: parseFloat(metrics.skillGrowthTrend as any),
        learningVelocity: parseFloat(metrics.learningVelocity as any),
        projectDepth: parseFloat(metrics.projectDepth as any),
        depthBreadthRatio: parseFloat(metrics.depthBreadthRatio as any),
        totalCommits: metrics.totalCommits,
        totalRepositories: metrics.totalRepositories,
        uniqueLanguages: metrics.uniqueLanguages,
        lastCalculatedAt: metrics.lastCalculatedAt,
      };
    }),

    /**
     * Calculate and update metrics
     */
    calculate: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        const repositories = await db.getUserRepositories(ctx.user.id);
        const commits = await db.getUserCommits(ctx.user.id);
        const languages = await db.getUserLanguages(ctx.user.id);

        const metrics = analytics.calculateMetrics(repositories, commits, languages);

        await db.upsertUserMetrics(ctx.user.id, metrics);

        return {
          success: true,
          metrics,
        };
      } catch (error) {
        console.error("Failed to calculate metrics:", error);
        throw new Error("Failed to calculate metrics");
      }
    }),

    /**
     * Get skill growth timeline
     */
    skillTimeline: protectedProcedure.query(async ({ ctx }) => {
      const languages = await db.getUserLanguages(ctx.user.id);
      return languages.map(lang => ({
        language: lang.language,
        commitCount: lang.commitCount,
        repositoryCount: lang.repositoryCount,
        firstSeen: lang.firstSeenAt,
        lastSeen: lang.lastSeenAt,
      }));
    }),

    /**
     * Get commit patterns
     */
    commitPatterns: protectedProcedure.query(async ({ ctx }) => {
      const commits = await db.getUserCommits(ctx.user.id);
      return analytics.analyzeCommitPatterns(commits);
    }),

    /**
     * Get new languages learned
     */
    newLanguages: protectedProcedure.query(async ({ ctx }) => {
      const languages = await db.getUserLanguages(ctx.user.id);
      return analytics.identifyNewLanguages(languages, 90);
    }),

    /**
     * Get top growth languages
     */
    topLanguages: protectedProcedure.query(async ({ ctx }) => {
      const languages = await db.getUserLanguages(ctx.user.id);
      return analytics.identifyGrowthLanguages(languages, 5);
    }),
  }),

  insights: router({
    /**
     * Generate AI insights
     */
    generate: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        const user = await db.getUserById(ctx.user.id);
        const metrics = await db.getUserMetrics(ctx.user.id);
        const languages = await db.getUserLanguages(ctx.user.id);
        const commits = await db.getUserCommits(ctx.user.id);
        const patterns = analytics.analyzeCommitPatterns(commits);

        if (!metrics) {
          throw new Error("No metrics available");
        }

        const prompt = `
You are an expert developer growth analyst. Analyze the following developer metrics and provide 3-5 personalized growth insights and recommendations.

Developer Profile:
- Username: ${user?.githubUsername}
- Total Commits: ${metrics.totalCommits}
- Total Repositories: ${metrics.totalRepositories}
- Unique Languages: ${metrics.uniqueLanguages}
- Consistency Score: ${metrics.consistencyScore}/100
- Learning Velocity: ${metrics.learningVelocity} commits/day
- Project Depth Score: ${metrics.projectDepth}/100
- Depth vs Breadth Ratio: ${metrics.depthBreadthRatio}

Languages Used: ${languages.map(l => l.language).join(", ")}

Commit Patterns:
- Average Commits Per Day: ${patterns.averageCommitsPerDay}
- Peak Activity Day: ${patterns.peakDay}
- Productivity Pattern: ${patterns.burstyPattern ? "Burst-based" : patterns.consistentPattern ? "Consistent" : "Mixed"}

Based on this data, provide:
1. 3-5 specific, actionable insights about their development patterns
2. 3-5 recommendations for improvement
3. A brief summary of their overall growth trajectory

Format your response as JSON with this structure:
{
  "insights": [
    { "title": "string", "description": "string" }
  ],
  "recommendations": [
    { "area": "string", "suggestion": "string", "priority": "high|medium|low" }
  ],
  "summary": "string"
}
`;

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You are an expert developer growth analyst. Provide insights in valid JSON format.",
            },
            {
              role: "user",
              content: [{ type: "text", text: prompt }],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "developer_insights",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  insights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                      },
                      required: ["title", "description"],
                    },
                  },
                  recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        area: { type: "string" },
                        suggestion: { type: "string" },
                        priority: { type: "string", enum: ["high", "medium", "low"] },
                      },
                      required: ["area", "suggestion", "priority"],
                    },
                  },
                  summary: { type: "string" },
                },
                required: ["insights", "recommendations", "summary"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("No response from LLM");
        }

        const contentStr = typeof content === "string" ? content : JSON.stringify(content);
        const insightsData = JSON.parse(contentStr);

        // Store insights in database
        await db.storeAIInsights(ctx.user.id, insightsData);

        return insightsData;
      } catch (error) {
        console.error("Failed to generate insights:", error);
        throw new Error("Failed to generate insights");
      }
    }),

    /**
     * Get latest insights
     */
    latest: protectedProcedure.query(async ({ ctx }) => {
      return db.getLatestAIInsights(ctx.user.id);
    }),
  }),
});

export type AppRouter = typeof appRouter;
