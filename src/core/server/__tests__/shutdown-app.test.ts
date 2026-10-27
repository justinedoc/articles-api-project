import type { ServerType } from "@hono/node-server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pool } from "@/core/db";
import { closeRedis } from "@/core/redis";
import { resetShutdownStateForTesting, shutdownApp } from "../shutdown-app";

vi.mock("@/core/db", () => ({
	pool: { end: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/core/redis", () => ({
	closeRedis: vi.fn().mockResolvedValue(undefined),
}));

describe("shutdownApp", () => {
	const mockServer = {
		close: vi.fn((cb?: (err?: Error) => void) => {
			if (cb) cb();
		}),
		closeIdleConnections: vi.fn(),
	} as unknown as ServerType;

	beforeEach(() => {
		vi.clearAllMocks();
		resetShutdownStateForTesting();
	});

	it("initiates graceful shutdown, closes server, pool, and redis", async () => {
		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation((() => undefined) as never);

		await shutdownApp("SIGINT", mockServer);

		expect(mockServer.close).toHaveBeenCalledTimes(1);
		expect(pool.end).toHaveBeenCalledTimes(1);
		expect(closeRedis).toHaveBeenCalledTimes(1);
		expect(exitSpy).toHaveBeenCalledWith(0);
	});

	it("forces immediate exit if shutdown is called a second time", async () => {
		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation((() => undefined) as never);

		// First signal starts shutdown
		await shutdownApp("SIGINT", mockServer);
		// Second signal while already shutting down
		await shutdownApp("SIGINT", mockServer);

		expect(exitSpy).toHaveBeenCalledWith(1);
	});
});
