// components/landing/Hero.jsx
import React from 'react';
import dynamic from 'next/dynamic';
import VideoBackground from './VideoBackground';
import Button from './Button';
import Link from 'next/link';

// Dynamically import client-side components
const AuroraBackground = dynamic(() => import('../../user/ui/AuroraBackground'));
const BackgroundBeams = dynamic(() => import('../../user/ui/BackgroundBeams'));
const BackgroundBeamsWithCollision = dynamic(() => import('../../user/ui/BackgroundBeamsWithCollision'));
const BackgroundBoxes = dynamic(() => import('../../user/ui/BackgroundBoxes'));

const Hero = ({ theme, props }) => {
  const {
    layout = 'left',
    title,
    subtitle,
    cta,
    image = null,
    video,
    backgroundColor,
    textColor,
    containerSize = 'xl',
    bgFx = 'default',
    titleTheme = 'default',
    heroImageClasses = 'absolute inset-0 w-full h-full object-cover',
    sectionClasses = 'relative min-h-screen flex items-center justify-center overflow-hidden'
  } = props;

  const bgStyle = {
    backgroundColor: backgroundColor || 'transparent',
    color: textColor || 'inherit'
  };

  const renderBackground = () => {
    if (video) {
      return <VideoBackground videoSrc={video} posterImage={image} />;
    } else if (bgFx !== 'default') {
      switch (bgFx) {
        case 'aurora':
          return <AuroraBackground image={image} />;
        case 'beams':
          return <BackgroundBeams image={image} />;
        case 'beamsCollision':
          return <BackgroundBeamsWithCollision image={image} />;
        case 'backgroundBoxes':
          return <BackgroundBoxes image={image} />;
        default:
          return null;
      }
    } else if (image) {
      return (
        <img
          src={image}
          alt=""
          className={heroImageClasses}
        />
      );
    }
    return null;
  };

  const containerClasses = {
    sm: 'max-w-screen-sm',
    md: 'max-w-screen-md',
    lg: 'max-w-screen-lg',
    xl: 'max-w-screen-xl',
    '2xl': 'max-w-screen-2xl',
    full: 'max-w-full',
  };

  const getTitleClasses = () => {
    const baseClasses = "font-extrabold tracking-tight mb-4 max-w-screen-lg mx-auto";
    switch (titleTheme) {
      case 'gradient':
        return `${baseClasses} text-4xl sm:text-5xl md:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-purple-500 via-violet-500 to-pink-500`;
      case 'outlined':
        return `${baseClasses} text-4xl sm:text-5xl md:text-6xl text-transparent stroke-white fill-transparent`;
      default:
        return `${baseClasses} text-4xl sm:text-5xl md:text-6xl text-white`;
    }
  };

  return (
    <section 
      className={sectionClasses}
      style={bgStyle}
    >
      {renderBackground()}
      {bgFx === 'default' && <div className="absolute inset-0 bg-black bg-opacity-50 z-10"></div>}
      <div className={`relative z-20 w-full ${containerClasses[containerSize]} mx-auto px-4 sm:px-6 lg:px-8`}>
        <div className={`text-center ${layout === 'left' ? 'text-left' : layout === 'right' ? 'text-right' : ''}`}>
          {title && (
            <h1 className={getTitleClasses()}>
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="mt-3 text-base sm:text-lg md:mt-5 md:text-xl text-gray-300 max-w-prose mx-auto">
              {subtitle}
            </p>
          )}
          {cta && (
            <div className={`mt-5 ${layout !== 'center' ? '' : 'flex justify-center'}`}>
            <Link href={cta.href} passHref>
              <Button
                as="a"
                type={cta.type || 'default'}
                bgColor={cta.bgColor || 'bg-secondary'}
                textColor={cta.textColor || 'text-white'}
              >
                {cta.label}
              </Button>
            </Link>
          </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Hero;