// DynamicBackground.jsx
'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const AuroraBackground = dynamic(() => import('@/components/user/ui/AuroraBackground').then(mod => mod.default), { });
const BackgroundBeams = dynamic(() => import('@/components/user/ui/BackgroundBeams').then(mod => mod.default), { });
const BackgroundBeamsWithCollision = dynamic(() => import('@/components/user/ui/BackgroundBeamsWithCollision').then(mod => mod.default), { });
const BackgroundBoxes = dynamic(() => import('@/components/user/ui/BackgroundBoxes').then(mod => mod.default), { });
const Vortex = dynamic(() => import('@/components/user/ui/vortex').then(mod => mod.default), { });
const WavyBackground = dynamic(() => import('@/components/user/ui/wavy-background').then(mod => mod.WavyBackground), { });

const DynamicBackground = ({ type, color, wavyColors, image, children }) => {
  switch (type) {
    case 'aurora':
      return <AuroraBackground image={image}>{children}</AuroraBackground>;
    case 'beams':
      return <BackgroundBeams image={image}>{children}</BackgroundBeams>;
    case 'beamsCollision':
      return <BackgroundBeamsWithCollision image={image}>{children}</BackgroundBeamsWithCollision>;
    case 'boxes':
      return <BackgroundBoxes image={image}>{children}</BackgroundBoxes>;
    case 'vortex':
      return (
        <Vortex
          backgroundColor={color || 'transparent'}
          particleCount={464}
          rangeY={164}
          rangeSpeed={0.01}
          baseSpeed={0.1}
          baseRadius={1}
          containerClassName="absolute inset-0"
        >
          {children}
        </Vortex>
      );
    case 'wavy':
      return (
        <WavyBackground
          colors={wavyColors || ['#38bdf8', '#818cf8', '#c084fc', '#e879f9', '#22d3ee']}
          waveOpacity={0.5}
          blur={10}
          speed="fast"
          waveWidth={50}
          backgroundFill={color || 'transparent'}
          containerClassName="absolute inset-0"
        >
          {children}
        </WavyBackground>
      );
    default:
      return null;
  }
};

export default DynamicBackground;