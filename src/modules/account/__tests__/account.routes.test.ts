import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@/core/auth";
import { auth } from "@/core/auth";
import { createApp } from "@/core/server";
import { accountRouter } from "../index";
import * as accountService from "../service";

describe("Account Routes Integration Tests", () => {
	const app = createApp().route("/account", accountRouter);

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
		const mockAccount = {
			id: "usr_123",
			name: "Jane Doe",
			email: "jane@example.com",
			emailVerified: true,
			image: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const mockSession: AuthSession = {
			session: {
				id: "sess_123",
				userId: "usr_123",
				expiresAt: new Date(Date.now() + 3600000),
				token: "token_123",
				createdAt: new Date(),
				updatedAt: new Date(),
				ipAddress: null,
				userAgent: null,
			},
			user: mockAccount,
		};

		vi.spyOn(auth.api, "getSession").mockResolvedValue(mockSession);
		vi.spyOn(accountService, "getAccount").mockResolvedValue(mockAccount);

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
		const mockSession: AuthSession = {
			session: {
				id: "sess_123",
				userId: "usr_123",
				expiresAt: new Date(Date.now() + 3600000),
				token: "token_123",
				createdAt: new Date(),
				updatedAt: new Date(),
				ipAddress: null,
				userAgent: null,
			},
			user: {
				id: "usr_123",
				name: "Jane Doe",
				email: "jane@example.com",
				emailVerified: true,
				image: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		};

		vi.spyOn(auth.api, "getSession").mockResolvedValue(mockSession);
		vi.spyOn(accountService, "deleteAccount").mockResolvedValue({
			id: "usr_123",
			name: "Jane Doe",
			email: "jane@example.com",
			emailVerified: true,
			image: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const res = await app.request("/api/account/me", {
			method: "DELETE",
		});

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.message).toBe("Account deleted successfully");
	});
});
