"use client";
import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import CanvasRevealEffect from "@/components/user/ui/canvas-reveal-effect";


// Example of input test data for component preview and testing
export const testInputData = {
  props: {
    cards: [
      {
        cover: "CM",
        title: "Crypto Mining",
        text: "Explore the world of cryptocurrency mining.",
      },
      {
        cover: "AI",
        title: "Artificial Intelligence",
        text: "Discover the power of AI in modern applications.",
        animationSpeed: 3,
        containerClassName: "bg-indigo-600",
        colors: [[79, 70, 229]],
      },
      {
        cover: "VR",
        title: "Virtual Reality",
        text: "Immerse yourself in virtual worlds.",
        hasRadialGradient: true,
      },
    ]
  }
};

const FtCard = ({ 
  cover, 
  title, 
  text,
  animationSpeed = 4,
  containerClassName = "bg-transparent",
  colors = [
    [236, 72, 153],
    [232, 121, 249],
  ],
  dotSize = 2,
  hasRadialGradient = true
}) => {
  const [hovered, setHovered] = React.useState(false);
  
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ borderRadius: `calc(1.75rem * 0.96)` }}
      className="border border-white/[0.2] group/canvas-card flex items-center justify-center max-w-sm w-full mx-auto p-4 relative h-[24rem] "
    >
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full w-full absolute inset-0"
          >
            <CanvasRevealEffect
              animationSpeed={animationSpeed}
              containerClassName={containerClassName}
              colors={colors}
              dotSize={dotSize}
            />
            
            <div className="absolute inset-0 [mask-image:radial-gradient(400px_at_center,white,transparent)] bg-pink/50 dark:bg-white/90" />
            
          </motion.div>
        )}
      </AnimatePresence>
      <div className="relative z-20 text-center">
        <motion.div 
          className="text-3xl font-bold  transition-all duration-300"
          animate={hovered ? { scale: 0.8, y: -20, opacity: 0 } : { scale: 1, y: 0, opacity: 1 }}
        >
          {cover}
        </motion.div>
        <motion.h2 
          className="text-2xl font-bold mb-2 transition-all duration-300"
          initial={{ opacity: 0, y: 20 }}
          animate={hovered ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        >
          {title}
        </motion.h2>
        <motion.p 
          className="text-md transition-all duration-300"
          initial={{ opacity: 0, y: 20 }}
          animate={hovered ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        >
          {text}
        </motion.p>
      </div>
    </div>
  );
};

const FeatureReveal = ({ jcontext, props }) => {
  const { cards = testInputData.props.cards } = props || {};

  return (
    <>
        <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-indigo-600">Deploy faster</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-white-900 sm:text-4xl">Abracemos el Futuro</p>
            <p className="mt-6 text-lg leading-8 text-gray-200">Trabajamos en comunidad para llevar la tecnología a todos los rincones del país.</p>
        </div>
        <div className="py-20 flex flex-col lg:flex-row items-center justify-center bg-transparent dark:bg-black w-full gap-4 mx-auto px-8">
        {cards.map((card, index) => (
            <FtCard key={index} {...card} />
        ))}
        </div>
    </>
  );
};


export default FeatureReveal;

/* 
Example JSON configuration for this component:
{
  "component": "FeatureReveal",
  "attributes": {
    "props": {
      "cards": [
        {
          "cover": "BTC",
          "title": "Bitcoin",
          "text": "The world's first cryptocurrency."
        },
        {
          "cover": "ETH",
          "title": "Ethereum",
          "text": "Programmable blockchain for smart contracts.",
          "animationSpeed": 3,
          "containerClassName": "bg-blue-600",
          "colors": [[59, 130, 246]],
          "hasRadialGradient": true
        },
        {
          "cover": "SOL",
          "title": "Solana",
          "text": "High-performance blockchain for DeFi and NFTs.",
          "containerClassName": "bg-purple-600",
          "colors": [[147, 51, 234]]
        }
      ]
    }
  }
}
*/