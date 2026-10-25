import { Scalar } from "@scalar/hono-api-reference";
import type { AppOpenAPI } from "@/core/types";
import packageJSON from "../../../package.json" with { type: "json" };

export * from "./helpers";
export * from "./schemas";
export function configureOpenAPI(router: AppOpenAPI, version: string) {
	router.openAPIRegistry.registerComponent("securitySchemes", "BearerAuth", {
		type: "http",
		scheme: "bearer",
		description: "Bearer session token",
	});

	router.openAPIRegistry.registerComponent("securitySchemes", "CookieAuth", {
		type: "apiKey",
		in: "cookie",
		name: "better-auth.session_token",
		description: "Session cookie automatically sent by the browser",
	});

	const basePath = `/api/${version}`;

	router.doc("/doc", {
		openapi: "3.1.1",
		info: {
			version: packageJSON.version,
			title: `Project API ${version.toUpperCase()}`,
		},
		servers: [
			{
				url: basePath,
				description: "Local Environment",
			},
			{ url: `https://api.example.com${basePath}`, description: "Production" },
		],
	});

	router.get(
		"/reference",
		Scalar(() => {
			return {
				theme: "deepSpace",
				layout: "classic",
				pageTitle: `Project Documentation ${version.toUpperCase()}`,
				sources: [
					{
						title: "Application API",
						url: `${basePath}/doc`,
					},
					{
						title: "Authentication API",
						url: `${basePath}/auth/open-api/generate-schema`,
					},
				],
				defaultHttpClient: {
					targetKey: "node",
					clientKey: "fetch",
				},
			};
		}),
	);
}

export default configureOpenAPI;
