// Resolve a data asset path against the app's base URL so images work whether
// the site is served from the domain root, a sub-path (GitHub Pages project
// site), or `vite preview`. iconAsset values look like "/assets/...".
const BASE = import.meta.env.BASE_URL;

export function asset(path: string): string {
  if (/^https?:/.test(path)) return path; // already absolute URL
  return BASE.replace(/\/$/, "") + (path.startsWith("/") ? path : `/${path}`);
}
