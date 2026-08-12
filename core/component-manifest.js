/**
 * Component Manifest Structure Definition
 * Simple, practical structure for component metadata
 */

export const manifestSchema = {
  // Required fields
  name: 'string',           // Component name (e.g., 'Hero', 'AuthForm')
  version: 'string',        // Semantic version (e.g., '1.0.0')
  
  // Basic info
  description: 'string',    // What the component does
  category: 'string',       // e.g., 'layout', 'auth', 'ecommerce', 'content'
  component: 'string',      // How to reference in JSON (e.g., '@landing/Hero', 'AuthForm')
  
  // Parameters the component accepts
  parameters: [
    {
      name: 'string',       // Parameter name
      type: 'string',       // 'string', 'number', 'boolean', 'object', 'array'
      required: false,      // Is it required?
      default: 'any',       // Default value
      description: 'string' // What it does
    }
  ],
  
  // Example usage
  example: {
    component: 'string',    // Component reference
    attributes: {}          // Example attributes
  }
};

// Example manifest for a Hero component
export const exampleManifest = {
  name: 'Hero',
  version: '1.0.0',
  description: 'Hero section with title, subtitle and CTA button',
  category: 'layout',
  component: '@landing/Hero',
  
  parameters: [
    {
      name: 'title',
      type: 'string',
      required: true,
      description: 'Main heading text'
    },
    {
      name: 'subtitle',
      type: 'string',
      required: false,
      default: '',
      description: 'Supporting text below title'
    },
    {
      name: 'buttonText',
      type: 'string',
      required: false,
      default: 'Get Started',
      description: 'CTA button label'
    },
    {
      name: 'variant',
      type: 'string',
      required: false,
      default: 'default',
      description: 'Visual style variant'
    }
  ],
  
  example: {
    component: '@landing/Hero',
    attributes: {
      title: 'Welcome to Our Platform',
      subtitle: 'Build amazing things',
      buttonText: 'Start Building',
      variant: 'gradient'
    }
  }
};