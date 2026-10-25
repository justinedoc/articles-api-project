import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import * as redisModule from "@/core/redis";
import type { AppBindings } from "@/core/types";
import { getClientIp, rateLimiter } from "../rate-limiter";

describe("Rate Limiter Unit Tests", () => {
	it("should correctly resolve client IP from proxy headers in priority order", () => {
		const mockContextCf = {
			req: {
				header: (name: string) =>
					name === "cf-connecting-ip" ? "203.0.113.1" : undefined,
			},
		} as unknown as Parameters<typeof getClientIp>[0];
		expect(getClientIp(mockContextCf)).toBe("203.0.113.1");

		const mockContextXff = {
			req: {
				header: (name: string) =>
					name === "x-forwarded-for" ? "198.51.100.5, 10.0.0.1" : undefined,
			},
		} as unknown as Parameters<typeof getClientIp>[0];
		expect(getClientIp(mockContextXff)).toBe("198.51.100.5");

		const mockContextRealIp = {
			req: {
				header: (name: string) =>
					name === "x-real-ip" ? "192.0.2.9" : undefined,
			},
		} as unknown as Parameters<typeof getClientIp>[0];
		expect(getClientIp(mockContextRealIp)).toBe("192.0.2.9");

		const mockContextEmpty = {
			req: {
				header: () => undefined,
			},
		} as unknown as Parameters<typeof getClientIp>[0];
		expect(getClientIp(mockContextEmpty)).toBe("127.0.0.1");
	});

	it("should fail-open and proceed when Redis is unavailable", async () => {
		vi.spyOn(redisModule, "isRedisAvailable").mockReturnValue(false);

		const app = new Hono<AppBindings>();
		app.use("*", rateLimiter({ maxRequests: 5, windowSeconds: 60 }));
		app.get("/test", (c) => c.text("OK"));

		const res = await app.request("/test");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("OK");
	});

	it("should enforce limits and return 429 when max requests are exceeded", async () => {
		vi.spyOn(redisModule, "isRedisAvailable").mockReturnValue(true);

		// Mock redis multi pipeline response
		const multiMock = {
			zremrangebyscore: vi.fn().mockReturnThis(),
			zadd: vi.fn().mockReturnThis(),
			zcard: vi.fn().mockReturnThis(),
			expire: vi.fn().mockReturnThis(),
			exec: vi.fn().mockResolvedValue([
				[null, 0],
				[null, 1],
				[null, 6], // count is 6, exceeding limit of 5
				[null, 1],
			]),
		};

		vi.spyOn(redisModule.redis, "multi").mockReturnValue(
			multiMock as unknown as ReturnType<typeof redisModule.redis.multi>,
		);

		const app = new Hono<AppBindings>();
		app.use(
			"*",
			rateLimiter({
				maxRequests: 5,
				windowSeconds: 60,
				message: "Rate limit reached",
			}),
		);
		app.get("/test", (c) => c.text("OK"));

		const res = await app.request("/test");
		expect(res.status).toBe(429);

		const data = await res.json();
		expect(data.success).toBe(false);
		expect(data.message).toBe("Rate limit reached");
		expect(res.headers.get("RateLimit-Limit")).toBe("5");
		expect(res.headers.get("RateLimit-Remaining")).toBe("0");
		expect(res.headers.get("Retry-After")).toBe("60");
	});
});
