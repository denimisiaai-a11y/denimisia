import { notFound } from 'next/navigation';

// `/500` is a path Next.js reserves internally for the built-in error page
// (legacy Pages Router convention). Without this explicit route, navigating
// to `denimisiabd.com/500` returns HTTP 500 and renders Next.js's default
// `__next_error__` page instead of our branded 404.
//
// This component intercepts the URL and converts it to a normal 404 so the
// user lands on `not-found.tsx` like any other unknown path.
export default function FiveHundred(): never {
  notFound();
}
