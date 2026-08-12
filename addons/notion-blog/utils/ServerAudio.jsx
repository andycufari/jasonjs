// components/plugins/notion-blog/utils/ServerAudio.jsx
'use client';

import { useState, useRef, useEffect } from 'react';

export default function ServerAudio({ src, className, preload = "metadata" }) {
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const audioRef = useRef(null);

  // Framework's Notion connector already handles audio proxying
  // No need to process the URL again
  const finalSrc = src;

  const handleError = (e) => {
    console.error(`Failed to load audio:`, e);
    setIsError(true);
    setIsLoading(false);
  };

  const handleCanPlay = () => {
    setIsLoading(false);
  };

  if (!src) return null;

  if (isError) {
    return (
      <div className={`p-4 bg-gray-800/50 rounded-lg text-center ${className}`}>
        <div className="text-red-400 flex items-center justify-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span>Audio file could not be loaded</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="animate-pulse flex space-x-1">
            <div className="h-2 w-1 bg-blue-400 rounded-full"></div>
            <div className="h-3 w-1 bg-blue-400 rounded-full"></div>
            <div className="h-4 w-1 bg-blue-400 rounded-full"></div>
            <div className="h-3 w-1 bg-blue-400 rounded-full"></div>
            <div className="h-2 w-1 bg-blue-400 rounded-full"></div>
          </div>
        </div>
      )}
      {finalSrc && (
        <audio
          ref={audioRef}
          className="w-full"
          controls
          preload={preload}
          onError={handleError}
          onCanPlay={handleCanPlay}
        >
          <source src={finalSrc} type="audio/mpeg" />
          <source src={finalSrc} type="audio/mp3" />
          <source src={finalSrc} type="audio/wav" />
          <source src={finalSrc} type="audio/ogg" />
          Your browser does not support the audio element.
        </audio>
      )}
    </div>
  );
}
