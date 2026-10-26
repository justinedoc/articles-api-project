import type { OpenAPIHono } from "@hono/zod-openapi";
import { eq, sql } from "drizzle-orm";
import type { Env, Schema } from "hono";
import type { AuthSession } from "@/core/auth";
import { db } from "@/core/db";
import { user } from "@/core/db/schema";
import { createApp } from "@/core/server";
import type { AppBindings } from "@/core/types";

/**
 * Creates a unique user in the test database for service/integration tests.
 */
export const createTestUser = async (
	label = "user",
	overrides?: Partial<typeof user.$inferInsert>,
) => {
	const id = `test-${label}-${crypto.randomUUID()}`;
	const [created] = await db
		.insert(user)
		.values({
			id,
			name: label,
			email: `${id}@example.test`,
			...overrides,
		})
		.returning();
	return created;
};

/**
 * Deletes test users and cascades all related records (articles, comments, profiles, likes).
 */
export const cleanupTestUsers = async (userIds: Iterable<string>) => {
	for (const id of userIds) {
		await db.delete(user).where(eq(user.id, id));
	}
};

/**
 * Truncates specified database tables with CASCADE.
 */
export const truncateTables = async (...tables: string[]) => {
	for (const table of tables) {
		await db.execute(sql.raw(`TRUNCATE TABLE "${table}" CASCADE`));
	}
};

/**
 * Generates a mock user object matching AuthSession["user"] with explicit image: string | null.
 */
export const createMockUser = (
	overrides?: Partial<AuthSession["user"]>,
): AuthSession["user"] & { image: string | null } => ({
	id: "usr_test_123",
	name: "Test User",
	email: "test@example.com",
	emailVerified: true,
	image: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	...overrides,
});

/**
 * Generates a mock AuthSession object with sensible defaults for route testing.
 */
export const createMockSession = (
	userOverrides?: Partial<AuthSession["user"]>,
	sessionOverrides?: Partial<AuthSession["session"]>,
): AuthSession & { user: AuthSession["user"] & { image: string | null } } => {
	const mockUser = createMockUser(userOverrides);
	return {
		session: {
			id: "sess_test_123",
			userId: mockUser.id,
			expiresAt: new Date(Date.now() + 3_600_000),
			token: "token_test_123",
			createdAt: new Date(),
			updatedAt: new Date(),
			ipAddress: null,
			userAgent: null,
			...sessionOverrides,
		},
		user: mockUser,
	};
};

/**
 * Instantiates a Hono app with the given route mounted at the specified base path.
 */
export const createTestApp = <
	E extends Env = AppBindings,
	S extends Schema = Schema,
	BasePath extends string = string,
>(
	path: string,
	router: OpenAPIHono<E, S, BasePath>,
) => {
	return createApp().route(path, router);
};
