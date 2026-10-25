import { Scalar } from "@scalar/hono-api-reference";
import type { AppOpenAPI } from "@/core/lib/types";
import { env } from "@/env";
import packageJSON from "../../../package.json" with { type: "json" };

export default function configureOpenAPI(router: AppOpenAPI, version: string) {
	router.openAPIRegistry.registerComponent("securitySchemes", "BearerAuth", {
		type: "http",
		scheme: "bearer",
	});

	const basePath = `/api/${version}`;

	router.doc("/doc", {
		openapi: "3.1.1",
		info: {
			version: packageJSON.version,
			title: `Blog API ${version.toUpperCase()}`,
		},
		servers: [
			{
				url: basePath,
				description: "Local Environment",
			},
			{ url: `${env.SERVER_URL}${basePath}`, description: "Production" },
		],
	});

	router.get(
		"/reference",
		Scalar(() => {
			return {
				theme: "deepSpace",
				layout: "classic",
				pageTitle: `Blog API Documentation ${version.toUpperCase()}`,
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
