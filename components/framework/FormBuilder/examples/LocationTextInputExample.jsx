// LocationTextInputExample.jsx - Example usage of LocationTextInput with different languages and formats
'use client';

import React, { useState } from 'react';
import LocationTextInput from '../inputs/LocationTextInput';

export default function LocationTextInputExample() {
  const [spanishAddress, setSpanishAddress] = useState('');
  const [englishAddress, setEnglishAddress] = useState('');
  const [locationObject, setLocationObject] = useState(null);
  const [locationGeopoint, setLocationGeopoint] = useState(null);

  const handleLocationUpdate = (fieldName, value) => {
    if (fieldName === 'location_object') {
      setLocationObject(value);
    } else if (fieldName === 'location_geopoint') {
      setLocationGeopoint(value);
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-2xl">
      <h1 className="text-2xl font-bold">LocationTextInput Examples</h1>
      
      {/* Spanish Language Example */}
      <div className="space-y-4 border p-4 rounded">
        <h2 className="text-lg font-semibold">Spanish Language (Object Format)</h2>
        <LocationTextInput
          name="address_es"
          value={spanishAddress}
          onChange={setSpanishAddress}
          onLocationUpdate={handleLocationUpdate}
          locationFieldName="location_object"
          language="es"
          format="object"
          fieldSchema={{
            label: "Dirección",
            help: "Escribe una dirección en Argentina",
            location: true,
            location_ref: "location_object"
          }}
        />
        
        <div className="bg-gray-50 p-3 rounded text-sm">
          <strong>Address Value:</strong> {spanishAddress || 'Empty'}
        </div>
        
        <div className="bg-blue-50 p-3 rounded text-sm">
          <strong>Location Object:</strong>
          <pre className="mt-1 text-xs">{JSON.stringify(locationObject, null, 2)}</pre>
        </div>
      </div>

      {/* English Language Example */}
      <div className="space-y-4 border p-4 rounded">
        <h2 className="text-lg font-semibold">English Language (Geopoint Array Format)</h2>
        <LocationTextInput
          name="address_en"
          value={englishAddress}
          onChange={setEnglishAddress}
          onLocationUpdate={handleLocationUpdate}
          locationFieldName="location_geopoint"
          language="en"
          format="geopoint"
          countryCode="US"
          fieldSchema={{
            label: "Address",
            help: "Enter an address in the United States",
            location: true,
            location_ref: "location_geopoint"
          }}
        />
        
        <div className="bg-gray-50 p-3 rounded text-sm">
          <strong>Address Value:</strong> {englishAddress || 'Empty'}
        </div>
        
        <div className="bg-green-50 p-3 rounded text-sm">
          <strong>Location Geopoint [lng, lat]:</strong>
          <pre className="mt-1 text-xs">{JSON.stringify(locationGeopoint, null, 2)}</pre>
        </div>
      </div>

      {/* Usage Instructions */}
      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
        <h3 className="font-semibold mb-2">Usage Instructions:</h3>
        <ul className="text-sm space-y-1">
          <li><strong>Spanish Example:</strong> Try typing "Conesa 800" - it will format as "Conesa 800, ..." and return an object format</li>
          <li><strong>English Example:</strong> Try typing "800 Main St" - it will format as "800 Main St, ..." and return a geopoint array [lng, lat]</li>
          <li><strong>Props:</strong> 
            <ul className="ml-4 mt-1">
              <li>• language: 'es' or 'en' (affects address format and API language)</li>
              <li>• format: 'object' or 'geopoint' (output format for location field)</li>
              <li>• countryCode: 'AR', 'US', etc. (auto-detected from language if not provided)</li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
  );
}
