import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/core/db/schema/index.ts",
	out: "./src/core/db/migrations",
	dbCredentials: {
		// biome-ignore lint/style/noNonNullAssertion: <db url is always present>
		url: process.env.DATABASE_URL!,
	},
});
