"use client";
import React from "react";
import Image from "next/image";

const FeatureGradient = ({ jcontext, props }) => {
  // Destructure props, use default values if not provided
  const { items = [] } = props || {};

  if (items.length === 0) {
    return null; // Don't render anything if there are no items
  }

  return (
    <div className="container mx-auto px-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {items.map((item, index) => (
          <div key={index} className="rounded-[22px] max-w-sm p-4 sm:p-6 bg-white dark:bg-zinc-900 shadow-lg">
            {item.imageSrc && (
              <Image
                src={item.imageSrc}
                alt={item.imageAlt || ''}
                height={200}
                width={200}
                className="object-contain mx-auto"
              />
            )}
            {item.title && (
              <p className="text-base sm:text-lg text-black mt-4 mb-2 dark:text-neutral-200">
                {item.title}
              </p>
            )}
            {item.description && (
              <p className="text-sm text-neutral-600 dark:text-neutral-400 h-20 overflow-hidden">
                {item.description}
              </p>
            )}
            {item.buttonLabel && (
              <button className="rounded-full pl-4 pr-1 py-1 text-white flex items-center space-x-1 bg-black mt-4 text-xs font-bold dark:bg-zinc-800">
                <span>{item.buttonLabel}</span>
                {item.buttonPrice && (
                  <span className="bg-zinc-700 rounded-full text-[0.6rem] px-2 py-0 text-white">
                    {item.buttonPrice}
                  </span>
                )}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeatureGradient;

/* 
Example JSON configuration for this component:
{
  "component": "FeatureGradient",
  "attributes": {
    "props": {
      "items": [
        {
          "imageSrc": "/product1.webp",
          "imageAlt": "Product 1",
          "title": "Product 1 Title",
          "description": "Description for Product 1",
          "buttonLabel": "Buy Now",
          "buttonPrice": "$99.99"
        },
        {
          "title": "Product 2 Title",
          "description": "Description for Product 2"
        },
        {
          "imageSrc": "/product3.webp",
          "imageAlt": "Product 3",
          "title": "Product 3 Title",
          "buttonLabel": "Learn More"
        }
      ]
    }
  }
}
*/