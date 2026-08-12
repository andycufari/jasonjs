// geocoding.js - Free geocoding using OpenStreetMap Nominatim API
import { formatAddressByLocale } from './formatting';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const SEARCH_DELAY = 1000; // 1 second delay between requests (rate limiting)

// Cache to avoid repeated requests
const geocodeCache = new Map();
let lastRequestTime = 0;

/**
 * Rate-limited fetch function
 */
async function rateLimitedFetch(url) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < SEARCH_DELAY) {
    await new Promise(resolve => setTimeout(resolve, SEARCH_DELAY - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'JasonJS Framework (https://github.com/jasonjs-framework)'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Geocoding error: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Search for addresses using Nominatim API
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of search results
 */
export async function searchAddresses(query, options = {}) {
  if (!query || query.trim().length < 3) {
    return [];
  }
  
  const {
    limit = 5,
    countryCode = null, // No country restriction by default
    viewbox = null, // Bounding box for results
    bounded = false,
    language = 'en', // Language for results (default to English)
    addressFormat = 'default' // Address format preference
  } = options;
  
  // Check cache first
  const cacheKey = `search_${query}_${countryCode}_${limit}_${language}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }
  
  try {
    const params = new URLSearchParams({
      q: query.trim(),
      format: 'json',
      limit: limit.toString(),
      addressdetails: '1',
      extratags: '1',
      namedetails: '1',
      'accept-language': language
    });
    
    if (countryCode) {
      params.append('countrycodes', countryCode.toLowerCase());
    }
    
    if (viewbox) {
      params.append('viewbox', viewbox);
      if (bounded) {
        params.append('bounded', '1');
      }
    }
    
    const url = `${NOMINATIM_BASE_URL}/search?${params.toString()}`;
    const results = await rateLimitedFetch(url);
    
    // Format results with both flat and nested structure for compatibility
    const formattedResults = results.map(result => {
      const addressComponents = {
        house_number: result.address?.house_number,
        road: result.address?.road,
        suburb: result.address?.suburb,
        city: result.address?.city || result.address?.town || result.address?.village,
        state: result.address?.state,
        postcode: result.address?.postcode,
        country: result.address?.country
      };

      // Format address based on preferences
      const formattedAddress = addressFormat !== 'default' 
        ? formatAddressByLocale(addressComponents, { 
            format: addressFormat,
            locale: language === 'en' ? 'en-US' : 'es-AR'
          })
        : result.display_name;

      return {
        id: result.place_id,
        display_name: formattedAddress, // Use formatted address
        displayName: formattedAddress,
        originalDisplayName: result.display_name, // Keep original for fallback
        name: result.name,
        // Flat coordinates for direct access
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        // Also provide nested structure
        address: addressComponents,
        coordinates: {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon)
        },
        boundingBox: result.boundingbox ? {
          north: parseFloat(result.boundingbox[1]),
          south: parseFloat(result.boundingbox[0]),
          east: parseFloat(result.boundingbox[3]),
          west: parseFloat(result.boundingbox[2])
        } : null,
        type: result.type,
        importance: result.importance
      };
    });
    
    // Cache results
    geocodeCache.set(cacheKey, formattedResults);
    
    return formattedResults;
  } catch (error) {
    console.error('Address search error:', error);
    return [];
  }
}

/**
 * Reverse geocode coordinates to address
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Object} options - Options
 * @returns {Promise<Object|null>} Address object or null
 */
export async function reverseGeocode(lat, lng, options = {}) {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return null;
  }

  const { zoom = 18, language = 'en' } = options;

  // Check cache first
  const cacheKey = `reverse_${lat}_${lng}_${zoom}_${language}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lng.toString(),
      format: 'json',
      addressdetails: '1',
      zoom: zoom.toString(),
      'accept-language': language
    });
    
    const url = `${NOMINATIM_BASE_URL}/reverse?${params.toString()}`;
    const result = await rateLimitedFetch(url);
    
    if (!result || result.error) {
      return null;
    }
    
    const formattedResult = {
      displayName: result.display_name,
      name: result.name,
      address: {
        house_number: result.address?.house_number,
        road: result.address?.road,
        suburb: result.address?.suburb,
        city: result.address?.city || result.address?.town || result.address?.village,
        state: result.address?.state,
        postcode: result.address?.postcode,
        country: result.address?.country
      },
      coordinates: {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon)
      }
    };
    
    // Cache result
    geocodeCache.set(cacheKey, formattedResult);
    
    return formattedResult;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

/**
 * Format address for display
 * @param {Object} address - Address object
 * @returns {string} Formatted address string
 */
export function formatAddress(address) {
  if (!address) return '';
  
  const parts = [];
  
  // Street address
  if (address.house_number && address.road) {
    parts.push(`${address.road} ${address.house_number}`);
  } else if (address.road) {
    parts.push(address.road);
  }
  
  // Suburb/neighborhood
  if (address.suburb) {
    parts.push(address.suburb);
  }
  
  // City
  if (address.city) {
    parts.push(address.city);
  }
  
  // State
  if (address.state) {
    parts.push(address.state);
  }
  
  // Postal code
  if (address.postcode) {
    parts.push(address.postcode);
  }
  
  return parts.join(', ');
}

/**
 * Get user's approximate location using IP geolocation
 * @returns {Promise<Object|null>} Location object or null
 */
export async function getUserLocation() {
  try {
    // Try to use browser geolocation first
    if (navigator.geolocation) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy
            });
          },
          () => {
            // Fallback to IP-based location (optional)
            resolve(null);
          },
          {
            timeout: 10000,
            enableHighAccuracy: false
          }
        );
      });
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user location:', error);
    return null;
  }
}

/**
 * Calculate distance between two points in kilometers
 * @param {Object} point1 - { lat, lng }
 * @param {Object} point2 - { lat, lng }
 * @returns {number} Distance in kilometers
 */
export function calculateDistance(point1, point2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLng = (point2.lng - point1.lng) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Clear geocoding cache (useful for memory management)
 */
export function clearGeocodeCache() {
  geocodeCache.clear();
}