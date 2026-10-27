import { z } from "@hono/zod-openapi";

export const healthOkSchema = z
	.object({
		status: z.literal("ok").openapi({
			description: "Overall system health status",
			example: "ok",
		}),
		timestamp: z.string().openapi({
			description: "ISO timestamp of the health check",
			example: "2026-10-27T12:00:00.000Z",
		}),
		services: z.object({
			database: z.enum(["up", "down"]).openapi({
				description: "PostgreSQL database connectivity status",
				example: "up",
			}),
			redis: z.enum(["up", "down"]).optional().openapi({
				description: "Redis in-memory cache connectivity status",
				example: "up",
			}),
		}),
	})
	.openapi("HealthCheckOk");

export const healthErrorSchema = z
	.object({
		status: z.literal("error").openapi({
			description: "Overall system health status indicating failure",
			example: "error",
		}),
		timestamp: z.string().openapi({
			description: "ISO timestamp of the health check",
			example: "2026-10-27T12:00:00.000Z",
		}),
		services: z.object({
			database: z.enum(["up", "down"]).openapi({
				description: "PostgreSQL database connectivity status",
				example: "down",
			}),
			redis: z.enum(["up", "down"]).optional().openapi({
				description: "Redis in-memory cache connectivity status",
				example: "down",
			}),
		}),
	})
	.openapi("HealthCheckError");
