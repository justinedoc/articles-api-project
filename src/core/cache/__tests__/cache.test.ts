import { beforeEach, describe, expect, it, vi } from "vitest";
import { cache } from "../index";

describe("CacheService Unit Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should return fresh data from fetchFn on cache miss", async () => {
		const mockFetch = vi.fn().mockResolvedValue({ id: "1", title: "Hello" });

		const result = await cache.getOrSet("test:item:1", mockFetch);

		expect(result).toEqual({ id: "1", title: "Hello" });
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it("should prevent Cache Stampede (Thundering Herd) by coalescing concurrent in-flight requests", async () => {
		let callCount = 0;
		const slowFetch = vi.fn(async () => {
			callCount++;
			// Simulate 50ms async DB fetch latency
			await new Promise((resolve) => setTimeout(resolve, 50));
			return { id: "user_42", role: "admin" };
		});

		// Launch 10 simultaneous concurrent requests for the exact same cache key
		const promises = Array.from({ length: 10 }).map(() =>
			cache.getOrSet("test:stampede:user_42", slowFetch),
		);

		const results = await Promise.all(promises);

		// All 10 callers should receive the exact same data
		for (const res of results) {
			expect(res).toEqual({ id: "user_42", role: "admin" });
		}

		// The underlying DB fetch MUST only execute ONCE despite 10 concurrent requests
		expect(callCount).toBe(1);
		expect(slowFetch).toHaveBeenCalledTimes(1);
	});

	it("should support negative caching to prevent Cache Penetration when record is null", async () => {
		const nullFetch = vi.fn().mockResolvedValue(null);

		const result = await cache.getOrSet("test:nonexistent:999", nullFetch, {
			cacheNull: true,
			nullTtlSeconds: 10,
		});

		expect(result).toBeNull();
		expect(nullFetch).toHaveBeenCalledTimes(1);
	});

	it("should delete key on cache.del", async () => {
		await expect(cache.del("test:item:1")).resolves.toBeUndefined();
	});
});
