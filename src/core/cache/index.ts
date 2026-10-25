import { baseLogger } from "@/core/logger";
import { isRedisAvailable, redis } from "@/core/redis";

export interface CacheOptions {
	/**
	 * Time-to-live in seconds. Defaults to 300 (5 minutes).
	 */
	ttlSeconds?: number;
	/**
	 * Whether to add randomized jitter (±10%) to prevent Cache Avalanche.
	 * Defaults to true.
	 */
	jitter?: boolean;
	/**
	 * Whether to cache null/undefined values to prevent Cache Penetration.
	 * Defaults to true.
	 */
	cacheNull?: boolean;
	/**
	 * TTL for cached null values. Defaults to 30 seconds.
	 */
	nullTtlSeconds?: number;
}

const DEFAULT_TTL_SECONDS = 300;
const DEFAULT_NULL_TTL_SECONDS = 30;
const NULL_SENTINEL = "__NULL_CACHE_SENTINEL__";

/**
 * In-flight promise map to prevent Cache Stampede (Thundering Herd Problem).
 * When multiple concurrent requests miss the cache for the same key,
 * only one DB query executes while all others await the same in-flight Promise.
 */
const inFlightRequests = new Map<string, Promise<unknown>>();

type CacheEntry<T> = {
	hit: boolean;
	value: T | null;
};

/**
 * Add random jitter (±10%) to a TTL to avoid Cache Avalanche.
 */
function applyJitter(ttl: number): number {
	const variance = Math.floor(ttl * 0.1 * (Math.random() * 2 - 1));
	return Math.max(1, ttl + variance);
}

class CacheService {
	private async getEntry<T>(key: string): Promise<CacheEntry<T>> {
		if (!isRedisAvailable()) return { hit: false, value: null };

		try {
			const data = await redis.get(key);
			if (!data) return { hit: false, value: null };
			if (data === NULL_SENTINEL) return { hit: true, value: null };
			return { hit: true, value: JSON.parse(data) as T };
		} catch (err) {
			baseLogger.warn(
				{ err: err instanceof Error ? err.message : err, key },
				"Cache GET error, falling back to data source",
			);
			return { hit: false, value: null };
		}
	}

	/**
	 * Retrieve a deserialized value from cache.
	 */
	async get<T>(key: string): Promise<T | null> {
		const entry = await this.getEntry<T>(key);
		return entry.value;
	}

	/**
	 * Store a value in cache with optional TTL and jitter.
	 */
	async set<T>(
		key: string,
		value: T | null,
		options: CacheOptions = {},
	): Promise<void> {
		if (!isRedisAvailable()) return;

		const baseTtl =
			value === null
				? (options.nullTtlSeconds ?? DEFAULT_NULL_TTL_SECONDS)
				: (options.ttlSeconds ?? DEFAULT_TTL_SECONDS);

		const finalTtl = options.jitter !== false ? applyJitter(baseTtl) : baseTtl;

		try {
			const payload = value === null ? NULL_SENTINEL : JSON.stringify(value);
			await redis.set(key, payload, "EX", finalTtl);
		} catch (err) {
			baseLogger.warn(
				{ err: err instanceof Error ? err.message : err, key },
				"Cache SET error",
			);
		}
	}

	/**
	 * Invalidate a specific cache key.
	 */
	async del(key: string): Promise<void> {
		if (!isRedisAvailable()) return;

		try {
			await redis.del(key);
		} catch (err) {
			baseLogger.warn(
				{ err: err instanceof Error ? err.message : err, key },
				"Cache DEL error",
			);
		}
	}

	/**
	 * Invalidate all keys matching a pattern using non-blocking SCAN.
	 * NEVER use KEYS * in production as it blocks the single-threaded Redis engine.
	 */
	async invalidatePattern(pattern: string): Promise<number> {
		if (!isRedisAvailable()) return 0;

		let deletedCount = 0;
		try {
			const stream = redis.scanStream({
				match: pattern,
				count: 100,
			});

			for await (const keys of stream) {
				const keyBatch = keys as string[];
				if (keyBatch.length > 0) {
					await redis.del(...keyBatch);
					deletedCount += keyBatch.length;
				}
			}

			if (deletedCount > 0) {
				baseLogger.debug(
					{ pattern, deletedCount },
					"Cache pattern invalidated",
				);
			}
		} catch (err) {
			baseLogger.warn(
				{ err: err instanceof Error ? err.message : err, pattern },
				"Cache invalidatePattern error",
			);
		}

		return deletedCount;
	}

	/**
	 * Cache-Aside with Thundering Herd (Stampede) Protection:
	 * 1. Checks Redis cache.
	 * 2. If missed, checks if an in-flight fetch promise already exists for this key.
	 * 3. Only runs the DB query once, caches the result with jitter, and returns it to all waiting callers.
	 * 4. Gracefully degrades if Redis is offline.
	 */
	async getOrSet<T>(
		key: string,
		fetchFn: () => Promise<T | null>,
		options: CacheOptions = {},
	): Promise<T | null> {
		// 1. Try cache
		const cached = await this.getEntry<T>(key);
		if (cached.hit) {
			return cached.value;
		}

		// 2. Prevent Thundering Herd using in-flight deduplication
		if (inFlightRequests.has(key)) {
			return inFlightRequests.get(key) as Promise<T | null>;
		}

		const fetchPromise = (async () => {
			try {
				const freshData = await fetchFn();

				// 3. Cache result (or negative cache if null)
				if (freshData !== null) {
					await this.set(key, freshData, options);
				} else if (options.cacheNull !== false) {
					await this.set(key, null, options);
				}

				return freshData;
			} finally {
				inFlightRequests.delete(key);
			}
		})();

		inFlightRequests.set(key, fetchPromise);
		return fetchPromise;
	}
}

export const cache = new CacheService();
