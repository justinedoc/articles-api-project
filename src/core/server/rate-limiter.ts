import type { MiddlewareHandler } from "hono";
import * as httpStatusCodes from "stoker/http-status-codes";
import { baseLogger } from "@/core/logger";
import { isRedisAvailable, redis } from "@/core/redis";
import type { AppBindings } from "@/core/types";

export interface RateLimiterOptions {
	/**
	 * Window size in seconds. Defaults to 60 (1 minute).
	 */
	windowSeconds?: number;
	/**
	 * Maximum requests allowed within window. Defaults to 100.
	 */
	maxRequests?: number;
	/**
	 * Key prefix for Redis. Defaults to "rl:global".
	 */
	prefix?: string;
	/**
	 * Custom message returned when limit is exceeded.
	 */
	message?: string;
	/**
	 * Custom identifier extractor. Defaults to authenticated user ID or client IP.
	 */
	keyGenerator?: (c: Parameters<MiddlewareHandler<AppBindings>>[0]) => string;
}

export function getClientIp(
	c: Parameters<MiddlewareHandler<AppBindings>>[0],
): string {
	const cfConnectingIp = c.req.header("cf-connecting-ip");
	if (cfConnectingIp) return cfConnectingIp;

	const xForwardedFor = c.req.header("x-forwarded-for");
	if (xForwardedFor) {
		const first = xForwardedFor.split(",")[0]?.trim();
		if (first) return first;
	}

	const xRealIp = c.req.header("x-real-ip");
	if (xRealIp) return xRealIp;

	return "127.0.0.1";
}

/**
 * Production-ready Sliding Window Rate Limiter using Redis Sorted Sets (ZSET).
 * Prevents traffic spikes at window boundaries that occur with fixed-window counters.
 * Features fail-open degradation if Redis becomes temporarily unreachable.
 */
export function rateLimiter(
	options: RateLimiterOptions = {},
): MiddlewareHandler<AppBindings> {
	const windowSeconds = options.windowSeconds ?? 60;
	const maxRequests = options.maxRequests ?? 100;
	const prefix = options.prefix ?? "rl:global";
	const errorMessage =
		options.message ?? "Too many requests. Please try again later.";

	return async (c, next) => {
		// If Redis is not available, fail open so legitimate traffic is not blocked
		if (!isRedisAvailable()) {
			return next();
		}

		const user = c.get("user");
		const identifier = options.keyGenerator
			? options.keyGenerator(c)
			: user?.id
				? `user:${user.id}`
				: `ip:${getClientIp(c)}`;

		const redisKey = `${prefix}:${identifier}`;
		const now = Date.now();
		const windowStart = now - windowSeconds * 1000;

		try {
			// Atomic sliding-window pipeline
			const multi = redis.multi();
			multi.zremrangebyscore(redisKey, 0, windowStart);
			multi.zadd(redisKey, now, `${now}-${Math.random()}`);
			multi.zcard(redisKey);
			multi.expire(redisKey, windowSeconds);

			const results = await multi.exec();

			if (!results) {
				return next();
			}

			// results[2] is zcard output: [null, count]
			const [, zcardResult] = results[2];
			const currentRequests = Number(zcardResult);

			const remaining = Math.max(0, maxRequests - currentRequests);
			const resetSeconds = windowSeconds;

			c.res.headers.set("RateLimit-Limit", String(maxRequests));
			c.res.headers.set("RateLimit-Remaining", String(remaining));
			c.res.headers.set("RateLimit-Reset", String(resetSeconds));

			if (currentRequests > maxRequests) {
				c.res.headers.set("Retry-After", String(resetSeconds));
				baseLogger.warn(
					{ identifier, currentRequests, maxRequests },
					"Rate limit exceeded",
				);
				return c.json(
					{
						success: false,
						message: errorMessage,
					},
					httpStatusCodes.TOO_MANY_REQUESTS,
				);
			}

			return next();
		} catch (err) {
			baseLogger.warn(
				{ err: err instanceof Error ? err.message : err, redisKey },
				"Rate limiter execution failed; failing open",
			);
			return next();
		}
	};
}
