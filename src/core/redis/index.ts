import { Redis, type RedisOptions } from "ioredis";
import { baseLogger } from "@/core/logger";
import { env } from "@/env";

const globalForRedis = globalThis as unknown as {
	redis?: Redis;
};

const redisOptions: RedisOptions = {
	lazyConnect: true,
	maxRetriesPerRequest: 3,
	enableReadyCheck: true,
	autoResubscribe: true,
	autoResendUnfulfilledCommands: true,
	retryStrategy(times) {
		if (env.NODE_ENV === "test") {
			// In test environment, don't spam retries indefinitely
			if (times > 2) return null;
		}
		const delay = Math.min(times * 100, 3000);
		return delay;
	},
};

export const redis =
	globalForRedis.redis ?? new Redis(env.REDIS_URL, redisOptions);

if (env.NODE_ENV !== "production") {
	globalForRedis.redis = redis;
}

let isConnected = false;

redis.on("connect", () => {
	isConnected = true;
	baseLogger.info("Redis connection established");
});

redis.on("ready", () => {
	isConnected = true;
	baseLogger.info("Redis client ready to receive commands");
});

redis.on("error", (err: unknown) => {
	isConnected = false;
	baseLogger.error(
		{ err: err instanceof Error ? err.message : err },
		"Redis error encountered",
	);
});

redis.on("close", () => {
	isConnected = false;
	baseLogger.warn("Redis connection closed");
});

export function isRedisAvailable(): boolean {
	return isConnected && redis.status === "ready";
}

/**
 * Initialize Redis connection safely on startup.
 * If connection fails, logs warning and allows app to run with graceful degradation.
 */
export async function initRedis(): Promise<boolean> {
	if (redis.status === "ready" || redis.status === "connecting") {
		return true;
	}
	try {
		await redis.connect();
		isConnected = true;
		return true;
	} catch (err) {
		baseLogger.warn(
			{ err: err instanceof Error ? err.message : err },
			"Redis initial connection failed; caching and rate limiting will run in fallback/degraded mode",
		);
		isConnected = false;
		return false;
	}
}

/**
 * Gracefully quit Redis connection during shutdown.
 */
export async function closeRedis(): Promise<void> {
	if (redis.status === "end" || redis.status === "close") {
		return;
	}

	try {
		const quitPromise = redis.quit();
		const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 2000));
		await Promise.race([quitPromise, timeoutPromise]);
		baseLogger.info("Redis connection closed gracefully");
	} catch (err) {
		baseLogger.warn(
			{ err: err instanceof Error ? err.message : err },
			"Forcing Redis disconnect after quit error/timeout",
		);
		redis.disconnect();
	}
}
