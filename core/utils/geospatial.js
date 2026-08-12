// core/utils/geospatial.js
// Geospatial utility functions for JasonJS Framework

/**
 * Calculate distance between two points using Haversine formula
 * @param {Array<number>} point1 - [longitude, latitude]
 * @param {Array<number>} point2 - [longitude, latitude]
 * @returns {number} Distance in meters
 */
export function calculateDistance(point1, point2) {
  const [lon1, lat1] = point1;
  const [lon2, lat2] = point2;
  
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Calculate bearing between two points
 * @param {Array<number>} point1 - [longitude, latitude]
 * @param {Array<number>} point2 - [longitude, latitude]
 * @returns {number} Bearing in degrees (0-360)
 */
export function calculateBearing(point1, point2) {
  const [lon1, lat1] = point1;
  const [lon2, lat2] = point2;
  
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = Math.atan2(y, x);
  
  return ((θ * 180 / Math.PI) + 360) % 360; // Normalize to 0-360
}

/**
 * Generate a bounding box around a center point
 * @param {Array<number>} center - [longitude, latitude]
 * @param {number} radiusMeters - Radius in meters
 * @returns {Object} Bounding box with southwest and northeast corners
 */
export function getBoundingBox(center, radiusMeters) {
  const [lon, lat] = center;
  
  // Convert radius to degrees (approximate)
  const latDegrees = radiusMeters / 111320; // meters per degree latitude
  const lonDegrees = radiusMeters / (111320 * Math.cos(lat * Math.PI / 180)); // meters per degree longitude at this latitude
  
  return {
    southwest: [lon - lonDegrees, lat - latDegrees],
    northeast: [lon + lonDegrees, lat + latDegrees]
  };
}

/**
 * Check if a point is within a bounding box
 * @param {Array<number>} point - [longitude, latitude]
 * @param {Array<number>} southwest - [longitude, latitude]
 * @param {Array<number>} northeast - [longitude, latitude]
 * @returns {boolean} True if point is within bounds
 */
export function isWithinBounds(point, southwest, northeast) {
  const [lon, lat] = point;
  const [swLon, swLat] = southwest;
  const [neLon, neLat] = northeast;
  
  return lon >= swLon && lon <= neLon && lat >= swLat && lat <= neLat;
}

/**
 * Convert coordinates between different formats
 * @param {*} coordinates - Input coordinates (various formats)
 * @returns {Array<number>} Normalized [longitude, latitude] array
 */
export function normalizeCoordinates(coordinates) {
  // Handle GeoJSON Point
  if (coordinates && coordinates.type === 'Point' && coordinates.coordinates) {
    return coordinates.coordinates;
  }
  
  // Handle coordinate objects
  if (coordinates && typeof coordinates === 'object' && coordinates.longitude !== undefined) {
    return [coordinates.longitude, coordinates.latitude];
  }
  
  if (coordinates && typeof coordinates === 'object' && coordinates.lng !== undefined) {
    return [coordinates.lng, coordinates.lat];
  }
  
  // Handle arrays
  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    return [coordinates[0], coordinates[1]];
  }
  
  throw new Error('Invalid coordinate format. Expected [longitude, latitude] or GeoJSON Point');
}

/**
 * Format coordinates for display
 * @param {Array<number>} coordinates - [longitude, latitude]
 * @param {number} precision - Decimal places (default: 6)
 * @returns {string} Formatted coordinates string
 */
export function formatCoordinates(coordinates, precision = 6) {
  const [lon, lat] = normalizeCoordinates(coordinates);
  return `${lat.toFixed(precision)}, ${lon.toFixed(precision)}`;
}

/**
 * Convert distance between different units
 * @param {number} distance - Distance value
 * @param {string} fromUnit - Source unit ('m', 'km', 'mi', 'ft')
 * @param {string} toUnit - Target unit ('m', 'km', 'mi', 'ft')
 * @returns {number} Converted distance
 */
export function convertDistance(distance, fromUnit, toUnit) {
  // Convert to meters first
  let meters;
  switch (fromUnit.toLowerCase()) {
    case 'm':
    case 'meter':
    case 'meters':
      meters = distance;
      break;
    case 'km':
    case 'kilometer':
    case 'kilometers':
      meters = distance * 1000;
      break;
    case 'mi':
    case 'mile':
    case 'miles':
      meters = distance * 1609.344;
      break;
    case 'ft':
    case 'foot':
    case 'feet':
      meters = distance * 0.3048;
      break;
    default:
      throw new Error(`Unknown unit: ${fromUnit}`);
  }
  
  // Convert from meters to target unit
  switch (toUnit.toLowerCase()) {
    case 'm':
    case 'meter':
    case 'meters':
      return meters;
    case 'km':
    case 'kilometer':
    case 'kilometers':
      return meters / 1000;
    case 'mi':
    case 'mile':
    case 'miles':
      return meters / 1609.344;
    case 'ft':
    case 'foot':
    case 'feet':
      return meters / 0.3048;
    default:
      throw new Error(`Unknown unit: ${toUnit}`);
  }
}

/**
 * Generate a circular polygon approximation
 * @param {Array<number>} center - [longitude, latitude]
 * @param {number} radiusMeters - Radius in meters
 * @param {number} points - Number of points to generate (default: 32)
 * @returns {Object} GeoJSON Polygon
 */
export function createCirclePolygon(center, radiusMeters, points = 32) {
  const [centerLon, centerLat] = center;
  const coordinates = [];
  
  for (let i = 0; i <= points; i++) {
    const angle = (i * 360 / points) * Math.PI / 180;
    
    // Calculate point on circle
    const latOffset = (radiusMeters / 111320) * Math.cos(angle);
    const lonOffset = (radiusMeters / (111320 * Math.cos(centerLat * Math.PI / 180))) * Math.sin(angle);
    
    coordinates.push([
      centerLon + lonOffset,
      centerLat + latOffset
    ]);
  }
  
  return {
    type: 'Polygon',
    coordinates: [coordinates]
  };
}

/**
 * Parse various location string formats
 * @param {string} locationString - Location string (e.g., "lat,lng", "lng lat")
 * @returns {Array<number>} [longitude, latitude]
 */
export function parseLocationString(locationString) {
  if (typeof locationString !== 'string') {
    throw new Error('Location must be a string');
  }
  
  // Remove extra whitespace and split by common separators
  const parts = locationString.trim().split(/[,\s]+/).map(part => parseFloat(part.trim()));
  
  if (parts.length !== 2 || parts.some(isNaN)) {
    throw new Error('Location string must contain exactly two numeric values');
  }
  
  // Assume first number is latitude, second is longitude if values look like lat/lng
  // (latitude is typically smaller in absolute value than longitude)
  if (Math.abs(parts[0]) <= 90 && Math.abs(parts[1]) <= 180) {
    return [parts[1], parts[0]]; // [longitude, latitude]
  } else {
    // Assume it's already in [longitude, latitude] format
    return parts;
  }
}

/**
 * Geospatial validation functions
 */
export const validation = {
  /**
   * Check if coordinates are valid
   * @param {Array<number>} coordinates - [longitude, latitude]
   * @returns {boolean} True if valid
   */
  isValidCoordinates(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
      return false;
    }
    
    const [lon, lat] = coordinates;
    return typeof lon === 'number' && typeof lat === 'number' &&
           lon >= -180 && lon <= 180 &&
           lat >= -90 && lat <= 90 &&
           !isNaN(lon) && !isNaN(lat);
  },
  
  /**
   * Check if distance is valid
   * @param {number} distance - Distance in meters
   * @returns {boolean} True if valid
   */
  isValidDistance(distance) {
    return typeof distance === 'number' && distance >= 0 && !isNaN(distance);
  }
};

/**
 * Common locations for testing and examples
 */
export const commonLocations = {
  buenosAires: [-58.3816, -34.6037],
  newYork: [-74.006, 40.7128],
  london: [-0.1276, 51.5074],
  tokyo: [139.6503, 35.6762],
  sydney: [151.2093, -33.8688],
  paris: [2.3522, 48.8566],
  madrid: [-3.7038, 40.4168],
  rome: [12.4964, 41.9028]
};