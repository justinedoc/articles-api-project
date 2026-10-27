import type { Context } from "hono";

/**
 * Sets standard Cache-Control and Vary headers on responses.
 * When authenticated, marks responses private so shared proxies/CDNs do not cache per-user data.
 * When anonymous, allows public caching for maxAgeSeconds with stale-while-revalidate.
 */
export const setCacheHeaders = (
	c: Context,
	isPrivate: boolean,
	maxAgeSeconds = 60,
	staleWhileRevalidateSeconds = 300,
) => {
	c.header("Vary", "Authorization, Cookie");
	if (isPrivate) {
		c.header("Cache-Control", "private, no-cache");
	} else {
		c.header(
			"Cache-Control",
			`public, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`,
		);
	}
};

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
	setCacheHeaders(c, false, maxAgeSeconds, staleWhileRevalidateSeconds);
};

export const setPrivateCacheHeaders = (c: Context) => {
	setCacheHeaders(c, true);
};
