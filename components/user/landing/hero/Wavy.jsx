import React from "react";
import WavyBackground from "@/components/user/ui/wavy-background";
import Link from "next/link";

function WavyBackgroundDemo({ badge, title, subtitle, button = null, config = null }) {
  return (
    <WavyBackground 
      className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-20 md:py-32" 
      {...config}
    >
      <div className="max-w-4xl mx-auto text-center">
        {badge && (
         <h1 className="text-3xl md:text-4xl lg:text-6xl text-white font-bold inter-var mb-10">
              {badge}
            </h1>
        )}
        <h1 className="text-3xl md:text-4xl lg:text-6xl text-white font-bold inter-var mb-20">
          {title}
        </h1>
        <p className="text-lg md:text-xl lg:text-2xl text-white font-normal inter-var mb-20">
          {subtitle}
        </p>
        {button && (
          <div className="mt-8">
            <Link href={button.href} className={button.className || 'px-8 py-3 md:px-12 md:py-4 rounded-full bg-blue-950 font-bold text-white text-sm md:text-base tracking-wider uppercase transform hover:scale-105 hover:bg-blue-400 transition-all duration-200 outline outline-offset-2 outline-blue-100 inline-block'}>
              {button.label}
            </Link>
          </div>
        )}
      </div>
    </WavyBackground>
  );
}

export default WavyBackgroundDemo;