'use client'

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const FAQItem = ({ question, answer, isOpen, toggleOpen, index }) => {
  return (
    <div className="transition-all duration-200 bg-transparent border border-gray-200 shadow-lg rounded-lg overflow-hidden">
      <button
        type="button"
        className="flex items-center justify-between w-full px-4 py-5 sm:p-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
        onClick={() => toggleOpen(index)}
        aria-expanded={isOpen}
      >
        <span className="flex text-lg font-semibold text-gray-200">{question}</span>
        <motion.svg
          className="w-6 h-6 text-gray-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
              <p dangerouslySetInnerHTML={{ __html: answer }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Faq = ({ props }) => {
  const {
    title = 'Frequently Asked Questions',
    subtitle = 'Find answers to common questions about our services',
    faqs = [],
    contactText = "Didn't find the answer you are looking for?",
    contactLink = {
      text: 'Contact our support',
      href: '#',
    },
    backgroundColor = 'bg-gray-50',
    titleColor = 'text-black',
    subtitleColor = 'text-gray-600',
    maxVisibleItems = 4,
  } = props;

  const [openIndex, setOpenIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);

  const toggleOpen = useCallback((index) => {
    setOpenIndex((prevIndex) => (prevIndex === index ? -1 : index));
  }, []);

  const visibleFaqs = useMemo(() => {
    return showAll ? faqs : faqs.slice(0, maxVisibleItems);
  }, [faqs, showAll, maxVisibleItems]);

  return (
    <section className={`py-10 ${backgroundColor} sm:py-16 lg:py-24`}>
      <div className="px-4 mx-auto sm:px-6 lg:px-8 max-w-7xl">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className={`text-3xl font-bold leading-tight ${titleColor} sm:text-4xl lg:text-5xl`}>
            {title}
          </h2>
          <p className={`max-w-xl mx-auto mt-4 text-base leading-relaxed ${subtitleColor}`}>
            {subtitle}
          </p>
        </div>

        <div className="max-w-3xl mx-auto mt-8 space-y-4 md:mt-16">
          {visibleFaqs.map((faq, index) => (
            <FAQItem
              key={index}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIndex === index}
              toggleOpen={toggleOpen}
              index={index}
            />
          ))}
        </div>

        {faqs.length > maxVisibleItems && (
          <div className="text-center mt-8">
            <button
              className="px-4 py-2 text-sm font-medium text-white transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? 'Ver menos' : 'Ver Más'}
            </button>
          </div>
        )}

        <p className="text-center text-gray-600 text-base mt-9">
          {contactText}{' '}
          <a
            href={contactLink.href}
            className="font-medium text-blue-600 transition-all duration-200 hover:text-blue-700 focus:text-blue-700 hover:underline"
          >
            {contactLink.text}
          </a>
        </p>
      </div>
    </section>
  );
};

export default Faq;