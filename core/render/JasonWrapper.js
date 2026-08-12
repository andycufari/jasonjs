import React from 'react';
import JasonCraftThisJSON from './jason';

// Wrapper component to handle mixed content (strings and components)
export default function JasonWrapper({ json, jcomponents, jcontext, renderComponent }) {
  // Normalize the components array to ensure all items are proper component objects
  const normalizedJson = {
    ...json,
    components: normalizeComponents(json.components || [])
  };

  return (
    <JasonCraftThisJSON
      json={normalizedJson}
      jcomponents={jcomponents}
      jcontext={jcontext}
      renderComponent={renderComponent}
    />
  );
}

function normalizeComponents(components) {
  if (!Array.isArray(components)) {
    console.warn('Components is not an array:', components);
    return [];
  }

  // console.log('normalizeComponents called with', components.length, 'items');
  
  return components.map((item, index) => {
    // If it's a string, wrap it in a span component
    if (typeof item === 'string') {
      return {
        component: 'span',
        components: [item]
      };
    }
    
    // If it's a number, boolean, or null, convert to string and wrap
    if (item === null || typeof item === 'number' || typeof item === 'boolean') {
      return {
        component: 'span',
        components: [String(item)]
      };
    }
    
    // If it's already an object, validate it has required properties
    if (typeof item === 'object' && item !== null) {
      // If it doesn't have a component property, it's invalid
      if (!item.component) {
        // console.warn(`Component at index ${index} missing 'component' property:`, JSON.stringify(item, null, 2));
        return {
          component: 'div',
          attributes: { className: 'error border border-red-500 p-2 bg-red-50 text-sm' },
          components: [`[Invalid Component: missing 'component' property]`]
        };
      }
      
      // Process children if they exist
      if (item.components && Array.isArray(item.components)) {
        return {
          ...item,
          components: normalizeComponents(item.components)
        };
      }
      return item;
    }
    
    // For any other type, return a span with error message
    // console.warn(`Unexpected component type at index ${index}:`, typeof item, item);
    return {
      component: 'span',
      attributes: { className: 'error text-red-500' },
      components: ['[Invalid Component Type]']
    };
  });
}