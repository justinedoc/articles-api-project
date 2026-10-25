import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@/core/auth";
import { auth } from "@/core/auth";
import { createApp } from "@/core/server";
import { usersRouter } from "../index";
import * as usersService from "../service";

describe("Users Routes Integration Tests", () => {
	const app = createApp().route("/users", usersRouter);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should return 401 Unauthorized when accessing /users/me without credentials", async () => {
		vi.spyOn(auth.api, "getSession").mockResolvedValue(null);

		const res = await app.request("/api/users/me", {
			method: "GET",
		});

		expect(res.status).toBe(401);
		const json = await res.json();
		expect(json.success).toBe(false);
		expect(json.message).toBe("Unauthorized");
	});

	it("should return 422 Unprocessable Entity when PATCH /users/me has an invalid payload", async () => {
		const mockSession: AuthSession = {
			session: {
				id: "sess_1",
				userId: "usr_1",
				expiresAt: new Date(Date.now() + 3600000),
				token: "token_1",
				createdAt: new Date(),
				updatedAt: new Date(),
				ipAddress: null,
				userAgent: null,
			},
			user: {
				id: "usr_1",
				email: "test@example.com",
				name: "Test User",
				emailVerified: true,
				image: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		};

		vi.spyOn(auth.api, "getSession").mockResolvedValue(mockSession);

		const res = await app.request("/api/users/me", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				avatarUrl: "not-a-valid-url", // Fails z.url() validation
			}),
		});

		expect(res.status).toBe(422);
		const json = await res.json();
		expect(json.success).toBe(false);
		expect(json.message).toBeDefined();
	});

	it("should return 200 OK with profile when authenticated user requests GET /users/me", async () => {
		const mockUser = {
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
			user: mockUser,
		};

		vi.spyOn(auth.api, "getSession").mockResolvedValue(mockSession);
		vi.spyOn(usersService, "getProfile").mockResolvedValue(mockUser);

		const res = await app.request("/api/users/me", {
			method: "GET",
		});

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.message).toBe("Profile retrieved successfully");
		expect(json.data.id).toBe("usr_123");
		expect(json.data.email).toBe("jane@example.com");
	});
});
