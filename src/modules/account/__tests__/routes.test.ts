import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/core/auth";
import { createMockSession, createTestApp } from "@/core/test-utils";
import { accountRouter } from "../index";
import * as accountService from "../service";

describe("Account Routes Integration Tests", () => {
	const app = createTestApp("/account", accountRouter);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should return 401 Unauthorized when accessing /account/me without credentials", async () => {
		vi.spyOn(auth.api, "getSession").mockResolvedValue(null);

		const res = await app.request("/api/account/me", {
			method: "GET",
		});

		expect(res.status).toBe(401);
		const json = await res.json();
		expect(json.success).toBe(false);
		expect(json.message).toBe("Unauthorized");
	});

	it("should return 200 OK with account details when authenticated user requests GET /account/me", async () => {
		const mockSession = createMockSession({
			id: "usr_123",
			name: "Jane Doe",
			email: "jane@example.com",
		});

		vi.spyOn(auth.api, "getSession").mockResolvedValue(mockSession);
		vi.spyOn(accountService, "getAccount").mockResolvedValue(mockSession.user);

		const res = await app.request("/api/account/me", {
			method: "GET",
		});

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.message).toBe("Account retrieved successfully");
		expect(json.data.id).toBe("usr_123");
		expect(json.data.email).toBe("jane@example.com");
	});

	it("should return 200 OK when authenticated user requests DELETE /account/me", async () => {
		const mockSession = createMockSession({
			id: "usr_123",
			name: "Jane Doe",
			email: "jane@example.com",
		});

		vi.spyOn(auth.api, "getSession").mockResolvedValue(mockSession);
		vi.spyOn(accountService, "deleteAccount").mockResolvedValue(
			mockSession.user,
		);

		const res = await app.request("/api/account/me", {
			method: "DELETE",
		});

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.message).toBe("Account deleted successfully");
	});
});
