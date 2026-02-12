CREATE TABLE `aiInsights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`insights` json NOT NULL,
	`recommendations` json NOT NULL,
	`summary` text,
	`generatedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aiInsights_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `commits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`repositoryId` int NOT NULL,
	`commitHash` varchar(255) NOT NULL,
	`message` text,
	`authorName` varchar(255),
	`authorEmail` varchar(320),
	`committedAt` timestamp NOT NULL,
	`additions` int NOT NULL DEFAULT 0,
	`deletions` int NOT NULL DEFAULT 0,
	`filesChanged` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `commits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dailyAnalytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`date` timestamp NOT NULL,
	`commitsCount` int NOT NULL DEFAULT 0,
	`repositoriesCount` int NOT NULL DEFAULT 0,
	`languagesCount` int NOT NULL DEFAULT 0,
	`totalAdditions` int NOT NULL DEFAULT 0,
	`totalDeletions` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dailyAnalytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emailNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('weekly_summary','monthly_summary') NOT NULL,
	`sentAt` timestamp NOT NULL,
	`status` enum('sent','failed','pending') NOT NULL DEFAULT 'pending',
	`content` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `emailNotifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `languageProficiency` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`language` varchar(100) NOT NULL,
	`commitCount` int NOT NULL DEFAULT 0,
	`repositoryCount` int NOT NULL DEFAULT 0,
	`firstSeenAt` timestamp NOT NULL,
	`lastSeenAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `languageProficiency_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `repositories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`githubRepoId` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`url` varchar(500) NOT NULL,
	`description` text,
	`language` varchar(100),
	`stars` int NOT NULL DEFAULT 0,
	`forks` int NOT NULL DEFAULT 0,
	`size` int NOT NULL DEFAULT 0,
	`isPrivate` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `repositories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userMetrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`consistencyScore` decimal(5,2) NOT NULL DEFAULT '0',
	`skillGrowthTrend` decimal(5,2) NOT NULL DEFAULT '0',
	`learningVelocity` decimal(8,2) NOT NULL DEFAULT '0',
	`projectDepth` decimal(5,2) NOT NULL DEFAULT '0',
	`depthBreadthRatio` decimal(5,2) NOT NULL DEFAULT '0',
	`totalCommits` int NOT NULL DEFAULT 0,
	`totalRepositories` int NOT NULL DEFAULT 0,
	`uniqueLanguages` int NOT NULL DEFAULT 0,
	`lastCalculatedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userMetrics_id` PRIMARY KEY(`id`),
	CONSTRAINT `userMetrics_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `githubUsername` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `githubId` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `githubAccessToken` text;--> statement-breakpoint
ALTER TABLE `users` ADD `githubConnected` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `lastGitHubSync` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `emailNotificationsEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notificationFrequency` enum('weekly','monthly') DEFAULT 'weekly' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_githubId_unique` UNIQUE(`githubId`);