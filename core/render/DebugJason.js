import React from 'react';
import JasonCraftThisJSON from './jason';

// Debug wrapper that logs everything going to JasonCraftThisJSON
export default function DebugJason({ json, jcomponents, jcontext, renderComponent }) {
  console.log('DebugJason - Intercepting call to JasonCraftThisJSON');
  console.log('DebugJason - json:', JSON.stringify(json, null, 2));
  console.log('DebugJason - jcomponents keys:', Object.keys(jcomponents || {}));
  
  // Intercept the component lookup
  const debugComponents = { ...jcomponents };
  
  // Wrap each component to log when it's called
  Object.keys(debugComponents).forEach(key => {
    const originalComponent = debugComponents[key];
    debugComponents[key] = (props) => {
      console.log(`DebugJason - Rendering component: ${key}`, props);
      return originalComponent(props);
    };
  });
  
  return (
    <JasonCraftThisJSON
      json={json}
      jcomponents={debugComponents}
      jcontext={jcontext}
      renderComponent={renderComponent}
    />
  );
}