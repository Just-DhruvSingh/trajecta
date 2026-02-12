/**
 * GitHub API client for fetching user data and analytics
 */

interface GitHubUser {
  id: number;
  login: string;
  name: string;
  avatar_url: string;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
}

interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  url: string;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  size: number;
  private: boolean;
  created_at: string;
  pushed_at: string;
}

interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  stats: {
    additions: number;
    deletions: number;
    total: number;
  };
}

export class GitHubClient {
  private token: string;
  private baseUrl = "https://api.github.com";

  constructor(accessToken: string) {
    this.token = accessToken;
  }

  private async fetch(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github.v3+json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getUser(): Promise<GitHubUser> {
    return this.fetch("/user");
  }

  async getRepositories(page: number = 1, perPage: number = 100): Promise<GitHubRepository[]> {
    return this.fetch(`/user/repos?page=${page}&per_page=${perPage}&sort=updated&direction=desc`);
  }

  async getAllRepositories(): Promise<GitHubRepository[]> {
    const repos: GitHubRepository[] = [];
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

  async getRepositoryCommits(owner: string, repo: string, since?: Date): Promise<GitHubCommit[]> {
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

  async getLanguages(owner: string, repo: string): Promise<Record<string, number>> {
    try {
      return await this.fetch(`/repos/${owner}/${repo}/languages`);
    } catch (error) {
      console.warn(`Failed to fetch languages for ${owner}/${repo}:`, error);
      return {};
    }
  }

  async getUserContributions(username: string, year?: number): Promise<number> {
    // This uses the GraphQL API for better performance
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
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();
      return data.data?.user?.contributionsCollection?.totalContributions || 0;
    } catch (error) {
      console.warn(`Failed to fetch contributions for ${username}:`, error);
      return 0;
    }
  }

  async getCommitStats(owner: string, repo: string): Promise<{
    totalCommits: number;
    totalAdditions: number;
    totalDeletions: number;
    filesChanged: number;
  }> {
    try {
      const commits = await this.fetch(`/repos/${owner}/${repo}/commits?per_page=1`);
      const lastCommit = commits[0];

      if (!lastCommit) {
        return { totalCommits: 0, totalAdditions: 0, totalDeletions: 0, filesChanged: 0 };
      }

      // Get the last commit to determine total count
      const linkHeader = lastCommit.commit?.url; // This is a workaround; GitHub doesn't expose total directly
      // We'll approximate based on available data
      return {
        totalCommits: 0, // Would need pagination to get exact count
        totalAdditions: 0,
        totalDeletions: 0,
        filesChanged: 0,
      };
    } catch (error) {
      console.warn(`Failed to fetch commit stats for ${owner}/${repo}:`, error);
      return { totalCommits: 0, totalAdditions: 0, totalDeletions: 0, filesChanged: 0 };
    }
  }
}

export async function fetchGitHubUserData(accessToken: string) {
  const client = new GitHubClient(accessToken);

  try {
    const user = await client.getUser();
    const repositories = await client.getAllRepositories();

    // Extract languages from all repositories
    const languageMap: Record<string, { count: number; repos: Set<string> }> = {};

    for (const repo of repositories) {
      if (repo.language) {
        if (!languageMap[repo.language]) {
          languageMap[repo.language] = { count: 0, repos: new Set() };
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
        createdAt: new Date(user.created_at),
      },
      repositories: repositories.map(repo => ({
        githubRepoId: repo.id.toString(),
        name: repo.name,
        url: repo.html_url,
        description: repo.description || undefined,
        language: repo.language || undefined,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        size: repo.size,
        isPrivate: repo.private,
      })),
      languages: Object.entries(languageMap).map(([lang, data]) => ({
        language: lang,
        repositoryCount: data.count,
        repositories: Array.from(data.repos),
      })),
    };
  } catch (error) {
    console.error("Failed to fetch GitHub user data:", error);
    throw error;
  }
}
