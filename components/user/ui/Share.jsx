// components/Share.jsx
'use client';

import React from 'react';
import * as ReactShare from 'react-share';

const Share = ({ url, title, networks }) => {
  const iconSize = 32;

  return (
    <div className="flex space-x-2">
      {networks.map((network) => {
        const ButtonComponent = ReactShare[`${network.charAt(0).toUpperCase() + network.slice(1)}ShareButton`];
        const IconComponent = ReactShare[`${network.charAt(0).toUpperCase() + network.slice(1)}Icon`];

        if (!ButtonComponent || !IconComponent) {
          console.warn(`Sharing network "${network}" is not supported.`);
          return null;
        }

        return (
          <ButtonComponent key={network} url={url} title={title}>
            <IconComponent size={iconSize} round />
          </ButtonComponent>
        );
      })}
    </div>
  );
};

export default Share;