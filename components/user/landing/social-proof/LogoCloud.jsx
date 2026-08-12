'use client';
import { motion } from 'framer-motion';

export default function LogoCloud({
  // Content
  title = "Trusted by innovative companies worldwide",
  subtitle = "",
  logos = [],
  
  // Visual
  variant = "default", // default, carousel, grid, minimal
  showCount = true,
  companyCount = "500+",
  
  // Animation
  autoplay = true,
  speed = 30, // seconds for full cycle
  
  // Theme integration
  jcontext
}) {
  // Get theme colors
  const theme = jcontext?.theme || {};
  const primaryColor = theme.primaryColor || '#3B82F6';

  // Default logos if none provided
  const defaultLogos = [
    { name: "TechCorp", width: 120, height: 40 },
    { name: "StartupCo", width: 140, height: 35 },
    { name: "InnovateLtd", width: 110, height: 45 },
    { name: "FutureTech", width: 130, height: 38 },
    { name: "NextGen", width: 125, height: 42 },
    { name: "CloudFirst", width: 135, height: 36 }
  ];

  const displayLogos = logos.length > 0 ? logos : defaultLogos;

  const generatePlaceholderLogo = (logo) => {
    return (
      <div 
        className="flex items-center justify-center bg-gray-100 rounded-lg font-semibold text-gray-600"
        style={{ 
          width: logo.width || 120, 
          height: logo.height || 40,
          fontSize: `${Math.max(12, (logo.width || 120) / 10)}px`
        }}
      >
        {logo.name}
      </div>
    );
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  const logoVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { duration: 0.5 }
    }
  };

  if (variant === "minimal") {
    return (
      <section className="py-12">
        <div className="container mx-auto px-4">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="text-center"
          >
            {showCount && (
              <motion.p variants={itemVariants} className="text-sm text-gray-500 mb-8">
                Trusted by {companyCount} companies
              </motion.p>
            )}
            
            <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-center gap-8 opacity-60">
              {displayLogos.slice(0, 6).map((logo, index) => (
                <motion.div
                  key={index}
                  variants={logoVariants}
                  className="hover:opacity-100 transition-opacity duration-200"
                >
                  {logo.src ? (
                    <img
                      src={logo.src}
                      alt={logo.alt || logo.name}
                      className="h-8 max-w-[120px] object-contain filter grayscale hover:grayscale-0 transition-all duration-200"
                    />
                  ) : (
                    generatePlaceholderLogo({...logo, height: 32})
                  )}
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>
    );
  }

  if (variant === "carousel") {
    return (
      <section className="py-16 overflow-hidden">
        <div className="container mx-auto px-4">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="text-center mb-12"
          >
            <motion.h2 variants={itemVariants} className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {title}
            </motion.h2>
            {subtitle && (
              <motion.p variants={itemVariants} className="text-xl text-gray-600 max-w-2xl mx-auto">
                {subtitle}
              </motion.p>
            )}
            {showCount && (
              <motion.p variants={itemVariants} className="text-lg font-semibold mt-4" style={{ color: primaryColor }}>
                Join {companyCount} companies already using our platform
              </motion.p>
            )}
          </motion.div>

          {/* Infinite scroll carousel */}
          <div className="relative">
            <div className="overflow-hidden">
              <motion.div
                animate={autoplay ? { x: [0, -50 * displayLogos.length] } : {}}
                transition={autoplay ? {
                  duration: speed,
                  repeat: Infinity,
                  ease: "linear"
                } : {}}
                className="flex items-center space-x-12"
                style={{ width: `${100 * displayLogos.length}%` }}
              >
                {/* Duplicate logos for seamless loop */}
                {[...displayLogos, ...displayLogos].map((logo, index) => (
                  <div
                    key={index}
                    className="flex-shrink-0 hover:scale-110 transition-transform duration-200"
                  >
                    {logo.src ? (
                      <img
                        src={logo.src}
                        alt={logo.alt || logo.name}
                        className="h-12 max-w-[160px] object-contain opacity-60 hover:opacity-100 transition-opacity duration-200"
                      />
                    ) : (
                      generatePlaceholderLogo({...logo, height: 48})
                    )}
                  </div>
                ))}
              </motion.div>
            </div>
            
            {/* Gradient overlays */}
            <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-white to-transparent pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-white to-transparent pointer-events-none" />
          </div>
        </div>
      </section>
    );
  }

  if (variant === "grid") {
    return (
      <section className="py-16">
        <div className="container mx-auto px-4">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="text-center mb-12"
          >
            <motion.h2 variants={itemVariants} className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {title}
            </motion.h2>
            {subtitle && (
              <motion.p variants={itemVariants} className="text-xl text-gray-600 max-w-2xl mx-auto">
                {subtitle}
              </motion.p>
            )}
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 items-center"
          >
            {displayLogos.map((logo, index) => (
              <motion.div
                key={index}
                variants={logoVariants}
                className="flex items-center justify-center p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 group"
              >
                {logo.src ? (
                  <img
                    src={logo.src}
                    alt={logo.alt || logo.name}
                    className="max-h-12 max-w-full object-contain opacity-70 group-hover:opacity-100 transition-opacity duration-200"
                  />
                ) : (
                  generatePlaceholderLogo({...logo, height: 48})
                )}
              </motion.div>
            ))}
          </motion.div>

          {showCount && (
            <motion.div
              variants={itemVariants}
              className="text-center mt-12"
            >
              <div className="inline-flex items-center px-6 py-3 rounded-full bg-gray-50 border border-gray-200">
                <span className="text-gray-600">Trusted by </span>
                <span className="font-bold mx-1" style={{ color: primaryColor }}>{companyCount}</span>
                <span className="text-gray-600"> companies worldwide</span>
              </div>
            </motion.div>
          )}
        </div>
      </section>
    );
  }

  // Default variant
  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="text-center"
        >
          <motion.h2 variants={itemVariants} className="text-2xl md:text-3xl font-bold text-gray-900 mb-8">
            {title}
          </motion.h2>
          
          {subtitle && (
            <motion.p variants={itemVariants} className="text-lg text-gray-600 mb-12 max-w-2xl mx-auto">
              {subtitle}
            </motion.p>
          )}

          <motion.div
            variants={itemVariants}
            className="flex flex-wrap items-center justify-center gap-8 lg:gap-12"
          >
            {displayLogos.slice(0, 8).map((logo, index) => (
              <motion.div
                key={index}
                variants={logoVariants}
                className="hover:scale-110 transition-transform duration-200"
              >
                {logo.src ? (
                  <img
                    src={logo.src}
                    alt={logo.alt || logo.name}
                    className="h-10 md:h-12 max-w-[140px] object-contain opacity-60 hover:opacity-100 transition-opacity duration-200 filter grayscale hover:grayscale-0"
                  />
                ) : (
                  generatePlaceholderLogo(logo)
                )}
              </motion.div>
            ))}
          </motion.div>

          {showCount && (
            <motion.p variants={itemVariants} className="text-gray-500 mt-8">
              Join {companyCount} companies that trust our platform
            </motion.p>
          )}
        </motion.div>
      </div>
    </section>
  );
}

LogoCloud.displayName = 'LogoCloud';