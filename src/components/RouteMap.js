import React, { useMemo, useRef, useEffect, useState } from 'react';
import DottedMap from 'dotted-map/without-countries';
import { AIRPORTS } from './AirportSearch';

// Create a lookup map for airport coordinates
const AIRPORT_COORDINATES = AIRPORTS.reduce((acc, airport) => {
  acc[airport.code] = {
    lat: airport.lat,
    lng: airport.lng,
    city: airport.city,
    country: airport.country
  };
  return acc;
}, {});

// Generate European map data (cached)
let cachedMapData = null;

const generateEuropeanMapData = () => {
  if (cachedMapData) return cachedMapData;
  
  try {
    // Import the full dotted-map for generation
    const { getMapJSON } = require('dotted-map');
    
    // Generate a map focused on Europe only
    cachedMapData = getMapJSON({
      width: 140, // Increased width for better resolution
      height: 80, // Increased height for better resolution
      countries: ['FRA', 'ITA', 'DEU', 'ESP', 'GBR', 'NLD', 'BEL', 'CHE', 'AUT', 'POL', 'CZE', 'HUN', 'PRT', 'GRC', 'SWE', 'NOR', 'DNK', 'FIN', 'IRL', 'LUX', 'SVK', 'SVN', 'EST', 'LVA', 'LTU', 'HRV', 'BGR', 'ROU', 'CYP', 'MLT'],
      region: { 
        lat: { min: 35, max: 72 }, // Extended north to include more of Scandinavia
        lng: { min: -10, max: 40 }  // Europe longitude range
      },
      grid: 'diagonal'
    });
    
    return cachedMapData;
  } catch (error) {
    console.error('Failed to generate map data:', error);
    return null;
  }
};

const RouteMap = React.memo(({ routes = [], themeColor = '#1E1E1E' }) => {
  // Always call hooks at the top level - no conditional returns before hooks
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const mapData = useMemo(() => {
    return generateEuropeanMapData();
  }, []);

  const mapInstance = useMemo(() => {
    if (!mapData) return null;
    
    try {
      const map = new DottedMap({ map: JSON.parse(mapData) });
      
      // Add pins for each route (only if routes exist)
      if (routes && routes.length > 0) {
        routes.forEach((route, index) => {
          const airportCode = route.airport?.code;
          const coordinates = AIRPORT_COORDINATES[airportCode];
          
          if (coordinates) {
            map.addPin({
              lat: coordinates.lat,
              lng: coordinates.lng,
              svgOptions: { 
                color: themeColor, 
                radius: 0.4, // Smaller pins for better proportion at full width
                stroke: '#FFFFFF',
                strokeWidth: 1.5
              },
              data: { 
                airportCode, 
                city: coordinates.city, 
                country: coordinates.country,
                routeIndex: index,
                type: route.type
              }
            });
          }
        });
      }
      
      return map;
    } catch (error) {
      console.error('Error creating map instance:', error);
      return null;
    }
  }, [routes, mapData, themeColor]);

  const svgMap = useMemo(() => {
    if (!mapInstance) return null;
    
    try {
      let svg = mapInstance.getSVG({
        radius: 0.2, // Smaller dots for better density at full width
        color: '#B8BCC8', // Medium-light grey for balanced visibility
        shape: 'hexagon',
        backgroundColor: 'transparent'
      });
      
      // Option 4: Add text labels directly to SVG - DISABLED (using HTML overlay instead)
      // SVG coordinates don't map directly to pixels, so pixel adjustments don't work
      if (false && routes && routes.length > 0) {
        try {
          const parser = new DOMParser();
          const svgDoc = parser.parseFromString(svg, 'image/svg+xml');
          const svgElement = svgDoc.documentElement;
          
          // Check for parsing errors
          const parseError = svgDoc.querySelector('parsererror');
          if (parseError) {
            console.error('SVG parsing error:', parseError.textContent);
            throw new Error('SVG parsing failed');
          }
          
          // Find all circle elements (pins) in the SVG
          const circles = Array.from(svgElement.querySelectorAll('circle'));
          console.log('Found circles:', circles.length, 'Routes:', routes.length);
          
          // Filter circles that match our pin style - be more lenient with matching
          const pinCircles = circles.filter(circle => {
            const fill = circle.getAttribute('fill');
            const stroke = circle.getAttribute('stroke');
            const strokeWidth = parseFloat(circle.getAttribute('stroke-width') || '0');
            const r = parseFloat(circle.getAttribute('r') || '0');
            
            // Match our pin characteristics: theme color fill, white stroke, reasonable radius
            // Be more lenient - check if it has white stroke and reasonable size
            const hasWhiteStroke = stroke === '#FFFFFF' || stroke === 'white' || stroke === '#fff';
            const hasThemeFill = fill === themeColor || fill?.toLowerCase() === themeColor?.toLowerCase();
            const hasReasonableSize = r > 0.2 && r < 1; // Pin radius should be around 0.4
            
            return hasWhiteStroke && hasThemeFill && hasReasonableSize;
          });
          
          console.log('Filtered pin circles:', pinCircles.length, 'Theme color:', themeColor);
          
          // If we didn't find enough pins, try a different approach - get all circles with white stroke
          if (pinCircles.length < routes.length) {
            const allWhiteStrokeCircles = circles.filter(circle => {
              const stroke = circle.getAttribute('stroke');
              const r = parseFloat(circle.getAttribute('r') || '0');
              return (stroke === '#FFFFFF' || stroke === 'white' || stroke === '#fff') && r > 0.2 && r < 1;
            });
            console.log('All white stroke circles:', allWhiteStrokeCircles.length);
            
            // Use the last N circles (pins are usually added last)
            if (allWhiteStrokeCircles.length >= routes.length) {
              pinCircles.length = 0;
              pinCircles.push(...allWhiteStrokeCircles.slice(-routes.length));
            }
          }
          
          // Match pins to routes by order (pins are added in the same order as routes)
          routes.forEach((route, index) => {
            const airportCode = route.airport?.code;
            const coordinates = AIRPORT_COORDINATES[airportCode];
            if (!coordinates || index >= pinCircles.length) {
              console.warn(`No pin found for route ${index}:`, airportCode);
              return;
            }
            
            const pinCircle = pinCircles[index];
            if (!pinCircle) {
              console.warn(`Pin circle not found at index ${index}`);
              return;
            }
            
            const cx = parseFloat(pinCircle.getAttribute('cx'));
            const cy = parseFloat(pinCircle.getAttribute('cy'));
            const pinRadius = parseFloat(pinCircle.getAttribute('r') || '0.4');
            
            console.log(`Adding label for ${airportCode} at (${cx}, ${cy}), radius: ${pinRadius}`);
            
            // Create text element 4px closer (overlapping pin)
            const text = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', cx);
            text.setAttribute('y', cy - pinRadius + 4); // 4px closer (overlapping pin by 4px)
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'hanging');
            text.setAttribute('fill', '#FFFFFF'); // White text for contrast
            text.setAttribute('font-size', '9'); // Minimal text size (9px)
            text.setAttribute('font-weight', '600');
            text.setAttribute('font-family', 'system-ui, -apple-system, sans-serif');
            text.textContent = `${route.airport.city} (${route.airport.code})`;
            
            // Estimate text dimensions for background
            const textLength = text.textContent.length;
            const estimatedWidth = textLength * 5.5; // ~5.5px per character for 9px font
            const estimatedHeight = 11; // Height for 9px font
            
            // Add background rectangle for better readability
            const rect = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', cx - estimatedWidth / 2 - 3);
            rect.setAttribute('y', cy - pinRadius + 4 - estimatedHeight - 2);
            rect.setAttribute('width', estimatedWidth + 6);
            rect.setAttribute('height', estimatedHeight + 4);
            rect.setAttribute('fill', themeColor);
            rect.setAttribute('rx', '3');
            rect.setAttribute('opacity', '0.9');
            
            // Insert elements after the pin circle
            pinCircle.parentNode.insertBefore(rect, pinCircle.nextSibling);
            pinCircle.parentNode.insertBefore(text, rect.nextSibling);
          });
          
          // Convert back to string
          const serializer = new XMLSerializer();
          svg = serializer.serializeToString(svgElement);
          console.log('SVG with labels generated successfully');
        } catch (parseError) {
          console.error('Failed to add SVG labels:', parseError);
          // Fall through to return SVG without labels
        }
      }
      
      return svg;
    } catch (error) {
      console.error('Error generating SVG map:', error);
      return null;
    }
  }, [mapInstance, routes, themeColor]);

  // Generate connection lines between consecutive routes
  const connectionLines = useMemo(() => {
    if (!routes || routes.length < 2) return '';
    
    const lines = [];
    for (let i = 0; i < routes.length - 1; i++) {
      const currentRoute = routes[i];
      const nextRoute = routes[i + 1];
      
      const currentCoords = AIRPORT_COORDINATES[currentRoute.airport?.code];
      const nextCoords = AIRPORT_COORDINATES[nextRoute.airport?.code];
      
      if (currentCoords && nextCoords) {
        // Convert lat/lng to SVG coordinates (simplified projection)
        const x1 = (currentCoords.lng + 180) * 2; // Rough conversion
        const y1 = (90 - currentCoords.lat) * 2;
        const x2 = (nextCoords.lng + 180) * 2;
        const y2 = (90 - nextCoords.lat) * 2;
        
        lines.push(
          `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${themeColor}" stroke-width="2" stroke-dasharray="4,4" opacity="0.8" />`
        );
      }
    }
    
    return lines.join('');
  }, [routes, themeColor]);

  // Map will show even without routes

  if (!svgMap) {
    return (
      <div className="w-full flex justify-center py-8">
        <div className="text-gray-600 text-sm">Map loading...</div>
      </div>
    );
  }

  // Insert connection lines into the SVG
  const svgWithLines = svgMap.replace('</svg>', `${connectionLines}</svg>`);

  return (
    <div className="w-full">
      <div className="relative w-full">
        {/* Map Container - Full viewport width and height */}
        <div 
          ref={containerRef}
          className="relative overflow-hidden w-full"
          style={{ 
            height: 'calc(100vh - 440px)', // Viewport height minus dark container height (360px) + margin (80px)
            minHeight: '200px', // Minimum height to ensure usability
            backgroundColor: '#f3f4f6' // Same as page background (bg-gray-100)
          }}
        >
          <img 
            ref={imageRef}
            src={`data:image/svg+xml;utf8,${encodeURIComponent(svgWithLines)}`}
            alt="Flight Routes Map"
            className="w-full h-full object-contain"
            style={{ 
              filter: 'brightness(1.1) contrast(1.1)',
              objectPosition: 'center top' // Align map to top to prevent cut-off
            }}
            onLoad={() => {
              // Trigger position recalculation when image loads
              setTimeout(() => {
                const event = new Event('resize');
                window.dispatchEvent(event);
              }, 100);
            }}
          />
          
          {/* Route Labels Overlay - Option 5: HTML overlay with accurate coordinate mapping */}
          <RouteLabelsOverlay 
            routes={routes} 
            themeColor={themeColor}
            coordinates={AIRPORT_COORDINATES}
            mapImageRef={imageRef}
            containerRef={containerRef}
          />
        </div>
        
      </div>
    </div>
  );
});

RouteMap.displayName = 'RouteMap';

// Option 5: HTML Overlay with accurate coordinate mapping
const RouteLabelsOverlay = ({ routes, themeColor, coordinates, mapImageRef, containerRef }) => {
  const [labelPositions, setLabelPositions] = useState([]);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (!routes || routes.length === 0) {
      setLabelPositions([]);
      return;
    }

    const calculatePositions = () => {
      const container = containerRef?.current;
      const img = mapImageRef?.current;
      
      if (!container) {
        console.warn('RouteLabelsOverlay: Container not found');
        return;
      }
      
      if (!img) {
        console.warn('RouteLabelsOverlay: Image ref not available');
        return;
      }

      const containerRect = container.getBoundingClientRect();
      
      // Calculate actual image dimensions accounting for object-contain
      const imgNaturalWidth = 140; // From map generation
      const imgNaturalHeight = 80; // From map generation
      
      const containerAspect = containerRect.width / containerRect.height;
      const imgAspect = imgNaturalWidth / imgNaturalHeight;
      
      let actualImgWidth, actualImgHeight, offsetX, offsetY;
      
      if (imgAspect > containerAspect) {
        // Image is wider - fit to width
        actualImgWidth = containerRect.width;
        actualImgHeight = containerRect.width / imgAspect;
        offsetX = 0;
        offsetY = (containerRect.height - actualImgHeight) / 2;
      } else {
        // Image is taller - fit to height
        actualImgHeight = containerRect.height;
        actualImgWidth = containerRect.height * imgAspect;
        offsetX = (containerRect.width - actualImgWidth) / 2;
        offsetY = 0;
      }

      const positions = routes.map((route) => {
        const airportCode = route.airport?.code;
        const coords = coordinates[airportCode];
        if (!coords) {
          console.warn(`No coordinates found for ${airportCode}`);
          return null;
        }

        // Use the same projection as the map
        const mapLatMin = 35, mapLatMax = 72;
        const mapLngMin = -10, mapLngMax = 40;
        
        // Calculate position in SVG coordinates
        const mapX = ((coords.lng - mapLngMin) / (mapLngMax - mapLngMin)) * imgNaturalWidth;
        const mapY = ((mapLatMax - coords.lat) / (mapLatMax - mapLatMin)) * imgNaturalHeight;
        
        // Convert to container coordinates
        const scaleX = actualImgWidth / imgNaturalWidth;
        const scaleY = actualImgHeight / imgNaturalHeight;
        
        // Pin center position in container coordinates
        const pinCenterX = offsetX + (mapX * scaleX);
        const pinCenterY = offsetY + (mapY * scaleY);
        
        // Calculate actual pin radius in pixels
        const pinRadiusSvg = 0.4; // SVG units
        const pinRadiusPx = pinRadiusSvg * scaleY; // Convert to container pixels
        
        // Pin top edge position
        const pinTopY = pinCenterY - pinRadiusPx;
        
        // Position label so its bottom edge overlaps the pin significantly
        // With transform translate(-50%, -100%), the top CSS value represents the label's bottom edge
        const overlapPx = 50; // Doubled overlap to bring labels very close
        const labelBottomY = pinTopY + overlapPx;
        
        // Use pixel values
        const result = {
          route,
          x: pinCenterX, // pixels - will be centered by transform
          y: labelBottomY, // pixels - bottom of label will be here (due to -100% transform)
          usePixels: true
        };
        
        // Debug logging
        if (route.airport?.code === routes[0]?.airport?.code) {
          console.log('🔍 Label position calculation:', {
            airport: route.airport.code,
            pinCenterX,
            pinCenterY,
            pinRadiusPx,
            pinTopY,
            overlapPx: 4,
            labelBottomY: result.y,
            scaleY,
            containerHeight: containerRect.height,
            containerWidth: containerRect.width
          });
        }
        
        return result;
      }).filter(Boolean);

      console.log('RouteLabelsOverlay: Calculated positions', positions.length, positions);
      setLabelPositions(positions);
    };

    // Wait a bit for DOM to be ready, then calculate
    const timeoutId = setTimeout(() => {
      calculatePositions();
    }, 100);
    
    const handleResize = () => {
      setTimeout(calculatePositions, 50);
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, [routes, coordinates, mapImageRef, imageLoaded]);

  // Handle image load event
  useEffect(() => {
    if (mapImageRef?.current) {
      const img = mapImageRef.current;
      if (img.complete) {
        setImageLoaded(true);
      } else {
        img.addEventListener('load', () => setImageLoaded(true), { once: true });
      }
    }
  }, [mapImageRef]);

  console.log('RouteLabelsOverlay render:', { 
    routesCount: routes?.length, 
    positionsCount: labelPositions.length,
    hasContainer: !!containerRef?.current,
    hasImage: !!mapImageRef?.current,
    imageLoaded
  });

  if (labelPositions.length === 0) {
    // Still render the container div for debugging
    return <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }} />;
  }

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      {labelPositions.map(({ route, x, y, usePixels }) => (
        <div
          key={route.id}
          className="absolute"
          style={{ 
            left: usePixels ? `${x}px` : `${x}%`, 
            top: usePixels ? `${y}px` : `${y}%`,
            transform: 'translate(-50%, -100%)', // Center horizontally, label bottom at calculated position
            zIndex: 10,
          }}
        >
          <div 
            className="px-2 py-0.5 rounded text-[9px] font-semibold text-white shadow-lg whitespace-nowrap"
            style={{ 
              backgroundColor: themeColor,
              lineHeight: '1.2'
            }}
          >
            {route.airport.city} ({route.airport.code})
          </div>
        </div>
      ))}
    </div>
  );
  };

export default RouteMap;