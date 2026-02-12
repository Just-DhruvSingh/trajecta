// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/db.ts
import { eq, and, desc, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json, boolean } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // GitHub integration fields
  githubUsername: varchar("githubUsername", { length: 255 }),
  githubId: varchar("githubId", { length: 255 }).unique(),
  githubAccessToken: text("githubAccessToken"),
  // Encrypted in production
  githubConnected: boolean("githubConnected").default(false).notNull(),
  lastGitHubSync: timestamp("lastGitHubSync"),
  // Notification preferences
  emailNotificationsEnabled: boolean("emailNotificationsEnabled").default(true).notNull(),
  notificationFrequency: mysqlEnum("notificationFrequency", ["weekly", "monthly"]).default("weekly").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var repositories = mysqlTable("repositories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  githubRepoId: varchar("githubRepoId", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  description: text("description"),
  language: varchar("language", { length: 100 }),
  stars: int("stars").default(0).notNull(),
  forks: int("forks").default(0).notNull(),
  size: int("size").default(0).notNull(),
  // in KB
  isPrivate: boolean("isPrivate").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var commits = mysqlTable("commits", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var languageProficiency = mysqlTable("languageProficiency", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  language: varchar("language", { length: 100 }).notNull(),
  commitCount: int("commitCount").default(0).notNull(),
  repositoryCount: int("repositoryCount").default(0).notNull(),
  firstSeenAt: timestamp("firstSeenAt").notNull(),
  lastSeenAt: timestamp("lastSeenAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var dailyAnalytics = mysqlTable("dailyAnalytics", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  date: timestamp("date").notNull(),
  commitsCount: int("commitsCount").default(0).notNull(),
  repositoriesCount: int("repositoriesCount").default(0).notNull(),
  languagesCount: int("languagesCount").default(0).notNull(),
  totalAdditions: int("totalAdditions").default(0).notNull(),
  totalDeletions: int("totalDeletions").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var userMetrics = mysqlTable("userMetrics", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  consistencyScore: decimal("consistencyScore", { precision: 5, scale: 2 }).default("0").notNull(),
  // 0-100
  skillGrowthTrend: decimal("skillGrowthTrend", { precision: 5, scale: 2 }).default("0").notNull(),
  // percentage change
  learningVelocity: decimal("learningVelocity", { precision: 8, scale: 2 }).default("0").notNull(),
  // commits/day
  projectDepth: decimal("projectDepth", { precision: 5, scale: 2 }).default("0").notNull(),
  // 0-100
  depthBreadthRatio: decimal("depthBreadthRatio", { precision: 5, scale: 2 }).default("0").notNull(),
  // depth/breadth
  totalCommits: int("totalCommits").default(0).notNull(),
  totalRepositories: int("totalRepositories").default(0).notNull(),
  uniqueLanguages: int("uniqueLanguages").default(0).notNull(),
  lastCalculatedAt: timestamp("lastCalculatedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var aiInsights = mysqlTable("aiInsights", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  insights: json("insights").notNull(),
  // Array of insight objects
  recommendations: json("recommendations").notNull(),
  // Array of recommendation objects
  summary: text("summary"),
  generatedAt: timestamp("generatedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var emailNotifications = mysqlTable("emailNotifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["weekly_summary", "monthly_summary"]).notNull(),
  sentAt: timestamp("sentAt").notNull(),
  status: mysqlEnum("status", ["sent", "failed", "pending"]).default("pending").notNull(),
  content: json("content"),
  // Email content data
  createdAt: timestamp("createdAt").defaultNow().notNull()
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/db.ts
var _db = null;
async function getDb() {
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
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function updateUserGitHubData(userId, githubData) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({
    githubId: githubData.githubId,
    githubUsername: githubData.githubUsername,
    githubAccessToken: githubData.githubAccessToken,
    githubConnected: true,
    lastGitHubSync: /* @__PURE__ */ new Date()
  }).where(eq(users.id, userId));
}
async function getUserById(userId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function upsertRepositories(userId, repos) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  for (const repo of repos) {
    await db.insert(repositories).values({
      userId,
      ...repo
    }).onDuplicateKeyUpdate({
      set: {
        stars: repo.stars,
        forks: repo.forks,
        size: repo.size,
        updatedAt: /* @__PURE__ */ new Date()
      }
    });
  }
}
async function getUserRepositories(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(repositories).where(eq(repositories.userId, userId));
}
async function upsertCommits(userId, commitData) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  for (const commit of commitData) {
    await db.insert(commits).values({
      userId,
      ...commit
    }).onDuplicateKeyUpdate({
      set: {
        message: commit.message
      }
    });
  }
}
async function getUserCommits(userId, days = 365) {
  const db = await getDb();
  if (!db) return [];
  const cutoffDate = /* @__PURE__ */ new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  return db.select().from(commits).where(and(
    eq(commits.userId, userId),
    gte(commits.committedAt, cutoffDate)
  )).orderBy(desc(commits.committedAt));
}
async function upsertLanguageProficiency(userId, language, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(languageProficiency).where(and(
    eq(languageProficiency.userId, userId),
    eq(languageProficiency.language, language)
  )).limit(1);
  if (existing.length > 0) {
    await db.update(languageProficiency).set({
      commitCount: data.commitCount,
      repositoryCount: data.repositoryCount,
      lastSeenAt: data.lastSeenAt,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(and(
      eq(languageProficiency.userId, userId),
      eq(languageProficiency.language, language)
    ));
  } else {
    await db.insert(languageProficiency).values({
      userId,
      language,
      ...data
    });
  }
}
async function getUserLanguages(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(languageProficiency).where(eq(languageProficiency.userId, userId)).orderBy(desc(languageProficiency.commitCount));
}
async function upsertUserMetrics(userId, metrics) {
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
    uniqueLanguages: metrics.uniqueLanguages
  };
  await db.insert(userMetrics).values({
    userId,
    ...metricsData,
    lastCalculatedAt: /* @__PURE__ */ new Date()
  }).onDuplicateKeyUpdate({
    set: {
      ...metricsData,
      lastCalculatedAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    }
  });
}
async function getUserMetrics(userId) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(userMetrics).where(eq(userMetrics.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}
async function storeAIInsights(userId, insights) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(aiInsights).values({
    userId,
    insights: JSON.stringify(insights.insights),
    recommendations: JSON.stringify(insights.recommendations),
    summary: insights.summary,
    generatedAt: /* @__PURE__ */ new Date()
  });
}
async function getLatestAIInsights(userId) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(aiInsights).where(eq(aiInsights.userId, userId)).orderBy(desc(aiInsights.generatedAt)).limit(1);
  if (result.length > 0) {
    const insight = result[0];
    return {
      ...insight,
      insights: JSON.parse(insight.insights),
      recommendations: JSON.parse(insight.recommendations)
    };
  }
  return null;
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
import { z as z2 } from "zod";

// server/github.ts
var GitHubClient = class {
  token;
  baseUrl = "https://api.github.com";
  constructor(accessToken) {
    this.token = accessToken;
  }
  async fetch(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github.v3+json",
        ...options.headers
      }
    });
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
  async getUser() {
    return this.fetch("/user");
  }
  async getRepositories(page = 1, perPage = 100) {
    return this.fetch(`/user/repos?page=${page}&per_page=${perPage}&sort=updated&direction=desc`);
  }
  async getAllRepositories() {
    const repos = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const batch = await this.getRepositories(page, 100);
      if (batch.length === 0) {
        hasMore = false;
      } else {
        repos.push(...batch);
        page++;
      }
    }
    return repos;
  }
  async getRepositoryCommits(owner, repo, since) {
    let endpoint = `/repos/${owner}/${repo}/commits?per_page=100`;
    if (since) {
      endpoint += `&since=${since.toISOString()}`;
    }
    try {
      return await this.fetch(endpoint);
    } catch (error) {
      console.warn(`Failed to fetch commits for ${owner}/${repo}:`, error);
      return [];
    }
  }
  async getLanguages(owner, repo) {
    try {
      return await this.fetch(`/repos/${owner}/${repo}/languages`);
    } catch (error) {
      console.warn(`Failed to fetch languages for ${owner}/${repo}:`, error);
      return {};
    }
  }
  async getUserContributions(username, year) {
    const query = `
      query {
        user(login: "${username}") {
          contributionsCollection${year ? `(from: "${year}-01-01T00:00:00Z", to: "${year}-12-31T23:59:59Z")` : ""} {
            totalContributions
          }
        }
      }
    `;
    try {
      const response = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ query })
      });
      const data = await response.json();
      return data.data?.user?.contributionsCollection?.totalContributions || 0;
    } catch (error) {
      console.warn(`Failed to fetch contributions for ${username}:`, error);
      return 0;
    }
  }
  async getCommitStats(owner, repo) {
    try {
      const commits2 = await this.fetch(`/repos/${owner}/${repo}/commits?per_page=1`);
      const lastCommit = commits2[0];
      if (!lastCommit) {
        return { totalCommits: 0, totalAdditions: 0, totalDeletions: 0, filesChanged: 0 };
      }
      const linkHeader = lastCommit.commit?.url;
      return {
        totalCommits: 0,
        // Would need pagination to get exact count
        totalAdditions: 0,
        totalDeletions: 0,
        filesChanged: 0
      };
    } catch (error) {
      console.warn(`Failed to fetch commit stats for ${owner}/${repo}:`, error);
      return { totalCommits: 0, totalAdditions: 0, totalDeletions: 0, filesChanged: 0 };
    }
  }
};
async function fetchGitHubUserData(accessToken) {
  const client = new GitHubClient(accessToken);
  try {
    const user = await client.getUser();
    const repositories2 = await client.getAllRepositories();
    const languageMap = {};
    for (const repo of repositories2) {
      if (repo.language) {
        if (!languageMap[repo.language]) {
          languageMap[repo.language] = { count: 0, repos: /* @__PURE__ */ new Set() };
        }
        languageMap[repo.language].count++;
        languageMap[repo.language].repos.add(repo.name);
      }
    }
    return {
      user: {
        id: user.id.toString(),
        username: user.login,
        name: user.name,
        avatarUrl: user.avatar_url,
        publicRepos: user.public_repos,
        followers: user.followers,
        following: user.following,
        createdAt: new Date(user.created_at)
      },
      repositories: repositories2.map((repo) => ({
        githubRepoId: repo.id.toString(),
        name: repo.name,
        url: repo.html_url,
        description: repo.description || void 0,
        language: repo.language || void 0,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        size: repo.size,
        isPrivate: repo.private
      })),
      languages: Object.entries(languageMap).map(([lang, data]) => ({
        language: lang,
        repositoryCount: data.count,
        repositories: Array.from(data.repos)
      }))
    };
  } catch (error) {
    console.error("Failed to fetch GitHub user data:", error);
    throw error;
  }
}

// server/analytics.ts
function calculateConsistencyScore(commits2) {
  if (commits2.length === 0) return 0;
  const commitsByDay = {};
  commits2.forEach((commit) => {
    const day = commit.committedAt.toISOString().split("T")[0];
    commitsByDay[day] = (commitsByDay[day] || 0) + 1;
  });
  const dailyCounts = Object.values(commitsByDay);
  if (dailyCounts.length === 0) return 0;
  const mean = dailyCounts.reduce((a, b) => a + b, 0) / dailyCounts.length;
  const variance = dailyCounts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / dailyCounts.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean === 0 ? 0 : stdDev / mean;
  const score = Math.max(0, Math.min(100, 100 - cv * 50));
  return Math.round(score);
}
function calculateLearningVelocity(commits2) {
  if (commits2.length === 0) return 0;
  const dates = commits2.map((c) => c.committedAt.getTime());
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  const daysDiff = (maxDate.getTime() - minDate.getTime()) / (1e3 * 60 * 60 * 24);
  if (daysDiff === 0) return commits2.length;
  return parseFloat((commits2.length / daysDiff).toFixed(2));
}
function calculateProjectDepth(repositories2, commits2) {
  if (repositories2.length === 0) return 0;
  const avgSize = repositories2.reduce((sum, repo) => sum + repo.size, 0) / repositories2.length;
  const sizeScore = Math.min(100, avgSize / 1e3 * 100);
  const commitDensity = commits2.length / repositories2.length;
  const densityScore = Math.min(100, commitDensity * 5);
  const depthScore = sizeScore * 0.4 + densityScore * 0.6;
  return Math.round(depthScore);
}
function calculateDepthBreadthRatio(repositories2, commits2, languages) {
  if (repositories2.length === 0 || languages.length === 0) return 0;
  const depth = commits2.length / repositories2.length;
  const breadth = languages.length;
  return parseFloat((depth / breadth).toFixed(2));
}
function calculateSkillGrowthTrend(currentLanguages, commits2, timeWindowDays = 90) {
  if (currentLanguages.length === 0) return 0;
  const cutoffDate = /* @__PURE__ */ new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeWindowDays);
  const recentCommits = commits2.filter((c) => c.committedAt >= cutoffDate);
  if (recentCommits.length === 0) return 0;
  const growthPercentage = recentCommits.length / commits2.length * 100;
  return Math.min(100, Math.round(growthPercentage));
}
function analyzeCommitPatterns(commits2) {
  if (commits2.length === 0) {
    return {
      averageCommitsPerDay: 0,
      peakDay: "Monday",
      burstyPattern: false,
      consistentPattern: false
    };
  }
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const commitsByDayOfWeek = {};
  commits2.forEach((commit) => {
    const dayOfWeek = commit.committedAt.getDay();
    commitsByDayOfWeek[dayOfWeek] = (commitsByDayOfWeek[dayOfWeek] || 0) + 1;
  });
  let peakDay = 0;
  let maxCommits = 0;
  Object.entries(commitsByDayOfWeek).forEach(([day, count]) => {
    if (count > maxCommits) {
      maxCommits = count;
      peakDay = parseInt(day);
    }
  });
  const values = Object.values(commitsByDayOfWeek);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const burstyPattern = stdDev > mean * 0.5;
  const consistentPattern = stdDev < mean * 0.3;
  return {
    averageCommitsPerDay: parseFloat((commits2.length / 7).toFixed(2)),
    peakDay: dayNames[peakDay],
    burstyPattern,
    consistentPattern
  };
}
function identifyNewLanguages(languages, timeWindowDays = 90) {
  const cutoffDate = /* @__PURE__ */ new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeWindowDays);
  return languages.filter((lang) => lang.firstSeenAt >= cutoffDate).map((lang) => lang.language);
}
function identifyGrowthLanguages(languages, topN = 3) {
  return languages.sort((a, b) => b.commitCount - a.commitCount).slice(0, topN).map((lang) => ({
    language: lang.language,
    commitCount: lang.commitCount,
    growth: lang.commitCount > 100 ? "High" : lang.commitCount > 50 ? "Medium" : "Low"
  }));
}
function calculateMetrics(repositories2, commits2, languages) {
  return {
    consistencyScore: calculateConsistencyScore(commits2),
    skillGrowthTrend: calculateSkillGrowthTrend(languages, commits2),
    learningVelocity: calculateLearningVelocity(commits2),
    projectDepth: calculateProjectDepth(repositories2, commits2),
    depthBreadthRatio: calculateDepthBreadthRatio(repositories2, commits2, languages),
    totalCommits: commits2.length,
    totalRepositories: repositories2.length,
    uniqueLanguages: languages.length
  };
}

// server/_core/llm.ts
var ensureArray = (value) => Array.isArray(value) ? value : [value];
var normalizeContentPart = (part) => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return part;
  }
  if (part.type === "image_url") {
    return part;
  }
  if (part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};
var normalizeMessage = (message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
    return {
      role,
      name,
      tool_call_id,
      content
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text
    };
  }
  return {
    role,
    name,
    content: contentParts
  };
};
var normalizeToolChoice = (toolChoice, tools) => {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }
    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }
    return {
      type: "function",
      function: { name: tools[0].function.name }
    };
  }
  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name }
    };
  }
  return toolChoice;
};
var resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
var assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};
var normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema
}) => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return void 0;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
    }
  };
};
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format
  } = params;
  const payload = {
    model: "gemini-2.5-flash",
    messages: messages.map(normalizeMessage)
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  payload.max_tokens = 32768;
  payload.thinking = {
    "budget_tokens": 128
  };
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}

// server/routers.ts
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  github: router({
    /**
     * Connect GitHub account
     */
    connect: protectedProcedure.input(z2.object({ accessToken: z2.string() })).mutation(async ({ ctx, input }) => {
      try {
        const client = new GitHubClient(input.accessToken);
        const user = await client.getUser();
        await updateUserGitHubData(ctx.user.id, {
          githubId: user.id.toString(),
          githubUsername: user.login,
          githubAccessToken: input.accessToken
        });
        return {
          success: true,
          username: user.login
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
        const user = await getUserById(ctx.user.id);
        if (!user || !user.githubAccessToken) {
          throw new Error("GitHub not connected");
        }
        const githubData = await fetchGitHubUserData(user.githubAccessToken);
        await upsertRepositories(ctx.user.id, githubData.repositories);
        for (const lang of githubData.languages) {
          await upsertLanguageProficiency(ctx.user.id, lang.language, {
            commitCount: lang.repositoryCount,
            repositoryCount: lang.repositoryCount,
            firstSeenAt: /* @__PURE__ */ new Date(),
            lastSeenAt: /* @__PURE__ */ new Date()
          });
        }
        const client = new GitHubClient(user.githubAccessToken);
        for (const repo of githubData.repositories) {
          const [owner, repoName] = repo.name.split("/");
          const commits2 = await client.getRepositoryCommits(owner || user.githubUsername || "", repoName);
          if (commits2.length > 0) {
            const dbRepo = await getUserRepositories(ctx.user.id);
            const matchingRepo = dbRepo.find((r) => r.githubRepoId === repo.githubRepoId);
            if (matchingRepo) {
              await upsertCommits(
                ctx.user.id,
                commits2.map((c) => ({
                  repositoryId: matchingRepo.id,
                  commitHash: c.sha,
                  message: c.commit.message,
                  authorName: c.commit.author.name,
                  authorEmail: c.commit.author.email,
                  committedAt: new Date(c.commit.author.date),
                  additions: c.stats?.additions || 0,
                  deletions: c.stats?.deletions || 0,
                  filesChanged: 0
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
      const user = await getUserById(ctx.user.id);
      return {
        connected: user?.githubConnected || false,
        username: user?.githubUsername || null,
        lastSync: user?.lastGitHubSync || null
      };
    })
  }),
  analytics: router({
    /**
     * Get user metrics
     */
    metrics: protectedProcedure.query(async ({ ctx }) => {
      const metrics = await getUserMetrics(ctx.user.id);
      if (!metrics) {
        return null;
      }
      return {
        consistencyScore: parseFloat(metrics.consistencyScore),
        skillGrowthTrend: parseFloat(metrics.skillGrowthTrend),
        learningVelocity: parseFloat(metrics.learningVelocity),
        projectDepth: parseFloat(metrics.projectDepth),
        depthBreadthRatio: parseFloat(metrics.depthBreadthRatio),
        totalCommits: metrics.totalCommits,
        totalRepositories: metrics.totalRepositories,
        uniqueLanguages: metrics.uniqueLanguages,
        lastCalculatedAt: metrics.lastCalculatedAt
      };
    }),
    /**
     * Calculate and update metrics
     */
    calculate: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        const repositories2 = await getUserRepositories(ctx.user.id);
        const commits2 = await getUserCommits(ctx.user.id);
        const languages = await getUserLanguages(ctx.user.id);
        const metrics = calculateMetrics(repositories2, commits2, languages);
        await upsertUserMetrics(ctx.user.id, metrics);
        return {
          success: true,
          metrics
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
      const languages = await getUserLanguages(ctx.user.id);
      return languages.map((lang) => ({
        language: lang.language,
        commitCount: lang.commitCount,
        repositoryCount: lang.repositoryCount,
        firstSeen: lang.firstSeenAt,
        lastSeen: lang.lastSeenAt
      }));
    }),
    /**
     * Get commit patterns
     */
    commitPatterns: protectedProcedure.query(async ({ ctx }) => {
      const commits2 = await getUserCommits(ctx.user.id);
      return analyzeCommitPatterns(commits2);
    }),
    /**
     * Get new languages learned
     */
    newLanguages: protectedProcedure.query(async ({ ctx }) => {
      const languages = await getUserLanguages(ctx.user.id);
      return identifyNewLanguages(languages, 90);
    }),
    /**
     * Get top growth languages
     */
    topLanguages: protectedProcedure.query(async ({ ctx }) => {
      const languages = await getUserLanguages(ctx.user.id);
      return identifyGrowthLanguages(languages, 5);
    })
  }),
  insights: router({
    /**
     * Generate AI insights
     */
    generate: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        const user = await getUserById(ctx.user.id);
        const metrics = await getUserMetrics(ctx.user.id);
        const languages = await getUserLanguages(ctx.user.id);
        const commits2 = await getUserCommits(ctx.user.id);
        const patterns = analyzeCommitPatterns(commits2);
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

Languages Used: ${languages.map((l) => l.language).join(", ")}

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
              content: "You are an expert developer growth analyst. Provide insights in valid JSON format."
            },
            {
              role: "user",
              content: [{ type: "text", text: prompt }]
            }
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
                        description: { type: "string" }
                      },
                      required: ["title", "description"]
                    }
                  },
                  recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        area: { type: "string" },
                        suggestion: { type: "string" },
                        priority: { type: "string", enum: ["high", "medium", "low"] }
                      },
                      required: ["area", "suggestion", "priority"]
                    }
                  },
                  summary: { type: "string" }
                },
                required: ["insights", "recommendations", "summary"],
                additionalProperties: false
              }
            }
          }
        });
        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("No response from LLM");
        }
        const contentStr = typeof content === "string" ? content : JSON.stringify(content);
        const insightsData = JSON.parse(contentStr);
        await storeAIInsights(ctx.user.id, insightsData);
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
      return getLatestAIInsights(ctx.user.id);
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs2 from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var PROJECT_ROOT = import.meta.dirname;
var LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}
function trimLogFile(logPath, maxSize) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }
    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines = [];
    let keptBytes = 0;
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}
`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
  }
}
function writeToLogFile(source, entries) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });
  fs.appendFileSync(logPath, `${lines.join("\n")}
`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector() {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true
            },
            injectTo: "head"
          }
        ]
      };
    },
    configureServer(server) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }
        const handlePayload = (payload) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        const reqBody = req.body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    }
  };
}
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector()];
var vite_config_default = defineConfig({
  base: "./",
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
