// LMap.jsx - Fixed bottom margin and direct marker clicks
"use client";

import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

const LMap = ({
  markers = [],
  userLocation = null,
  searchRadius = null,
  mapConfig = {},
  onMarkerClick = null,
  onMapClick = null,
  onBoundsChange = null,
  enableExploration = false,
  explorationButton = null,
  height = '600px',
  className = '',
  legend = null,
  tileLayer = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  children
}) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [L, setL] = useState(null);
  const [isExploring, setIsExploring] = useState(false);
  const isExploringRef = useRef(false);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const markersRef = useRef([]);
  const boundsTimeoutRef = useRef(null);

  // Default map configuration
  const defaultMapConfig = {
    center: [-34.548, -58.472], // Buenos Aires default
    zoom: 12,
    zoomControl: true,
    ...mapConfig
  };

  // Load Leaflet dynamically
  useEffect(() => {
    const loadLeaflet = async () => {
      if (!window.L) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }
      setL(window.L);
    };

    loadLeaflet().catch(console.error);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!L || !mapContainerRef.current) return;

    // Ensure container has dimensions before initializing map
    const container = mapContainerRef.current;
    if (!container.offsetWidth || !container.offsetHeight) {
      console.warn('Map container has no dimensions yet, waiting...');
      // Retry after a short delay
      const retryTimeout = setTimeout(() => {
        if (container.offsetWidth && container.offsetHeight && !mapRef.current) {
          // Trigger re-initialization by updating L reference
          setL(window.L);
        }
      }, 100);
      return () => clearTimeout(retryTimeout);
    }

    // Prevent double initialization
    if (mapRef.current) return;

    // Create map instance
    const mapInstance = L.map(container, {
      zoomControl: defaultMapConfig.zoomControl
    });
    
    // Set initial view
    let center = defaultMapConfig.center;
    let zoom = defaultMapConfig.zoom;

    if (userLocation) {
      center = [userLocation.lat, userLocation.lng];
      zoom = 14;
    } else if (markers.length > 0 && markers[0].lat && markers[0].lng) {
      center = [markers[0].lat, markers[0].lng];
      zoom = 13;
    }

    mapInstance.setView(center, zoom);

    // Add tile layer
    L.tileLayer(tileLayer, {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapInstance);

    // Add map click handler
    if (onMapClick) {
      mapInstance.on('click', onMapClick);
    }

    // Add bounds change handler for exploration
    if (onBoundsChangeRef.current) {
      const handleBoundsChange = () => {
        clearTimeout(boundsTimeoutRef.current);
        boundsTimeoutRef.current = setTimeout(() => {
          const bounds = mapInstance.getBounds();
          const center = mapInstance.getCenter();
          const zoom = mapInstance.getZoom();
          
          onBoundsChangeRef.current({
            bounds: {
              north: bounds.getNorth(),
              south: bounds.getSouth(),
              east: bounds.getEast(),
              west: bounds.getWest()
            },
            center: {
              lat: center.lat,
              lng: center.lng
            },
            zoom: zoom,
            isExploring: isExploringRef.current
          });
        }, 500);
      };

      mapInstance.on('moveend', handleBoundsChange);
      mapInstance.on('zoomend', handleBoundsChange);
    }

    mapRef.current = mapInstance;
    setMap(mapInstance);

    return () => {
      clearTimeout(boundsTimeoutRef.current);
      mapInstance.remove();
    };
  }, [L]);

  // Keep refs in sync
  useEffect(() => {
    isExploringRef.current = isExploring;
  }, [isExploring]);

  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
  }, [onBoundsChange]);

  // Update center when mapConfig.center changes
  useEffect(() => {
    if (!map || !mapConfig.center) return;
    var c = mapConfig.center;
    if (c && c.length === 2) {
      map.setView(c, mapConfig.zoom || map.getZoom(), { animate: true });
    }
  }, [map, mapConfig.center?.[0], mapConfig.center?.[1], mapConfig.zoom]);

  // Update markers
  useEffect(() => {
    if (!map || !L) return;

    // Clear existing markers immediately
    markersRef.current.forEach(marker => {
      try {
        marker.remove();
      } catch (e) {
        // Ignore errors from removing markers
      }
    });
    markersRef.current = [];

    // Wait for map to be fully ready
    const addMarkers = () => {
      // Double check map is still valid
      if (!map._container) return;

      const bounds = [];

      // Add user location marker
      if (userLocation) {
      const userIcon = L.divIcon({
        html: userLocation.icon || `
          <div style="position: relative;">
            <div style="
              position: absolute;
              inset: -4px;
              background: linear-gradient(to right, #3b82f6, #06b6d4);
              border-radius: 50%;
              opacity: 0.3;
              animation: pulse 2s infinite;
            "></div>
            <div style="
              width: 24px;
              height: 24px;
              background: #3b82f6;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="
                width: 8px;
                height: 8px;
                background: white;
                border-radius: 50%;
              "></div>
            </div>
          </div>
        `,
        className: 'user-location-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .addTo(map);

      if (userLocation.popup) {
        userMarker.bindPopup(userLocation.popup);
      }
      
      markersRef.current.push(userMarker);

      // Add search radius circle
      if (searchRadius) {
        const circle = L.circle([userLocation.lat, userLocation.lng], {
          color: '#10b981',
          fillColor: '#10b981',
          fillOpacity: 0.1,
          weight: 2,
          radius: searchRadius
        }).addTo(map);
        
        markersRef.current.push(circle);
      }

      bounds.push([userLocation.lat, userLocation.lng]);
    }

    // Add markers
    markers.forEach((marker, index) => {
      if (!marker.lat || !marker.lng) return;

      // Create marker icon
      const markerIcon = marker.icon ? L.divIcon({
        html: marker.icon,
        className: marker.className || 'custom-marker',
        iconSize: marker.iconSize || [32, 32],
        iconAnchor: marker.iconAnchor || [16, 16],
        popupAnchor: marker.popupAnchor || [0, -16]
      }) : undefined;

      // Create marker
      const leafletMarker = markerIcon 
        ? L.marker([marker.lat, marker.lng], { icon: markerIcon })
        : L.marker([marker.lat, marker.lng]);

      leafletMarker.addTo(map);

      // Direct click handler (no popup if clickable)
      if (marker.clickable !== false && onMarkerClick) {
        leafletMarker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onMarkerClick(marker, index);
        });
      } else if (marker.popup) {
        // Only add popup if not clickable
        leafletMarker.bindPopup(marker.popup);
      }

      markersRef.current.push(leafletMarker);
      bounds.push([marker.lat, marker.lng]);
    });

      // Fit bounds if we have markers and no user location
      if (bounds.length > 1 && !userLocation) {
        try {
          map.fitBounds(bounds, { padding: [50, 50] });
        } catch (e) {
          console.warn('Failed to fit bounds:', e);
        }
      }
    };

    // Ensure map is fully initialized before adding markers
    let readyTimeout;
    let markersAdded = false;

    const safelyAddMarkers = () => {
      // Prevent duplicate marker addition
      if (markersAdded) return;

      // Comprehensive readiness check
      try {
        if (!map || !map._container || !map._loaded) return false;

        // Check if panes are properly initialized
        const panes = map.getPanes();
        if (!panes || !panes.markerPane || !panes.markerPane.parentNode) {
          return false;
        }

        // All checks passed - add markers
        markersAdded = true;
        addMarkers();
        return true;
      } catch (e) {
        console.warn('Map not ready yet:', e.message);
        return false;
      }
    };

    const initializeMarkers = () => {
      // Try immediate initialization
      if (safelyAddMarkers()) {
        return;
      }

      // Use whenReady for guaranteed initialization
      map.whenReady(() => {
        // Small delay to ensure all panes are fully attached to DOM
        readyTimeout = setTimeout(() => {
          if (!markersAdded) {
            safelyAddMarkers();
          }
        }, 50);
      });
    };

    initializeMarkers();

    // Cleanup timeout on unmount
    return () => {
      if (readyTimeout) clearTimeout(readyTimeout);
    };
  }, [map, L, markers, userLocation, searchRadius, onMarkerClick]);

  return (
    <>
      {/* Inject CSS styles for animations and fixes */}
      <style jsx>{`
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.2;
          }
          100% {
            transform: scale(1);
            opacity: 0.3;
          }
        }
        
        .leaflet-container {
          position: relative !important;
          width: 100% !important;
          height: 100% !important;
        }
        
        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        
        .leaflet-popup-content {
          margin: 0;
          padding: 0;
        }
        
        .user-location-marker,
        .custom-marker {
          background: transparent !important;
          border: none !important;
        }
        
        /* Fix for mobile controls */
        .leaflet-control-container {
          pointer-events: auto;
        }
        
        .leaflet-control-zoom {
          margin: 10px !important;
        }
        
        /* Fix bottom cut-off issue */
        .leaflet-bottom {
          bottom: 0 !important;
        }
        
        .leaflet-touch .leaflet-control-layers,
        .leaflet-touch .leaflet-bar {
          border: 2px solid rgba(0,0,0,0.1);
          background-clip: padding-box;
        }
        
        /* Ensure proper cursor for clickable markers */
        .custom-marker {
          cursor: pointer !important;
        }
      `}</style>

      <div 
        className={`relative ${className}`}
        style={{ 
          height,
          width: '100%',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div 
          ref={mapContainerRef}
          style={{ 
            height: '100%',
            width: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
          }}
          className="rounded-lg"
        />
        
        {/* Exploration Mode Button */}
        {enableExploration && (
          <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-[1000]">
            <button
              onClick={() => setIsExploring(!isExploring)}
              className={`
                px-3 py-2 rounded-lg shadow-lg font-medium text-xs sm:text-sm
                transition-all duration-200 flex items-center gap-2
                ${isExploring 
                  ? 'bg-green-500 text-white hover:bg-green-600' 
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }
              `}
            >
              {isExploring ? (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  {explorationButton?.activeText || 'Buscando en esta área'}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M9 3v18M21 9H3"/>
                  </svg>
                  {explorationButton?.text || 'Buscar mientras navego'}
                </>
              )}
            </button>
          </div>
        )}

        {/* Show exploration indicator */}
        {isExploring && (
          <div className="absolute top-14 left-2 sm:top-16 sm:left-4 z-[1000]">
            <div className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-medium shadow-md">
              {explorationButton?.helpText || 'Mueve el mapa para buscar en otras áreas'}
            </div>
          </div>
        )}

        {/* Legend */}
        {legend && legend.items && (
          <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 z-[1000]">
            <div className="space-y-2 text-xs">
              {legend.items.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className={item.className || "w-4 h-4 rounded-full"}
                    style={item.style}
                  />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Children (custom overlays) */}
        {children}
      </div>
    </>
  );
};

export default LMap;