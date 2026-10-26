import { describe, expect, it } from "vitest";
import app from "../src/index";

describe("E2E API Tests", () => {
	it("should serve OpenAPI 3.2.1 documentation JSON spec at /api/v1/doc", async () => {
		const res = await app.request("/api/v1/doc");
		expect(res.status).toBe(200);

		const spec = await res.json();
		expect(spec.openapi).toBe("3.2.1");
		expect(spec.info).toBeDefined();
		expect(spec.info.title).toContain("Project API");
		expect(spec.components?.securitySchemes?.BearerAuth).toBeDefined();
		expect(spec.paths["/system/health"]).toBeDefined();
		expect(spec.paths["/account/me"]).toBeDefined();
		expect(spec.paths["/profiles/me"]).toBeDefined();
		expect(spec.paths["/profiles/{username}"]).toBeDefined();
		expect(spec.paths["/articles"]).toBeDefined();
		expect(spec.paths["/articles/{id}/like"]).toBeDefined();
		expect(spec.paths["/articles/{articleId}/comments"]).toBeDefined();
	});

	it("should serve Scalar Reference HTML documentation UI at /api/v1/reference", async () => {
		const res = await app.request("/api/v1/reference");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");

		const html = await res.text();
		expect(html).toContain("Scalar");
	});

	it("should return system health and telemetry headers at /api/v1/system/health", async () => {
		const res = await app.request("/api/v1/system/health");
		expect(res.status).toBe(200);

		// Telemetry and security headers
		expect(res.headers.get("X-Query-Count")).toBeDefined();
		expect(res.headers.get("RateLimit-Limit")).toBeDefined();
		expect(res.headers.get("RateLimit-Remaining")).toBeDefined();

		const json = await res.json();
		expect(json.status).toBe("ok");
		expect(json.services.database).toBe("up");
	});

	it("should return 404 Not Found for non-existent endpoints", async () => {
		const res = await app.request("/api/v1/unknown-route");
		expect(res.status).toBe(404);
	});
});
