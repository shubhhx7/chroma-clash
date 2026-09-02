/**
 * Cache-busting version for processed runtime assets. Bump when assets are
 * regenerated so browsers/CDNs never serve stale sprites or audio.
 */
export const ASSET_VERSION = 13;

export const versioned = (url: string): string => `${url}?v=${ASSET_VERSION}`;
