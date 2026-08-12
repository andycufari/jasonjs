// components/plugins/notion-blog/utils/ServerImage.jsx
'use client';

import Image from 'next/image';
import { useState } from 'react';

export default function ServerImage({ src, alt, className, sizes = "100vw", priority = false }) {
  const [isError, setIsError] = useState(false);

  if (!src) return null;

  // Framework's Notion connector already handles image proxying
  // No need to process the URL again
  const finalSrc = src;

  const handleError = () => {
    console.error(`Failed to load image: ${finalSrc}`);
    setIsError(true);
  };

  if (isError) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100`}>
        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
        </svg>
      </div>
    );
  }

  return (
    <Image
      src={finalSrc}
      alt={alt || ''}
      className={className}
      fill
      sizes={sizes}
      priority={priority}
      loading={priority ? 'eager' : 'lazy'}
      quality={75}
      onError={handleError}
    />
  );
}
