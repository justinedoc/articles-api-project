import { config } from "dotenv";
import { prettifyError, z } from "zod";

config();

const envSchema = z.object({
	PORT: z.coerce.number().default(3000),
	HOST: z.string().default("0.0.0.0"),
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	LOG_LEVEL: z
		.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
		.default("info"),

	SERVER_URL: z.url().default("http://localhost:3000"),
	APP_URL: z.url().default("http://localhost:4321"),
	TRUST_PROXY: z
		.enum(["true", "false"])
		.default("false")
		.transform((value) => value === "true"),

	DATABASE_URL: z.string(),
	REDIS_URL: z.string().default("redis://localhost:6379"),

	BETTER_AUTH_URL: z.url(),
	BETTER_AUTH_SECRET: z.string(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
	console.error("Environment Validation Failed!");
	console.error(prettifyError(parsedEnv.error));

	process.exit(1);
}

if (parsedEnv.data.NODE_ENV !== "test") {
	console.log("✅ ENVs validated successfully.");
}

export type Env = z.infer<typeof envSchema>;
export const env = parsedEnv.data;
