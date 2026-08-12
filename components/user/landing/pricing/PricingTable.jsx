'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, Crown, Building, ChevronRight, Info } from 'lucide-react';

export default function PricingTable({
  // Content
  title = "Choose the perfect plan for your team",
  subtitle = "Start free, scale as you grow",
  
  // Plans configuration
  plans = [],
  currency = "USD",
  currencySymbol = "$",
  billingCycle = "monthly", // monthly, yearly
  showYearlyToggle = true,
  yearlyDiscount = 20,
  
  // Highlighted plan
  popularPlanId = "",
  
  // Features
  showComparison = true,
  ctaText = "Get Started",
  
  // Actions
  onPlanSelect = null,
  
  // Theme integration
  jcontext
}) {
  const [selectedBilling, setSelectedBilling] = useState(billingCycle);

  // Get theme colors
  const theme = jcontext?.theme || {};
  const primaryColor = theme.primaryColor || '#3B82F6';
  const secondaryColor = theme.secondaryColor || '#8B5CF6';

  // Default plans if none provided
  const defaultPlans = [
    {
      id: "starter",
      name: "Starter",
      description: "Perfect for individuals and small teams getting started",
      price: { monthly: 0, yearly: 0 },
      features: [
        "Up to 3 projects",
        "Basic analytics",
        "Email support",
        "1GB storage",
        "Standard templates"
      ],
      cta: "Start Free",
      ctaVariant: "secondary"
    },
    {
      id: "pro",
      name: "Professional",
      description: "For growing teams that need advanced features",
      price: { monthly: 29, yearly: 23 },
      features: [
        "Unlimited projects",
        "Advanced analytics",
        "Priority support",
        "50GB storage",
        "Premium templates",
        "Team collaboration",
        "Custom integrations"
      ],
      cta: "Start Free Trial",
      ctaVariant: "primary",
      popular: true
    },
    {
      id: "enterprise",
      name: "Enterprise",
      description: "For large organizations with custom needs",
      price: { monthly: 99, yearly: 79 },
      features: [
        "Everything in Pro",
        "Unlimited storage",
        "24/7 phone support",
        "SSO & SAML",
        "Advanced security",
        "Custom contracts",
        "Dedicated success manager"
      ],
      cta: "Contact Sales",
      ctaVariant: "secondary"
    }
  ];

  const displayPlans = plans.length > 0 ? plans : defaultPlans;

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

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  const getPrice = (plan) => {
    const price = plan.price[selectedBilling];
    return typeof price === 'number' ? price : 0;
  };

  const getPlanIcon = (plan) => {
    if (plan.id === 'enterprise') return Building;
    if (plan.popular || plan.id === popularPlanId) return Crown;
    return Zap;
  };

  const handlePlanSelect = (plan) => {
    if (onPlanSelect) {
      onPlanSelect(plan, selectedBilling);
    } else {
      // Default action - could redirect to signup
      console.log('Selected plan:', plan.id, 'billing:', selectedBilling);
    }
  };

  return (
    <section className="py-20 bg-gradient-to-br from-gray-50 to-white">
      <div className="container mx-auto px-4">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="text-center mb-16"
        >
          <motion.h2 variants={cardVariants} className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {title}
          </motion.h2>
          
          <motion.p variants={cardVariants} className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            {subtitle}
          </motion.p>

          {/* Billing toggle */}
          {showYearlyToggle && (
            <motion.div variants={cardVariants} className="flex items-center justify-center mb-8">
              <div className="bg-gray-100 p-1 rounded-xl flex items-center">
                <button
                  onClick={() => setSelectedBilling('monthly')}
                  className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
                    selectedBilling === 'monthly'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setSelectedBilling('yearly')}
                  className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 relative ${
                    selectedBilling === 'yearly'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Yearly
                  {yearlyDiscount > 0 && (
                    <span 
                      className="absolute -top-2 -right-1 px-2 py-1 text-xs font-bold text-white rounded-full"
                      style={{ backgroundColor: primaryColor }}
                    >
                      -{yearlyDiscount}%
                    </span>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Pricing cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto"
        >
          {displayPlans.map((plan, index) => {
            const Icon = getPlanIcon(plan);
            const isPopular = plan.popular || plan.id === popularPlanId;
            const price = getPrice(plan);
            
            return (
              <motion.div
                key={plan.id}
                variants={cardVariants}
                className={`relative bg-white rounded-2xl shadow-lg border-2 transition-all duration-200 hover:shadow-xl ${
                  isPopular 
                    ? 'border-transparent shadow-2xl scale-105' 
                    : 'border-gray-100 hover:border-gray-200'
                } ${plan.id === 'enterprise' ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white' : ''}`}
                style={isPopular ? { borderColor: primaryColor } : {}}
              >
                {/* Popular badge */}
                {isPopular && (
                  <div 
                    className="absolute -top-4 left-1/2 transform -translate-x-1/2 px-6 py-2 rounded-full text-white text-sm font-bold"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Most Popular
                  </div>
                )}

                <div className="p-8">
                  {/* Plan header */}
                  <div className="text-center mb-8">
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                      plan.id === 'enterprise' ? 'bg-white/10' : 'bg-gray-50'
                    }`}>
                      <Icon 
                        className={`w-8 h-8 ${
                          plan.id === 'enterprise' ? 'text-white' : ''
                        }`}
                        style={plan.id !== 'enterprise' ? { color: primaryColor } : {}}
                      />
                    </div>
                    
                    <h3 className={`text-2xl font-bold mb-2 ${
                      plan.id === 'enterprise' ? 'text-white' : 'text-gray-900'
                    }`}>
                      {plan.name}
                    </h3>
                    
                    <p className={`${
                      plan.id === 'enterprise' ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      {plan.description}
                    </p>
                  </div>

                  {/* Pricing */}
                  <div className="text-center mb-8">
                    <div className="flex items-baseline justify-center">
                      <span className={`text-5xl font-bold ${
                        plan.id === 'enterprise' ? 'text-white' : 'text-gray-900'
                      }`}>
                        {price === 0 ? 'Free' : `${currencySymbol}${price}`}
                      </span>
                      {price > 0 && (
                        <span className={`text-lg ml-1 ${
                          plan.id === 'enterprise' ? 'text-gray-300' : 'text-gray-600'
                        }`}>
                          /{selectedBilling === 'yearly' ? 'year' : 'month'}
                        </span>
                      )}
                    </div>
                    
                    {selectedBilling === 'yearly' && price > 0 && yearlyDiscount > 0 && (
                      <p className={`text-sm mt-2 ${
                        plan.id === 'enterprise' ? 'text-gray-300' : 'text-gray-500'
                      }`}>
                        Save {yearlyDiscount}% with yearly billing
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <div className="mb-8">
                    <ul className="space-y-4">
                      {plan.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start">
                          <Check className={`w-5 h-5 mr-3 flex-shrink-0 mt-0.5 ${
                            plan.id === 'enterprise' ? 'text-green-400' : 'text-green-500'
                          }`} />
                          <span className={`${
                            plan.id === 'enterprise' ? 'text-gray-200' : 'text-gray-700'
                          }`}>
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={() => handlePlanSelect(plan)}
                    className={`w-full py-4 px-6 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center ${
                      plan.ctaVariant === 'primary' || isPopular
                        ? 'text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                        : plan.id === 'enterprise'
                        ? 'bg-white text-gray-900 hover:bg-gray-100'
                        : 'border-2 hover:bg-gray-50'
                    }`}
                    style={
                      plan.ctaVariant === 'primary' || isPopular
                        ? { backgroundColor: primaryColor }
                        : plan.id !== 'enterprise'
                        ? { borderColor: primaryColor, color: primaryColor }
                        : {}
                    }
                  >
                    {plan.cta || ctaText}
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Additional info */}
        <motion.div variants={cardVariants} className="text-center mt-12">
          <div className="inline-flex items-center px-6 py-3 bg-blue-50 rounded-xl border border-blue-100">
            <Info className="w-5 h-5 mr-2 text-blue-600" />
            <span className="text-blue-700">
              All plans include 14-day free trial. No credit card required.
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

PricingTable.displayName = 'PricingTable';