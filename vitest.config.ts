import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src"),
		},
	},
	test: {
		environment: "node",
		globals: true,
		// setupFiles: ["./vitest.setup.ts"],
		fileParallelism: false,
		testTimeout: 20_000,
		exclude: ["node_modules/**", "dist/**"],
		env: loadEnv("test", process.cwd(), ""),
	},
});
