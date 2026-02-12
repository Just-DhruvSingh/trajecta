import { eq, and, desc, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, repositories, commits, languageProficiency, dailyAnalytics, userMetrics, aiInsights, emailNotifications } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// GitHub integration functions
export async function updateUserGitHubData(userId: number, githubData: {
  githubId: string;
  githubUsername: string;
  githubAccessToken: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users)
    .set({
      githubId: githubData.githubId,
      githubUsername: githubData.githubUsername,
      githubAccessToken: githubData.githubAccessToken,
      githubConnected: true,
      lastGitHubSync: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Repository operations
export async function upsertRepositories(userId: number, repos: Array<{
  githubRepoId: string;
  name: string;
  url: string;
  description?: string;
  language?: string;
  stars: number;
  forks: number;
  size: number;
  isPrivate: boolean;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  for (const repo of repos) {
    await db.insert(repositories)
      .values({
        userId,
        ...repo,
      })
      .onDuplicateKeyUpdate({
        set: {
          stars: repo.stars,
          forks: repo.forks,
          size: repo.size,
          updatedAt: new Date(),
        },
      });
  }
}

export async function getUserRepositories(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(repositories).where(eq(repositories.userId, userId));
}

// Commit operations
export async function upsertCommits(userId: number, commitData: Array<{
  repositoryId: number;
  commitHash: string;
  message?: string;
  authorName?: string;
  authorEmail?: string;
  committedAt: Date;
  additions: number;
  deletions: number;
  filesChanged: number;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  for (const commit of commitData) {
    await db.insert(commits)
      .values({
        userId,
        ...commit,
      })
      .onDuplicateKeyUpdate({
        set: {
          message: commit.message,
        },
      });
  }
}

export async function getUserCommits(userId: number, days: number = 365) {
  const db = await getDb();
  if (!db) return [];

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  return db.select()
    .from(commits)
    .where(and(
      eq(commits.userId, userId),
      gte(commits.committedAt, cutoffDate)
    ))
    .orderBy(desc(commits.committedAt));
}

// Language proficiency operations
export async function upsertLanguageProficiency(userId: number, language: string, data: {
  commitCount: number;
  repositoryCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select()
    .from(languageProficiency)
    .where(and(
      eq(languageProficiency.userId, userId),
      eq(languageProficiency.language, language)
    ))
    .limit(1);

  if (existing.length > 0) {
    await db.update(languageProficiency)
      .set({
        commitCount: data.commitCount,
        repositoryCount: data.repositoryCount,
        lastSeenAt: data.lastSeenAt,
        updatedAt: new Date(),
      })
      .where(and(
        eq(languageProficiency.userId, userId),
        eq(languageProficiency.language, language)
      ));
  } else {
    await db.insert(languageProficiency)
      .values({
        userId,
        language,
        ...data,
      });
  }
}

export async function getUserLanguages(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(languageProficiency)
    .where(eq(languageProficiency.userId, userId))
    .orderBy(desc(languageProficiency.commitCount));
}

// Daily analytics operations
export async function recordDailyAnalytics(userId: number, date: Date, data: {
  commitsCount: number;
  repositoriesCount: number;
  languagesCount: number;
  totalAdditions: number;
  totalDeletions: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(dailyAnalytics)
    .values({
      userId,
      date,
      ...data,
    });
}

// User metrics operations
export async function upsertUserMetrics(userId: number, metrics: {
  consistencyScore: number;
  skillGrowthTrend: number;
  learningVelocity: number;
  projectDepth: number;
  depthBreadthRatio: number;
  totalCommits: number;
  totalRepositories: number;
  uniqueLanguages: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const metricsData = {
    consistencyScore: metrics.consistencyScore.toString(),
    skillGrowthTrend: metrics.skillGrowthTrend.toString(),
    learningVelocity: metrics.learningVelocity.toString(),
    projectDepth: metrics.projectDepth.toString(),
    depthBreadthRatio: metrics.depthBreadthRatio.toString(),
    totalCommits: metrics.totalCommits,
    totalRepositories: metrics.totalRepositories,
    uniqueLanguages: metrics.uniqueLanguages,
  };

  await db.insert(userMetrics)
    .values({
      userId,
      ...metricsData,
      lastCalculatedAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        ...metricsData,
        lastCalculatedAt: new Date(),
        updatedAt: new Date(),
      },
    });
}

export async function getUserMetrics(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(userMetrics)
    .where(eq(userMetrics.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

// AI insights operations
export async function storeAIInsights(userId: number, insights: {
  insights: Array<{ title: string; description: string }>;
  recommendations: Array<{ area: string; suggestion: string; priority: string }>;
  summary: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(aiInsights)
    .values({
      userId,
      insights: JSON.stringify(insights.insights),
      recommendations: JSON.stringify(insights.recommendations),
      summary: insights.summary,
      generatedAt: new Date(),
    });
}

export async function getLatestAIInsights(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(aiInsights)
    .where(eq(aiInsights.userId, userId))
    .orderBy(desc(aiInsights.generatedAt))
    .limit(1);

  if (result.length > 0) {
    const insight = result[0];
    return {
      ...insight,
      insights: JSON.parse(insight.insights as string),
      recommendations: JSON.parse(insight.recommendations as string),
    };
  }

  return null;
}

// Email notification operations
export async function recordEmailNotification(userId: number, type: 'weekly_summary' | 'monthly_summary', content: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(emailNotifications)
    .values({
      userId,
      type,
      sentAt: new Date(),
      status: 'sent',
      content: JSON.stringify(content),
    });
}
