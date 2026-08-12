// tailwind.config.js
const defaultTheme = require("tailwindcss/defaultTheme");
const colors = require("tailwindcss/colors");
const {
  default: flattenColorPalette,
} = require("tailwindcss/lib/util/flattenColorPalette");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./core/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  safelist: [
    // Colors - Extended palette for AI components
    'bg-red-50', 'bg-red-100', 'bg-red-200', 'bg-red-300', 'bg-red-400', 'bg-red-500', 'bg-red-600', 'bg-red-700', 'bg-red-800', 'bg-red-900',
    'bg-blue-50', 'bg-blue-100', 'bg-blue-200', 'bg-blue-300', 'bg-blue-400', 'bg-blue-500', 'bg-blue-600', 'bg-blue-700', 'bg-blue-800', 'bg-blue-900',
    'bg-green-50', 'bg-green-100', 'bg-green-200', 'bg-green-300', 'bg-green-400', 'bg-green-500', 'bg-green-600', 'bg-green-700', 'bg-green-800', 'bg-green-900',
    'bg-yellow-50', 'bg-yellow-100', 'bg-yellow-200', 'bg-yellow-300', 'bg-yellow-400', 'bg-yellow-500', 'bg-yellow-600', 'bg-yellow-700', 'bg-yellow-800', 'bg-yellow-900',
    'bg-purple-50', 'bg-purple-100', 'bg-purple-200', 'bg-purple-300', 'bg-purple-400', 'bg-purple-500', 'bg-purple-600', 'bg-purple-700', 'bg-purple-800', 'bg-purple-900',
    'bg-pink-50', 'bg-pink-100', 'bg-pink-200', 'bg-pink-300', 'bg-pink-400', 'bg-pink-500', 'bg-pink-600', 'bg-pink-700', 'bg-pink-800', 'bg-pink-900',
    'bg-gray-50', 'bg-gray-100', 'bg-gray-200', 'bg-gray-300', 'bg-gray-400', 'bg-gray-500', 'bg-gray-600', 'bg-gray-700', 'bg-gray-800', 'bg-gray-900',
    'bg-slate-50', 'bg-slate-100', 'bg-slate-200', 'bg-slate-300', 'bg-slate-400', 'bg-slate-500', 'bg-slate-600', 'bg-slate-700', 'bg-slate-800', 'bg-slate-900',
    'bg-indigo-50', 'bg-indigo-100', 'bg-indigo-200', 'bg-indigo-300', 'bg-indigo-400', 'bg-indigo-500', 'bg-indigo-600', 'bg-indigo-700', 'bg-indigo-800', 'bg-indigo-900',
    'bg-emerald-50', 'bg-emerald-100', 'bg-emerald-200', 'bg-emerald-300', 'bg-emerald-400', 'bg-emerald-500', 'bg-emerald-600', 'bg-emerald-700', 'bg-emerald-800', 'bg-emerald-900',

    // Text colors
    'text-red-50', 'text-red-100', 'text-red-200', 'text-red-300', 'text-red-400', 'text-red-500', 'text-red-600', 'text-red-700', 'text-red-800', 'text-red-900',
    'text-blue-50', 'text-blue-100', 'text-blue-200', 'text-blue-300', 'text-blue-400', 'text-blue-500', 'text-blue-600', 'text-blue-700', 'text-blue-800', 'text-blue-900',
    'text-green-50', 'text-green-100', 'text-green-200', 'text-green-300', 'text-green-400', 'text-green-500', 'text-green-600', 'text-green-700', 'text-green-800', 'text-green-900',
    'text-gray-50', 'text-gray-100', 'text-gray-200', 'text-gray-300', 'text-gray-400', 'text-gray-500', 'text-gray-600', 'text-gray-700', 'text-gray-800', 'text-gray-900',
    'text-slate-50', 'text-slate-100', 'text-slate-200', 'text-slate-300', 'text-slate-400', 'text-slate-500', 'text-slate-600', 'text-slate-700', 'text-slate-800', 'text-slate-900',
    'text-white', 'text-black', 'text-transparent',

    // Border colors and styles
    'border', 'border-0', 'border-2', 'border-4', 'border-8',
    'border-red-200', 'border-red-300', 'border-red-400', 'border-red-500', 'border-red-600',
    'border-blue-200', 'border-blue-300', 'border-blue-400', 'border-blue-500', 'border-blue-600',
    'border-green-200', 'border-green-300', 'border-green-400', 'border-green-500', 'border-green-600',
    'border-gray-200', 'border-gray-300', 'border-gray-400', 'border-gray-500', 'border-gray-600',
    'border-slate-200', 'border-slate-300', 'border-slate-400', 'border-slate-500', 'border-slate-600',
    'border-solid', 'border-dashed', 'border-dotted', 'border-double', 'border-none',
    'border-gray-200/50', 'dark:border-gray-800/50',

    // Border radius
    'rounded', 'rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-3xl', 'rounded-full',
    'rounded-t', 'rounded-r', 'rounded-b', 'rounded-l', 'rounded-tl', 'rounded-tr', 'rounded-bl', 'rounded-br',
    'rounded-t-sm', 'rounded-r-sm', 'rounded-b-sm', 'rounded-l-sm',
    'rounded-t-md', 'rounded-r-md', 'rounded-b-md', 'rounded-l-md',
    'rounded-t-lg', 'rounded-r-lg', 'rounded-b-lg', 'rounded-l-lg',
    'rounded-t-xl', 'rounded-r-xl', 'rounded-b-xl', 'rounded-l-xl',

    // Shadows and effects
    'shadow', 'shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-2xl', 'shadow-inner', 'shadow-none',
    'drop-shadow', 'drop-shadow-sm', 'drop-shadow-md', 'drop-shadow-lg', 'drop-shadow-xl', 'drop-shadow-2xl', 'drop-shadow-none',
    'shadow-red-500/50', 'shadow-blue-500/50', 'shadow-green-500/50', 'shadow-purple-500/50', 'shadow-pink-500/50',

    // Transitions and animations
    'transition', 'transition-none', 'transition-all', 'transition-colors', 'transition-opacity', 'transition-shadow', 'transition-transform',
    'duration-75', 'duration-100', 'duration-150', 'duration-200', 'duration-300', 'duration-500', 'duration-700', 'duration-1000',
    'ease-linear', 'ease-in', 'ease-out', 'ease-in-out',
    'delay-75', 'delay-100', 'delay-150', 'delay-200', 'delay-300', 'delay-500', 'delay-700', 'delay-1000',

    // Transforms
    'transform', 'transform-cpu', 'transform-gpu', 'transform-none',
    'scale-0', 'scale-50', 'scale-75', 'scale-90', 'scale-95', 'scale-100', 'scale-105', 'scale-110', 'scale-125', 'scale-150',
    'rotate-0', 'rotate-1', 'rotate-2', 'rotate-3', 'rotate-6', 'rotate-12', 'rotate-45', 'rotate-90', 'rotate-180',
    '-rotate-1', '-rotate-2', '-rotate-3', '-rotate-6', '-rotate-12', '-rotate-45', '-rotate-90', '-rotate-180',
    'translate-x-0', 'translate-x-1', 'translate-x-2', 'translate-x-4', 'translate-x-8', 'translate-x-16',
    'translate-y-0', 'translate-y-1', 'translate-y-2', 'translate-y-4', 'translate-y-8', 'translate-y-16',
    '-translate-x-1', '-translate-x-2', '-translate-x-4', '-translate-x-8', '-translate-x-16',
    '-translate-y-1', '-translate-y-2', '-translate-y-4', '-translate-y-8', '-translate-y-16',
    'skew-x-0', 'skew-x-1', 'skew-x-2', 'skew-x-3', 'skew-x-6', 'skew-x-12',
    'skew-y-0', 'skew-y-1', 'skew-y-2', 'skew-y-3', 'skew-y-6', 'skew-y-12',

    // Hover and focus states
    'hover:bg-red-500', 'hover:bg-blue-500', 'hover:bg-green-500', 'hover:bg-gray-500', 'hover:bg-slate-500',
    'hover:text-red-500', 'hover:text-blue-500', 'hover:text-green-500', 'hover:text-gray-500', 'hover:text-white',
    'hover:border-red-500', 'hover:border-blue-500', 'hover:border-green-500', 'hover:border-gray-500',
    'hover:shadow-md', 'hover:shadow-lg', 'hover:shadow-xl', 'hover:shadow-2xl',
    'hover:scale-105', 'hover:scale-110', 'hover:scale-95',
    'hover:rotate-1', 'hover:rotate-2', 'hover:rotate-3', 'hover:-rotate-1', 'hover:-rotate-2',
    'hover:translate-y-1', 'hover:-translate-y-1', 'hover:translate-y-2', 'hover:-translate-y-2',
    'focus:outline-none', 'focus:ring', 'focus:ring-2', 'focus:ring-4', 'focus:ring-blue-500', 'focus:ring-red-500', 'focus:ring-green-500',
    'focus:border-blue-500', 'focus:border-red-500', 'focus:border-green-500',

    // Gradients
    'bg-gradient-to-r', 'bg-gradient-to-l', 'bg-gradient-to-t', 'bg-gradient-to-b',
    'bg-gradient-to-tr', 'bg-gradient-to-tl', 'bg-gradient-to-br', 'bg-gradient-to-bl',
    'from-red-500', 'from-blue-500', 'from-green-500', 'from-yellow-500', 'from-purple-500', 'from-pink-500', 'from-gray-500',
    'via-red-500', 'via-blue-500', 'via-green-500', 'via-yellow-500', 'via-purple-500', 'via-pink-500', 'via-gray-500',
    'to-red-500', 'to-blue-500', 'to-green-500', 'to-yellow-500', 'to-purple-500', 'to-pink-500', 'to-gray-500',

    // Opacity
    'opacity-0', 'opacity-5', 'opacity-10', 'opacity-20', 'opacity-25', 'opacity-30', 'opacity-40', 'opacity-50',
    'opacity-60', 'opacity-70', 'opacity-75', 'opacity-80', 'opacity-90', 'opacity-95', 'opacity-100',

    // Spacing utilities
    'p-0', 'p-0.5', 'p-1', 'p-1.5', 'p-2', 'p-2.5', 'p-3', 'p-3.5', 'p-4', 'p-5', 'p-6', 'p-7', 'p-8', 'p-9', 'p-10', 'p-11', 'p-12', 'p-14', 'p-16', 'p-20', 'p-24', 'p-28', 'p-32',
    'm-0', 'm-0.5', 'm-1', 'm-1.5', 'm-2', 'm-2.5', 'm-3', 'm-3.5', 'm-4', 'm-5', 'm-6', 'm-7', 'm-8', 'm-9', 'm-10', 'm-11', 'm-12', 'm-14', 'm-16', 'm-20', 'm-24', 'm-28', 'm-32',
    'px-0', 'px-0.5', 'px-1', 'px-1.5', 'px-2', 'px-2.5', 'px-3', 'px-3.5', 'px-4', 'px-5', 'px-6', 'px-7', 'px-8', 'px-9', 'px-10', 'px-11', 'px-12', 'px-14', 'px-16', 'px-20', 'px-24',
    'py-0', 'py-0.5', 'py-1', 'py-1.5', 'py-2', 'py-2.5', 'py-3', 'py-3.5', 'py-4', 'py-5', 'py-6', 'py-7', 'py-8', 'py-9', 'py-10', 'py-11', 'py-12', 'py-14', 'py-16', 'py-20', 'py-24',
    'pt-0', 'pt-1', 'pt-2', 'pt-3', 'pt-4', 'pt-5', 'pt-6', 'pt-8', 'pt-10', 'pt-12', 'pt-16', 'pt-20', 'pt-24',
    'pb-0', 'pb-1', 'pb-2', 'pb-3', 'pb-4', 'pb-5', 'pb-6', 'pb-8', 'pb-10', 'pb-12', 'pb-16', 'pb-20', 'pb-24',
    'pl-0', 'pl-1', 'pl-2', 'pl-3', 'pl-4', 'pl-5', 'pl-6', 'pl-8', 'pl-10', 'pl-12', 'pl-16', 'pl-20', 'pl-24',
    'pr-0', 'pr-1', 'pr-2', 'pr-3', 'pr-4', 'pr-5', 'pr-6', 'pr-8', 'pr-10', 'pr-12', 'pr-16', 'pr-20', 'pr-24',
    'space-x-0', 'space-x-1', 'space-x-2', 'space-x-3', 'space-x-4', 'space-x-5', 'space-x-6', 'space-x-8', 'space-x-10', 'space-x-12',
    'space-y-0', 'space-y-1', 'space-y-2', 'space-y-3', 'space-y-4', 'space-y-5', 'space-y-6', 'space-y-8', 'space-y-10', 'space-y-12',
    'gap-0', 'gap-1', 'gap-2', 'gap-3', 'gap-4', 'gap-5', 'gap-6', 'gap-8', 'gap-10', 'gap-12', 'gap-16', 'gap-20', 'gap-24',

    // Layout utilities
    'block', 'inline-block', 'inline', 'flex', 'inline-flex', 'table', 'table-cell', 'table-row', 'grid', 'inline-grid', 'hidden',
    'flex-row', 'flex-row-reverse', 'flex-col', 'flex-col-reverse', 'flex-wrap', 'flex-wrap-reverse', 'flex-nowrap',
    'items-start', 'items-end', 'items-center', 'items-baseline', 'items-stretch',
    'justify-start', 'justify-end', 'justify-center', 'justify-between', 'justify-around', 'justify-evenly',
    'content-start', 'content-end', 'content-center', 'content-between', 'content-around', 'content-evenly',
    'self-auto', 'self-start', 'self-end', 'self-center', 'self-stretch', 'self-baseline',
    'flex-1', 'flex-auto', 'flex-initial', 'flex-none', 'grow', 'grow-0', 'shrink', 'shrink-0',
    'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-5', 'grid-cols-6', 'grid-cols-7', 'grid-cols-8', 'grid-cols-9', 'grid-cols-10', 'grid-cols-11', 'grid-cols-12',
    'grid-rows-1', 'grid-rows-2', 'grid-rows-3', 'grid-rows-4', 'grid-rows-5', 'grid-rows-6',
    'col-auto', 'col-span-1', 'col-span-2', 'col-span-3', 'col-span-4', 'col-span-5', 'col-span-6', 'col-span-7', 'col-span-8', 'col-span-9', 'col-span-10', 'col-span-11', 'col-span-12', 'col-span-full',
    'row-auto', 'row-span-1', 'row-span-2', 'row-span-3', 'row-span-4', 'row-span-5', 'row-span-6', 'row-span-full',

    // Sizing
    'w-0', 'w-0.5', 'w-1', 'w-1.5', 'w-2', 'w-2.5', 'w-3', 'w-3.5', 'w-4', 'w-5', 'w-6', 'w-7', 'w-8', 'w-9', 'w-10', 'w-11', 'w-12', 'w-14', 'w-16', 'w-20', 'w-24', 'w-28', 'w-32', 'w-36', 'w-40', 'w-44', 'w-48', 'w-52', 'w-56', 'w-60', 'w-64', 'w-72', 'w-80', 'w-96',
    'w-auto', 'w-px', 'w-full', 'w-screen', 'w-min', 'w-max', 'w-fit',
    'w-1/2', 'w-1/3', 'w-2/3', 'w-1/4', 'w-2/4', 'w-3/4', 'w-1/5', 'w-2/5', 'w-3/5', 'w-4/5', 'w-1/6', 'w-2/6', 'w-3/6', 'w-4/6', 'w-5/6',
    'h-0', 'h-0.5', 'h-1', 'h-1.5', 'h-2', 'h-2.5', 'h-3', 'h-3.5', 'h-4', 'h-5', 'h-6', 'h-7', 'h-8', 'h-9', 'h-10', 'h-11', 'h-12', 'h-14', 'h-16', 'h-20', 'h-24', 'h-28', 'h-32', 'h-36', 'h-40', 'h-44', 'h-48', 'h-52', 'h-56', 'h-60', 'h-64', 'h-72', 'h-80', 'h-96',
    'h-auto', 'h-px', 'h-full', 'h-screen', 'h-min', 'h-max', 'h-fit',
    'min-w-0', 'min-w-full', 'min-w-min', 'min-w-max', 'min-w-fit',
    'min-h-0', 'min-h-full', 'min-h-screen', 'min-h-min', 'min-h-max', 'min-h-fit',
    'max-w-0', 'max-w-none', 'max-w-xs', 'max-w-sm', 'max-w-md', 'max-w-lg', 'max-w-xl', 'max-w-2xl', 'max-w-3xl', 'max-w-4xl', 'max-w-5xl', 'max-w-6xl', 'max-w-7xl', 'max-w-full', 'max-w-min', 'max-w-max', 'max-w-fit', 'max-w-prose', 'max-w-screen-sm', 'max-w-screen-md', 'max-w-screen-lg', 'max-w-screen-xl', 'max-w-screen-2xl',
    'max-h-0', 'max-h-1', 'max-h-2', 'max-h-3', 'max-h-4', 'max-h-5', 'max-h-6', 'max-h-7', 'max-h-8', 'max-h-9', 'max-h-10', 'max-h-11', 'max-h-12', 'max-h-14', 'max-h-16', 'max-h-20', 'max-h-24', 'max-h-28', 'max-h-32', 'max-h-36', 'max-h-40', 'max-h-44', 'max-h-48', 'max-h-52', 'max-h-56', 'max-h-60', 'max-h-64', 'max-h-72', 'max-h-80', 'max-h-96', 'max-h-px', 'max-h-full', 'max-h-screen', 'max-h-min', 'max-h-max', 'max-h-fit',

    // Positioning
    'static', 'fixed', 'absolute', 'relative', 'sticky',
    'inset-0', 'inset-x-0', 'inset-y-0', 'top-0', 'right-0', 'bottom-0', 'left-0',
    'top-1', 'top-2', 'top-3', 'top-4', 'top-5', 'top-6', 'top-8', 'top-10', 'top-12', 'top-16', 'top-20', 'top-24',
    'right-1', 'right-2', 'right-3', 'right-4', 'right-5', 'right-6', 'right-8', 'right-10', 'right-12', 'right-16', 'right-20', 'right-24',
    'bottom-1', 'bottom-2', 'bottom-3', 'bottom-4', 'bottom-5', 'bottom-6', 'bottom-8', 'bottom-10', 'bottom-12', 'bottom-16', 'bottom-20', 'bottom-24',
    'left-1', 'left-2', 'left-3', 'left-4', 'left-5', 'left-6', 'left-8', 'left-10', 'left-12', 'left-16', 'left-20', 'left-24',
    'z-0', 'z-10', 'z-20', 'z-30', 'z-40', 'z-50', 'z-auto',

    // Typography
    'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'text-6xl', 'text-7xl', 'text-8xl', 'text-9xl',
    'font-thin', 'font-extralight', 'font-light', 'font-normal', 'font-medium', 'font-semibold', 'font-bold', 'font-extrabold', 'font-black',
    'italic', 'not-italic', 'uppercase', 'lowercase', 'capitalize', 'normal-case',
    'underline', 'overline', 'line-through', 'no-underline',
    'text-left', 'text-center', 'text-right', 'text-justify',
    'leading-3', 'leading-4', 'leading-5', 'leading-6', 'leading-7', 'leading-8', 'leading-9', 'leading-10', 'leading-none', 'leading-tight', 'leading-snug', 'leading-normal', 'leading-relaxed', 'leading-loose',
    'tracking-tighter', 'tracking-tight', 'tracking-normal', 'tracking-wide', 'tracking-wider', 'tracking-widest',

    // Responsive breakpoints for all the above
    'sm:block', 'sm:inline-block', 'sm:inline', 'sm:flex', 'sm:inline-flex', 'sm:grid', 'sm:hidden',
    'md:block', 'md:inline-block', 'md:inline', 'md:flex', 'md:inline-flex', 'md:grid', 'md:hidden',
    'lg:block', 'lg:inline-block', 'lg:inline', 'lg:flex', 'lg:inline-flex', 'lg:grid', 'lg:hidden',
    'xl:block', 'xl:inline-block', 'xl:inline', 'xl:flex', 'xl:inline-flex', 'xl:grid', 'xl:hidden',
    '2xl:block', '2xl:inline-block', '2xl:inline', '2xl:flex', '2xl:inline-flex', '2xl:grid', '2xl:hidden',
    'sm:text-xs', 'sm:text-sm', 'sm:text-base', 'sm:text-lg', 'sm:text-xl', 'sm:text-2xl', 'sm:text-3xl', 'sm:text-4xl', 'sm:text-5xl', 'sm:text-6xl', 'sm:text-7xl', 'sm:text-8xl', 'sm:text-9xl',
    'md:text-xs', 'md:text-sm', 'md:text-base', 'md:text-lg', 'md:text-xl', 'md:text-2xl', 'md:text-3xl', 'md:text-4xl', 'md:text-5xl', 'md:text-6xl', 'md:text-7xl', 'md:text-8xl', 'md:text-9xl',
    'lg:text-xs', 'lg:text-sm', 'lg:text-base', 'lg:text-lg', 'lg:text-xl', 'lg:text-2xl', 'lg:text-3xl', 'lg:text-4xl', 'lg:text-5xl', 'lg:text-6xl', 'lg:text-7xl', 'lg:text-8xl', 'lg:text-9xl',
    'xl:text-xs', 'xl:text-sm', 'xl:text-base', 'xl:text-lg', 'xl:text-xl', 'xl:text-2xl', 'xl:text-3xl', 'xl:text-4xl', 'xl:text-5xl', 'xl:text-6xl', 'xl:text-7xl', 'xl:text-8xl', 'xl:text-9xl',
    '2xl:text-xs', '2xl:text-sm', '2xl:text-base', '2xl:text-lg', '2xl:text-xl', '2xl:text-2xl', '2xl:text-3xl', '2xl:text-4xl', '2xl:text-5xl', '2xl:text-6xl', '2xl:text-7xl', '2xl:text-8xl', '2xl:text-9xl',
    'sm:p-1', 'sm:p-2', 'sm:p-3', 'sm:p-4', 'sm:p-5', 'sm:p-6', 'sm:p-8',
    'md:p-1', 'md:p-2', 'md:p-3', 'md:p-4', 'md:p-5', 'md:p-6', 'md:p-8', 'md:p-10',
    'lg:p-2', 'lg:p-3', 'lg:p-4', 'lg:p-5', 'lg:p-6', 'lg:p-8', 'lg:p-10', 'lg:p-12',
    'sm:w-full', 'sm:w-1/2', 'sm:w-1/3', 'sm:w-2/3', 'sm:w-1/4', 'sm:w-3/4',
    'md:w-full', 'md:w-1/2', 'md:w-1/3', 'md:w-2/3', 'md:w-1/4', 'md:w-3/4', 'md:w-64', 'md:w-72', 'md:w-80', 'md:w-96',
    'lg:w-full', 'lg:w-1/2', 'lg:w-1/3', 'lg:w-2/3', 'lg:w-1/4', 'lg:w-3/4', 'lg:w-64', 'lg:w-72', 'lg:w-80', 'lg:w-96',
    'xl:w-full', 'xl:w-1/2', 'xl:w-1/3', 'xl:w-2/3', 'xl:w-1/4', 'xl:w-3/4',

    // Additional Tailwind Preset Colors - Complete Sets
    // Orange
    'bg-orange-50', 'bg-orange-100', 'bg-orange-200', 'bg-orange-300', 'bg-orange-400', 'bg-orange-500', 'bg-orange-600', 'bg-orange-700', 'bg-orange-800', 'bg-orange-900',
    'text-orange-50', 'text-orange-100', 'text-orange-200', 'text-orange-300', 'text-orange-400', 'text-orange-500', 'text-orange-600', 'text-orange-700', 'text-orange-800', 'text-orange-900',
    'border-orange-200', 'border-orange-300', 'border-orange-400', 'border-orange-500', 'border-orange-600',
    'from-orange-400', 'from-orange-500', 'via-orange-400', 'via-orange-500', 'to-orange-400', 'to-orange-500',
    'hover:bg-orange-400', 'hover:bg-orange-500', 'hover:text-orange-500', 'hover:border-orange-500',

    // Emerald (complete variants)
    'text-emerald-50', 'text-emerald-100', 'text-emerald-200', 'text-emerald-300', 'text-emerald-400', 'text-emerald-500', 'text-emerald-600', 'text-emerald-700', 'text-emerald-800', 'text-emerald-900',
    'border-emerald-200', 'border-emerald-300', 'border-emerald-400', 'border-emerald-500', 'border-emerald-600',
    'from-emerald-400', 'from-emerald-500', 'via-emerald-400', 'via-emerald-500', 'to-emerald-400', 'to-emerald-500',
    'hover:bg-emerald-400', 'hover:bg-emerald-500', 'hover:text-emerald-500', 'hover:border-emerald-500',

    // Teal
    'bg-teal-50', 'bg-teal-100', 'bg-teal-200', 'bg-teal-300', 'bg-teal-400', 'bg-teal-500', 'bg-teal-600', 'bg-teal-700', 'bg-teal-800', 'bg-teal-900',
    'text-teal-50', 'text-teal-100', 'text-teal-200', 'text-teal-300', 'text-teal-400', 'text-teal-500', 'text-teal-600', 'text-teal-700', 'text-teal-800', 'text-teal-900',
    'border-teal-200', 'border-teal-300', 'border-teal-400', 'border-teal-500', 'border-teal-600',
    'from-teal-400', 'from-teal-500', 'via-teal-400', 'via-teal-500', 'to-teal-400', 'to-teal-500',
    'hover:bg-teal-400', 'hover:bg-teal-500', 'hover:text-teal-500', 'hover:border-teal-500',

    // Cyan
    'bg-cyan-50', 'bg-cyan-100', 'bg-cyan-200', 'bg-cyan-300', 'bg-cyan-400', 'bg-cyan-500', 'bg-cyan-600', 'bg-cyan-700', 'bg-cyan-800', 'bg-cyan-900',
    'text-cyan-50', 'text-cyan-100', 'text-cyan-200', 'text-cyan-300', 'text-cyan-400', 'text-cyan-500', 'text-cyan-600', 'text-cyan-700', 'text-cyan-800', 'text-cyan-900',
    'border-cyan-200', 'border-cyan-300', 'border-cyan-400', 'border-cyan-500', 'border-cyan-600',
    'from-cyan-400', 'from-cyan-500', 'via-cyan-400', 'via-cyan-500', 'to-cyan-400', 'to-cyan-500',
    'hover:bg-cyan-400', 'hover:bg-cyan-500', 'hover:text-cyan-500', 'hover:border-cyan-500',

    // Sky
    'bg-sky-50', 'bg-sky-100', 'bg-sky-200', 'bg-sky-300', 'bg-sky-400', 'bg-sky-500', 'bg-sky-600', 'bg-sky-700', 'bg-sky-800', 'bg-sky-900',
    'text-sky-50', 'text-sky-100', 'text-sky-200', 'text-sky-300', 'text-sky-400', 'text-sky-500', 'text-sky-600', 'text-sky-700', 'text-sky-800', 'text-sky-900',
    'border-sky-200', 'border-sky-300', 'border-sky-400', 'border-sky-500', 'border-sky-600',
    'from-sky-400', 'from-sky-500', 'via-sky-400', 'via-sky-500', 'to-sky-400', 'to-sky-500',
    'hover:bg-sky-400', 'hover:bg-sky-500', 'hover:text-sky-500', 'hover:border-sky-500',

    // Violet
    'bg-violet-50', 'bg-violet-100', 'bg-violet-200', 'bg-violet-300', 'bg-violet-400', 'bg-violet-500', 'bg-violet-600', 'bg-violet-700', 'bg-violet-800', 'bg-violet-900',
    'text-violet-50', 'text-violet-100', 'text-violet-200', 'text-violet-300', 'text-violet-400', 'text-violet-500', 'text-violet-600', 'text-violet-700', 'text-violet-800', 'text-violet-900',
    'border-violet-200', 'border-violet-300', 'border-violet-400', 'border-violet-500', 'border-violet-600',
    'from-violet-400', 'from-violet-500', 'via-violet-400', 'via-violet-500', 'to-violet-400', 'to-violet-500',
    'hover:bg-violet-400', 'hover:bg-violet-500', 'hover:text-violet-500', 'hover:border-violet-500',

    // Fuchsia
    'bg-fuchsia-50', 'bg-fuchsia-100', 'bg-fuchsia-200', 'bg-fuchsia-300', 'bg-fuchsia-400', 'bg-fuchsia-500', 'bg-fuchsia-600', 'bg-fuchsia-700', 'bg-fuchsia-800', 'bg-fuchsia-900',
    'text-fuchsia-50', 'text-fuchsia-100', 'text-fuchsia-200', 'text-fuchsia-300', 'text-fuchsia-400', 'text-fuchsia-500', 'text-fuchsia-600', 'text-fuchsia-700', 'text-fuchsia-800', 'text-fuchsia-900',
    'border-fuchsia-200', 'border-fuchsia-300', 'border-fuchsia-400', 'border-fuchsia-500', 'border-fuchsia-600',
    'from-fuchsia-400', 'from-fuchsia-500', 'via-fuchsia-400', 'via-fuchsia-500', 'to-fuchsia-400', 'to-fuchsia-500',
    'hover:bg-fuchsia-400', 'hover:bg-fuchsia-500', 'hover:text-fuchsia-500', 'hover:border-fuchsia-500',

    // Rose
    'bg-rose-50', 'bg-rose-100', 'bg-rose-200', 'bg-rose-300', 'bg-rose-400', 'bg-rose-500', 'bg-rose-600', 'bg-rose-700', 'bg-rose-800', 'bg-rose-900',
    'text-rose-50', 'text-rose-100', 'text-rose-200', 'text-rose-300', 'text-rose-400', 'text-rose-500', 'text-rose-600', 'text-rose-700', 'text-rose-800', 'text-rose-900',
    'border-rose-200', 'border-rose-300', 'border-rose-400', 'border-rose-500', 'border-rose-600',
    'from-rose-400', 'from-rose-500', 'via-rose-400', 'via-rose-500', 'to-rose-400', 'to-rose-500',
    'hover:bg-rose-400', 'hover:bg-rose-500', 'hover:text-rose-500', 'hover:border-rose-500',

    // Amber
    'bg-amber-50', 'bg-amber-100', 'bg-amber-200', 'bg-amber-300', 'bg-amber-400', 'bg-amber-500', 'bg-amber-600', 'bg-amber-700', 'bg-amber-800', 'bg-amber-900',
    'text-amber-50', 'text-amber-100', 'text-amber-200', 'text-amber-300', 'text-amber-400', 'text-amber-500', 'text-amber-600', 'text-amber-700', 'text-amber-800', 'text-amber-900',
    'border-amber-200', 'border-amber-300', 'border-amber-400', 'border-amber-500', 'border-amber-600',
    'from-amber-400', 'from-amber-500', 'via-amber-400', 'via-amber-500', 'to-amber-400', 'to-amber-500',
    'hover:bg-amber-400', 'hover:bg-amber-500', 'hover:text-amber-500', 'hover:border-amber-500',

    // Lime
    'bg-lime-50', 'bg-lime-100', 'bg-lime-200', 'bg-lime-300', 'bg-lime-400', 'bg-lime-500', 'bg-lime-600', 'bg-lime-700', 'bg-lime-800', 'bg-lime-900',
    'text-lime-50', 'text-lime-100', 'text-lime-200', 'text-lime-300', 'text-lime-400', 'text-lime-500', 'text-lime-600', 'text-lime-700', 'text-lime-800', 'text-lime-900',
    'border-lime-200', 'border-lime-300', 'border-lime-400', 'border-lime-500', 'border-lime-600',
    'from-lime-400', 'from-lime-500', 'via-lime-400', 'via-lime-500', 'to-lime-400', 'to-lime-500',
    'hover:bg-lime-400', 'hover:bg-lime-500', 'hover:text-lime-500', 'hover:border-lime-500',

    // Zinc
    'bg-zinc-50', 'bg-zinc-100', 'bg-zinc-200', 'bg-zinc-300', 'bg-zinc-400', 'bg-zinc-500', 'bg-zinc-600', 'bg-zinc-700', 'bg-zinc-800', 'bg-zinc-900',
    'text-zinc-50', 'text-zinc-100', 'text-zinc-200', 'text-zinc-300', 'text-zinc-400', 'text-zinc-500', 'text-zinc-600', 'text-zinc-700', 'text-zinc-800', 'text-zinc-900',
    'border-zinc-200', 'border-zinc-300', 'border-zinc-400', 'border-zinc-500', 'border-zinc-600',
    'from-zinc-400', 'from-zinc-500', 'via-zinc-400', 'via-zinc-500', 'to-zinc-400', 'to-zinc-500',
    'hover:bg-zinc-400', 'hover:bg-zinc-500', 'hover:text-zinc-500', 'hover:border-zinc-500',

    // Neutral
    'bg-neutral-50', 'bg-neutral-100', 'bg-neutral-200', 'bg-neutral-300', 'bg-neutral-400', 'bg-neutral-500', 'bg-neutral-600', 'bg-neutral-700', 'bg-neutral-800', 'bg-neutral-900',
    'text-neutral-50', 'text-neutral-100', 'text-neutral-200', 'text-neutral-300', 'text-neutral-400', 'text-neutral-500', 'text-neutral-600', 'text-neutral-700', 'text-neutral-800', 'text-neutral-900',
    'border-neutral-200', 'border-neutral-300', 'border-neutral-400', 'border-neutral-500', 'border-neutral-600',
    'from-neutral-400', 'from-neutral-500', 'via-neutral-400', 'via-neutral-500', 'to-neutral-400', 'to-neutral-500',
    'hover:bg-neutral-400', 'hover:bg-neutral-500', 'hover:text-neutral-500', 'hover:border-neutral-500',

    // Stone
    'bg-stone-50', 'bg-stone-100', 'bg-stone-200', 'bg-stone-300', 'bg-stone-400', 'bg-stone-500', 'bg-stone-600', 'bg-stone-700', 'bg-stone-800', 'bg-stone-900',
    'text-stone-50', 'text-stone-100', 'text-stone-200', 'text-stone-300', 'text-stone-400', 'text-stone-500', 'text-stone-600', 'text-stone-700', 'text-stone-800', 'text-stone-900',
    'border-stone-200', 'border-stone-300', 'border-stone-400', 'border-stone-500', 'border-stone-600',
    'from-stone-400', 'from-stone-500', 'via-stone-400', 'via-stone-500', 'to-stone-400', 'to-stone-500',
    'hover:bg-stone-400', 'hover:bg-stone-500', 'hover:text-stone-500', 'hover:border-stone-500',

    // Background utilities with opacity
    'bg-black/50', 'bg-black/60', 'bg-black/70', 'bg-black/75', 'bg-black/80', 'bg-black/90',
    'bg-white/50', 'bg-white/60', 'bg-white/70', 'bg-white/75', 'bg-white/80', 'bg-white/90',
    'dark:bg-gray-900/80',

    // Background clip and text effects
    'bg-clip-text', 'text-transparent',

    // Backdrop effects
    'backdrop-blur', 'backdrop-blur-sm', 'backdrop-blur-md', 'backdrop-blur-lg', 'backdrop-blur-xl',

    // Animation utilities
    'animate-bounce', 'animate-spin', 'animate-ping', 'animate-pulse',
    'animate-fade-in', 'animate-progress-indeterminate', 'animate-blob',
    'animation-delay-2000', 'animation-delay-4000',

    // Additional transform utilities
    'hover:scale-100', 'hover:scale-101', 'hover:scale-102', 'hover:scale-103', 'hover:scale-104', 'hover:scale-105',

    // Additional border radius
    'rounded-3xl',

    // Leading and tracking
    'leading-relaxed', 'leading-loose',

    // Flex utilities
    'flex-shrink-0', 'flex-grow-0',

    // Additional classes from ListingsFeed component
    // Layout and positioning
    'min-h-screen', 'fixed', 'inset-0', 'top-0', 'right-0', 'left-0', 'bottom-0',
    'z-50', 'z-[55]', 'z-[60]', 'relative', 'absolute',

    // Responsive grid breakpoints
    'md:grid-cols-2', 'lg:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-4',
    'lg:mr-[60%]',

    // Widths and heights
    'w-[60%]', 'h-screen', 'h-8', 'h-10', 'max-w-[800px]',

    // Spacing
    'mt-24', 'py-8', 'space-y-2',

    // Flex utilities
    'flex-col', 'items-center', 'justify-center', 'justify-between',

    // Text utilities
    'text-xl', 'text-sm', 'text-muted', 'text-text', 'font-bold',

    // Colors and backgrounds
    'bg-background', 'text-primary', 'text-muted',

    // Borders
    'border-l', 'border-border-base',

    // Shadows
    'shadow-2xl',

    // Transform and transition
    'transform', 'transition-all', 'duration-300',

    // Overflow
    'overflow-hidden', 'overflow-auto', 'overflow-scroll', 'overflow-x-auto', 'overflow-y-auto', 'overflow-x-hidden', 'overflow-y-hidden',

    // Pointer events and cursor
    'pointer-events-none', 'pointer-events-auto',
    'cursor-pointer', 'cursor-default', 'cursor-not-allowed', 'cursor-wait', 'cursor-text', 'cursor-move', 'cursor-grab', 'cursor-grabbing',

    // Select
    'select-none', 'select-text', 'select-all', 'select-auto',

    // Mobile breakpoints
    'md:w-1/2',

    // Slate gradient colors (for hero sections, backgrounds)
    'from-slate-50', 'from-slate-100', 'from-slate-200', 'from-slate-300', 'from-slate-400', 'from-slate-500', 'from-slate-600', 'from-slate-700', 'from-slate-800', 'from-slate-900',
    'via-slate-50', 'via-slate-100', 'via-slate-200', 'via-slate-300', 'via-slate-400', 'via-slate-500', 'via-slate-600', 'via-slate-700', 'via-slate-800', 'via-slate-900',
    'to-slate-50', 'to-slate-100', 'to-slate-200', 'to-slate-300', 'to-slate-400', 'to-slate-500', 'to-slate-600', 'to-slate-700', 'to-slate-800', 'to-slate-900',

    // Blue gradient extended (50-900 range)
    'from-blue-50', 'from-blue-100', 'from-blue-200', 'from-blue-300', 'from-blue-400', 'from-blue-600', 'from-blue-700', 'from-blue-800', 'from-blue-900',
    'via-blue-50', 'via-blue-100', 'via-blue-200', 'via-blue-300', 'via-blue-400', 'via-blue-600', 'via-blue-700', 'via-blue-800', 'via-blue-900',
    'to-blue-50', 'to-blue-100', 'to-blue-200', 'to-blue-300', 'to-blue-400', 'to-blue-600', 'to-blue-700', 'to-blue-800', 'to-blue-900',

    // Extended hover states for buttons and borders
    'hover:bg-blue-600', 'hover:bg-blue-700', 'hover:bg-blue-800',
    'hover:border-blue-300', 'hover:border-blue-400', 'hover:border-blue-600',

    // Active states for buttons
    'active:scale-90', 'active:scale-95', 'active:scale-100',

    // Additional text colors
    'text-blue-700', 'text-blue-800',

    // Semantic color classes (shadcn/ui theme system)
    'bg-background', 'text-foreground',
    'bg-card', 'text-card-foreground',
    'bg-popover', 'text-popover-foreground',
    'bg-primary', 'text-primary', 'text-primary-foreground', 'bg-primary/10', 'bg-primary/20', 'bg-primary/90', 'hover:bg-primary/90', 'hover:bg-primary/10',
    'bg-secondary', 'text-secondary-foreground',
    'bg-muted', 'text-muted-foreground', 'bg-muted/30', 'bg-muted/50',
    'bg-accent', 'text-accent-foreground', 'hover:bg-accent', 'hover:text-accent-foreground',
    'bg-destructive', 'text-destructive', 'text-destructive-foreground', 'bg-destructive/10', 'hover:bg-destructive/10',
    'border-border', 'border-input', 'border-primary', 'ring-ring', 'ring-border',
    'focus:ring-ring', 'focus:ring-offset-2', 'focus:ring-2',

    // Additional hover states
    'hover:bg-muted', 'hover:text-foreground', 'hover:opacity-80', 'hover:opacity-90',

    // Backdrop and blur effects
    'bg-black/50', 'backdrop-blur-sm', 'backdrop-blur', 'backdrop-blur-md', 'backdrop-blur-lg',

    // Purple gradients (for Expertise component)
    'from-purple-400', 'from-purple-500', 'from-purple-600',
    'via-purple-400', 'via-purple-500', 'via-purple-600',
    'to-purple-400', 'to-purple-500', 'to-purple-600',
    'hover:from-blue-600', 'hover:via-purple-600', 'hover:to-pink-600',

    // Pink gradients
    'from-pink-400', 'from-pink-500', 'from-pink-600',
    'to-pink-400', 'to-pink-500', 'to-pink-600',

    // Indigo colors and gradients (for Pricing component)
    'bg-indigo-50', 'bg-indigo-100', 'bg-indigo-200', 'bg-indigo-300', 'bg-indigo-400', 'bg-indigo-500', 'bg-indigo-600', 'bg-indigo-700', 'bg-indigo-800', 'bg-indigo-900',
    'text-indigo-50', 'text-indigo-100', 'text-indigo-200', 'text-indigo-300', 'text-indigo-400', 'text-indigo-500', 'text-indigo-600', 'text-indigo-700', 'text-indigo-800', 'text-indigo-900',
    'border-indigo-200', 'border-indigo-300', 'border-indigo-400', 'border-indigo-500', 'border-indigo-600',
    'from-indigo-50', 'from-indigo-100', 'from-indigo-200', 'from-indigo-300', 'from-indigo-400', 'from-indigo-500', 'from-indigo-600', 'from-indigo-700',
    'via-indigo-50', 'via-indigo-100', 'via-indigo-200', 'via-indigo-300', 'via-indigo-400', 'via-indigo-500', 'via-indigo-600',
    'to-indigo-50', 'to-indigo-100', 'to-indigo-200', 'to-indigo-300', 'to-indigo-400', 'to-indigo-500', 'to-indigo-600', 'to-indigo-700',
    'from-blue-50', 'to-indigo-50',
    'hover:from-blue-700', 'hover:to-indigo-700',

    // Slate dark backgrounds (for Benefits component)
    'bg-slate-800', 'bg-slate-900', 'bg-slate-950',
    'text-slate-100', 'text-slate-200', 'text-slate-300', 'text-slate-400',

    // Blue text colors
    'text-blue-400', 'text-blue-500', 'text-blue-600',

    // Leading utilities
    'leading-tight', 'leading-snug',

    // Hover transform
    'hover:transform',

    // Green badge colors
    'bg-green-500', 'bg-green-600', 'text-green-500', 'text-green-600',

    // Shadow utilities
    'hover:shadow-xl', 'shadow-xl',

    // FinalCTA component classes
    'py-20', 'py-24', 'py-28', 'py-32',
    'to-white', 'from-white',
    'sm:flex-row', 'sm:flex-col', 'sm:items-center', 'sm:justify-center',
    'hover:to-purple-700', 'hover:from-purple-700',
    'border-gray-300', 'border-gray-400',
    'hover:border-gray-400', 'hover:border-gray-300',
    'hover:text-gray-900', 'hover:text-gray-800', 'hover:text-gray-700',

    // Group hover utilities (for Expertise component gradient borders)
    'group-hover:from-blue-600', 'group-hover:via-purple-600', 'group-hover:to-pink-600',
    'group-hover:bg-gray-50', 'group-hover:bg-gray-100',

    // Arbitrary values for thin borders
    'p-[2px]', 'p-[1px]', 'p-[3px]',

    // Dark mode text colors (for FormBuilder and form inputs)
    'dark:text-gray-100', 'dark:text-gray-200', 'dark:text-gray-300', 'dark:text-gray-400', 'dark:text-gray-500',
    'dark:text-white', 'dark:text-slate-100', 'dark:text-slate-200', 'dark:text-slate-300', 'dark:text-slate-400',
    'dark:text-red-400', 'dark:text-red-500',
    'dark:text-green-400', 'dark:text-green-500',
    'dark:text-blue-400', 'dark:text-blue-500',

    // Dark mode backgrounds
    'dark:bg-gray-700', 'dark:bg-gray-800', 'dark:bg-gray-900', 'dark:bg-gray-950',
    'dark:bg-slate-700', 'dark:bg-slate-800', 'dark:bg-slate-900', 'dark:bg-slate-950',
    'dark:bg-zinc-800', 'dark:bg-zinc-900',

    // Dark mode borders
    'dark:border-gray-600', 'dark:border-gray-700', 'dark:border-gray-800',
    'dark:border-slate-600', 'dark:border-slate-700', 'dark:border-slate-800',

    // Dark mode placeholders
    'dark:placeholder-gray-400', 'dark:placeholder-gray-500', 'dark:placeholder-slate-400',

    // Dark mode focus states
    'dark:focus:border-blue-400', 'dark:focus:ring-blue-400',

    // Dark mode hover states
    'dark:hover:bg-gray-700', 'dark:hover:bg-gray-800',
    'dark:hover:text-gray-200', 'dark:hover:text-white',

    // Semantic color classes for FormBuilder (theme-aware)
    'text-foreground', 'bg-foreground',
    'text-muted-foreground', 'bg-muted-foreground',
    'placeholder:text-muted-foreground',
    'border-input', 'focus:ring-ring', 'focus-visible:ring-ring',

    // Dark mode for SelectInput
    'dark:bg-gray-800', 'dark:bg-gray-900', 'dark:bg-gray-950',
    'dark:text-gray-100', 'dark:text-gray-200', 'dark:text-gray-400',
    'dark:border-gray-600', 'dark:border-gray-700',
    'dark:hover:border-gray-500', 'dark:hover:bg-gray-800',
    'dark:shadow-gray-950/50',
    'dark:bg-blue-900', 'dark:text-blue-200', 'dark:text-blue-100', 'dark:text-blue-400',
    'dark:hover:bg-blue-800', 'dark:bg-blue-900/50', 'dark:focus:bg-gray-800'
  ],
  darkMode: 'class', // or 'media' if you prefer system settings
  theme: {
    extend: {
      colors: {
        // shadcn/ui Colors (keeping these as primary system)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },

        // JasonJS Theme Colors (renamed to avoid conflicts)
        'jason-primary': 'var(--colors-primary)',
        'jason-secondary': 'var(--colors-secondary)',
        'jason-background': 'var(--colors-background)',
        'jason-text': 'var(--colors-text)',
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        sans: 'var(--fontFamily-sans)',
        heading: 'var(--fontFamily-heading)',
      },
      fontWeight: {
        heading: 'var(--fontWeight-heading)',
      },
      borderRadius: {
        DEFAULT: 'var(--borderRadius-DEFAULT)',
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      animation: {
        shimmer: "shimmer 2s linear infinite",
        carousel: 'carousel 60s linear infinite',
        spin: 'spin 2s linear infinite',
        'gradient-x': 'gradient-x 6s ease infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'progress-indeterminate': 'progress-indeterminate 1.5s ease-in-out infinite',
        blob: 'blob 7s infinite',
      },
      keyframes: {
        shimmer: {
          from: { backgroundPosition: "0 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        carousel: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        spin: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'gradient-x': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        "shine-pulse": {
          "0%": {
            "background-position": "0% 0%",
          },
          "50%": {
            "background-position": "100% 100%",
          },
          to: {
            "background-position": "0% 0%",
          },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'progress-indeterminate': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' },
        },
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
      },
      aspectRatio: {
        'w-16': '16',
        'h-9': '9',
      },
      animationDelay: {
        '2000': '2s',
        '4000': '4s',
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require('@tailwindcss/typography'),
    addVariablesForColors,
    require('@tailwindcss/aspect-ratio'),
  ],
};

// This plugin adds each Tailwind color as a global CSS variable, e.g. var(--gray-200).
// Also adds RGB triplet variants (e.g. --gray-200-rgb: 229 231 235) for opacity composability.
function addVariablesForColors({ addBase, theme }) {
  let allColors = flattenColorPalette(theme("colors"));
  let newVars = {};

  for (const [key, val] of Object.entries(allColors)) {
    newVars[`--${key}`] = val;
    // Generate RGB triplet for hex colors (enables `rgb(var(--cyan-500-rgb) / 0.3)`)
    if (typeof val === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(val)) {
      const hex = val.length === 4
        ? `#${val[1]}${val[1]}${val[2]}${val[2]}${val[3]}${val[3]}`
        : val;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        newVars[`--${key}-rgb`] = `${r} ${g} ${b}`;
      }
    }
  }

  addBase({
    ":root": newVars,
  });
}
