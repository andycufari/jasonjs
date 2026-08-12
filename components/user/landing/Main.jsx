// studio/components/landing/Main.jsx
import React from 'react';

const Main = ({ jcontext, children }) => {
  // No need to destructure theme from jcontext.theme, it should be directly in jcontext
  const { theme } = jcontext;

  // We don't need to generate dynamic classes based on theme anymore
  // Our Tailwind config now uses CSS variables for these values

  return (
    <main className="min-h-screen bg-background text-text font-sans">
      {children}
    </main>
  );
};

export default Main;