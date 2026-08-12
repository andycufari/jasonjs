import React from "react";
import Vortex from "@/components/user/ui/vortex";
import Button from "./Button";
import MovingButton from "./MovingButton";

// Example of input test data for component preview and testing
export const testInputData = {
  props: {
    title: 'Club Argentino de Tecnología',
    paragraph: '🇦🇷 Democratizamos el Acceso a la Innovación Bit a Bit 🇦🇷',
    button1: { label: 'Sumate', href: '#' },
    button2: { label: 'Saber más', href: '#' },
  },
};

const HeroVortex = ({ jcontext, props }) => {
  // Destructure props, use default values from testInputData if not provided
  const {
    title = testInputData.props.title,
    paragraph = testInputData.props.paragraph,
    button1 = testInputData.props.button1,
    button2 = testInputData.props.button2,
  } = props || {};

  return (
    <div className="w-[calc(100%-4rem)] mx-auto rounded-md  h-screen overflow-hidden">
      <Vortex
        backgroundColor="transparent"
        rangeY={164}
        particleCount={464}
        rangeSpeed={0.01}
        baseSpeed={0.1}
        baseRadius={1}
        className="flex items-center flex-col justify-center px-2 md:px-8 py-4 w-full h-full">
        <h1 className="text-white text-3xl md:text-6xl font-bold text-center">{title}</h1>
        <p className="text-white text-sm md:text-3xl max-w-xl mt-6 text-center">{paragraph}</p>
        <div className="flex flex-col sm:flex-row items-center gap-4 mt-6">
          <MovingButton props={button1} />
          {button2 && (
            <a href={button2.href} className="px-4 py-2 text-white">
              {button2.label}
            </a>
          )}
        </div>
      </Vortex>
    </div>
  );
};

export default HeroVortex;

/* 
Example JSON configuration for this component:
{
  "component": "CatHero",
  "attributes": {
    "props": {
      "title": "Custom Title",
      "paragraph": "Custom paragraph text.",
      "button1": { "label": "Join Us", "href": "/join" },
      "button2": { "label": "Learn More", "href": "/learn" }
    }
  }
}
*/