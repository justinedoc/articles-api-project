import type { Context } from "hono";

/**
 * Sets standard Cache-Control headers on public responses.
 * Browsers and CDNs will serve from cache for `maxAgeSeconds`,
 * and serve stale content in the background while revalidating for `staleWhileRevalidateSeconds`.
 */
export const setPublicCacheHeaders = (
	c: Context,
	maxAgeSeconds = 60,
	staleWhileRevalidateSeconds = 300,
) => {
	c.header(
		"Cache-Control",
		`public, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`,
	);
};
