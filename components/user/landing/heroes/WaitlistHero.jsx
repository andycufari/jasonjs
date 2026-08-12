'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, Users, ChevronRight, CheckCircle, Sparkles } from 'lucide-react';

export default function WaitlistHero({
  // Content props
  headline = "Be the first to experience the future",
  subheadline = "Join thousands of innovators on our exclusive waitlist",
  ctaText = "Get Early Access",
  incentive = "Early members get 50% off forever",
  
  // Visual props  
  variant = "gradient", // gradient, minimal, animated
  showCount = true,
  currentCount = 2341,
  
  // Database integration
  database = "waitlist",
  
  // Background customization
  backgroundImage = null,
  backgroundColor = null,
  backgroundOpacity = 0.5,
  
  // Typography customization
  headlineClasses = "text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight",
  subheadlineClasses = "text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto",
  
  // Layout customization
  sectionClasses = "min-h-screen flex items-center justify-center px-4 relative overflow-hidden",
  containerClasses = "text-center max-w-4xl mx-auto relative z-10",
  
  // Form customization
  formClasses = "max-w-md mx-auto",
  inputClasses = "w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:border-transparent text-gray-900 placeholder-gray-500 bg-white/90 backdrop-blur-sm shadow-sm",
  buttonClasses = "px-8 py-4 rounded-2xl text-white font-semibold flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed",
  
  // Theme integration
  jcontext
}) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [animatedCount, setAnimatedCount] = useState(currentCount);

  // Get theme colors - support both direct props and theme system
  const theme = jcontext?.theme || {};
  const primaryColor = theme.colors?.primary || theme.primaryColor || '#3B82F6';
  const secondaryColor = theme.colors?.secondary || theme.secondaryColor || '#8B5CF6';

  // Animate counter
  useEffect(() => {
    if (showCount) {
      const interval = setInterval(() => {
        setAnimatedCount(prev => prev + Math.floor(Math.random() * 3));
      }, 5000 + Math.random() * 10000);
      return () => clearInterval(interval);
    }
  }, [showCount]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/data/${database}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            email,
            timestamp: new Date().toISOString(),
            source: 'waitlist_hero',
            page: window.location.pathname,
            utm: {
              source: new URLSearchParams(window.location.search).get('utm_source'),
              medium: new URLSearchParams(window.location.search).get('utm_medium'),
              campaign: new URLSearchParams(window.location.search).get('utm_campaign')
            },
            userAgent: navigator.userAgent,
            referrer: document.referrer,
            status: 'active'
          }
        }),
      });

      const result = await response.json();
      
      if (response.ok && result.data) {
        setIsSubmitted(true);
        setEmail('');
      } else {
        throw new Error(result.error || 'Failed to join waitlist');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.6,
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  const getBackgroundStyle = () => {
    let style = {};
    
    // Custom background color/image takes precedence
    if (backgroundImage) {
      style.backgroundImage = `url(${backgroundImage})`;
      style.backgroundSize = 'cover';
      style.backgroundPosition = 'center';
      style.backgroundRepeat = 'no-repeat';
    } else if (backgroundColor) {
      style.backgroundColor = backgroundColor;
    } else {
      // Default variant-based backgrounds
      switch (variant) {
        case 'gradient':
          style.background = `linear-gradient(135deg, ${primaryColor}20 0%, ${secondaryColor}20 100%)`;
          break;
        case 'animated':
          style.background = `radial-gradient(circle at 50% 50%, ${primaryColor}10 0%, transparent 50%)`;
          break;
        default:
          break;
      }
    }
    
    return style;
  };

  if (isSubmitted) {
    return (
      <section className="min-h-screen flex items-center justify-center px-4" style={getBackgroundStyle()}>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-2xl mx-auto"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="w-20 h-20 mx-auto mb-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: primaryColor }}
          >
            <CheckCircle className="w-10 h-10 text-white" />
          </motion.div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            You're on the list! 🎉
          </h1>
          
          <p className="text-xl text-gray-600 mb-8">
            Welcome to an exclusive group of {animatedCount.toLocaleString()} innovators.
            We'll notify you the moment we launch.
          </p>
          
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 shadow-lg">
            <h3 className="font-semibold text-gray-900 mb-3">What happens next?</h3>
            <div className="space-y-3 text-left">
              <div className="flex items-center text-gray-600">
                <div className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: primaryColor }}></div>
                You'll get exclusive updates on our progress
              </div>
              <div className="flex items-center text-gray-600">
                <div className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: primaryColor }}></div>
                Early access when we launch (before anyone else)
              </div>
              <div className="flex items-center text-gray-600">
                <div className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: primaryColor }}></div>
                {incentive}
              </div>
            </div>
          </div>
        </motion.div>
      </section>
    );
  }

  return (
    <section className={sectionClasses} style={getBackgroundStyle()}>
      {/* Background overlay for images */}
      {backgroundImage && (
        <div 
          className="absolute inset-0 bg-black z-10" 
          style={{ opacity: backgroundOpacity }}
        />
      )}
      {/* Animated background elements */}
      {variant === 'animated' && (
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ 
              x: [0, 100, 0],
              y: [0, -100, 0],
            }}
            transition={{ 
              duration: 20,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full opacity-10"
            style={{ backgroundColor: primaryColor }}
          />
          <motion.div
            animate={{ 
              x: [0, -100, 0],
              y: [0, 100, 0],
            }}
            transition={{ 
              duration: 25,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full opacity-10"
            style={{ backgroundColor: secondaryColor }}
          />
        </div>
      )}

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className={containerClasses}
        style={{ zIndex: backgroundImage ? 20 : 10 }}
      >
        {/* Badge */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/90 backdrop-blur-sm border border-gray-200 shadow-sm">
            <Sparkles className="w-4 h-4 mr-2" style={{ color: primaryColor }} />
            <span className="text-sm font-medium text-gray-700">Something amazing is coming</span>
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

        {/* Waitlist count */}
        {showCount && (
          <motion.div variants={itemVariants} className="mb-8">
            <div className="inline-flex items-center px-6 py-3 rounded-full bg-white/90 backdrop-blur-sm border border-gray-200 shadow-sm">
              <Users className="w-5 h-5 mr-2 text-gray-600" />
              <span className="font-semibold text-gray-900">
                {animatedCount.toLocaleString()}
              </span>
              <span className="text-gray-600 ml-1">people waiting</span>
            </div>
          </motion.div>
        )}

        {/* Waitlist form */}
        <motion.div variants={itemVariants} className="mb-8">
          <form onSubmit={handleSubmit} className={formClasses}>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                  disabled={isSubmitting}
                  className={inputClasses}
                  style={{ focusRingColor: primaryColor }}
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting || !email}
                className={buttonClasses}
                style={{ backgroundColor: primaryColor }}
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {ctaText}
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </button>
            </div>
            {error && (
              <p className="text-red-500 text-sm mt-3 text-center">{error}</p>
            )}
          </form>
        </motion.div>

        {/* Incentive */}
        {incentive && (
          <motion.div variants={itemVariants} className="mb-8">
            <p className="text-gray-600">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                    style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>
                ✨ {incentive}
              </span>
            </p>
          </motion.div>
        )}

        {/* Trust indicators */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-gray-500">
          <div className="flex items-center">
            <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
            No spam, ever
          </div>
          <div className="flex items-center">
            <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
            Unsubscribe anytime
          </div>
          <div className="flex items-center">
            <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
            Early access guaranteed
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

WaitlistHero.displayName = 'WaitlistHero';