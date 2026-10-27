import { createApp } from "@/core/server";
import { getRoutesV1 } from "@/versions";

export const app = createApp();

export const routes = app.route("/v1", getRoutesV1());

export type AppType = typeof routes;
export default app;
