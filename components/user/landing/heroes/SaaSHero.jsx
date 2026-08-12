'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, ChevronRight, Star, Users, Zap, Shield, CheckCircle, ArrowRight } from 'lucide-react';

export default function SaaSHero({
  // Content props
  headline = "The future of productivity is here",
  subheadline = "Streamline your workflow with our powerful platform trusted by thousands of teams worldwide",
  ctaText = "Start Free Trial",
  secondaryCta = "Watch Demo",
  
  // Features
  features = [
    "10x faster workflows",
    "Enterprise security", 
    "24/7 support"
  ],
  
  // Social proof
  userCount = "10,000+",
  rating = 4.9,
  logoCloud = [],
  
  // Media
  demoUrl = "",
  productImage = "",
  
  // Visual
  variant = "default", // default, video, product
  
  // Background customization
  backgroundImage = null,
  backgroundColor = null,
  backgroundOpacity = 0.4,
  
  // Typography customization
  headlineClasses = "text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight",
  subheadlineClasses = "text-xl text-gray-600 mb-8 max-w-2xl",
  
  // Layout customization
  sectionClasses = "relative min-h-screen flex items-center justify-center px-4 py-20 overflow-hidden",
  containerClasses = "container mx-auto max-w-7xl relative z-10",
  contentClasses = "grid lg:grid-cols-2 gap-12 items-center",
  
  // Button customization
  primaryButtonClasses = "inline-flex items-center px-8 py-4 rounded-xl text-white font-semibold transition-all duration-200 shadow-lg hover:shadow-xl mr-4",
  secondaryButtonClasses = "inline-flex items-center px-8 py-4 border-2 border-gray-300 rounded-xl text-gray-700 font-semibold hover:border-gray-400 transition-colors",
  
  // Actions
  ctaUrl = "/signup",
  demoAction = null,
  
  // Theme integration
  jcontext
}) {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Get theme colors - support both direct props and theme system
  const theme = jcontext?.theme || {};
  const primaryColor = theme.colors?.primary || theme.primaryColor || '#3B82F6';
  const secondaryColor = theme.colors?.secondary || theme.secondaryColor || '#8B5CF6';

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

  const handleCTAClick = () => {
    if (ctaUrl.startsWith('http')) {
      window.open(ctaUrl, '_blank');
    } else {
      window.location.href = ctaUrl;
    }
  };

  const handleDemoClick = () => {
    if (demoAction) {
      demoAction();
    } else if (demoUrl) {
      setIsVideoPlaying(true);
    }
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
      />
    ));
  };

  const getBackgroundStyle = () => {
    let style = {};
    
    if (backgroundImage) {
      style.backgroundImage = `url(${backgroundImage})`;
      style.backgroundSize = 'cover';
      style.backgroundPosition = 'center';
      style.backgroundRepeat = 'no-repeat';
    } else if (backgroundColor) {
      style.backgroundColor = backgroundColor;
    }
    
    return style;
  };

  return (
    <section className={sectionClasses} style={getBackgroundStyle()}>
      {/* Background overlay for images or default gradient */}
      {backgroundImage ? (
        <div 
          className="absolute inset-0 bg-black" 
          style={{ opacity: backgroundOpacity }}
        />
      ) : (
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            background: `radial-gradient(circle at 30% 20%, ${primaryColor} 0%, transparent 50%), radial-gradient(circle at 80% 80%, ${secondaryColor} 0%, transparent 50%)`
          }}
        />
      )}

      <div className={containerClasses}>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className={contentClasses}
        >
          {/* Left Content */}
          <div className="text-left">
            {/* Badge */}
            <motion.div variants={itemVariants} className="mb-6">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-white shadow-sm border border-gray-200">
                <Zap className="w-4 h-4 mr-2" style={{ color: primaryColor }} />
                <span className="text-sm font-medium text-gray-700">Trusted by {userCount} teams</span>
              </div>
            </motion.div>

            {/* Headline */}
            <motion.h1 variants={itemVariants} className={headlineClasses}>
              {headline}
            </motion.h1>

            {/* Subheadline */}
            <motion.p variants={itemVariants} className={subheadlineClasses}>
              {subheadline}
            </motion.p>

            {/* Features list */}
            <motion.div variants={itemVariants} className="mb-8">
              <div className="grid sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center">
                    <CheckCircle className="w-5 h-5 mr-3 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* CTAs */}
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 mb-8">
              <button
                onClick={handleCTAClick}
                className={primaryButtonClasses}
                style={{ backgroundColor: primaryColor }}
              >
                {ctaText}
                <ChevronRight className="w-5 h-5 ml-2" />
              </button>
              
              {(demoUrl || demoAction) && (
                <button
                  onClick={handleDemoClick}
                  className={secondaryButtonClasses}
                  style={{ borderColor: primaryColor, color: primaryColor }}
                >
                  <Play className="w-5 h-5 mr-2" />
                  {secondaryCta}
                </button>
              )}
            </motion.div>

            {/* Social proof */}
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              {/* Rating */}
              <div className="flex items-center">
                <div className="flex mr-2">
                  {renderStars(rating)}
                </div>
                <span className="text-sm text-gray-600">
                  {rating}/5 from 200+ reviews
                </span>
              </div>

              {/* Logo cloud (if provided) */}
              {logoCloud.length > 0 && (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-500">Trusted by:</span>
                  <div className="flex items-center space-x-3">
                    {logoCloud.slice(0, 3).map((logo, index) => (
                      <img
                        key={index}
                        src={logo.src}
                        alt={logo.alt}
                        className="h-6 opacity-60 hover:opacity-100 transition-opacity"
                      />
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Right Content - Visual */}
          <div className="relative">
            <motion.div
              variants={itemVariants}
              className="relative"
            >
              {variant === 'video' && demoUrl ? (
                <div className="relative">
                  {!isVideoPlaying ? (
                    <div 
                      className="relative bg-gray-900 rounded-2xl overflow-hidden shadow-2xl cursor-pointer group"
                      onClick={() => setIsVideoPlaying(true)}
                    >
                      <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                        <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/30 transition-all duration-200">
                          <Play className="w-8 h-8 text-white ml-1" />
                        </div>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <div className="absolute bottom-6 left-6 text-white">
                        <p className="text-lg font-semibold">See how it works</p>
                        <p className="text-sm opacity-90">2 min demo</p>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl">
                      <iframe
                        src={demoUrl}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  )}
                </div>
              ) : variant === 'product' && productImage ? (
                <div className="relative">
                  <img
                    src={productImage}
                    alt="Product screenshot"
                    className="w-full rounded-2xl shadow-2xl"
                  />
                  {/* Floating elements */}
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute -top-4 -right-4 bg-white rounded-xl shadow-lg p-4"
                  >
                    <div className="flex items-center">
                      <Users className="w-5 h-5 mr-2" style={{ color: primaryColor }} />
                      <span className="text-sm font-medium">+{userCount} users</span>
                    </div>
                  </motion.div>
                </div>
              ) : (
                // Default dashboard mockup
                <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden">
                  <div className="h-12 bg-gray-50 border-b border-gray-200 flex items-center px-6">
                    <div className="flex space-x-2">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <div className="w-3 h-3 rounded-full bg-yellow-400" />
                      <div className="w-3 h-3 rounded-full bg-green-400" />
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-gray-50 rounded-lg p-4">
                          <div className="w-8 h-8 rounded-lg mb-3" style={{ backgroundColor: `${primaryColor}20` }} />
                          <div className="h-4 bg-gray-200 rounded mb-2" />
                          <div className="h-3 bg-gray-100 rounded w-2/3" />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-gray-200" />
                          <div className="flex-1">
                            <div className="h-3 bg-gray-200 rounded mb-1" />
                            <div className="h-2 bg-gray-100 rounded w-1/2" />
                          </div>
                          <div className="w-16 h-6 rounded" style={{ backgroundColor: `${primaryColor}20` }} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Floating badges */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, delay: 1 }}
                className="absolute -bottom-6 -left-6 bg-white rounded-xl shadow-lg p-4 border border-gray-100"
              >
                <div className="flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-green-500" />
                  <span className="text-sm font-medium">SOC 2 Compliant</span>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

SaaSHero.displayName = 'SaaSHero';