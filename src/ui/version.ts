// App/web version string, injected at build time from package.json
// (vite.config.ts → define). Kept out of brand.ts because vite.config.ts
// imports brand.ts before this build-time global exists.
export const APP_VERSION: string = __APP_VERSION__;
