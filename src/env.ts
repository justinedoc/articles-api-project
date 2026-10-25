import { config } from "dotenv";
import { prettifyError, z } from "zod";

config();

const envSchema = z.object({
	PORT: z.coerce.number().default(3000),
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	LOG_LEVEL: z
		.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
		.default("info"),

	SERVER_URL: z.url().default("http://localhost:3000"),
	APP_URL: z.url().default("http://localhost:4321"),

	DATABASE_URL: z.string(),

	BETTER_AUTH_URL: z.url(),
	BETTER_AUTH_SECRET: z.string(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
	console.error("Environment Validation Failed!");
	console.error(prettifyError(parsedEnv.error));

	process.exit(1);
}

console.log("✅ ENVs validated successfully.");

export type Env = z.infer<typeof envSchema>;
export const env = parsedEnv.data;
