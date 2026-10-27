import { describe, expect, it } from "vitest";
import { apiClient } from "./helpers/client";

describe("E2E: System, Docs & Middleware", () => {
	it("should serve OpenAPI 3.2.1 documentation spec at /api/v1/doc", async () => {
		const res = await apiClient.get<Record<string, unknown>>("/api/v1/doc");
		expect(res.status).toBe(200);

		const spec = res.data as {
			openapi: string;
			info: { title: string };
			paths: Record<string, unknown>;
			components?: { securitySchemes?: Record<string, unknown> };
		};

		expect(spec.openapi).toBe("3.2.1");
		expect(spec.info.title).toContain("Project API");
		expect(spec.components?.securitySchemes?.BearerAuth).toBeDefined();
		expect(spec.paths["/system/health"]).toBeDefined();
		expect(spec.paths["/account/me"]).toBeDefined();
		expect(spec.paths["/profiles/me"]).toBeDefined();
		expect(spec.paths["/profiles/{username}"]).toBeDefined();
		expect(spec.paths["/articles"]).toBeDefined();
		expect(spec.paths["/articles/trending"]).toBeDefined();
		expect(spec.paths["/articles/{id}/like"]).toBeDefined();
		expect(spec.paths["/articles/{articleId}/comments"]).toBeDefined();
		expect(spec.paths["/tags/popular"]).toBeDefined();
	});

	it("should serve Scalar Reference HTML documentation at /api/v1/reference", async () => {
		const res = await apiClient.get("/api/v1/reference");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
		expect(res.text).toContain("Scalar");
	});

	it("should report system health with database, redis, and telemetry headers", async () => {
		const res = await apiClient.get<{
			status: string;
			services: { database: string; redis: string };
		}>("/api/v1/system/health");

		expect(res.status).toBe(200);
		expect(res.data.status).toBe("ok");
		expect(res.data.services.database).toBe("up");

		// Security & Telemetry headers
		expect(res.headers.get("X-Query-Count")).toBeDefined();
		expect(res.headers.get("RateLimit-Limit")).toBeDefined();
		expect(res.headers.get("RateLimit-Remaining")).toBeDefined();
		expect(res.headers.get("etag")).toBeDefined();
		expect(res.headers.get("cross-origin-resource-policy")).toBe(
			"cross-origin",
		);
	});

	it("should return 404 for unknown endpoints", async () => {
		const res = await apiClient.get("/api/v1/non-existent-route");
		expect(res.status).toBe(404);
	});

	it("should enforce request body limits and reject payloads > 2MB with 413", async () => {
		// Create a payload larger than 2MB (2 * 1024 * 1024 bytes)
		const oversizedBody = "x".repeat(2.5 * 1024 * 1024);

		const res = await apiClient.post("/api/v1/articles", oversizedBody, {
			headers: { "Content-Type": "text/plain" },
		});

		expect(res.status).toBe(413);
		expect(res.text).toContain("Payload too large");
	});
});
