import * as httpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/core/types";
import type { CheckRoute } from "./routes";
import { getSystemHealth } from "./service";

export const check: AppRouteHandler<CheckRoute> = async (c) => {
	const services = await getSystemHealth();
	const timestamp = new Date().toISOString();

	if (services.database === "up") {
		return c.json(
			{ status: "ok" as const, timestamp, services },
			httpStatusCodes.OK,
		);
	}

	c.var.logger.error({ services }, "System health check failed");
	return c.json(
		{ status: "error" as const, timestamp, services },
		httpStatusCodes.SERVICE_UNAVAILABLE,
	);
};
