// components/PartnersCarousel.jsx
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

const PartnersCarousel = ({ props }) => {
  const {
    partners,
    sectionPadding = 'py-20',
    bgColor = 'bg-white',
    animate = true,
    gray = false,
    squared = false,
    squaredStyle = 'bright',
    title = '',
    titleFont = 'font-sans',
    titleClasses = 'text-2xl font-bold mb-8'
  } = props;

  const getImageClass = () => {
    let classes = ' max-w-24 h-auto transition-all duration-300 ease-in-out';
    if (gray) classes += ' grayscale hover:grayscale-0';
    if (squared) {
      classes += ' p-2';
      classes += squaredStyle === 'bright' ? ' bg-white' : ' bg-gray-100';
    }
    return classes;
  };

  const carouselClasses = animate 
    ? 'animate-carousel flex space-x-8 overflow-hidden'
    : 'flex flex-wrap justify-center items-center';

  return (
    <section className={`${bgColor} ${sectionPadding}`}>
      <div className="container mx-auto px-4">
        {title && (
          <h2 className={`text-center ${titleFont} ${titleClasses}`}>
            {title}
          </h2>
        )}
        <div className={carouselClasses}>
          {partners.map((partner, index) => (
            <div key={index} className={animate ? 'flex-shrink-0' : 'mx-4 my-2'}>
              {partner.link ? (
                <Link href={partner.link} target="_blank" className="focus:outline-none">
                  <Image
                    src={partner.src}
                    alt={`Partner ${index + 1}`}
                    width={200}
                    height={100}
                    objectFit="contain"
                    className={getImageClass()}
                  />
                </Link>
              ) : (
                <Image
                  src={partner.src}
                  alt={`Partner ${index + 1}`}
                  width={200}
                  height={80}
                  objectFit="contain"
                  className={getImageClass()}
                />
              )}
            </div>
          ))}
          {animate && partners.map((partner, index) => (
            <div key={`repeat-${index}`} className="flex-shrink-0">
              {partner.link ? (
                <Link href={partner.link} target="_blank" className="focus:outline-none">
                  <Image
                    src={partner.src}
                    alt={`Partner ${index + 1}`}
                    width={200}
                    height={80}
                    objectFit="contain"
                    className={getImageClass()}
                  />
                </Link>
              ) : (
                <Image
                  src={partner.src}
                  alt={`Partner ${index + 1}`}
                  width={200}
                  height={80}
                  objectFit="contain"
                  className={getImageClass()}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PartnersCarousel;