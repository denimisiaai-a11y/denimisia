// SSR fallback overlay shown on the homepage during the first paint, before
// the React-managed splash gate hydrates. The inline script that decides
// whether to skip the overlay lives in the root layout (`next/script` with
// strategy="beforeInteractive"), and CSS in globals.css hides this div once
// the React splash takes over via `data-splash-handed-off` on <html>.

export function SplashPrerender() {
  return <div id="denimisia-splash-prerender" aria-hidden="true" />;
}
