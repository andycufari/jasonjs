'use client';

// Tailwind Seed
// This file enumerates commonly used utility classes for dynamic components
// so Tailwind's JIT can see them at build time and avoid purging.
// It is not imported anywhere; the content glob picks it up.

export const TAILWIND_SEED = `
  /* Gradient backgrounds and color stops */
  bg-gradient-to-r bg-gradient-to-l bg-gradient-to-b bg-gradient-to-t
  from-green-400 via-emerald-500 to-green-400
  from-emerald-400 via-emerald-500 to-emerald-400
  from-blue-400 via-indigo-500 to-purple-500
  from-pink-500 via-rose-500 to-orange-400
  from-yellow-400 via-orange-500 to-red-500

  /* Positioning and sizing */
  absolute relative inset-0 pointer-events-none

  /* Rounding and blur */
  rounded-lg rounded-xl rounded-2xl blur-sm blur

  /* Opacity and transitions */
  opacity-0 opacity-100 transition-opacity duration-300 duration-500
  group group-hover:opacity-100

  /* Animations */
  animate-pulse animate-spin animate-gradient-x

  /* Shadows and borders */
  shadow-sm shadow-md shadow-lg border border-2 border-transparent

  /* Background helpers for smooth gradient motion */
  bg-[length:200%_200%]
`;

export default TAILWIND_SEED;

