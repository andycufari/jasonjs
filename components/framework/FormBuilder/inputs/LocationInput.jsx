// LocationInput.jsx - Address search with coordinates using free Nominatim API
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertCircle, MapPin, Search, Loader2, Target, X } from 'lucide-react';
import { searchAddresses, reverseGeocode, formatAddress, getUserLocation } from '../utils/geocoding';
import { parseCoordinates, formatCoordinates } from '../utils/formatting';
import { useFormBuilderLanguage } from '../i18n/useFormBuilderLanguage';

/**
 * Location input with address search and coordinate storage
 */
export default function LocationInput({
  id,
  name,
  value = null, // { lat, lng, address? }
  onChange,
  onBlur,
  onFocus,
  fieldSchema = {},
  error = null,
  touched = false,
  disabled = false,
  className = '',
  showLabel = true,
  language = null, // Optional language override
  ...props
}) {
  // i18n hook
  const { t, language: detectedLanguage } = useFormBuilderLanguage(language);

  // Use provided language or detected language from i18n
  const currentLanguage = language || detectedLanguage;

  const [addressQuery, setAddressQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [showCoordinateEditor, setShowCoordinateEditor] = useState(false);
  const searchTimeoutRef = useRef(null);
  const hideTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const justSelectedRef = useRef(false); // Prevents re-search after selection

  const {
    label = t('locationInput.label'),
    placeholder = t('locationInput.placeholder'),
    help,
    required = false,
    showCoordinates = false,
    showMap = false,
    allowManualCoordinates = true,
    allowCurrentLocation = true,
    countryCode = null // No country restriction by default
  } = fieldSchema;

  const inputId = id || name;
  const showError = error && touched;
  const isDisabled = disabled || fieldSchema.readOnly;
  const coordinates = parseCoordinates(value);

  useEffect(() => {
    // This effect syncs the internal address text with the parent value.
    // It runs only when the address string from the parent changes.
    if (value?.address && value.address !== addressQuery) {
      // Mark as just selected to prevent re-search loop
      justSelectedRef.current = true;
      setAddressQuery(value.address);
      // Don't show results when loading existing data
      setShowResults(false);
      setSearchResults([]);
    } else if (!value && addressQuery) {
      // Handle the case where the parent value is cleared
      setAddressQuery('');
      setShowResults(false);
      setSearchResults([]);
    }
  }, [value?.address]);

  // Use ref to store onChange to prevent infinite loops
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    // This effect fetches an address via reverse geocoding if we only have coordinates.
    // It runs only when the coordinates change and no address is present.
    const coordinates = parseCoordinates(value);
    if (coordinates && !value?.address) {
      reverseGeocode(coordinates.lat, coordinates.lng, { language: currentLanguage })
        .then(result => {
          if (result && onChangeRef.current) {
            const formattedAddress = formatAddress(result.address);
            // Update the parent component's state with the full location object
            onChangeRef.current({
              ...coordinates,
              address: formattedAddress,
            });
          }
        })
        .catch(console.error);
    }
  }, [value?.lat, value?.lng, currentLanguage]); // Added language to dependencies

  // Handle address search
  useEffect(() => {
    // Skip search on initial load or when setting address from existing data
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    // Skip search if user just selected a result (prevents re-search loop)
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }

    if (addressQuery.length >= 3) {
      // Clear previous timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // Debounced search
      searchTimeoutRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const results = await searchAddresses(addressQuery, {
            countryCode,
            limit: 5,
            language: currentLanguage
          });
          setSearchResults(results);
          setShowResults(results.length > 0);
        } catch (error) {
          console.error('Search error:', error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 500);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [addressQuery, countryCode, currentLanguage]);

  const handleAddressChange = (e) => {
    // This is user input, not initial data loading
    isInitialLoadRef.current = false;
    setAddressQuery(e.target.value);
    setShowResults(true);
  };

  const handleSelectResult = (result) => {
    const newValue = {
      lat: result.coordinates.lat,
      lng: result.coordinates.lng,
      address: result.displayName
    };

    // Mark that we just selected - prevents re-search loop
    justSelectedRef.current = true;

    setAddressQuery(result.displayName);
    setShowResults(false);
    setSearchResults([]); // Clear results to prevent re-showing

    if (onChange) {
      onChange(newValue);
    }
  };

  const handleGetCurrentLocation = async () => {
    setIsGettingLocation(true);
    try {
      const location = await getUserLocation();
      if (location) {
        // Reverse geocode to get address
        const result = await reverseGeocode(location.lat, location.lng, { language: currentLanguage });
        const address = result ? formatAddress(result.address) : '';

        const newValue = {
          lat: location.lat,
          lng: location.lng,
          address
        };

        // Mark that we just selected - prevents re-search loop
        justSelectedRef.current = true;

        setAddressQuery(address);
        setShowResults(false);
        setSearchResults([]);

        if (onChange) {
          onChange(newValue);
        }
      } else {
        // Handle location permission denied or unavailable
        alert(t('locationInput.locationError'));
      }
    } catch (error) {
      console.error('Location error:', error);
      alert(t('locationInput.locationErrorGeneric'));
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleManualCoordinates = (lat, lng) => {
    const newValue = {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      address: addressQuery || formatCoordinates({ lat, lng })
    };
    
    if (onChange) {
      onChange(newValue);
    }
  };

  const handleClear = () => {
    setAddressQuery('');
    setSearchResults([]);
    setShowResults(false);
    
    if (onChange) {
      onChange(null);
    }
  };

  const handleBlur = (e) => {
    // Clear any previous hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    // Delay hiding results to allow clicking on them
    hideTimeoutRef.current = setTimeout(() => {
      setShowResults(false);
    }, 150);

    if (onBlur) {
      onBlur(e);
    }
  };

  const handleFocus = (e) => {
    // Clear any hide timeout when focusing
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    // Only show results if there are search results from user searching
    // Don't auto-show on focus unless user has typed something
    if (searchResults.length > 0 && addressQuery.length >= 3) {
      setShowResults(true);
    }

    if (onFocus) {
      onFocus(e);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label */}
      {showLabel && label && (
        <Label htmlFor={inputId} className="flex items-center gap-1">
          <MapPin className="h-4 w-4" />
          {label}
          {required && (
            <span className="text-red-500 text-sm">*</span>
          )}
        </Label>
      )}

      {/* Address Search Input */}
      <div className="relative">
        <div className="relative">
          <Input
            ref={inputRef}
            id={inputId}
            name={name}
            type="text"
            value={addressQuery}
            onChange={handleAddressChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
            placeholder={placeholder}
            disabled={isDisabled}
            className={`pr-20 ${showError ? 'border-red-500 focus:border-red-500' : ''}`}
            aria-invalid={showError}
            aria-describedby={
              showError ? `${inputId}-error` : 
              help ? `${inputId}-help` : undefined
            }
            {...props}
          />
          
          {/* Loading indicator */}
          {isSearching && (
            <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400 dark:text-gray-500" />
            </div>
          )}

          {/* Clear button */}
          {addressQuery && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              disabled={isDisabled}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
            {searchResults.map((result, index) => (
              <button
                key={result.id || index}
                type="button"
                onClick={() => handleSelectResult(result)}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none"
              >
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{result.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {formatAddress(result.address)}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {allowCurrentLocation && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGetCurrentLocation}
            disabled={isDisabled || isGettingLocation}
            className="flex items-center gap-2"
          >
            {isGettingLocation ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Target className="h-4 w-4" />
            )}
            {t('locationInput.myLocation')}
          </Button>
        )}

        {allowManualCoordinates && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowCoordinateEditor(!showCoordinateEditor)}
            disabled={isDisabled}
          >
            {t('locationInput.coordinates')}
          </Button>
        )}
      </div>

      {/* Manual Coordinate Editor */}
      {showCoordinateEditor && allowManualCoordinates && (
        <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800">
          <div className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">{t('locationInput.manualCoordinates')}</div>
          <div className="flex gap-2">
            <Input
              type="number"
              step="any"
              placeholder={t('locationInput.latitude')}
              value={coordinates?.lat || ''}
              onChange={(e) => handleManualCoordinates(e.target.value, coordinates?.lng || 0)}
              className="text-sm"
            />
            <Input
              type="number"
              step="any"
              placeholder={t('locationInput.longitude')}
              value={coordinates?.lng || ''}
              onChange={(e) => handleManualCoordinates(coordinates?.lat || 0, e.target.value)}
              className="text-sm"
            />
          </div>
        </div>
      )}

      {/* Current Coordinates Display */}
      {coordinates && showCoordinates && (
        <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded">
          <div className="font-medium text-gray-700 dark:text-gray-300">{t('locationInput.coordinatesLabel')}</div>
          <div className="font-mono">{formatCoordinates(coordinates)}</div>
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
          className="text-gray-500 dark:text-gray-400 text-sm"
        >
          {help}
        </div>
      )}
    </div>
  );
}