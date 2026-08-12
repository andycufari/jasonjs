// components/SideFeature.jsx
import React from 'react';
import Image from 'next/image';
import { WobbleCard } from "@/components/user/ui/wobble-card";
import Button from './Button';
import Link from 'next/link';
// Lightweight utility function to replace randomId
const randomId = () => Math.random().toString(36).substring(2, 15);

const SideFeature = ({ props }) => {
  const { 
    id = null,
    title, 
    titleColor = 'text-white',
    titleFont = 'font-sans',
    text, 
    textColor = 'text-gray-300',
    image, 
    bgColor = 'bg-gray-900', 
    imageFx = null, 
    imageWidth = '100%',
    imageHeight = '244px',
    imagePadding = '0px',
    orientation = 'left',
    sectionPadding = 'py-20',
    titleSize = 'text-3xl',
    textSize = 'text-base',
    cta = null
  } = props;

  const processText = (text) => {
    const createMarkup = (html) => ({ __html: html });

    return (
      <div 
        className={`${textColor} ${textSize} leading-relaxed`}
        dangerouslySetInnerHTML={createMarkup(text.replace(
          /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/g,
          '<a class="text-blue-400 hover:underline" href="$2" target="_blank" rel="noopener noreferrer"'
        ))}
      />
    );
  };

  const imageStyle = {
    width: imageWidth,
    height: imageHeight,
    padding: imagePadding,
  };

  const ImageComponent = () => (
    <div style={imageStyle} className="relative overflow-hidden">
      <Image
        src={image}
        alt={`Illustration for ${title}`}
        layout="fill"
        objectFit="cover"
        className="rounded-lg"
      />
    </div>
  );

  const TextContent = () => (
    <div className="w-full lg:w-5/12 lg:pr-8 mb-8 lg:mb-0">
      <h2 
        id={`feature-${title.replace(/\s+/g, '-').toLowerCase()}`}
        className={`${titleSize} font-bold mb-4 ${titleColor} ${titleFont}`}
      >
        {title}
      </h2>
      {processText(text)}
      {cta && (
        <div className="mt-6">
          <Button
            href={cta.href}
            type={cta.type || 'default'}
            bgColor={cta.bgColor || 'bg-blue-500'}
            textColor={cta.textColor || 'text-white'}
            className={cta.className || ''}
          >
            {cta.label}
          </Button>
        </div>
      )}
    </div>
  );

  const ImageContent = () => (
    <div className="w-full lg:w-6/12">
      {imageFx === 'wobble' ? (
        <WobbleCard containerClassName="w-full h-full">
          <ImageComponent />
        </WobbleCard>
      ) : (
        <ImageComponent />
      )}
    </div>
  );

  return (
    <section id={id} className={`${bgColor} ${sectionPadding}`} aria-labelledby={`feature-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      <div className="container mx-auto px-4">
        <div className={`flex flex-col lg:flex-row items-start lg:items-center justify-between ${orientation === 'right' ? 'lg:flex-row-reverse' : ''}`}>
          <TextContent />
          <ImageContent />
        </div>
      </div>
    </section>
  );
};

export default SideFeature;