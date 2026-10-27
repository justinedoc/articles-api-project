import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { user } from "@/core/db/schema";
import { ApiTestClient, apiClient } from "./client";

export interface E2EUser {
	id: string;
	name: string;
	email: string;
	token: string;
	client: ApiTestClient;
}

export const createE2EUser = async (label = "user"): Promise<E2EUser> => {
	const email = `e2e-${label}-${crypto.randomUUID()}@example.test`;
	const name = `E2E ${label.charAt(0).toUpperCase() + label.slice(1)}`;
	const password = "Password123!";

	const res = await apiClient.post<{
		token: string;
		user: { id: string; name: string; email: string };
	}>("/api/v1/auth/sign-up/email", {
		name,
		email,
		password,
	});

	if (res.status !== 200 || !res.data.token) {
		throw new Error(
			`Failed to create E2E test user: ${res.status} - ${res.text}`,
		);
	}

	return {
		id: res.data.user.id,
		name: res.data.user.name,
		email: res.data.user.email,
		token: res.data.token,
		client: new ApiTestClient(res.data.token),
	};
};

export const cleanupE2EUsers = async (userIds: Iterable<string>) => {
	for (const id of userIds) {
		await db.delete(user).where(eq(user.id, id));
	}
};
