import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extended with GitHub integration fields.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  
  // GitHub integration fields
  githubUsername: varchar("githubUsername", { length: 255 }),
  githubId: varchar("githubId", { length: 255 }).unique(),
  githubAccessToken: text("githubAccessToken"), // Encrypted in production
  githubConnected: boolean("githubConnected").default(false).notNull(),
  lastGitHubSync: timestamp("lastGitHubSync"),
  
  // Notification preferences
  emailNotificationsEnabled: boolean("emailNotificationsEnabled").default(true).notNull(),
  notificationFrequency: mysqlEnum("notificationFrequency", ["weekly", "monthly"]).default("weekly").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * GitHub repositories data for each user
 */
export const repositories = mysqlTable("repositories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  githubRepoId: varchar("githubRepoId", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  description: text("description"),
  language: varchar("language", { length: 100 }),
  stars: int("stars").default(0).notNull(),
  forks: int("forks").default(0).notNull(),
  size: int("size").default(0).notNull(), // in KB
  isPrivate: boolean("isPrivate").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Repository = typeof repositories.$inferSelect;
export type InsertRepository = typeof repositories.$inferInsert;

/**
 * Commit history for analytics
 */
export const commits = mysqlTable("commits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  repositoryId: int("repositoryId").notNull(),
  commitHash: varchar("commitHash", { length: 255 }).notNull(),
  message: text("message"),
  authorName: varchar("authorName", { length: 255 }),
  authorEmail: varchar("authorEmail", { length: 320 }),
  committedAt: timestamp("committedAt").notNull(),
  additions: int("additions").default(0).notNull(),
  deletions: int("deletions").default(0).notNull(),
  filesChanged: int("filesChanged").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Commit = typeof commits.$inferSelect;
export type InsertCommit = typeof commits.$inferInsert;

/**
 * Language proficiency tracking
 */
export const languageProficiency = mysqlTable("languageProficiency", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  language: varchar("language", { length: 100 }).notNull(),
  commitCount: int("commitCount").default(0).notNull(),
  repositoryCount: int("repositoryCount").default(0).notNull(),
  firstSeenAt: timestamp("firstSeenAt").notNull(),
  lastSeenAt: timestamp("lastSeenAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LanguageProficiency = typeof languageProficiency.$inferSelect;
export type InsertLanguageProficiency = typeof languageProficiency.$inferInsert;

/**
 * Daily analytics snapshot for trend analysis
 */
export const dailyAnalytics = mysqlTable("dailyAnalytics", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  date: timestamp("date").notNull(),
  commitsCount: int("commitsCount").default(0).notNull(),
  repositoriesCount: int("repositoriesCount").default(0).notNull(),
  languagesCount: int("languagesCount").default(0).notNull(),
  totalAdditions: int("totalAdditions").default(0).notNull(),
  totalDeletions: int("totalDeletions").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DailyAnalytics = typeof dailyAnalytics.$inferSelect;
export type InsertDailyAnalytics = typeof dailyAnalytics.$inferInsert;

/**
 * Calculated metrics for dashboard display
 */
export const userMetrics = mysqlTable("userMetrics", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  consistencyScore: decimal("consistencyScore", { precision: 5, scale: 2 }).default("0").notNull(), // 0-100
  skillGrowthTrend: decimal("skillGrowthTrend", { precision: 5, scale: 2 }).default("0").notNull(), // percentage change
  learningVelocity: decimal("learningVelocity", { precision: 8, scale: 2 }).default("0").notNull(), // commits/day
  projectDepth: decimal("projectDepth", { precision: 5, scale: 2 }).default("0").notNull(), // 0-100
  depthBreadthRatio: decimal("depthBreadthRatio", { precision: 5, scale: 2 }).default("0").notNull(), // depth/breadth
  totalCommits: int("totalCommits").default(0).notNull(),
  totalRepositories: int("totalRepositories").default(0).notNull(),
  uniqueLanguages: int("uniqueLanguages").default(0).notNull(),
  lastCalculatedAt: timestamp("lastCalculatedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserMetrics = typeof userMetrics.$inferSelect;
export type InsertUserMetrics = typeof userMetrics.$inferInsert;

/**
 * AI-generated insights and recommendations
 */
export const aiInsights = mysqlTable("aiInsights", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  insights: json("insights").notNull(), // Array of insight objects
  recommendations: json("recommendations").notNull(), // Array of recommendation objects
  summary: text("summary"),
  generatedAt: timestamp("generatedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AIInsight = typeof aiInsights.$inferSelect;
export type InsertAIInsight = typeof aiInsights.$inferInsert;

/**
 * Email notification history
 */
export const emailNotifications = mysqlTable("emailNotifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["weekly_summary", "monthly_summary"]).notNull(),
  sentAt: timestamp("sentAt").notNull(),
  status: mysqlEnum("status", ["sent", "failed", "pending"]).default("pending").notNull(),
  content: json("content"), // Email content data
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailNotification = typeof emailNotifications.$inferSelect;
export type InsertEmailNotification = typeof emailNotifications.$inferInsert;
