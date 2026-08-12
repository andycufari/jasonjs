// LocationTextInput.jsx - Text input with automatic location geocoding
'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertCircle, MapPin, Search, X, Loader2 } from 'lucide-react';
import { searchAddresses } from '../utils/geocoding';
import { useFormBuilderLanguage } from '../i18n/useFormBuilderLanguage';

/**
 * Enhanced text input that automatically geocodes addresses
 * and updates a linked location field
 */
export default function LocationTextInput({
  id,
  name,
  value = '',
  onChange,
  onBlur,
  onFocus,
  fieldSchema = {},
  error = null,
  touched = false,
  disabled = false,
  className = '',
  showLabel = true,
  // Location linking props
  onLocationUpdate = null, // Callback to update linked location field
  locationFieldName = null, // Name of the location field to update
  // Direct configuration props
  language = null, // Optional language override (detected automatically if not provided)
  format = 'object', // 'object' or 'geopoint' (array [lng, lat])
  countryCode = null, // Auto-detect from language if not provided
  ...props
}) {
  // i18n hook for translations
  const { t, language: detectedLanguage } = useFormBuilderLanguage(language);

  // Use provided language or detected language from i18n
  const currentLanguage = language || detectedLanguage;

  const {
    label,
    placeholder,
    help,
    required = false,
    maxLength,
    minLength,
    type = 'text',
    autoComplete = 'address-line1',
    autoFocus = false,
    readOnly = false,
    location = false, // Enable location geocoding
    location_ref = null, // Reference to location field
    geocoding = {
      enabled: true,
      showSuggestions: true,
      autoGeocode: true, // Automatically geocode on blur
      minQueryLength: 5
    }
  } = fieldSchema;

  // Use provided countryCode or null for worldwide search
  const detectedCountryCode = countryCode || null;
  const detectedPlaceholder = placeholder || t('locationInput.placeholder');

  // Simple address formatting based on language
  const formatAddressForLanguage = (addressParts, language) => {
    if (!addressParts) return '';
    
    const { house_number = '', road = '', suburb = '', city = '', state = '', postcode = '' } = addressParts;
    
    if (language === 'es') {
      // Spanish format: "Conesa 800, Balvanera, CABA, C1043AAR"
      const parts = [];
      if (road && house_number) {
        parts.push(`${road} ${house_number}`);
      } else if (road) {
        parts.push(road);
      }
      if (suburb) parts.push(suburb);
      if (city) parts.push(city);
      if (postcode) parts.push(postcode);
      return parts.filter(Boolean).join(', ');
    } else {
      // English format: "800 Conesa, Balvanera, Buenos Aires, C1043AAR"
      const parts = [];
      if (house_number && road) {
        parts.push(`${house_number} ${road}`);
      } else if (road) {
        parts.push(road);
      }
      if (suburb) parts.push(suburb);
      if (city) parts.push(city);
      if (postcode) parts.push(postcode);
      return parts.filter(Boolean).join(', ');
    }
  };

  // Convert location to specified format
  const convertLocationFormat = (locationData) => {
    if (!locationData || (!locationData.lat && !locationData.lng)) {
      return null;
    }
    
    const lat = parseFloat(locationData.lat);
    const lng = parseFloat(locationData.lng);
    
    if (isNaN(lat) || isNaN(lng)) {
      return null;
    }
    
    if (format === 'geopoint') {
      // GeoJSON format: [longitude, latitude] (note the order!)
      return [lng, lat];
    } else {
      // Default object format
      return {
        lat,
        lng,
        address: locationData.address || ''
      };
    }
  };

  // State for geocoding functionality
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState(null);
  
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const inputId = id || name;
  const showError = error && touched;
  const isDisabled = disabled || readOnly;
  const isLocationEnabled = location && geocoding.enabled;

  // Auto-search addresses as user types
  const searchAddressesDebounced = useCallback(async (query) => {
    if (!query || query.length < (geocoding.minQueryLength || 5) || !isLocationEnabled) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }

    try {
      setIsSearching(true);
      const results = await searchAddresses(query, {
        limit: 5,
        language: currentLanguage,
        countryCode: detectedCountryCode
      });

      // Format addresses based on language preference
      const formattedResults = results.map(result => ({
        ...result,
        display_name: formatAddressForLanguage(result.address, currentLanguage) || result.display_name,
        displayName: formatAddressForLanguage(result.address, currentLanguage) || result.displayName
      }));
      
      setSearchResults(formattedResults);
      setShowSuggestions(formattedResults.length > 0 && geocoding.showSuggestions);
    } catch (error) {
      console.warn('Address search failed:', error);
      setSearchResults([]);
      setShowSuggestions(false);
    } finally {
      setIsSearching(false);
    }
  }, [isLocationEnabled, geocoding.minQueryLength, geocoding.showSuggestions, currentLanguage, detectedCountryCode]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    
    // Enforce maxLength if specified
    if (maxLength && newValue.length > maxLength) {
      return;
    }
    
    if (onChange) {
      onChange(newValue);
    }

    // Clear previous coordinates if address changed significantly
    if (selectedCoordinates && value !== newValue) {
      setSelectedCoordinates(null);
    }

    // Debounced search for suggestions
    if (isLocationEnabled && geocoding.showSuggestions) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        searchAddressesDebounced(newValue);
      }, 300);
    }
  };

  const handleBlur = async (e) => {
    // Hide suggestions after a delay to allow selection
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);

    if (onBlur) {
      onBlur(e);
    }

    // Auto-geocode on blur if enabled and no coordinates selected
    if (isLocationEnabled && geocoding.autoGeocode && value && !selectedCoordinates) {
      await geocodeCurrentAddress();
    }
  };

  const handleFocus = (e) => {
    if (onFocus) {
      onFocus(e);
    }

    // Show suggestions if we have them
    if (searchResults.length > 0 && geocoding.showSuggestions) {
      setShowSuggestions(true);
    }
  };

  // Geocode the current address value
  const geocodeCurrentAddress = async () => {
    if (!value || !isLocationEnabled) return;

    try {
      setIsSearching(true);
      const results = await searchAddresses(value, {
        limit: 1,
        language: currentLanguage,
        countryCode: detectedCountryCode
      });

      if (results.length > 0) {
        const result = results[0];
        // Validate that we have valid coordinates
        if (result.lat && result.lng && !isNaN(result.lat) && !isNaN(result.lng)) {
          const formattedAddress = formatAddressForLanguage(result.address, currentLanguage) || result.display_name || result.displayName || value;
          const coordinates = {
            lat: result.lat,
            lng: result.lng,
            address: formattedAddress
          };
          
          setSelectedCoordinates(coordinates);
          updateLocationField(coordinates);
        } else {
          console.warn('Invalid coordinates in geocoding result:', result);
        }
      }
    } catch (error) {
      console.warn('Geocoding failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Select an address from suggestions
  const handleSelectAddress = (result) => {
    // Validate coordinates before using
    if (!result || !result.lat || !result.lng || isNaN(result.lat) || isNaN(result.lng)) {
      console.warn('Invalid address selection result:', result);
      return;
    }
    
    const newAddress = result.display_name || result.displayName || '';
    const coordinates = {
      lat: result.lat,
      lng: result.lng,
      address: newAddress
    };

    // Update address field
    // This is removed because the parent FormBuilder will update the
    // address field value when it receives the new coordinates.
    // Calling both onChange and onLocationUpdate causes a race condition.
    /*
    if (onChange) {
      onChange(newAddress);
    }
    */

    setSelectedCoordinates(coordinates);
    setShowSuggestions(false);
    setSearchResults([]);
    
    // Update linked location field
    updateLocationField(coordinates);

    // Focus back to input
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Update the linked location field with proper type conversion
  const updateLocationField = (coordinates) => {
    if (onLocationUpdate && (locationFieldName || location_ref)) {
      const convertedValue = convertLocationFormat(coordinates);
      onLocationUpdate(locationFieldName || location_ref, convertedValue);
    }
  };

  // Clear coordinates
  const handleClearCoordinates = () => {
    setSelectedCoordinates(null);
    updateLocationField(null);
  };

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target) &&
        !inputRef.current?.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label */}
      {showLabel && label && (
        <Label htmlFor={inputId} className="flex items-center gap-1">
          {isLocationEnabled && <MapPin className="h-4 w-4 text-blue-500" />}
          {label}
          {required && (
            <span className="text-red-500 text-sm">*</span>
          )}
        </Label>
      )}

      {/* Input Container */}
      <div className="relative">
        <Input
          ref={inputRef}
          id={inputId}
          name={name}
          type={type}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={detectedPlaceholder}
          disabled={isDisabled}
          readOnly={readOnly}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          minLength={minLength}
          maxLength={maxLength}
          className={`${showError ? 'border-red-500 focus:border-red-500' : ''} ${
            isLocationEnabled ? 'pr-20' : ''
          }`}
          aria-invalid={showError}
          aria-describedby={
            showError ? `${inputId}-error` : 
            help ? `${inputId}-help` : undefined
          }
          {...props}
        />

        {/* Location Controls */}
        {isLocationEnabled && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
            {isSearching && (
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            )}
            
            {selectedCoordinates && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearCoordinates}
                className="h-6 w-6 p-0"
                title={t('locationInput.clearCoordinates')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}

            {value && !isSearching && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={geocodeCurrentAddress}
                className="h-6 w-6 p-0"
                title={t('locationInput.searchCoordinates')}
              >
                <Search className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}

        {/* Address Suggestions */}
        {showSuggestions && searchResults.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto"
          >
            {searchResults.map((result, index) => (
              <button
                key={`${result.lat}-${result.lng}-${index}`}
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 focus:bg-gray-50 focus:outline-none"
                onClick={() => handleSelectAddress(result)}
              >
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-gray-900 line-clamp-1">
                      {result.display_name || result.displayName || 'Sin nombre'}
                    </div>
                    {result.lat && result.lng && (
                      <div className="text-xs text-gray-500">
                        {result.lat.toFixed(4)}, {result.lng.toFixed(4)}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Coordinates Display */}
      {selectedCoordinates && selectedCoordinates.lat && selectedCoordinates.lng && isLocationEnabled && (
        <div className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded">
          <div className="flex items-center justify-between">
            <span>
              📍 {t('locationInput.coordinatesLabel')} {selectedCoordinates.lat.toFixed(4)}, {selectedCoordinates.lng.toFixed(4)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearCoordinates}
              className="h-5 text-xs"
            >
              {t('locationInput.clear')}
            </Button>
          </div>
        </div>
      )}

      {/* Character counter */}
      {maxLength && (
        <div className="text-xs text-gray-500 text-right">
          {value.length}/{maxLength}
        </div>
      )}

      {/* Error message */}
      {showError && (
        <div 
          id={`${inputId}-error`}
          className="text-red-500 text-sm flex items-center gap-1"
          role="alert"
        >
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Help text */}
      {help && !showError && (
        <div 
          id={`${inputId}-help`}
          className="text-gray-500 text-sm"
        >
          {help}
        </div>
      )}
    </div>
  );
}