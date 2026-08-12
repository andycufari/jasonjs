// components/landing/VideoBackground.jsx
'use client';

import React, { useEffect, useRef, useState } from 'react';

const VideoBackground = ({ videoSrc, posterImage }) => {
  const videoRef = useRef(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const video = videoRef.current;
          if (video) {
            video.src = videoSrc;
            video.load();
          }
          observer.unobserve(entry.target);
        }
      });
    }, options);

    if (videoRef.current) {
      observer.observe(videoRef.current);
    }

    return () => {
      if (videoRef.current) {
        observer.unobserve(videoRef.current);
      }
    };
  }, [videoSrc]);

  const handleVideoLoad = () => {
    setIsVideoLoaded(true);
  };

  return (
    <div className="absolute inset-0 overflow-hidden">
      <video 
        ref={videoRef}
        autoPlay 
        loop 
        muted 
        playsInline 
        poster={posterImage}
        onLoadedData={handleVideoLoad}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
          isVideoLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default VideoBackground;