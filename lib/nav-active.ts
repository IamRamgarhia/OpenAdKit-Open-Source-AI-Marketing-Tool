/**
 * Active-route matching for the sidebar + mobile drawer.
 *
 * The old check was `path.startsWith(item.href)` with no segment boundary, so
 * `/generate/google` lit up while you were on `/generate/google-pmax`, and
 * `/brand` lit up on `/brand/new` AND on a hypothetical `/brandkit`. Several
 * tools also appear in more than one nav group with a different `?platform=`
 * pre-selection — those should only highlight the entry whose query matches
 * the current URL.
 */

export interface NavLike {
  href: string;
  query?: string;
}

/** True when `path` is `href` itself or a sub-route of it (segment boundary). */
export function pathMatchesHref(path: string | null | undefined, href: string): boolean {
  if (!path) return false;
  if (href === "/") return path === "/";
  const base = href.replace(/\/+$/, "");
  return path === base || path.startsWith(base + "/");
}

/**
 * Does the nav item represent the current location?
 *
 * - Path must match on a segment boundary.
 * - If the item carries a query (e.g. `platform=tiktok`) and the current URL
 *   specifies a DIFFERENT value for one of those keys, it's a sibling entry
 *   for another platform → not active. When the URL doesn't mention the key
 *   at all we can't disambiguate, so every duplicate stays active (matching
 *   the pre-query behaviour rather than highlighting nothing).
 */
export function isNavItemActive(
  path: string | null | undefined,
  search: string | URLSearchParams | null | undefined,
  item: NavLike
): boolean {
  if (!pathMatchesHref(path, item.href)) return false;
  if (!item.query) return true;
  const current = search instanceof URLSearchParams ? search : new URLSearchParams(search ?? "");
  for (const [k, v] of new URLSearchParams(item.query)) {
    const cur = current.get(k);
    if (cur !== null && cur !== v) return false;
  }
  return true;
}
