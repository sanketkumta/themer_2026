import { useState, useRef, useEffect, useMemo } from 'react';
import { useIsolatedState, useImageState } from '../hooks/useIsolatedState';
import { generateContextKey } from '../utils/contextValidation';
import { getReadableOnColor, getLightCardBackgroundColor } from '../utils/color';
import { getContentCardContent } from '../utils/festivalUtils';
import { getNonFestiveCardContent, getBusinessProfileCardContent } from '../data/festivalContent';
import { getPollinationsImage } from '../utils/unsplash';
import ThemeCreator from './ThemeCreator';
import FlightJourneyBar from './FlightJourneyBar';
import FlightProgress from './FlightProgress';
import Component3Cards from './Component3Cards';
import PlusIconCursor from './PlusIconCursor';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import PromptBubble from './PromptBubble';
import AnalyticsBubble from './AnalyticsBubble';
import MousePointer from './MousePointer';
import RouteMap from './RouteMap';
import { useLocation } from 'react-router-dom';
import { mapThemeChipToAnimation } from '../utils/themeAnimationMapper';
import { PhotoIcon, ChevronRightIcon } from '@heroicons/react/24/outline';



// Add CSS animation for gradient border
const gradientAnimationCSS = `
  @keyframes gradientAnimation {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }
`;





function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `LANDING IN ${h}H ${m.toString().padStart(2, '0')}M`;
}

// Helper function to get current route's prompt bubble
const getCurrentRoutePromptBubble = (routePromptBubbles, getCurrentRouteKey) => {
  const routeKey = getCurrentRouteKey();
  if (!routeKey) return null;
  const bubble = routePromptBubbles[routeKey] || null;
  console.log('🎯 Getting prompt bubble for route:', { routeKey, bubble, allBubbles: routePromptBubbles });
  return bubble;
};

function FrameContent({ origin, destination, minutesLeft, landingIn, maxFlightMinutes, handleProgressChange, themeColor, routes, isPromptMode, onPromptHover, onPromptClick, fpsPrompts, isThemeBuildStarted, selectedLogo, flightsGenerated, onAnimationProgress, onFlightPhaseSelect, selectedFlightPhase, promoCardContents, onContentCardHover, colorPromptClosedWithoutSave, getRouteColorPromptSaved, recommendedContentCards, getCurrentRouteKey, isModifyClicked, isCurrentRouteModified, selectedDates = [], isCurrentThemeFestive, getRouteSelectedThemeChip, routePromptBubbles, selectedProfile }) {

  // Generate context key for state isolation
  const contextKey = generateContextKey(getCurrentRouteKey(), selectedFlightPhase, themeColor, selectedDates);
  
  // Use isolated state management for temporary UI state (clears on context change)
  const contentCardImageState = useImageState(contextKey);
  
  // Persistent state for user customizations (survives context changes)
  const [persistentCustomizations, setPersistentCustomizations] = useState(() => {
    // Initialize from localStorage if available
    try {
      const saved = localStorage.getItem('contentCardCustomizations');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Helper functions for persistent customizations
  const getCustomizationKey = (cardIndex, contentType) => {
    // Create a unique key that includes route, phase, and card info
    const routeKey = getCurrentRouteKey();
    const cardKey = `${routeKey}-${selectedFlightPhase}-${cardIndex}-${contentType}`;
    return cardKey;
  };

  const saveCustomization = (cardIndex, contentType, value) => {
    const key = getCustomizationKey(cardIndex, contentType);
    console.log('💾 SAVING CONTENT CARD CUSTOMIZATION', {
      cardIndex,
      contentType,
      value,
      key,
      routeKey: getCurrentRouteKey(),
      flightPhase: selectedFlightPhase
    });
    
    setPersistentCustomizations(prev => {
      const updated = {
      ...prev,
        [key]: value
      };
      // Save to localStorage
      try {
        localStorage.setItem('contentCardCustomizations', JSON.stringify(updated));
        console.log('✅ Customization saved to localStorage');
      } catch (err) {
        console.warn('Failed to save customization to localStorage:', err);
      }
      return updated;
    });
  };

  const getCustomization = (cardIndex, contentType) => {
    const key = getCustomizationKey(cardIndex, contentType);
    const value = persistentCustomizations[key] || null;
    console.log('🔍 GETTING CONTENT CARD CUSTOMIZATION', {
      cardIndex,
      contentType,
      key,
      value,
      routeKey: getCurrentRouteKey(),
      flightPhase: selectedFlightPhase
    });
    return value;
  };

  // Helper functions using isolated state management for temporary UI state
  const setContentImageLoading = (cardIndex, isLoading) => {
    contentCardImageState.setImageLoading(cardIndex, isLoading);
  };

  const isContentImageLoading = (cardIndex) => {
    return contentCardImageState.imageLoadingStates[cardIndex] || false;
  };

  // Helper functions for content card title management (persistent)
  const setContentCardTitle = (cardIndex, title) => {
    saveCustomization(cardIndex, 'title', title);
  };

  const getContentCardTitle = (cardIndex) => {
    return getCustomization(cardIndex, 'title');
  };

  // Helper functions for content card remixed images (persistent)
  const setContentCardRemixedImage = (cardIndex, imageUrl) => {
    saveCustomization(cardIndex, 'remixedImage', imageUrl);
  };

  const getContentCardRemixedImage = (cardIndex) => {
    return getCustomization(cardIndex, 'remixedImage');
  };

  // Helper functions for content card image loading states (temporary)
  const setContentCardImageLoading = (cardIndex, isLoading) => {
    contentCardImageState.setImageLoading(cardIndex, isLoading);
  };

  const isContentCardImageLoading = (cardIndex) => {
    return contentCardImageState.imageLoadingStates[cardIndex] || false;
  };

  // Listen for save events from promo card clicks (when promo card closes content card bubbles)
  useEffect(() => {
    const handleSaveContentCard = (e) => {
      const { cardIndex, title, description } = e.detail || {};
      if (cardIndex !== null && cardIndex !== undefined) {
        // Save the title
        if (title !== undefined) {
          setContentCardTitle(cardIndex, title);
        }
        console.log('FrameContent: Content card content saved', { cardIndex, title, description });
      }
    };
    
    const handleRemixContentCardImage = (e) => {
      const { cardIndex, description } = e.detail || {};
      if (cardIndex !== null && cardIndex !== undefined && description) {
        try {
          const newImageUrl = getPollinationsImage(description, themeColor, { randomize: true });
          const timestamp = Date.now();
          const separator = newImageUrl.includes('?') ? '&' : '?';
          const newUrl = `${newImageUrl}${separator}t=${timestamp}`;
          setContentCardRemixedImage(cardIndex, newUrl);
          setContentCardImageLoading(cardIndex, true);
          console.log('FrameContent: Content card remix generated from promo card save', { cardIndex, description, newUrl });
        } catch (err) {
          console.error('FrameContent: Content card remix failed', err);
        }
      }
    };
    
    window.addEventListener('save-dashboard-content-card', handleSaveContentCard);
    window.addEventListener('remix-dashboard-content-card-image', handleRemixContentCardImage);
    
    return () => {
      window.removeEventListener('save-dashboard-content-card', handleSaveContentCard);
      window.removeEventListener('remix-dashboard-content-card-image', handleRemixContentCardImage);
    };
  }, [themeColor]);

  // Cleanup function to remove any lingering DOM elements
  useEffect(() => {
    return () => {
      const existingPanel = document.getElementById('locked-remix-panel');
      if (existingPanel && existingPanel.parentNode) existingPanel.parentNode.removeChild(existingPanel);
      const performancePanel = document.getElementById('performance-empty-panel');
      if (performancePanel && performancePanel.parentNode) performancePanel.parentNode.removeChild(performancePanel);
      const tooltip = document.getElementById('custom-tooltip');
      if (tooltip && tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
      window.__tooltipLocked = false;
    };
  }, []);

  // Helper function to get route-specific content cards
  const getRouteContentCards = () => {
    // Since we're inside FrameContent, we need to access the recommendedContentCards prop
    if (!recommendedContentCards || typeof recommendedContentCards === 'string') {
      return [
        { id: 1, title: 'Add content', type: 'default' },
        { id: 2, title: 'Add content', type: 'default' },
        { id: 3, title: 'Add content', type: 'default' },
        { id: 4, title: 'Add content', type: 'default' }
      ];
    }
    return recommendedContentCards;
  };
  
  // Helper function to get border style when flight phase is selected
  const getBorderStyle = () => {
    if (selectedFlightPhase) {
      return {
        position: 'relative',
        border: '2px solid transparent',
      };
    }
    return {};
  };

  // Helper function to create animated border overlay for content cards
  const getAnimatedBorderOverlay = () => {
    if (!selectedFlightPhase) return null;
    
    return (
      <div
        style={{
          position: 'absolute',
          top: '-12px',
          left: '-12px',
          right: '-12px', 
          bottom: '-12px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 25%, #ec4899 50%, #f59e0b 75%, #10b981 100%)',
          backgroundSize: '200% 200%',
          animation: 'gradientAnimation 3s ease infinite',
          zIndex: -1,
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'xor',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          padding: '12px',
          opacity: 1
        }}
      />
    );
  };

  // Helper function to get content text and image - uses festival content when theme is saved
  const getContentData = (cardIndex, selectedProfile) => {
    // CRITICAL: Only show content if theme has been saved for this route
    if (!getRouteColorPromptSaved()) {
      console.log('=== NO CONTENT - THEME NOT SAVED ===', {
        cardIndex,
        colorPromptSaved: getRouteColorPromptSaved(),
        reason: 'Theme must be saved before showing any content'
      });
      return { text: 'Add content', image: '' };
    }

    // Only generate festival content if:
    // 1. Theme is saved for this route (already checked above)
    // 2. Current theme is actually festive (not non-festive like Lufthansa)
    // 3. Required data is available
    if (isCurrentThemeFestive() && selectedFlightPhase && origin && destination) {
      console.log('=== GETTING FESTIVAL CONTENT FOR CONTENT CARD ===', {
        colorPromptSaved: getRouteColorPromptSaved(),
        isFestive: isCurrentThemeFestive(),
        selectedThemeChip: getRouteSelectedThemeChip(),
        selectedFlightPhase,
        origin,
        destination,
        cardIndex,
        selectedDates
      });
      
      // Handle both string and object formats for origin/destination
      const originCity = typeof origin === 'string' ? origin : origin?.airport?.city || origin;
      const destCity = typeof destination === 'string' ? destination : destination?.airport?.city || destination;
      
      const segment = { 
        origin: { airport: { city: originCity } }, 
        destination: { airport: { city: destCity } } 
      };
      
      // Use default dates if none are selected
      const datesToUse = selectedDates && selectedDates.length > 0 ? selectedDates : ['2024-09-15'];
      
      const festivalContent = getContentCardContent(segment, datesToUse, selectedFlightPhase, cardIndex, themeColor);
      
      console.log('=== CONTENT CARD FESTIVAL CONTENT RESULT ===', {
        festivalContent,
        hasText: !!festivalContent?.text,
        hasImage: !!festivalContent?.image
      });
      
      if (festivalContent && festivalContent.text) {
        return { text: festivalContent.text, image: festivalContent.image || '' };
      }
    } else {
      console.log('=== SKIPPING FESTIVAL CONTENT GENERATION ===', {
        colorPromptSaved: getRouteColorPromptSaved(),
        isFestive: isCurrentThemeFestive(),
        selectedThemeChip: getRouteSelectedThemeChip(),
        reason: !getRouteColorPromptSaved() ? 'theme not saved' : 
                !isCurrentThemeFestive() ? 'theme not festive' : 
                'missing required data'
      });
    }
    
    // For non-festive themes or when theme is saved but not festive, use profile-specific content
    if (selectedFlightPhase) {
      console.log('=== GETTING NON-FESTIVE CONTENT FOR CONTENT CARD ===', {
        selectedFlightPhase,
        cardIndex,
        colorPromptSaved: getRouteColorPromptSaved(),
        selectedProfile
      });
      
      // Use business profile content if user has selected "Business" profile
      let profileContent = null;
      if (selectedProfile === 'Business') {
        console.log('=== USING BUSINESS PROFILE CONTENT FOR CONTENT CARD ===');
        profileContent = getBusinessProfileCardContent(selectedFlightPhase, 'content', cardIndex, destination);
      } else {
        console.log('=== USING DEFAULT NON-FESTIVE CONTENT FOR CONTENT CARD ===');
        profileContent = getNonFestiveCardContent(selectedFlightPhase, 'content', cardIndex);
      }
      
      console.log('=== PROFILE CONTENT RESULT FOR CONTENT CARD ===', {
        profileContent,
        hasText: !!profileContent?.text,
        hasImage: !!profileContent?.image,
        selectedProfile
      });
      
      if (profileContent && profileContent.text) {
        return { text: profileContent.text, image: profileContent.image || '' };
      }
    }
    
    // Final fallback for unsaved themes
    return { text: 'Add content', image: '' };
  };




  // Helper function to render a single content card
  const renderContentCard = (originalCardIndex, displayPosition, selectedProfile) => {
    const cardStyle = {
      width: '100%',
      height: '160px',
      background: getLightCardBackgroundColor(themeColor),
      borderTopLeftRadius: '8px',
      borderTopRightRadius: '8px',
      borderBottomLeftRadius: '8px',
      borderBottomRightRadius: '8px',
      border: 'none',
      marginTop: '1px'
    };

    const contentData = getContentData(originalCardIndex, selectedProfile);

    return (
      <div
        key={`content-card-${originalCardIndex}-${displayPosition}`}
        className="overflow-clip relative shrink-0 flex items-center justify-center backdrop-blur-[10px] backdrop-filter group hover:shadow-[0_0_0_3px_#1E1E1E] cursor-pointer"
        style={cardStyle}
        onMouseEnter={(e) => {
          if (window.__tooltipLocked) return; // prevent new tooltip while locked
          const tooltip = document.createElement('div');
          tooltip.style.cssText = `
            position: fixed;
            background: #1E1E1E;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 2147483647;
            pointer-events: auto;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 8px;
            left: ${e.clientX + 18}px;
            top: ${e.clientY + 18}px;
          `;
          tooltip.id = 'custom-tooltip';
          tooltip.innerHTML = `
            <span id="tooltip-content-text" style="cursor:pointer;padding:2px 4px;border-radius:4px">Content</span>
            <span> | </span>
            <span id="tooltip-performance-text" style="cursor:pointer;padding:2px 4px;border-radius:4px">Performance</span>
            <span> |</span>
            <button id="custom-tooltip-close" aria-label="Close" style="background:transparent;border:none;color:white;opacity:.85;cursor:pointer;padding:0 2px;line-height:1">✕</button>
          `;
          const existing = document.getElementById('custom-tooltip');
          if (existing) existing.remove();
          document.body.appendChild(tooltip);
          const closeBtn = document.getElementById('custom-tooltip-close');
          if (closeBtn) {
            closeBtn.addEventListener('click', (ev) => {
              ev.stopPropagation();
              const t = document.getElementById('custom-tooltip');
              if (t) t.remove();
              const panel = document.getElementById('locked-remix-panel');
              if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
              const performancePanel = document.getElementById('performance-empty-panel');
              if (performancePanel && performancePanel.parentNode) performancePanel.parentNode.removeChild(performancePanel);
              window.__tooltipLocked = false;
            });
          }
          
          // Add click handler for Content text
          const contentText = document.getElementById('tooltip-content-text');
          if (contentText) {
            contentText.addEventListener('click', (ev) => {
              ev.stopPropagation();
              // Close performance panel
              const performancePanel = document.getElementById('performance-empty-panel');
              if (performancePanel && performancePanel.parentNode) performancePanel.parentNode.removeChild(performancePanel);
              // Apply selected state to Content text
              contentText.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
              contentText.style.color = '#FFFFFF';
              // Remove selected state from Performance text
              const performanceText = document.getElementById('tooltip-performance-text');
              if (performanceText) {
                performanceText.style.backgroundColor = 'transparent';
                performanceText.style.color = '#FFFFFF';
              }
              // Open remix rectangle (reuse existing logic from card click)
              const tooltip = document.getElementById('custom-tooltip');
              if (tooltip) {
                // Use requestAnimationFrame to ensure tooltip is fully positioned
                requestAnimationFrame(() => {
                  const rect = tooltip.getBoundingClientRect();
                  const contentDataLocal = getContentData(originalCardIndex, selectedProfile);
                  // Create the exact same UI as the built-in remix panel (directly positioned)
                  const remixContainer = document.createElement('div');
                  remixContainer.id = 'locked-remix-panel';
                  remixContainer.className = 'px-4 py-3 rounded-lg flex flex-col items-center';
                  remixContainer.setAttribute('data-content-card-index', originalCardIndex.toString());
                  
                  // Calculate proper spacing: bubble bottom should be 8px above tooltip top
                  // Bubble height is approximately 150px (text + buttons + padding)
                  const bubbleHeight = 150;
                  const spacing = 8;
                  const tooltipHeight = rect.height || 30; // Tooltip height (default 30px if not measured)
                  
                  // Position bubble: bottom of bubble = top of tooltip - spacing
                  // So: top of bubble = (top of tooltip - spacing) - bubble height
                  let bubbleTop = rect.top - spacing - bubbleHeight;
                  
                  // Viewport boundary check: ensure bubble doesn't go off-screen
                  const minTop = 10; // Minimum distance from top of viewport
                  if (bubbleTop < minTop) {
                    // If bubble would go off top, position it just above tooltip with minimum spacing
                    bubbleTop = Math.max(minTop, rect.top - tooltipHeight - spacing - bubbleHeight);
                  }
                  
                  remixContainer.style.cssText = 'position:fixed;left:' + rect.left + 'px;top:' + bubbleTop + 'px;z-index:2147483647;background-color:#1C1C1C;border:1px solid rgba(255,255,255,0.2);width:312px;gap:40px;box-shadow:rgba(0,0,0,0.35) 0px 8px 20px';

                // Create the text paragraph with contenteditable spans (exact same as built-in)
                const textDiv = document.createElement('div');
                textDiv.className = 'w-full';
                const textP = document.createElement('p');
                textP.className = 'whitespace-pre-wrap break-words text-md leading-6 text-white m-0';

                // "Change title to" span
                const changeTitleSpan = document.createElement('span');
                changeTitleSpan.className = 'text-gray-300 select-none';
                changeTitleSpan.style.marginRight = '8px';
                changeTitleSpan.textContent = 'Change title to';

                // Title span (contenteditable)
                const titleSpan = document.createElement('span');
                titleSpan.id = 'locked-tooltip-title';
                titleSpan.setAttribute('role', 'textbox');
                titleSpan.setAttribute('aria-label', 'title');
                titleSpan.setAttribute('contenteditable', 'true');
                titleSpan.className = 'outline-none';
                titleSpan.spellCheck = false;
                titleSpan.style.cssText = 'text-decoration:underline dotted;text-decoration-color:rgba(156,163,175,0.8);text-underline-offset:6px;caret-color:transparent;margin-right:8px';
                titleSpan.textContent = getContentCardTitle(originalCardIndex) || contentDataLocal.text || 'Add content';

                // "describe image of" span
                const describeSpan = document.createElement('span');
                describeSpan.className = 'text-gray-300 select-none';
                describeSpan.style.marginRight = '8px';
                describeSpan.textContent = 'describe image of';

                // Description span (contenteditable)
                const descSpan = document.createElement('span');
                descSpan.id = 'locked-tooltip-desc';
                descSpan.setAttribute('role', 'textbox');
                descSpan.setAttribute('aria-label', 'image description');
                descSpan.setAttribute('contenteditable', 'true');
                descSpan.className = 'outline-none';
                descSpan.spellCheck = false;
                descSpan.style.cssText = 'text-decoration:underline dotted;text-decoration-color:rgba(156,163,175,0.8);text-underline-offset:6px;caret-color:auto';
                descSpan.textContent = contentDataLocal.image || contentDataLocal.text || '';

                // Assemble the paragraph
                textP.appendChild(changeTitleSpan);
                textP.appendChild(titleSpan);
                textP.appendChild(describeSpan);
                textP.appendChild(descSpan);
                textDiv.appendChild(textP);

                // Buttons container
                const buttonsDiv = document.createElement('div');
                buttonsDiv.className = 'flex gap-2';

                // Remix button
                const lockedRemixBtn = document.createElement('button');
                lockedRemixBtn.id = 'locked-tooltip-remix';
                lockedRemixBtn.className = 'px-4 py-2 rounded-lg font-semibold text-xs uppercase transition-all duration-200 hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed';
                lockedRemixBtn.style.cssText = 'background-color: #10B981; color: white; border: 1px solid rgba(255, 255, 255, 0.3);';
                lockedRemixBtn.textContent = '🎲 Remix Style';

                // Save button
                const lockedSaveBtn = document.createElement('button');
                lockedSaveBtn.id = 'locked-tooltip-save';
                lockedSaveBtn.className = 'px-4 py-2 rounded-lg font-semibold text-xs uppercase transition-all duration-200 hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed';
                lockedSaveBtn.style.cssText = 'background-color: #10B981; color: white; border: 1px solid rgba(255, 255, 255, 0.3); backdrop-filter: blur(10px);';
                lockedSaveBtn.textContent = '💾 Save';

                buttonsDiv.appendChild(lockedRemixBtn);
                buttonsDiv.appendChild(lockedSaveBtn);

                // Assemble the container
                remixContainer.appendChild(textDiv);
                remixContainer.appendChild(buttonsDiv);

                // Remove any existing remix panel
                const existingPanel = document.getElementById('locked-remix-panel');
                if (existingPanel && existingPanel.parentNode) {
                  existingPanel.parentNode.removeChild(existingPanel);
                }

                document.body.appendChild(remixContainer);

                // Function to reposition bubble based on actual height
                const repositionBubble = () => {
                  requestAnimationFrame(() => {
                    const tooltip = document.getElementById('custom-tooltip');
                    const bubble = document.getElementById('locked-remix-panel');
                    if (!tooltip || !bubble) return;
                    
                    const tooltipRect = tooltip.getBoundingClientRect();
                    const bubbleRect = bubble.getBoundingClientRect();
                    const actualBubbleHeight = bubbleRect.height;
                    const spacing = 8;
                    const tooltipHeight = tooltipRect.height || 30;
                    
                    // Calculate new position: bubble bottom should be 8px above tooltip top
                    let bubbleTop = tooltipRect.top - spacing - actualBubbleHeight;
                    
                    // Viewport boundary check
                    const minTop = 10;
                    if (bubbleTop < minTop) {
                      bubbleTop = Math.max(minTop, tooltipRect.top - tooltipHeight - spacing - actualBubbleHeight);
                    }
                    
                    // Update bubble position
                    bubble.style.top = `${bubbleTop}px`;
                  });
                };

                // Add event listeners for title editing
                titleSpan.addEventListener('input', (e) => {
                  const el = e.target;
                  const raw = el.innerText;
                  const clamped = raw.length > 50 ? raw.slice(0, 50) : raw;
                  if (clamped !== raw) el.innerText = clamped;
                  // Update the content card title
                  setContentCardTitle(originalCardIndex, clamped);
                  // Reposition bubble after text change
                  repositionBubble();
                });
                titleSpan.addEventListener('keydown', (e) => {
                  if (e.key === 'Enter') { e.preventDefault(); return; }
                });
                
                // Add event listener for description editing
                descSpan.addEventListener('input', (e) => {
                  const el = e.target;
                  const raw = el.innerText || '';
                  const clamped = raw.length > 100 ? raw.slice(0, 100) : raw;
                  if (clamped !== raw) el.innerText = clamped;
                  // Reposition bubble after text change
                  repositionBubble();
                });
                descSpan.addEventListener('keydown', (e) => {
                  if (e.key === 'Enter') { e.preventDefault(); return; }
                });

                // Add event listeners for remix and save buttons
                const triggerRemix = () => {
                  try {
                    const imageDescription = (descSpan?.innerText || contentDataLocal.image || contentDataLocal.text || 'content');
                    const newImageUrl = getPollinationsImage(imageDescription, themeColor, { randomize: true });
                    const timestamp = Date.now();
                    const separator = newImageUrl.includes('?') ? '&' : '?';
                    const newUrl = `${newImageUrl}${separator}t=${timestamp}`;
                    setContentCardRemixedImage(originalCardIndex, newUrl);
                    setContentCardImageLoading(originalCardIndex, true);
                    console.log('Content card remix generated from panel', { originalCardIndex, imageDescription, newUrl });
                  } catch (err) {
                    console.error('Content card remix failed', err);
                  }
                };
                if (lockedRemixBtn) lockedRemixBtn.addEventListener('click', (ev) => { ev.stopPropagation(); triggerRemix(); });
                if (lockedSaveBtn) lockedSaveBtn.addEventListener('click', (ev) => { ev.stopPropagation(); triggerRemix(); });
                
                // Initial reposition after bubble is created to ensure correct positioning
                repositionBubble();
                });
              }
            });
          }

          // Add click handler for Performance text
          const performanceText = document.getElementById('tooltip-performance-text');
          if (performanceText) {
            performanceText.addEventListener('click', (ev) => {
              ev.stopPropagation();
              // Close remix rectangle
              const panel = document.getElementById('locked-remix-panel');
              if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
              // Apply selected state to Performance text
              performanceText.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
              performanceText.style.color = '#FFFFFF';
              // Remove selected state from Content text
              const contentText = document.getElementById('tooltip-content-text');
              if (contentText) {
                contentText.style.backgroundColor = 'transparent';
                contentText.style.color = '#FFFFFF';
              }
              // Open empty rectangle
              const tooltip = document.getElementById('custom-tooltip');
              if (tooltip) {
                const rect = tooltip.getBoundingClientRect();
                const emptyContainer = document.createElement('div');
                emptyContainer.id = 'performance-empty-panel';
                emptyContainer.className = 'px-4 py-3 rounded-lg flex flex-col items-center';
                emptyContainer.style.cssText = 'position:fixed;left:' + rect.left + 'px;top:' + (rect.top - 202) + 'px;z-index:2147483647;background-color:#1C1C1C;border:1px solid rgba(255,255,255,0.2);width:312px;gap:40px;box-shadow:rgba(0,0,0,0.35) 0px 8px 20px';
                
                // Create empty content
                const emptyDiv = document.createElement('div');
                emptyDiv.className = 'w-full text-center';
                emptyDiv.innerHTML = '<p class="text-white text-sm opacity-70">Performance panel coming soon...</p>';
                emptyContainer.appendChild(emptyDiv);
                
                // Remove any existing performance panel
                const existingPanel = document.getElementById('performance-empty-panel');
                if (existingPanel && existingPanel.parentNode) {
                  existingPanel.parentNode.removeChild(existingPanel);
                }
                
                document.body.appendChild(emptyContainer);
              }
            });
          }
          if (!window.__tooltipLocked) window.__tooltipLocked = false;
        }}
        onMouseMove={(e) => {
          const tooltip = document.getElementById('custom-tooltip');
          if (!tooltip || window.__tooltipLocked) return;
          tooltip.style.left = `${e.clientX + 18}px`;
          tooltip.style.top = `${e.clientY + 18}px`;
        }}
        onMouseLeave={() => {
          const tooltip = document.getElementById('custom-tooltip');
          if (tooltip && !window.__tooltipLocked) tooltip.remove();
        }}
        onClick={(e) => {
          // Defer DOM manipulation to avoid conflicts with React's render cycle
          setTimeout(() => {
            const tooltip = document.getElementById('custom-tooltip');
            if (tooltip) {
              tooltip.style.left = `${e.clientX + 12}px`;
              tooltip.style.top = `${e.clientY + 12}px`;
              // Apply selected state to Content text (matching hovertip selected state)
              const contentText = tooltip.querySelector('#tooltip-content-text');
              if (contentText) {
                contentText.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                contentText.style.color = '#FFFFFF';
                contentText.style.padding = '2px 4px';
                contentText.style.borderRadius = '4px';
              }
            }
            window.__tooltipLocked = true;
            // Show remix panel UI below tooltip, left-aligned (content cards)
            try {
              const existingPanel = document.getElementById('locked-remix-panel');
              if (existingPanel && existingPanel.parentNode) {
                existingPanel.parentNode.removeChild(existingPanel);
              }
            const t = document.getElementById('custom-tooltip');
            if (!t) return;
            // Use requestAnimationFrame to ensure tooltip is fully positioned before calculating
            requestAnimationFrame(() => {
              const rect = t.getBoundingClientRect();
              const contentDataLocal = getContentData(originalCardIndex, selectedProfile);
              // Create the exact same UI as the built-in remix panel (directly positioned)
              const remixContainer = document.createElement('div');
              remixContainer.id = 'locked-remix-panel';
              remixContainer.className = 'px-4 py-3 rounded-lg flex flex-col items-center';
              remixContainer.setAttribute('data-content-card-index', originalCardIndex.toString());
              
              // Calculate proper spacing: bubble bottom should be 8px above tooltip top
              // Bubble height is approximately 150px (text + buttons + padding)
              const bubbleHeight = 150;
              const spacing = 8;
              const tooltipHeight = rect.height || 30; // Tooltip height (default 30px if not measured)
              
              // Position bubble: bottom of bubble = top of tooltip - spacing
              // So: top of bubble = (top of tooltip - spacing) - bubble height
              let bubbleTop = rect.top - spacing - bubbleHeight;
              
              // Viewport boundary check: ensure bubble doesn't go off-screen
              const minTop = 10; // Minimum distance from top of viewport
              if (bubbleTop < minTop) {
                // If bubble would go off top, position it just above tooltip with minimum spacing
                bubbleTop = Math.max(minTop, rect.top - tooltipHeight - spacing - bubbleHeight);
              }
              
              remixContainer.style.cssText = 'position:fixed;left:' + rect.left + 'px;top:' + bubbleTop + 'px;z-index:2147483647;background-color:#1C1C1C;border:1px solid rgba(255,255,255,0.2);width:312px;gap:40px;box-shadow:rgba(0,0,0,0.35) 0px 8px 20px';

            // Create the text paragraph with contenteditable spans (exact same as built-in)
            const textDiv = document.createElement('div');
            textDiv.className = 'w-full';
            const textP = document.createElement('p');
            textP.className = 'whitespace-pre-wrap break-words text-md leading-6 text-white m-0';

            // "Change title to" span
            const changeTitleSpan = document.createElement('span');
            changeTitleSpan.className = 'text-gray-300 select-none';
            changeTitleSpan.style.marginRight = '8px';
            changeTitleSpan.textContent = 'Change title to';

            // Editable title span
            const titleSpan = document.createElement('span');
            titleSpan.id = 'locked-tooltip-title';
            titleSpan.role = 'textbox';
            titleSpan.setAttribute('aria-label', 'title');
            titleSpan.contentEditable = true;
            titleSpan.className = 'outline-none';
            titleSpan.spellCheck = false;
            titleSpan.style.cssText = 'text-decoration:underline dotted;text-decoration-color:rgba(156,163,175,0.8);text-underline-offset:6px;caret-color:transparent;margin-right:8px';
            titleSpan.textContent = getContentCardTitle(originalCardIndex) || contentDataLocal.text || 'Add content';

            // "describe image of" span
            const describeSpan = document.createElement('span');
            describeSpan.className = 'text-gray-300 select-none';
            describeSpan.style.marginRight = '8px';
            describeSpan.textContent = 'describe image of';

            // Editable description span
            const descSpan = document.createElement('span');
            descSpan.id = 'locked-tooltip-desc';
            descSpan.role = 'textbox';
            descSpan.setAttribute('aria-label', 'image description');
            descSpan.contentEditable = true;
            descSpan.className = 'outline-none';
            descSpan.spellCheck = false;
            descSpan.style.cssText = 'text-decoration:underline dotted;text-decoration-color:rgba(156,163,175,0.8);text-underline-offset:6px;caret-color:auto';
            descSpan.textContent = contentDataLocal.image || contentDataLocal.text || '';

            // Assemble the paragraph
            textP.appendChild(changeTitleSpan);
            textP.appendChild(titleSpan);
            textP.appendChild(describeSpan);
            textP.appendChild(descSpan);
            textDiv.appendChild(textP);

            // Create buttons container
            const buttonsDiv = document.createElement('div');
            buttonsDiv.className = 'flex gap-2';

            // Remix Style button (exact same as built-in)
            const lockedRemixBtn = document.createElement('button');
            lockedRemixBtn.id = 'locked-tooltip-remix';
            lockedRemixBtn.className = 'px-4 py-2 rounded-lg font-semibold text-xs uppercase transition-all duration-200 hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed';
            lockedRemixBtn.style.cssText = 'background-color:#10B981;color:white;border:1px solid rgba(255,255,255,0.3)';
            lockedRemixBtn.textContent = '🎲 Remix Style';

            // Save button (exact same as built-in)
            const lockedSaveBtn = document.createElement('button');
            lockedSaveBtn.id = 'locked-tooltip-save';
            lockedSaveBtn.className = 'px-4 py-2 rounded-lg font-semibold text-xs uppercase transition-all duration-200 hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed';
            lockedSaveBtn.style.cssText = 'background-color:#10B981;color:white;border:1px solid rgba(255,255,255,0.3);backdrop-filter:blur(10px)';
            lockedSaveBtn.textContent = '💾 Save';

            buttonsDiv.appendChild(lockedRemixBtn);
            buttonsDiv.appendChild(lockedSaveBtn);

            // Assemble the container
            remixContainer.appendChild(textDiv);
            remixContainer.appendChild(buttonsDiv);
            
            document.body.appendChild(remixContainer);

            // Function to reposition bubble based on actual height
            const repositionBubble = () => {
              requestAnimationFrame(() => {
                const tooltip = document.getElementById('custom-tooltip');
                const bubble = document.getElementById('locked-remix-panel');
                if (!tooltip || !bubble) return;
                
                const tooltipRect = tooltip.getBoundingClientRect();
                const bubbleRect = bubble.getBoundingClientRect();
                const actualBubbleHeight = bubbleRect.height;
                const spacing = 8;
                const tooltipHeight = tooltipRect.height || 30;
                
                // Calculate new position: bubble bottom should be 8px above tooltip top
                let bubbleTop = tooltipRect.top - spacing - actualBubbleHeight;
                
                // Viewport boundary check
                const minTop = 10;
                if (bubbleTop < minTop) {
                  bubbleTop = Math.max(minTop, tooltipRect.top - tooltipHeight - spacing - actualBubbleHeight);
                }
                
                // Update bubble position
                bubble.style.top = `${bubbleTop}px`;
              });
            };

            const titleEl = remixContainer.querySelector('#locked-tooltip-title');
            const descEl = remixContainer.querySelector('#locked-tooltip-desc');
            const remixBtn = remixContainer.querySelector('#locked-tooltip-remix');
            const saveBtn = remixContainer.querySelector('#locked-tooltip-save');
            
            // Add input handlers (same logic as built-in panel)
            if (titleEl) {
              titleEl.addEventListener('input', (e) => {
                const el = e.currentTarget;
                const raw = el.innerText || '';
                const clamped = raw.length > 50 ? raw.slice(0, 50) : raw;
                if (clamped !== raw) el.innerText = clamped;
                // Update the content card title
                setContentCardTitle(originalCardIndex, clamped);
                // Reposition bubble after text change
                repositionBubble();
              });
              titleEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); return; }
              });
            }
            if (descEl) {
              descEl.addEventListener('input', (e) => {
                const el = e.currentTarget;
                const raw = el.innerText || '';
                const clamped = raw.length > 100 ? raw.slice(0, 100) : raw;
                if (clamped !== raw) el.innerText = clamped;
                // Content cards don't have editable state management yet
                // Reposition bubble after text change
                repositionBubble();
              });
              descEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); return; }
              });
            }
            
            const triggerRemix = () => {
              try {
                const imageDescription = (descEl?.innerText || contentDataLocal.image || contentDataLocal.text || 'content');
                const newImageUrl = getPollinationsImage(imageDescription, themeColor, { randomize: true });
                const timestamp = Date.now();
                const separator = newImageUrl.includes('?') ? '&' : '?';
                const newUrl = `${newImageUrl}${separator}t=${timestamp}`;
                setContentCardRemixedImage(originalCardIndex, newUrl);
                setContentCardImageLoading(originalCardIndex, true);
                console.log('Content card remix generated from panel', { originalCardIndex, imageDescription, newUrl });
              } catch (err) { 
                console.error('Content card remix failed', err); 
              }
            };
            if (remixBtn) remixBtn.addEventListener('click', (ev) => { ev.stopPropagation(); triggerRemix(); });
            if (saveBtn) saveBtn.addEventListener('click', (ev) => { ev.stopPropagation(); triggerRemix(); });
            
            // Initial reposition after bubble is created to ensure correct positioning
            repositionBubble();
            });
          } catch {}
          // Stays until explicit close button is clicked
          }, 0); // Close setTimeout
        }}
      >
        {/* Image area - show image if available OR if we have a remixed image */}
        {/* Only show images after theme has been saved (Save button clicked) */}
        {(contentData.image || getContentCardRemixedImage(originalCardIndex)) && getRouteColorPromptSaved() && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-full relative">
              {/* Loading spinner */}
              {isContentCardImageLoading(originalCardIndex) && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
                  <div className="flex flex-col items-center space-y-2">
                    <ArrowPathIcon className="w-6 h-6 animate-spin text-gray-600" />
                    <span className="text-xs text-gray-600">Loading image...</span>
                  </div>
                </div>
              )}
              
              {/* Image */}
              {(() => {
                // Use remixed image if available, otherwise use original logic
                const hasRemixedImage = !!getContentCardRemixedImage(originalCardIndex);
                const baseDescription = contentData.image || contentData.text || 'content';
                // Only generate image if theme has been saved
                const imageSrc = getContentCardRemixedImage(originalCardIndex) || 
                  (getRouteColorPromptSaved() ? getPollinationsImage(baseDescription, themeColor) : null);
                
                console.log('=== CONTENT CARD IMAGE RENDERING DEBUG ===', {
                  originalCardIndex,
                  hasRemixedImage,
                  imageSrc,
                  contentDataImage: contentData.image,
                  isLoading: isContentCardImageLoading(originalCardIndex),
                  themeSaved: getRouteColorPromptSaved()
                });
                
                // Don't render image if imageSrc is null (theme not saved)
                if (!imageSrc) {
                  return null;
                }
                
                return (
                  <img 
                    src={imageSrc}
                    alt={baseDescription}
                className="w-full h-full object-cover rounded-lg"
                    style={{ display: isContentCardImageLoading(originalCardIndex) ? 'none' : 'block' }}
                onLoad={() => {
                      console.log('=== POLLINATIONS CONTENT CARD IMAGE LOADED ===', { 
                        cardIndex: originalCardIndex, 
                        alt: contentData.image, 
                        src: imageSrc,
                        wasRemixed: hasRemixedImage
                      });
                      setContentCardImageLoading(originalCardIndex, false);
                }}
                onError={(e) => {
                      console.log('=== POLLINATIONS CONTENT CARD IMAGE LOAD ERROR ===', { 
                        src: e.target.src, 
                        alt: contentData.image,
                        wasRemixed: hasRemixedImage
                      });
                      setContentCardImageLoading(originalCardIndex, false);
                  e.target.style.display = 'none';
                }}
                onLoadStart={() => {
                      console.log('=== POLLINATIONS CONTENT CARD IMAGE LOAD START ===', { 
                        cardIndex: originalCardIndex, 
                        alt: contentData.image, 
                        src: imageSrc,
                        wasRemixed: hasRemixedImage
                      });
                      setContentCardImageLoading(originalCardIndex, true);
                    }}
                  />
                );
              })()}
            </div>
          </div>
        )}
        
        {/* Bottom rectangle with text field */}
        <div 
          className="absolute bottom-0 left-0 right-0 z-10 p-2 backdrop-blur-md backdrop-filter shadow-none"
          style={{ 
            backgroundColor: getReadableOnColor(themeColor) + 'CC',
            minHeight: '40px',
            display: 'flex',
            alignItems: 'center',
            borderTopLeftRadius: '0px',
            borderTopRightRadius: '0px',
            borderBottomLeftRadius: '8px',
            borderBottomRightRadius: '8px'
          }}
        >
          <p className="block font-semibold text-center uppercase" 
             style={{ 
               fontSize: '12px', 
               lineHeight: '16px', 
               margin: 0,
               ...(themeColor.includes('gradient') 
                 ? { background: themeColor, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }
                 : { color: themeColor }
               )
             }}>
{getContentCardTitle(originalCardIndex) || contentData.text}
          </p>
        </div>
        

      </div>
    );
  };

  return (
    <>
      <style>{gradientAnimationCSS}</style>
      <div style={{ position: 'relative', zIndex: 10001, width: 1302, margin: '92px auto 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
      <div
        className={`fjb-fps-container ${isCurrentRouteModified() && !getRouteColorPromptSaved() ? 'border-4 border-gradient-to-r from-blue-500 via-purple-500 to-pink-500' : ''}`}
        style={{ 
          width: 1336, 
          maxWidth: 1336, 
          marginLeft: -2, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: 24, 
          background: themeColor, 
          borderTopLeftRadius: 0, 
          borderTopRightRadius: 0, 
          borderBottomLeftRadius: 16, 
          borderBottomRightRadius: 16, 
          padding: 16, 
          paddingTop: 80, 
          paddingBottom: 40, 
          marginTop: 4, 
          position: 'relative', 
          zIndex: 1,
          ...(isCurrentRouteModified() && !getRouteColorPromptSaved() && {
            border: '4px solid',
            borderImage: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 25%, #ec4899 50%, #f59e0b 75%, #10b981 100%) 1',
            borderRadius: '4px 4px 16px 16px',
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(139, 92, 246, 0.3)'
          })
        }}
        onMouseEnter={(e) => {
          if (!isPromptMode) return;
          // Strict: Only allow FJB container to trigger FJB hover tip
          const isOverFJB = e.target.closest('[data-name="flight journey bar"]') || e.target.closest('[data-name="logo placeholder"]');
          const isOverFlightPhaseChip = e.target.closest('.flight-phase-label') || e.target.closest('.flightPhase-label');

          if (isOverFJB && !isOverFlightPhaseChip && typeof onPromptHover === 'function') {
            onPromptHover(true, 'flight-journey-bar', { themeColor }, { x: e.clientX, y: e.clientY });
          }
        }}
        onMouseMove={(e) => {
          if (!isPromptMode) return;
          // Strict: Only allow FJB container to trigger FJB hover tip
          const isOverFJB = e.target.closest('[data-name="flight journey bar"]') || e.target.closest('[data-name="logo placeholder"]');
          const isOverFlightPhaseChip = e.target.closest('.flight-phase-label') || e.target.closest('.flightPhase-label');

          if (isOverFJB && !isOverFlightPhaseChip && typeof onPromptHover === 'function') {
            onPromptHover(true, 'flight-journey-bar', { themeColor }, { x: e.clientX, y: e.clientY });
          } else if (typeof onPromptHover === 'function') {
            onPromptHover(false, 'flight-journey-bar', { themeColor }, { x: e.clientX, y: e.clientY });
          }
        }}
        onMouseLeave={(e) => {
          if (!isPromptMode) return;
          if (typeof onPromptHover === 'function') {
            onPromptHover(false, 'flight-journey-bar', { themeColor }, { x: e.clientX, y: e.clientY });
          }
        }}
        onClick={(e) => {
          if (!isPromptMode || typeof onPromptClick !== 'function') return;

          // Check if there's already an active FJB prompt bubble
          const currentPromptBubble = getCurrentRoutePromptBubble(routePromptBubbles, getCurrentRouteKey);
          if (currentPromptBubble && (currentPromptBubble.elementType === 'flight-journey-bar' || currentPromptBubble.elementType === 'flight-journey-bar-animation')) {
            // If FJB prompt bubble is open, only allow clicks within FJB container
            const isOverFJBActive = e.target.closest('[data-name="flight journey bar"]') || e.target.closest('[data-name="logo placeholder"]');
            if (!isOverFJBActive) {
              // Click is outside FJB container, ignore it
              console.log('=== IGNORING CLICK OUTSIDE FJB CONTAINER - FJB PROMPT BUBBLE ACTIVE ===');
              return;
            }
          }

          // Strict: Only allow FJB container to open FJB color prompt bubble
          const isOverFJB = e.target.closest('[data-name="flight journey bar"]') || e.target.closest('[data-name="logo placeholder"]');
          const isOverLogoPlaceholder = e.target.closest('[data-name="logo placeholder"]');
          const isOverFlightPhaseChip = e.target.closest('.flight-phase-label') || e.target.closest('.flightPhase-label');

          if (isOverLogoPlaceholder) {
            // Let the logo-placeholder element handle its own click to open the correct PB
            return;
          }

          if (isOverFlightPhaseChip) {
            // Ignore clicks on flight phase chips - they should only select flight phases
            return;
          }

          // Do not open color prompt from FJB clicks anymore
          if (isOverFJB) {
            return;
          }
        }}
      >
        <div style={{ width: '100%', marginTop: -32, display: 'flex', flexDirection: 'column', gap: 28 }}>
          <FlightJourneyBar 
            origin={origin} 
            destination={destination} 
            minutesLeft={minutesLeft} 
            themeColor={themeColor} 
            selectedLogo={selectedLogo}
          />
          <FlightProgress 
            landingIn={landingIn} 
            maxFlightMinutes={maxFlightMinutes} 
            minutesLeft={minutesLeft} 
            onProgressChange={handleProgressChange} 
            themeColor={themeColor}
            isPromptMode={isPromptMode}
            onPromptHover={onPromptHover}
            onPromptClick={onPromptClick}
            fpsPrompts={fpsPrompts}
            flightsGenerated={flightsGenerated}
            onAnimationProgress={onAnimationProgress}
            onFlightPhaseSelect={onFlightPhaseSelect}
            selectedFlightPhase={selectedFlightPhase}
          />
        </div>
      </div>
      <Component3Cards 
        themeColor={themeColor} 
        origin={origin}
        destination={destination}
        routes={routes}
        isPromptMode={isPromptMode}
        onPromptHover={onPromptHover}
        onPromptClick={onPromptClick}
        isThemeBuildStarted={isThemeBuildStarted}
        selectedFlightPhase={selectedFlightPhase}
        promoCardContents={promoCardContents}
        colorPromptClosedWithoutSave={colorPromptClosedWithoutSave}
        colorPromptSaved={getRouteColorPromptSaved()}
        currentRouteKey={getCurrentRouteKey()}
        isModifyClicked={isCurrentRouteModified()}
        selectedDates={selectedDates}
        isCurrentThemeFestive={isCurrentThemeFestive}
        getRouteSelectedThemeChip={getRouteSelectedThemeChip}
        selectedProfile={selectedProfile}
      />
      
      {/* Recommended for you section */}
      <div
        className="flex flex-col items-start"
        style={{ width: '1302px', gap: '24px' }}
      >
        <p className="block text-left font-bold text-black" style={{ fontSize: '28px', lineHeight: '36px', margin: 0 }}>
          Recommended for you
        </p>
        
        {/* 4 Recommended Tiles */}
        <div className="grid grid-cols-4 gap-6" style={{ width: '100%' }} key={`content-cards-${JSON.stringify(getRouteContentCards())}`}>
          {!isThemeBuildStarted ? (
            // Show white placeholders when no theme is built
            <>
              <div
                className="overflow-clip relative shrink-0 flex items-center justify-center"
                style={{
                  width: '100%',
                  height: '160px',
                  borderTopLeftRadius: '8px',
                  borderTopRightRadius: '8px',
                  borderBottomLeftRadius: '8px',
                  borderBottomRightRadius: '8px',
                  backgroundColor: getLightCardBackgroundColor(themeColor)
                }}
              >
                <span style={{ color: 'black', fontSize: '14px' }}>Placeholder 1 (isThemeBuildStarted: {isThemeBuildStarted.toString()})</span>
              </div>
              <div
                className="overflow-clip relative shrink-0 flex items-center justify-center"
                style={{
                  width: '100%',
                  height: '160px',
                  borderTopLeftRadius: '8px',
                  borderTopRightRadius: '8px',
                  borderBottomLeftRadius: '8px',
                  borderBottomRightRadius: '8px',
                  backgroundColor: getLightCardBackgroundColor(themeColor)
                }}
              >
                <span style={{ color: 'black', fontSize: '14px' }}>Placeholder 2</span>
              </div>
              <div
                className="overflow-clip relative shrink-0 flex items-center justify-center"
                style={{
                  width: '100%',
                  height: '160px',
                  borderTopLeftRadius: '8px',
                  borderTopRightRadius: '8px',
                  borderBottomLeftRadius: '8px',
                  borderBottomRightRadius: '8px',
                  backgroundColor: getLightCardBackgroundColor(themeColor)
                }}
              >
                <span style={{ color: 'black', fontSize: '14px' }}>Placeholder 3</span>
              </div>
              <div
                className="overflow-clip relative shrink-0 flex items-center justify-center"
                style={{
                  width: '100%',
                  height: '160px',
                  borderTopLeftRadius: '8px',
                  borderTopRightRadius: '8px',
                  borderBottomLeftRadius: '8px',
                  borderBottomRightRadius: '8px',
                  backgroundColor: getLightCardBackgroundColor(themeColor)
                }}
              >
                <span style={{ color: 'black', fontSize: '14px' }}>Placeholder 4</span>
              </div>
            </>
          ) : (
            // Show themed content when theme is built and routes are available
            [0, 1, 2, 3].map((originalCardIndex, displayPosition) => {
              console.log('🎯 Rendering content card:', { 
                originalCardIndex, 
                displayPosition, 
                routeContentCards: getRouteContentCards() 
              });
              return renderContentCard(originalCardIndex, displayPosition, selectedProfile);
            })
          )}
        </div>
      </div>
      </div>
    </>
  );
}

export default function Dashboard() {
  const location = useLocation();
  const minimizeThemeCreator = location.state?.minimizeThemeCreator;
  // Lifted state for routes
  const [routes, setRoutes] = useState([]);
  // Track if user has started building theme (enables 3PCs content and PB)
  const [isThemeBuildStarted, setIsThemeBuildStarted] = useState(true);
  const [themeAnimationComplete, setThemeAnimationComplete] = useState(false);
  // NEW: State for selected segment (color card)
  const [selectedSegment, setSelectedSegment] = useState(null);
  // NEW: State for current theme color
  const [currentThemeColor, setCurrentThemeColor] = useState('#1E72AE'); // Always Discover blue for flights view

  // NEW: Per-flight-route theme tracking
  const [flightThemes, setFlightThemes] = useState({}); // { [flightKey]: themeColor }
  const [currentFlightKey, setCurrentFlightKey] = useState(null); // Current flight route key
  
  // NEW: Per-flight-route progress tracking
  const [flightRouteProgress, setFlightRouteProgress] = useState({}); // { [flightKey]: progressPercentage }

  
  // NEW: Prompt mode state
  const [isPromptMode, setIsPromptMode] = useState(false);
  const [modifiedRoutes, setModifiedRoutes] = useState({});
  const [activeSegmentId, setActiveSegmentId] = useState(null); // Track which segment is in prompt mode
  const [routePromptBubbles, setRoutePromptBubbles] = useState({}); // { routeKey: { x, y, elementType, elementData } }
  const [colorPromptClosedWithoutSave, setColorPromptClosedWithoutSave] = useState(false); // Track if color PB was closed without saving
  const [routeColorPromptSaved, setRouteColorPromptSaved] = useState({}); // Track if color PB was saved per route: { routeKey: boolean }
  const [routeSelectedThemeChips, setRouteSelectedThemeChips] = useState({}); // Track selected theme chip per route: { routeKey: chipData }
  const [selectedLogo, setSelectedLogo] = useState(null); // { id, src }
  const [ifeFrameThemeColor, setIfeFrameThemeColor] = useState('#1E1E1E'); // Preserve airline theme for IFE frame
  const [showPlusIcon, setShowPlusIcon] = useState(false);
  const [ifeFrameHover, setIfeFrameHover] = useState({ isHovering: false, x: 0, y: 0 }); // Track IFE frame hover state
  const [contentCardHover, setContentCardHover] = useState({ isHovering: false, x: 0, y: 0 }); // Track content card hover state
  
  // Store submitted prompts by FPS position
  const [fpsPrompts, setFpsPrompts] = useState({}); // { [position]: text }
  
  // NEW: Track if any filter chip has been selected
  const [isFilterChipSelected, setIsFilterChipSelected] = useState(false);
  
  // Mouse pointer state
  const [showMousePointer, setShowMousePointer] = useState(false);
  // Profiles dropdown state
  const [profilesDropdown, setProfilesDropdown] = useState({ visible: false, x: 0, y: 0 });

  // Theme chips (colors) exposed from ThemeCreator for the active flight
  const [fjbThemeChips, setFjbThemeChips] = useState([]);
  // Track the currently selected theme chip for logo animation
  const [selectedThemeChip, setSelectedThemeChip] = useState(null);
  // NEW: Track the currently selected flight phase
  const [selectedFlightPhase, setSelectedFlightPhase] = useState(null);
  
  // Route-specific promo card contents: { [routeKey]: { [cardIndex]: content } }
  const [promoCardContents, setPromoCardContents] = useState({});
  // NEW: Track the currently selected flight segment for FJB
  const [selectedFlightSegment, setSelectedFlightSegment] = useState(null);
  // NEW: Track selected dates for festival chips
  const [selectedDates, setSelectedDates] = useState([]);
  // NEW: Track flight card progress percentages (flight card index -> progress percentage)
  const [flightCardProgress, setFlightCardProgress] = useState({});
  // Route-specific recommended content cards: { [routeKey]: contentCards }
  const [recommendedContentCards, setRecommendedContentCards] = useState({});
  // Modified chip colors are stored per-route to avoid leakage: { [routeKey]: { [chipKey]: color } }
  const [modifiedChipColors, setModifiedChipColors] = useState({});

  const getRouteModifiedChipColors = () => {
    const routeKey = getCurrentRouteKey();
    return (routeKey && modifiedChipColors[routeKey]) ? modifiedChipColors[routeKey] : {};
  };

  const setRouteModifiedChipColor = (chipKey, color) => {
    const routeKey = getCurrentRouteKey();
    if (!routeKey) return;
    setModifiedChipColors(prev => ({
      ...prev,
      [routeKey]: {
        ...(prev[routeKey] || {}),
        [chipKey]: color
      }
    }));
  };
  // State for analytics bubble
  const [analyticsBubble, setAnalyticsBubble] = useState({ visible: false, x: 0, y: 0, elementData: null });


  // Handle analytics click
  const handleAnalyticsClick = (e, elementData) => {
    e.stopPropagation();
    console.log('=== ANALYTICS CLICKED - DISABLED ===', { elementData });
    
    // Analytics bubble is currently disabled
    // Do nothing - analytics functionality is turned off
    return;
  };

  // Close analytics bubble
  const handleCloseAnalytics = () => {
    setAnalyticsBubble({ visible: false, x: 0, y: 0, elementData: null });
  };



  // Handle content tab click
  const handleContentClick = (e, elementData) => {
    e.stopPropagation();
    console.log('=== CONTENT CLICKED ===', { elementData });
    
    // Close analytics bubble if open
    setAnalyticsBubble({ visible: false, x: 0, y: 0, elementData: null });
    
    // Use the hover tip's position instead of click coordinates
    let hoverTipPosition = { x: 0, y: 0 };
    
    if (elementData.cardType === 'content-card') {
      // Content card hover tip removed
    }
    
    // Small delay to prevent flickering
    setTimeout(() => {
      // Open prompt bubble at the correct position
      setCurrentRoutePromptBubble({
        x: hoverTipPosition.x,
        y: hoverTipPosition.y + 50, // Position below hover tip (consistent with promo card click)
        elementType: elementData.cardType === 'content-card' ? 'content-card' : 'promo-card',
        elementData: elementData,
        existingText: '',
        positionKey: `${elementData.cardType}-${elementData.cardIndex}`
      });
    }, 50);
  };


  // Removed scroll-collapsed header behavior

  // Use selected flight segment if available, then selected segment, else default to full route
  const origin = selectedFlightSegment?.origin || selectedSegment?.origin || (routes.length > 0 ? routes[0] : null);
  const destination = selectedFlightSegment?.destination || selectedSegment?.destination || (routes.length > 1 ? routes[routes.length - 1] : null);

  // Helper function to generate flight key
  const getFlightKey = (origin, destination) => {
    if (!origin || !destination) return null;
    return `${origin.airport?.code || origin.airport?.city || 'unknown'}-${destination.airport?.code || destination.airport?.city || 'unknown'}`;
  };
  
  // Helper function to get current route key
  const getCurrentRouteKey = () => {
    const routeKey = getFlightKey(origin, destination);
    console.log('🎯 getCurrentRouteKey called:', { origin, destination, routeKey });
    return routeKey;
  };

  // Close profiles dropdown when clicking outside or when other prompt bubbles are opened
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profilesDropdown.visible) {
        const isDropdown = event.target.closest('[data-dropdown="true"]');
        const isProfilesButton = event.target.closest('[data-profiles-button="true"]');
        if (!isDropdown && !isProfilesButton) {
          setProfilesDropdown({ visible: false, x: 0, y: 0 });
        }
      }
    };

    // Close profiles dropdown when other prompt bubbles are opened
    const currentBubble = getCurrentRoutePromptBubble(routePromptBubbles, getCurrentRouteKey);
    if (profilesDropdown.visible && currentBubble && currentBubble.elementType !== 'flight-journey-bar') {
      setProfilesDropdown({ visible: false, x: 0, y: 0 });
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profilesDropdown.visible, routePromptBubbles]);

  // Keep FJB hover tip pinned while Profiles dropdown is open
  useEffect(() => {
    // Profiles dropdown positioning is handled in the render
  }, [profilesDropdown.visible]);

  // Helper functions for route-specific colorPromptSaved
  const getRouteColorPromptSaved = () => {
    const routeKey = getCurrentRouteKey();
    return routeColorPromptSaved[routeKey] || false;
  };

  const setRouteColorPromptSavedValue = (value) => {
    const routeKey = getCurrentRouteKey();
    setRouteColorPromptSaved(prev => ({
      ...prev,
      [routeKey]: value
    }));
  };

  // Helper functions for route-specific theme chip management
  const getRouteSelectedThemeChip = () => {
    const routeKey = getCurrentRouteKey();
    return routeSelectedThemeChips[routeKey] || null;
  };

  const setRouteSelectedThemeChip = (chipData) => {
    const routeKey = getCurrentRouteKey();
    setRouteSelectedThemeChips(prev => ({
      ...prev,
      [routeKey]: chipData
    }));
  };

  // Helper function to validate if current theme should generate festival content
  const isCurrentThemeFestive = () => {
    const selectedChip = getRouteSelectedThemeChip();
    if (!selectedChip) return false;
    
    // Check if the chip is marked as festive
    if (selectedChip.isFestival) return true;
    
    // Check if the chip label indicates a festival
    const label = selectedChip.label?.toLowerCase() || '';
    const festiveKeywords = [
      'carnival', 'carnevale', 'oktoberfest', 'fashion week', 'light festival',
      'dance event', 'film festival', 'christmas', 'market', 'pride',
      'bastille', 'king\'s day', 'nuit blanche', 'tollwood', 'frühlingsfest'
    ];
    
    return festiveKeywords.some(keyword => label.includes(keyword));
  };
  
  // Helper function to get route-specific promo card contents
  const getRoutePromoCardContents = () => {
    const routeKey = getCurrentRouteKey();
    if (!routeKey) return {};
    return promoCardContents[routeKey] || {};
  };
  
  // Helper function to set route-specific promo card contents
  const setRoutePromoCardContents = (cardIndex, content) => {
    const routeKey = getCurrentRouteKey();
    if (!routeKey) return;
    
    setPromoCardContents(prev => ({
      ...prev,
      [routeKey]: {
        ...prev[routeKey],
        [cardIndex]: content
      }
    }));
  };
  
  // Helper function to get route-specific content cards
  const getRouteContentCards = () => {
    const routeKey = getCurrentRouteKey();
    if (!routeKey) return [
      { id: 1, title: 'Add content', type: 'default' },
      { id: 2, title: 'Add content', type: 'default' },
      { id: 3, title: 'Add content', type: 'default' },
      { id: 4, title: 'Add content', type: 'default' }
    ];
    return recommendedContentCards[routeKey] || [
      { id: 1, title: 'Add content', type: 'default' },
      { id: 2, title: 'Add content', type: 'default' },
      { id: 3, title: 'Add content', type: 'default' },
      { id: 4, title: 'Add content', type: 'default' }
    ];
  };
  
  // Helper function to set route-specific content cards
  const setRouteContentCards = (contentCards) => {
    const routeKey = getCurrentRouteKey();
    if (!routeKey) return;
    
    setRecommendedContentCards(prev => ({
      ...prev,
      [routeKey]: contentCards
    }));
  };
  
  // Helper function to get current flight theme
  const getCurrentFlightTheme = () => {
    const flightKey = getFlightKey(origin, destination);
    if (!flightKey) return '#1E72AE'; // Default Discover blue
    
    // Return the theme for this specific flight, or default if none set
    return flightThemes[flightKey] || '#1E72AE';
  };

  // Helper function to create lighter version of theme color
  const getLightThemeColor = (opacity = 0.1) => {
    if (activeThemeColor.startsWith('#')) {
      // Convert hex to rgba with opacity
      const hex = activeThemeColor.slice(1);
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return 'rgba(255,255,255,0.1)';
  };

  // Helper function to get phase-specific content for promo cards
  const getPhaseSpecificContent = (cardIndex) => {
    if (!selectedFlightPhase) return null;
    
    const phaseContent = {
      'takeoff': [
        { text: "Add experience", bgColor: getLightThemeColor() },
        { text: "Add experience", bgColor: getLightThemeColor() },
        { text: "Add experience", bgColor: getLightThemeColor() }
      ],
      'climb': [
        { text: "Add experience", bgColor: getLightThemeColor() },
        { text: "Add experience", bgColor: getLightThemeColor() },
        { text: "Add experience", bgColor: getLightThemeColor() }
      ],
      'cruise': [
        { text: "Add experience", bgColor: getLightThemeColor() },
        { text: "Add experience", bgColor: getLightThemeColor() },
        { text: "Add experience", bgColor: getLightThemeColor() }
      ],
      'descent': [
        { text: "Add experience", bgColor: getLightThemeColor() },
        { text: "Add experience", bgColor: getLightThemeColor() },
        { text: "Add experience", bgColor: getLightThemeColor() }
      ],
      'landing': [
        { text: "Add experience", bgColor: getLightThemeColor() },
        { text: "Add experience", bgColor: getLightThemeColor() },
        { text: "Add experience", bgColor: getLightThemeColor() }
      ]
    };
    
    const content = phaseContent[selectedFlightPhase];
    return content && content[cardIndex] ? content[cardIndex] : null;
  };

  // Helper function to get phase-specific image keywords for AI generation
  const getPhaseSpecificImageKeyword = (cardIndex) => {
    if (!selectedFlightPhase) return null;
    
    const phaseImageKeywords = {
      'takeoff': [
        "", // empty
        "", // empty
        "" // empty
      ],
      'climb': [
        "", // empty
        "", // empty
        "" // empty
      ],
      'cruise': [
        "", // empty
        "", // empty
        "" // empty
      ],
      'descent': [
        "", // empty
        "", // empty
        "" // empty
      ],
      'landing': [
        "", // empty
        "", // empty
        "" // empty
      ]
    };
    
    const keywords = phaseImageKeywords[selectedFlightPhase];
    return keywords && keywords[cardIndex] ? keywords[cardIndex] : null;
  };
  
  // Helper function to get current flight progress
  const getCurrentFlightProgress = () => {
    const flightKey = getFlightKey(origin, destination);
    if (!flightKey) return 0; // Default 0% progress
    
    // Return the progress for this specific flight, or 0 if none set
    return flightRouteProgress[flightKey] || 0;
  };
  
  // Helper function to check if current route is modified
  const isCurrentRouteModified = () => {
    const routeKey = getCurrentRouteKey();
    if (!routeKey) return false;
    return modifiedRoutes[routeKey] || false;
  };
  
  // Helper function to mark current route as modified
  const markCurrentRouteAsModified = () => {
    const routeKey = getCurrentRouteKey();
    if (!routeKey) return;
    setModifiedRoutes(prev => ({
      ...prev,
      [routeKey]: true
    }));
  };
  
  
  // Helper function to set current route's prompt bubble
  const setCurrentRoutePromptBubble = (bubbleData) => {
    const routeKey = getCurrentRouteKey();
    console.log('🎯 Setting prompt bubble for route:', { routeKey, bubbleData, hasRouteKey: !!routeKey });
    if (!routeKey) {
      console.log('❌ No route key found - cannot set prompt bubble');
      return;
    }
    setRoutePromptBubbles(prev => {
      const newState = {
        ...prev,
        [routeKey]: bubbleData
      };
      console.log('🎯 Updated route prompt bubbles:', newState);
      return newState;
    });
  };

  // Add debugging for when routePromptBubbles state changes
  useEffect(() => {
    console.log('🎯 routePromptBubbles state changed:', routePromptBubbles);
  }, [routePromptBubbles]);
  
  // Update current flight key when origin/destination changes
  useEffect(() => {
    const newFlightKey = getFlightKey(origin, destination);
    if (newFlightKey !== currentFlightKey) {
      setCurrentFlightKey(newFlightKey);
      console.log('🎯 Flight route changed:', { 
        from: currentFlightKey, 
        to: newFlightKey,
        availableThemes: Object.keys(flightThemes),
        availableProgress: Object.keys(flightRouteProgress),
        routePromptBubbles: routePromptBubbles
      });
    }
  }, [origin, destination, currentFlightKey, flightThemes, flightRouteProgress]);
  
  // Use the current flight's theme instead of global theme
  const activeThemeColor = getCurrentFlightTheme();

  // Store profile selections per route (persistent across context changes)
  const [routeProfiles, setRouteProfiles] = useState({});
  
  
  // Get the current route's selected profile
  const getCurrentRouteProfile = () => {
    const routeKey = getCurrentRouteKey();
    return routeKey ? routeProfiles[routeKey] || null : null;
  };
  
  // Set the current route's selected profile
  const setCurrentRouteProfile = (profile) => {
    const routeKey = getCurrentRouteKey();
    if (!routeKey) return;
    
    setRouteProfiles(prev => ({
      ...prev,
      [routeKey]: profile
    }));
    
    console.log('🔄 PROFILE STORED FOR ROUTE', {
      routeKey,
      profile,
      allRouteProfiles: { ...routeProfiles, [routeKey]: profile }
    });
  };
  
  
  // Make selectedProfile reactive to routeProfiles changes
  const selectedProfile = useMemo(() => {
    return getCurrentRouteProfile();
  }, [routeProfiles, getCurrentRouteKey]);
  
  
  // Debug logging for profile state changes
  useEffect(() => {
    console.log('🔄 PROFILE STATE CHANGED', {
      selectedProfile,
      routeKey: getCurrentRouteKey(),
      allRouteProfiles: routeProfiles
    });
  }, [selectedProfile, routeProfiles]);
  

  // Debug when routeColorPromptSaved changes
  useEffect(() => {
    console.log('=== DASHBOARD ROUTE COLORPROMPTSAVED CHANGED ===', {
      routeColorPromptSaved,
      currentRouteSaved: getRouteColorPromptSaved(),
      selectedFlightPhase,
      origin,
      destination,
      activeThemeColor,
      selectedDates,
      hasOrigin: !!origin,
      hasDestination: !!destination,
      hasSelectedFlightPhase: !!selectedFlightPhase,
      hasSelectedDates: !!selectedDates && selectedDates.length > 0
    });
  }, [routeColorPromptSaved, selectedFlightPhase, origin, destination, activeThemeColor, selectedDates]);

  // Compute contrasting border color for hover tip PBs (same logic as main PB)
  const isGradientTheme = typeof activeThemeColor === 'string' && activeThemeColor.includes('gradient');
  const parseHex = (hex) => {
    if (!hex || typeof hex !== 'string') return { r: 0, g: 0, b: 0 };
    const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) return { r: 0, g: 0, b: 0 };
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
  };
  const getLuminance = ({ r, g, b }) => {
    const srgb = [r, g, b].map(v => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  };
  const hoverUseLightText = isGradientTheme
    ? true
    : (typeof activeThemeColor === 'string' && activeThemeColor.startsWith('#') && activeThemeColor.length === 7
        ? getLuminance(parseHex(activeThemeColor)) < 0.5
        : true);
  const hoverBorderColor = hoverUseLightText ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.35)';
  // Material-based readable on-color for text/icons over activeThemeColor
  const hoverOnColor = getReadableOnColor(activeThemeColor);

  // Countdown state
  const maxFlightMinutes = 370; // 6h10m
  const [minutesLeft, setMinutesLeft] = useState(maxFlightMinutes);
  const timerRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [flightsGenerated, setFlightsGenerated] = useState(false);
  const [isGeneratingFlights, setIsGeneratingFlights] = useState(false);
  const [showInFlightGUI, setShowInFlightGUI] = useState(false);
  const [showIFEFrame, setShowIFEFrame] = useState(false);
  const [showInFlightPreview, setShowInFlightPreview] = useState(false);
  const [showSweepAnimation, setShowSweepAnimation] = useState(false);
  const [isScrollingUp, setIsScrollingUp] = useState(false);
  const [isFlightContentSticky, setIsFlightContentSticky] = useState(false);
  const [darkContainerHeight, setDarkContainerHeight] = useState(0);

  // Fixed position for FJB hover tip (always visible) - computed value
  const fjbHoverTip = { 
    visible: true, 
    x: window.innerWidth / 2, 
    y: isFlightContentSticky ? 136 : window.innerHeight / 2 - 324 
  };

  // Anchor for aligning dropdowns and prompt bubbles to the hover tip's left edge
  const hoverTipRef = useRef(null);
  const [hoverAnchor, setHoverAnchor] = useState({ x: 0, y: 0 });
  const [selectedHoverItem, setSelectedHoverItem] = useState(null); // Track which hover tip item is selected
  useEffect(() => {
    if (!isPromptMode || !showInFlightPreview) return;
    const updateAnchor = () => {
      if (!hoverTipRef.current) return;
      const rect = hoverTipRef.current.getBoundingClientRect();
      setHoverAnchor({ x: rect.left, y: rect.bottom });
    };
    updateAnchor();
    window.addEventListener('resize', updateAnchor, { passive: true });
    return () => window.removeEventListener('resize', updateAnchor);
  }, [isPromptMode, showInFlightPreview, isFlightContentSticky]);

  // Helper: compute hover tip anchor on demand to avoid timing races
  const getHoverAnchorNow = () => {
    try {
      const el = hoverTipRef.current || document.querySelector('[data-fjb-hover-tip="true"]') || document.querySelector('[data-hover-tip]');
      if (el) {
        const r = el.getBoundingClientRect();
        // Use left edge of the hover tip so bubble can left-align to it
        return { x: r.left, y: r.bottom };
      }
    } catch {}
    // Fallback estimate if hover tip not yet in DOM
    const fallbackY = isFlightContentSticky ? 136 : (typeof window !== 'undefined' ? (window.innerHeight / 2 - 324) : 0);
    const fallbackX = typeof window !== 'undefined' ? Math.max(0, Math.floor(window.innerWidth / 2 - 120)) : 0;
    return { x: fallbackX, y: fallbackY + 40 };
  };

  const openFjbPromptBelowHoverTip = (elementType) => {
    // Deterministically wait for the hover tip to be present and stable
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const timeoutMs = 2000; // hard cap
    let lastRect = null;
    let stableCount = 0;
    const requiredStableFrames = 3;

    const loop = () => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const el = hoverTipRef.current || document.querySelector('[data-fjb-hover-tip="true"]') || document.querySelector('[data-hover-tip]');
      if (el) {
        const r = el.getBoundingClientRect();
        const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
        const visible = !style || (style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0.8);
        const hasSize = r.width > 0 && r.height > 0;
        if (visible && hasSize) {
          if (lastRect && Math.abs(lastRect.left - r.left) < 0.5 && Math.abs(lastRect.bottom - r.bottom) < 0.5) {
            stableCount += 1;
          } else {
            stableCount = 0;
            lastRect = r;
          }
          if (stableCount >= requiredStableFrames) {
            const anchor = { x: r.left, y: r.bottom };
            handlePromptClick(elementType, { themeColor: activeThemeColor }, { x: anchor.x, y: anchor.y + 8 });
            return;
          }
        }
      }
      if (now - start < timeoutMs) {
        requestAnimationFrame(loop);
      } else if (lastRect) {
        const anchor = { x: lastRect.left, y: lastRect.bottom };
        handlePromptClick(elementType, { themeColor: activeThemeColor }, { x: anchor.x, y: anchor.y + 8 });
      } else {
        // As a last resort, don’t open until we can anchor correctly
        requestAnimationFrame(loop);
      }
    };
    requestAnimationFrame(loop);
  };

  // DEBUG: Track recommendedContentCards changes
  useEffect(() => {
    console.log('🎯 recommendedContentCards state changed:', recommendedContentCards);
  }, [recommendedContentCards]);

  // DEBUG: Track height changes
  const dashboardRef = useRef(null);
  useEffect(() => {
    console.log('🚀 DASHBOARD DEBUG: Component mounted/updated', {
      flightsGenerated,
      isGeneratingFlights,
      timestamp: new Date().toISOString()
    });
    
    if (dashboardRef.current) {
      const currentHeight = dashboardRef.current.getBoundingClientRect().height;
      console.log('🔍 DASHBOARD CURRENT HEIGHT:', currentHeight);
      
      const observer = new ResizeObserver(entries => {
        for (let entry of entries) {
          console.log('🔍 DASHBOARD HEIGHT CHANGE:', {
            height: entry.contentRect.height,
            flightsGenerated,
            isGeneratingFlights,
            timestamp: new Date().toISOString()
          });
        }
      });
      observer.observe(dashboardRef.current);
      return () => observer.disconnect();
    }
  }, [flightsGenerated, isGeneratingFlights]);

  // Listen for generate flights event
  useEffect(() => {
    const handleGenerateFlights = () => {
      console.log('🔥 FLIGHTS GENERATED EVENT TRIGGERED');
      setFlightsGenerated(true);
    };
    
    window.addEventListener('airport-search-generate-flights', handleGenerateFlights);
    return () => window.removeEventListener('airport-search-generate-flights', handleGenerateFlights);
  }, []);

  // Reset flightsGenerated when not generating flights
  useEffect(() => {
    if (!isGeneratingFlights) {
      setFlightsGenerated(false);
    }
  }, [isGeneratingFlights]);


  // Handle theme animation completion
  const handleThemeAnimationComplete = () => {
    setThemeAnimationComplete(true);
  };



  // Disable IFE frame animation - flight cards should appear in same position as route cards
  useEffect(() => {
    if (flightsGenerated) {
      // Just activate prompt mode immediately without any IFE frame
      setIsPromptMode(true);
      
      // Keep IFE frame hidden - flight cards appear in original position
      setShowInFlightGUI(false);
      setShowIFEFrame(false);
            } else {
      // Reset states when flights are not generated
      setShowInFlightGUI(false);
      setShowIFEFrame(false);
    }
  }, [flightsGenerated]);

  // Disable sweep animation - keep flight cards in original position
  useEffect(() => {
      setShowSweepAnimation(false);
  }, [isPromptMode, flightsGenerated]);

  useEffect(() => {
    setMinutesLeft(maxFlightMinutes);
  }, [maxFlightMinutes]);

  useEffect(() => {
    if (dragging) return; // Pause timer while dragging
    if (minutesLeft <= 0) return;
    timerRef.current = setTimeout(() => {
      setMinutesLeft((m) => (m > 0 ? m - 1 : 0));
    }, 60000);
    return () => clearTimeout(timerRef.current);
  }, [minutesLeft, dragging]);

  const landingIn = formatTime(minutesLeft);

  // Handle prompt mode interactions
  const handlePromptHover = (isHovering, elementType, elementData, position) => {
    // elementType: 'flight-icon' or 'promo-card'
    // elementData: contains specific data about the element
    // position: { x, y } cursor position
    console.log('=== HANDLE PROMPT HOVER ===', { isHovering, elementType, isPromptMode, colorPromptClosedWithoutSave });
    if (!isPromptMode) return;
    // When Profiles dropdown is open, ignore non-FJB hover updates and ignore hide events
    if (profilesDropdown.visible) {
      // During dropdown open, ignore hover updates
      return;
    }
    
    // Check if there's an active FJB prompt bubble
    const currentPromptBubble = getCurrentRoutePromptBubble(routePromptBubbles, getCurrentRouteKey);
    if (currentPromptBubble && (currentPromptBubble.elementType === 'flight-journey-bar' || currentPromptBubble.elementType === 'flight-journey-bar-animation')) {
      // If FJB prompt bubble is active, only allow FJB hover events
      if (elementType !== 'flight-journey-bar' && elementType !== 'flight-journey-bar-animation') {
        console.log('=== BLOCKING HOVER EVENT - FJB PROMPT BUBBLE ACTIVE ===', { elementType });
        return;
      }
    }
    
    // Process hover event directly since we removed excessive mouse move events
    processHoverEvent(isHovering, elementType, elementData, position);
  };
  
  const processHoverEvent = (isHovering, elementType, elementData, position) => {
    console.log('=== DEBUG PROCESS HOVER EVENT ===', {
      isHovering,
      elementType,
      elementData,
      position,
      colorPromptSaved: getRouteColorPromptSaved(),
      colorPromptClosedWithoutSave,
      isPromptMode
    });
    // When Profiles dropdown is open, do not modify hover state for non-FJB elements
    if (profilesDropdown.visible && elementType !== 'flight-journey-bar' && elementType !== 'flight-journey-bar-animation') {
      return;
    }
    
    // Check if there's an active FJB prompt bubble
    const currentPromptBubble = getCurrentRoutePromptBubble(routePromptBubbles, getCurrentRouteKey);
    if (currentPromptBubble && (currentPromptBubble.elementType === 'flight-journey-bar' || currentPromptBubble.elementType === 'flight-journey-bar-animation')) {
      // If FJB prompt bubble is active, only allow FJB hover events
      if (elementType !== 'flight-journey-bar' && elementType !== 'flight-journey-bar-animation') {
        console.log('=== BLOCKING HOVER EVENT - FJB PROMPT BUBBLE ACTIVE ===', { elementType });
        return;
      }
    }
    
    // If color prompt hasn't been saved, only allow flight-journey-bar hovers
    if (!getRouteColorPromptSaved() && elementType !== 'flight-journey-bar') {
      console.log('🎯 Prompt hover ignored - color prompt not saved, only FJB allowed');
      return;
    }
    
    
    // FJB hover logic removed - hover tip is now always visible
    if (elementType === 'flight-journey-bar' || elementType === 'flight-journey-bar-animation') {
      return;
    }
    if (elementType === 'flight-icon') {
      if (!getCurrentRoutePromptBubble(routePromptBubbles, getCurrentRouteKey)) {
        // FPS hover tip removed
        setShowPlusIcon(false);
      } else {
        // FPS hover tip removed
      }
      return;
    }


    if (elementType === 'promo-card') {
      // Promo card hover tip removed
      return;
    }

    if (elementType === 'content-card') {
      // Content card hover tip removed
      return;
    }
    if (getCurrentRoutePromptBubble(routePromptBubbles, getCurrentRouteKey)) return;
    // Default behavior for other elements (none for now)
    console.log('Prompt hover:', isHovering, elementType, elementData, position);
  };

  const handlePromptClick = (elementType, elementData, position) => {
    console.log('=== DEBUG HANDLE PROMPT CLICK ===', {
      elementType,
      elementData,
      position,
      isCurrentRouteModified: isCurrentRouteModified(),
      colorPromptSaved: getRouteColorPromptSaved(),
      colorPromptClosedWithoutSave,
      isPromptMode
    });
    
    // Ignore content card clicks - no prompt bubbles for these
    if (elementType === 'content-card') {
      console.log('🎯 Prompt click ignored - content cards no longer support prompt bubbles');
      return;
    }
    
    // Only allow prompt clicks if the current route has been modified (Add button clicked) OR we're in in-flight preview mode
    if (!isCurrentRouteModified() && !showInFlightPreview) {
      console.log('🎯 Prompt click ignored - route not modified and not in in-flight preview');
      return;
    }
    
    // If color prompt hasn't been saved, only allow flight-journey-bar clicks
    if (!getRouteColorPromptSaved() && elementType !== 'flight-journey-bar' && elementType !== 'flight-journey-bar-animation') {
      console.log('🎯 Prompt click ignored - color prompt not saved, only FJB allowed');
      return;
    }
    
    // Check if there's already an active FJB prompt bubble
    const currentPromptBubble = getCurrentRoutePromptBubble(routePromptBubbles, getCurrentRouteKey);
    if (currentPromptBubble && (currentPromptBubble.elementType === 'flight-journey-bar' || currentPromptBubble.elementType === 'flight-journey-bar-animation')) {
      // If FJB prompt bubble is active, only allow FJB-related clicks
      if (elementType !== 'flight-journey-bar' && elementType !== 'flight-journey-bar-animation') {
        console.log('=== IGNORING CLICK - FJB PROMPT BUBBLE ACTIVE ===', { elementType });
        return;
      }
    }
    
    // Ensure prompt mode is active before opening any prompt bubble
    if (!isPromptMode) {
      setIsPromptMode(true);
    }

    console.log('=== PROMPT CLICK CALLED ===', { 
      elementType, 
      elementData, 
      position, 
      isPromptMode,
      currentPromoCardContents: promoCardContents,
      colorPromptClosedWithoutSave
    });
    
    // Clear the closed without save state when opening a new color prompt
    if (elementType === 'flight-journey-bar' || elementType === 'flight-journey-bar-animation') {
      setColorPromptClosedWithoutSave(false);
    }
    
    
    
    
    // Generate unique key for different element types
    let positionKey;
    if (elementType === 'flight-icon') {
      positionKey = `fps-${Math.round(elementData.progress * 1000)}`; // Use progress as unique identifier
    } else if (elementType === 'flight-phase-button') {
      positionKey = 'flight-phase-button-dashboard'; // Single key for flight phase button
    } else if (elementType === 'flight-journey-bar') {
      positionKey = 'fjb-dashboard'; // Single key for FJB on dashboard
    } else if (elementType === 'flight-journey-bar-animation') {
      positionKey = 'fjb-animation-dashboard'; // Single key for FJB animation on dashboard

    } else {
      positionKey = `${elementType}-${elementData.cardIndex || 0}`;
    }
    
    // Get existing text for this position
    let existingText = '';
    if (elementType === 'content-card' && elementData?.cardIndex !== undefined) {
      // For content cards, get existing content from route-specific content cards
      const routeContentCards = getRouteContentCards();
      const contentCard = routeContentCards[elementData.cardIndex];
      console.log('=== DEBUG ROUTE-SPECIFIC CONTENT CARD RETRIEVAL ===', {
        elementType,
        cardIndex: elementData.cardIndex,
        routeKey: getCurrentRouteKey(),
        routeContentCards,
        contentCard
      });
      // Content cards now show empty text - no default content
      existingText = '';
      console.log('=== CONTENT CARD EXISTING TEXT SET TO EMPTY ===', { existingText });
    } else {
      existingText = fpsPrompts[positionKey] || '';
    }
    
    // Positioning per element type: FPS relative to container, others at viewport point
    if (elementType === 'flight-icon') {
      const container = document.querySelector('.flight-progress-bar-container');
      if (container) {
        const rect = container.getBoundingClientRect();
        const relX = Math.max(0, Math.min(position.x - rect.left + 2, rect.width));
        const relY = Math.max(0, position.y - rect.top + 10);
        setCurrentRoutePromptBubble({
          x: relX,
          y: relY,
          elementType,
          elementData,
          positionKey,
          existingText
        });
      } else {
        setCurrentRoutePromptBubble({
          x: position.x,
          y: position.y,
          elementType,
          elementData,
          positionKey,
          existingText
        });
      }
    } else if (elementType === 'flight-phase-button') {
      // Flight phase button: position at the given point (viewport coordinates)
      setCurrentRoutePromptBubble({
        x: position.x,
        y: position.y,
        elementType,
        elementData,
        positionKey,
        existingText
      });
    } else if (elementType === 'content-card') {
      // For content-card, place below the hover tip (hover tip is typically 50px tall)
      setCurrentRoutePromptBubble({
        x: position.x,
        y: position.y + 60, // Position below hover tip with enough spacing to avoid overlap
        elementType,
        elementData,
        positionKey,
        existingText
      });
    } else {
      // For flight-journey-bar and other elements, position below the hover tip
      // FJB hover tip is now at click position, so add 8px to get 8px spacing
      const offsetY = elementType === 'flight-journey-bar' ? 8 : 0; // 8px below hover tip
      setCurrentRoutePromptBubble({
        x: position.x,
        y: position.y + offsetY,
        elementType,
        elementData,
        positionKey,
        existingText
      });
    }
    setShowPlusIcon(false); // Hide plus icon when bubble appears
    
    // Ensure hover tips remain visible at fixed positions when prompt bubbles open
  };

  // Listen for prompt events from routes view (inline flight cards)
  useEffect(() => {
    const handleEnterPrompt = (e) => {
      try {
        setIsPromptMode(true);
        const segId = e?.detail?.segId || null;
        setActiveSegmentId(segId);
      } catch {}
    };
    const handleTriggerPrompt = (e) => {
      try {
        const { elementType, elementData, position, segId } = e?.detail || {};
        // Ensure prompt mode before triggering
        setIsPromptMode(true);
        if (segId) setActiveSegmentId(segId);
        if (elementType) {
          setTimeout(() => {
            handlePromptClick(elementType, elementData || {}, position || { x: 0, y: 0 });
          }, 30);
        }
      } catch {}
    };
    window.addEventListener('enter-prompt-mode', handleEnterPrompt);
    window.addEventListener('trigger-prompt-bubble', handleTriggerPrompt);
    return () => {
      window.removeEventListener('enter-prompt-mode', handleEnterPrompt);
      window.removeEventListener('trigger-prompt-bubble', handleTriggerPrompt);
    };
  }, []);

  const handleExitPromptMode = () => {
    setIsPromptMode(false);
    setActiveSegmentId(null);
    setCurrentRoutePromptBubble(null);
    setShowPlusIcon(false);
  };

  const handlePromptBubbleClose = () => {
    setCurrentRoutePromptBubble(null);
    setShowPlusIcon(false); // Ensure plus icon is hidden when bubble closes
    // Clear selected hover item when prompt bubble closes
    setSelectedHoverItem(null);
    // Hover tip is now always visible, no need to hide it
  };

  const handlePromptBubbleSubmit = (promptText, elementType, elementData, positionKey, options = {}) => {
    console.log('🚀 === PROMPT BUBBLE SUBMIT START ===');
    console.log('=== PROMPT BUBBLE SUBMIT CALLED ===', {
      promptText, 
      elementType, 
      elementData, 
      positionKey,
      options,
      currentPromoCardContents: promoCardContents
    });
    
    
    
    // Store the submitted text for this position
    if (positionKey) {
      setFpsPrompts(prev => ({
        ...prev,
        [positionKey]: promptText
      }));
    }
    
    // TODO: Handle the actual prompt submission logic here
    // Don't close the bubble for logo placeholder submissions (keep bubble open for editing)
    if (elementType !== 'logo-placeholder') {
      setCurrentRoutePromptBubble(null);
    }
    // Heuristic: if this is logo placeholder, parse prompt to choose or clear an animation
    if (elementType === 'logo-placeholder') {
      const text = (promptText || '').toLowerCase();
      // removal/disable intents
      const removalRegex = /(remove|clear|disable|turn\s*off|stop).*animation|animation.*(off|remove|clear|stop|disable)/;
      if (removalRegex.test(text)) {
        setSelectedLogo(prev => ({ ...(prev || {}), animationType: null }));
        return;
      }

      let type = 'sparkles';
      if (/confetti|celebrat|party|congrats/.test(text)) type = 'confetti';
      else if (/light|festive|bulb|christmas|string/.test(text)) type = 'lights';
      else if (/glow|neon|shine|halo/.test(text)) type = 'glow';
      setSelectedLogo(prev => ({ ...(prev || {}), animationType: type }));
    }
    // Optionally exit prompt mode after submission
    // handleExitPromptMode();
    console.log('🚀 === PROMPT BUBBLE SUBMIT END ===');
  };

  const handleFilterChipSelect = (isSelected) => {
    setIsFilterChipSelected(isSelected);
  };

  // Handle progress bar drag
  const handleProgressChange = (newMinutes) => {
    setDragging(true);
    setMinutesLeft(newMinutes);
  };
  useEffect(() => {
    if (!dragging) return;
    const handleUp = () => setDragging(false);
    window.addEventListener('mouseup', handleUp);
    return () => window.removeEventListener('mouseup', handleUp);
  }, [dragging]);

  // Removed scroll detection and header collapse behavior

  // Manage body overflow - always allow scrolling in flights view
  useEffect(() => {
    console.log('Dashboard overflow effect: always allow scroll');
    // Always allow scrolling
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    document.documentElement.style.overflow = 'auto';
    document.documentElement.style.height = 'auto';
    document.body.style.position = 'static';
    document.body.style.width = 'auto';

    // Cleanup function to restore scrolling when component unmounts
    return () => {
      document.body.style.overflow = 'auto';
      document.body.style.height = 'auto';
      document.documentElement.style.overflow = 'auto';
      document.documentElement.style.height = 'auto';
      document.body.style.position = 'static';
      document.body.style.width = 'auto';
    };
  }, []);

  // Handle sticky positioning for flight content when dark container scrolls up
  useEffect(() => {
    if (!showInFlightPreview) return;

    const handleScroll = () => {
      // Find the ThemeCreator dark container
      const themeCreatorContainer = document.querySelector('[data-component="ThemeCreator"]');
      if (!themeCreatorContainer) return;

      const containerRect = themeCreatorContainer.getBoundingClientRect();
      const containerBottom = containerRect.bottom;
      const containerTop = containerRect.top;

      // Bidirectional sticky behavior:
      // - Stick when container bottom goes above viewport (scrolling down)
      // - Unstick when container top comes back into view (scrolling up)
      let shouldBeSticky;
      
      if (containerTop >= 0) {
        // Dark container is visible at top - unstick flight content
        shouldBeSticky = false;
      } else if (containerBottom <= 100) {
        // Dark container mostly out of view - stick flight content
        shouldBeSticky = true;
        } else {
        // In transition zone - maintain current state
        shouldBeSticky = isFlightContentSticky;
      }
      
      setIsFlightContentSticky(shouldBeSticky);
      
      // Store the dark container height for positioning calculations
      if (containerRect.height !== darkContainerHeight) {
        setDarkContainerHeight(containerRect.height);
      }

      // Debug logging
      console.log('🔍 Scroll Debug:', {
        containerTop,
        containerBottom,
        shouldBeSticky,
        isFlightContentSticky,
        canUserScroll: true // User can always scroll
      });
    };

    // Add scroll listener
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial check
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [showInFlightPreview, darkContainerHeight, isFlightContentSticky]);

  // Keep all elements visible - no auto-scroll to hide themer logo or input fields
  // Removed auto-scroll to maintain visibility of input fields and generate flights button

  // NEW: Handle flight phase selection from FlightProgress
  const handleFlightPhaseSelect = (phase) => {
    console.log('🚀 === FLIGHT PHASE SELECT START ===');
    console.log('🎯 Flight phase selected:', { phase, currentPhase: selectedFlightPhase });
    setSelectedFlightPhase(phase);
    
    // Store the current content for the previous phase before switching
    const routeKey = getCurrentRouteKey();
                if (routeKey && isCurrentRouteModified()) {
      setPromoCardContents(prev => {
        const newState = { ...prev };
        const currentPhase = selectedFlightPhase;
        
        // If we have a current phase and current content, store it
        if (currentPhase && newState[routeKey]) {
          newState[`${routeKey}-${currentPhase}`] = newState[routeKey];
        }
        
        // If we're switching to a phase that has stored content, restore it
        if (newState[`${routeKey}-${phase}`]) {
          newState[routeKey] = newState[`${routeKey}-${phase}`];
        } else {
                  // If no stored content for this phase, set phase-specific default content
        const phaseSpecificContent = getPhaseSpecificDefaultContent(phase);
        console.log('🚨 RESETTING PROMO CARDS TO PHASE-SPECIFIC DEFAULTS:', { phase, phaseSpecificContent });
        newState[routeKey] = phaseSpecificContent;
        }
        
        return newState;
      });
    } else if (routeKey) {
      console.log('🎯 Skipping phase-specific content update - route not modified yet');
    }
    console.log('🚀 === FLIGHT PHASE SELECT END ===');
  };

  // Helper function to get phase-specific default content
  const getPhaseSpecificDefaultContent = (phase) => {
    const phaseContent = {
      'takeoff': {
        0: { text: '', image: '', updated: false },
        1: { text: '', image: '', updated: false },
        2: { text: '', image: '', updated: false }
      },
      'climb': {
        0: { text: '', image: '', updated: false },
        1: { text: '', image: '', updated: false },
        2: { text: '', image: '', updated: false }
      },
      'cruise': {
        0: { text: '', image: '', updated: false },
        1: { text: '', image: '', updated: false },
        2: { text: '', image: '', updated: false }
      },
      'descent': {
        0: { text: '', image: '', updated: false },
        1: { text: '', image: '', updated: false },
        2: { text: '', image: '', updated: false }
      },
      'landing': {
        0: { text: '', image: '', updated: false },
        1: { text: '', image: '', updated: false },
        2: { text: '', image: '', updated: false }
      }
    };
    
    return phaseContent[phase] || phaseContent['takeoff'];
  };



  console.log('🎯 Dashboard RENDER: showInFlightPreview =', showInFlightPreview, 'showIFEFrame =', showIFEFrame, 'isPromptMode =', isPromptMode);
  

  return (
    <div 
      ref={dashboardRef}
      className="min-h-screen"
      style={{
        height: 'auto',
        overflow: 'visible',
        overflowY: 'visible',
        position: 'relative',
        minHeight: '100vh',
        borderBottomLeftRadius: '24px',
        borderBottomRightRadius: '24px'
      }}
      data-name="dashboard-container"
    >
            {/* Dashboard Header */}
      {/* Header removed as requested */}
      {/* ThemeCreator positioned below header (always visible) */}
      <div 
        className="w-full flex justify-center"
        style={{ 
          marginTop: 0,
          marginBottom: 80
        }}
      >
        <ThemeCreator
          routes={routes}
          setRoutes={setRoutes}
          initialMinimized={minimizeThemeCreator}
          initialWidth={minimizeThemeCreator ? 318 : undefined}
          initialFlightCreationMode={false}
          onColorCardSelect={segment => setSelectedSegment(segment)}
          onThemeColorChange={color => {
            // Store theme for the current flight route
            const flightKey = getFlightKey(origin, destination);
            if (flightKey) {
              setFlightThemes(prev => ({
                ...prev,
                [flightKey]: color
              }));
              console.log('🎯 ThemeCreator: Stored theme for flight route:', { flightKey, color });
              
              // Mark the route as modified when theme is saved from ThemeCreator
              markCurrentRouteAsModified();
            }
            // When theme color changes from ThemeCreator, clear any logo animation
            // as this is not from a theme chip selection
            setSelectedLogo(prev => ({ 
              ...(prev || {}), 
              animationType: null 
            }));
          }}
          onStateChange={() => {}}
          onEnterPromptMode={(segmentId) => {
            setIsPromptMode(true);
            setActiveSegmentId(segmentId);
          }}
          onFilterChipSelect={handleFilterChipSelect}
          isPromptMode={isPromptMode}
          activeSegmentId={activeSegmentId}
          onExposeThemeChips={(chips) => setFjbThemeChips(chips || [])}
          onStartThemeBuild={() => setIsThemeBuildStarted(true)}
          themeColor={activeThemeColor}
          onTriggerPromptBubble={handlePromptClick}
          selectedLogo={selectedLogo}
          isInHeader={false}
          onThemeAnimationComplete={handleThemeAnimationComplete}
          onGeneratingStateChange={(isGenerating) => {
            setIsGeneratingFlights(isGenerating);
          }}
          flightsGenerated={flightsGenerated}
                      onBuildThemes={() => {
              setIsThemeBuildStarted(true);
              // DIRECT TRIGGER: Show preview when build themes is clicked
              console.log('🎯 Dashboard: onBuildThemes called, triggering preview with delay');
              setTimeout(() => {
                console.log('🎯 Dashboard: Timer executed, setting preview states');
                setShowInFlightPreview(true);
                setShowIFEFrame(true);
                setIsPromptMode(true);
              }, 250); // Match ThemeCreator delay
            }}
            onFlightSelect={(segment) => {
              setSelectedFlightSegment(segment);
            }}
          flightCardProgress={flightRouteProgress}
          showIFEFrame={showIFEFrame}
          onAirlineSelect={(logoInfo, themeColor) => {
            console.log('🎯 Dashboard: Airline selected:', logoInfo, themeColor);
            setSelectedLogo(logoInfo); // logoInfo can be null for "All Airlines" reset
            
            // Store theme for the current flight route
            const flightKey = getFlightKey(origin, destination);
            if (flightKey && themeColor) {
              setFlightThemes(prev => ({
                ...prev,
                [flightKey]: themeColor
              }));
              console.log('🎯 Dashboard: Stored airline theme for flight route:', { flightKey, themeColor });
              
              // Mark the route as modified when airline theme is saved
              markCurrentRouteAsModified();
            }
          }}
          onModifyClicked={() => {
            // Mark the current route as modified when Add button is clicked
            console.log('🎯 Add button clicked - marking route as modified');
            markCurrentRouteAsModified();
            
            // Set "Add theme" as selected in the hover tip
            setSelectedHoverItem('add-theme');
          }}
          onDatesChange={(dates) => {
            setSelectedDates(dates);
            console.log('🎯 Dashboard: Dates updated from ThemeCreator:', dates);
          }}
          onShowPreview={(show) => {
            console.log('🎯 Dashboard: onShowPreview called with:', show);
            setShowInFlightPreview(show);
            setShowIFEFrame(show);
            setIsPromptMode(show);
            setIsScrollingUp(show);
            
            if (show) {
              // Scroll the page to bring the content to the top after animation
              setTimeout(() => {
                console.log('🎯 Attempting to scroll to top');
                
                // Try multiple approaches to scroll to top
                const flightCardContainer = document.getElementById('flight-card-container');
                console.log('🎯 Flight card container found:', !!flightCardContainer);
                
                if (flightCardContainer) {
                  const rect = flightCardContainer.getBoundingClientRect();
                  console.log('🎯 Container position:', rect.top, rect.left);
                  
                  // Calculate scroll position to bring container to top
                  const scrollTop = window.pageYOffset + rect.top - 20; // 20px from top
                  console.log('🎯 Scrolling to position:', scrollTop);
                  
                  // Force scroll to top
                  window.scrollTo({
                    top: scrollTop,
                    behavior: 'smooth'
                  });
                }
              }, 800); // Wait for animations to complete
            }
            
            console.log('🎯 Dashboard: States IMMEDIATELY after set - showInFlightPreview:', show, 'showIFEFrame:', show, 'isPromptMode:', show, 'isScrollingUp:', show);
            
            // Force a re-render check
            setTimeout(() => {
              console.log('🎯 Dashboard: States AFTER timeout - showInFlightPreview should be:', show);
            }, 100);
          }}
          onBuildThemeClicked={() => {
            console.log('🎯 Dashboard: Build theme clicked, triggering preview directly');
            setTimeout(() => {
              setShowInFlightPreview(true);
              setShowIFEFrame(true);
              setIsPromptMode(true);
              
              // Select "Add theme" in hover tip
              setSelectedHoverItem('add-theme');
              
              // Notify components that layout has changed
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('layoutChanged', { detail: { type: 'ifePreviewShown' } }));
                
                // Wait for hover tip to be mounted, then compute anchor at the moment of opening
                setTimeout(() => openFjbPromptBelowHoverTip('flight-journey-bar'), 80);
              }, 240);
            }, 250);
          }}
          isRouteModified={isCurrentRouteModified()}
        />
      </div>
      {/* Route Map */}
      {!showInFlightPreview && (
        <RouteMap 
          routes={routes} 
          themeColor={activeThemeColor}
        />
      )}
      
      {/* In-flight preview label */}
      {showInFlightPreview && (
        <div 
          className="w-full flex justify-center"
          style={{
            marginTop: 20,
            opacity: showInFlightPreview ? 1 : 0,
            transform: showInFlightPreview ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.4s ease-out, transform 0.4s ease-out'
          }}
        >

        </div>
      )}

      {/* Flight card and chevrons in place of Select Theme text */}
      {showInFlightPreview && (
        <div 
          id="flight-card-container"
          className="w-full flex justify-center"
          style={{
            marginTop: isFlightContentSticky ? 0 : 20,
            opacity: showInFlightPreview ? 1 : 0,
            transform: showInFlightPreview ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.4s ease-out, transform 0.4s ease-out, position 0.3s ease-out, top 0.3s ease-out',
            position: isFlightContentSticky ? 'fixed' : 'relative',
            top: isFlightContentSticky ? '20px' : 'auto',
            left: isFlightContentSticky ? '0' : 'auto',
            right: isFlightContentSticky ? '0' : 'auto',
            zIndex: isFlightContentSticky ? 1000 : 'auto',
            minHeight: '120px'
          }}
        >
          {/* Flight card will be positioned here via AirportSearch */}
        </div>
      )}

      {/* IFE frame - Shows when preview mode is active */}
      {showInFlightPreview && (
        <div 
          className="w-full flex justify-center" 
          style={{ 
            marginTop: isFlightContentSticky ? 0 : 8, 
            height: '880px',
            opacity: showInFlightPreview ? 1 : 0,
            transform: showInFlightPreview ? 'translateY(0)' : 'translateY(40px)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out, position 0.3s ease-out, top 0.3s ease-out',
            position: isFlightContentSticky ? 'fixed' : 'relative',
            top: isFlightContentSticky ? '140px' : 'auto',
            left: isFlightContentSticky ? '0' : 'auto',
            right: isFlightContentSticky ? '0' : 'auto',
            zIndex: isFlightContentSticky ? 999 : 'auto'
          }}
        >
          <div 
            style={{ position: 'relative', width: 1400, height: 1100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', transform: 'scale(0.8)', transformOrigin: 'top center' }}
                          onMouseEnter={(e) => {
                // Check if there's already an active FJB prompt bubble - if so, ignore all IFE frame hovers
                const currentPromptBubble = getCurrentRoutePromptBubble(routePromptBubbles, getCurrentRouteKey);
                if (currentPromptBubble && (currentPromptBubble.elementType === 'flight-journey-bar' || currentPromptBubble.elementType === 'flight-journey-bar-animation')) {
                  return;
                }
                
                // Check if hover is on promo or content card to avoid triggering hover effects
                const target = e.target;
                const isPromoOrContentCard = (
                  target.closest('[data-content-card]') ||
                  target.closest('.content-card')
                );
                
                if (!isPromoOrContentCard) {
                  setIfeFrameHover({ isHovering: true, x: e.clientX, y: e.clientY });
                }
              }}
              onMouseMove={(e) => {
                // Check if there's already an active FJB prompt bubble - if so, ignore all IFE frame hovers
                const currentPromptBubble = getCurrentRoutePromptBubble(routePromptBubbles, getCurrentRouteKey);
                if (currentPromptBubble && (currentPromptBubble.elementType === 'flight-journey-bar' || currentPromptBubble.elementType === 'flight-journey-bar-animation')) {
                  return;
                }
                
                // Check if hover is on promo or content card to avoid triggering hover effects
                const target = e.target;
                const isPromoOrContentCard = (
                  target.closest('[data-content-card]') ||
                  target.closest('.content-card')
                );
                
                if (!isPromoOrContentCard) {
                  setIfeFrameHover({ isHovering: true, x: e.clientX, y: e.clientY });
                }
              }}
            onMouseLeave={() => {
              setIfeFrameHover({ isHovering: false, x: 0, y: 0 });
            }}
            onClick={(e) => {
              // Only allow IFE frame clicks if the current route has been modified (Add button clicked)
              if (!isCurrentRouteModified()) {
                console.log('🎯 IFE frame click ignored - route not modified (Add button not clicked)');
                return;
              }
              
              // Check if there's already an active FJB prompt bubble - if so, ignore all IFE frame clicks
              const currentPromptBubble = getCurrentRoutePromptBubble(routePromptBubbles, getCurrentRouteKey);
              if (currentPromptBubble && (currentPromptBubble.elementType === 'flight-journey-bar' || currentPromptBubble.elementType === 'flight-journey-bar-animation')) {
                console.log('🎯 IFE frame click ignored - FJB prompt bubble is active');
                return;
              }
              
              // Check if click is on promo or content card to avoid triggering color prompt
              const target = e.target;
              const isPromoOrContentCard = (
                target.closest('[data-promo-card]') || 
                target.closest('[data-content-card]') ||
                target.closest('.promo-card') ||
                target.closest('.content-card')
              );
              
              if (isPromoOrContentCard) {
                console.log('🎯 IFE frame click ignored - click on promo/content card');
                return;
              }
              
              // Global click delegation for "Change Theme" buttons in IFE frame
              const isChangeThemeButton = (
                target.textContent?.includes('Change theme') || 
                target.textContent?.includes('Change Theme') ||
                target.title?.includes('Change Theme') ||
                target.title?.includes('Change theme')
              );
              
              // Removed: IFE Change Theme triggers color prompt
            }}
          >
            {/* IFE Frame SVG */}
            <img
              src={process.env.PUBLIC_URL + '/ife-frame.svg'}
              alt="Mobile Frame"
              style={{ position: 'absolute', top: -40, left: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none', willChange: 'transform', transform: 'translateZ(0)' }}
            />
            
            {/* Frame Content */}
            <FrameContent
              origin={origin}
              destination={destination}
              minutesLeft={minutesLeft}
              landingIn={landingIn}
              maxFlightMinutes={maxFlightMinutes}
              handleProgressChange={handleProgressChange}
              themeColor={activeThemeColor}
              routes={routes}
              isPromptMode={isPromptMode}
              onPromptHover={handlePromptHover}
              onPromptClick={handlePromptClick}
              fpsPrompts={fpsPrompts}
              isThemeBuildStarted={isThemeBuildStarted}
              selectedLogo={selectedLogo}
              flightsGenerated={flightsGenerated}
              onAnimationProgress={(progress) => {
                if (progress >= 0.2 && !themeAnimationComplete) {
                  handleThemeAnimationComplete();
                }
              }}
              onFlightPhaseSelect={handleFlightPhaseSelect}
              selectedFlightPhase={selectedFlightPhase}
              promoCardContents={getRoutePromoCardContents()}
              recommendedContentCards={getRouteContentCards()}
              onContentCardHover={(isHovering, x, y) => {
                console.log('=== CONTENT CARD HOVER ===', { isHovering, x, y });
                setContentCardHover({ isHovering, x, y });
              }}
              colorPromptClosedWithoutSave={colorPromptClosedWithoutSave}
              getRouteColorPromptSaved={getRouteColorPromptSaved}
              getCurrentRouteKey={getCurrentRouteKey}
              isModifyClicked={isCurrentRouteModified()}
              isCurrentRouteModified={isCurrentRouteModified}
              selectedDates={selectedDates}
              isCurrentThemeFestive={isCurrentThemeFestive}
              getRouteSelectedThemeChip={getRouteSelectedThemeChip}
              routePromptBubbles={routePromptBubbles}
              selectedProfile={selectedProfile}
            />
          </div>
        </div>
      )}
      

      


      
      {/* Plus Icon Cursor for Prompt Mode */}
      <PlusIconCursor 
        isVisible={isPromptMode && showPlusIcon} 
        themeColor={activeThemeColor} 
      />

      {/* Analytics Bubble */}
      <AnalyticsBubble
        isVisible={analyticsBubble.visible}
        position={{ x: analyticsBubble.x, y: analyticsBubble.y }}
        elementData={analyticsBubble.elementData}
        onClose={handleCloseAnalytics}
        themeColor={activeThemeColor} 
      />

      {/* Mouse Pointer Cursor */}
      <MousePointer 
        isVisible={showMousePointer}
        themeColor={activeThemeColor}
        size="normal"
        showShadow={true}
        animated={true}
      />

      {/* Prompt Bubble */}
      <PromptBubble
        key={`${getCurrentRoutePromptBubble(routePromptBubbles, getCurrentRouteKey)?.elementType}-${getCurrentRoutePromptBubble(routePromptBubbles, getCurrentRouteKey)?.positionKey}-${getCurrentRoutePromptBubble(routePromptBubbles, getCurrentRouteKey)?.existingText?.length || 0}`}
        isVisible={!!getCurrentRoutePromptBubble(routePromptBubbles, getCurrentRouteKey)}
        position={getCurrentRoutePromptBubble(routePromptBubbles, getCurrentRouteKey) || { x: 0, y: 0 }}
        elementType={getCurrentRoutePromptBubble(routePromptBubbles, getCurrentRouteKey)?.elementType}
        elementData={getCurrentRoutePromptBubble(routePromptBubbles, getCurrentRouteKey)?.elementData}
        onClose={handlePromptBubbleClose}
        onSubmit={handlePromptBubbleSubmit}
        onCloseWithoutSave={() => {
          console.log('=== COLOR PROMPT CLOSED WITHOUT SAVE ===');
          setColorPromptClosedWithoutSave(true);
          // Clear selected hover item when prompt bubble closes without save
          setSelectedHoverItem(null);
          // Hover tip is now always visible, no need to hide it
        }}
        themeColor={activeThemeColor}
        isThemeBuildStarted={isThemeBuildStarted}
        existingText={(() => {
          const bubble = getCurrentRoutePromptBubble(routePromptBubbles, getCurrentRouteKey);
          const existingText = bubble?.existingText || '';
          console.log('=== RENDERING PROMPT BUBBLE WITH EXISTING TEXT ===', {
            bubble,
            existingText,
            existingTextLength: existingText.length,
            elementType: bubble?.elementType
          });
          return existingText;
        })()}
        positionKey={getCurrentRoutePromptBubble(routePromptBubbles, getCurrentRouteKey)?.positionKey}
        fpsPrompts={fpsPrompts}
        onThemeColorChange={(color, chipData) => {
          if (typeof color === 'string' && color.length > 0) {
            console.log('🚀 === THEME COLOR CHANGE START ===');
            console.log('🎯 onThemeColorChange called with:', { color, chipData, isThemeBuildStarted });
            
            // Store theme for the current flight route
            const flightKey = getFlightKey(origin, destination);
            if (flightKey) {
              setFlightThemes(prev => ({
                ...prev,
                [flightKey]: color
              }));
              console.log('🎯 Stored theme for flight route:', { flightKey, color, allThemes: { ...flightThemes, [flightKey]: color } });
              
              // Store progress for the current flight route (100% when theme is saved)
              setFlightRouteProgress(prev => ({
                ...prev,
                [flightKey]: 100
              }));
              console.log('🎯 Stored progress for flight route:', { flightKey, progress: 100, allProgress: { ...flightRouteProgress, [flightKey]: 100 } });
            }
            
            // Store the selected theme chip data for validation
            if (chipData) {
              setRouteSelectedThemeChip(chipData);
              console.log('🎯 Stored theme chip for route:', { routeKey: getCurrentRouteKey(), chipData });
            }
            
            // Clear the closed without save state since the user saved
            setColorPromptClosedWithoutSave(false);
            setRouteColorPromptSavedValue(true);
            
            // Hover tip remains visible at fixed position
            
            // Update selected theme chip and apply logo animation
            if (chipData && chipData.label) {
              setSelectedThemeChip(chipData);
              const animationType = mapThemeChipToAnimation(chipData.label, chipData.color);
              setSelectedLogo(prev => ({ 
                ...(prev || {}), 
                animationType: animationType 
              }));
            }
            
            // Auto-select takeoff flight phase
            console.log('🚨 ABOUT TO CALL setSelectedFlightPhase("takeoff") - THIS MIGHT TRIGGER CARD RESET');
            setSelectedFlightPhase('takeoff');
            console.log('🎯 Auto-selected takeoff flight phase');
            
            // Mark the route as modified when theme is saved
            markCurrentRouteAsModified();
            
            // Update route-specific promo card contents (preserve existing custom content)
            const routeKey = getCurrentRouteKey();
            if (routeKey) {
              setPromoCardContents(prev => {
                const existingContent = prev[routeKey] || {};
                const defaultContent = {
                  0: { text: '', image: '', updated: false, backgroundImage: null },
                  1: { text: '', image: '', updated: false, backgroundImage: null },
                  2: { text: '', image: '', updated: false, backgroundImage: null }
                };
                
                // Preserve existing custom content, only use defaults for cards that haven't been customized
                const preservedContent = {};
                for (let i = 0; i < 3; i++) {
                  if (existingContent[i] && existingContent[i].updated) {
                    // Keep existing custom content
                    preservedContent[i] = existingContent[i];
                  } else {
                    // Use default content for uncustomized cards
                    preservedContent[i] = defaultContent[i];
                  }
                }
                
                const newState = {
                  ...prev,
                  [routeKey]: preservedContent
                };
                console.log('🎯 Updated route-specific promo card contents (preserving custom content):', {
                  routeKey,
                  existingContent,
                  preservedContent,
                  allRoutes: Object.keys(newState)
                });
                return newState;
              });
              
            }
            
            // Content cards now always show "Add content" - no theme-based title updates
            
            
            console.log('🎯 Completed theme save with preserved card content');
            console.log('🚀 === THEME COLOR CHANGE END ===');
            
            // Close the prompt bubble after saving the color
            setCurrentRoutePromptBubble(null);
          }
        }}
        themeChips={getCurrentRoutePromptBubble(routePromptBubbles, getCurrentRouteKey)?.elementType === 'flight-journey-bar' ? fjbThemeChips : []}
        selectedLogo={selectedLogo}
        onLogoSelect={(info) => {
          setSelectedLogo(info);
          // Auto-set theme color based on selected logo
          if (info && info.id) {
            const logoColorMap = {
              'discover': '#1E72AE',
              'lufthansa': '#0A1D3D', 
              'swiss': '#CB0300'
            };
            const newColor = logoColorMap[info.id];
            if (newColor) {
              // Store theme for the current flight route
              const flightKey = getFlightKey(origin, destination);
              if (flightKey) {
                setFlightThemes(prev => ({
                  ...prev,
                  [flightKey]: newColor
                }));
                console.log('🎯 Dashboard: Stored logo theme for flight route:', { flightKey, newColor });
                
                // Mark the route as modified when logo theme is saved
                markCurrentRouteAsModified();
              }
            }
          }
        }}
        flightsGenerated={flightsGenerated}
        selectedFlightPhase={selectedFlightPhase}
        onFlightPhaseSelect={handleFlightPhaseSelect}
        selectedFlightSegment={selectedFlightSegment}
        selectedDates={selectedDates}
        modifiedChipColors={getRouteModifiedChipColors()}
        setModifiedChipColors={setRouteModifiedChipColor}
      />

      {/* Change Theme Button - Shows when hovering IFE frame after color prompt was closed without save */}
      {/* REMOVED: Dummy change theme button that was showing as overlay */}

      {/* FJB hover tip bubble: shows label and plus; click opens color PB */}
      {isPromptMode && showInFlightPreview && (
        <div
          key={`fjb-hover-${activeThemeColor}`}
          className="fixed"
          data-hover-tip="true"
          style={{ 
            left: '50%', 
            top: isFlightContentSticky ? '136px' : 'calc(50% - 324px)', 
            transform: 'translateX(-50%)', 
            pointerEvents: 'auto', 
            zIndex: 999999999 
          }}
        >
          <div
            ref={hoverTipRef}
            data-fjb-hover-tip="true"
            className="flex items-center gap-2 px-3 py-2 rounded-2xl border shadow-md"
            style={{
              backgroundColor: '#1f2937', // Dark container color
              borderColor: 'rgba(255, 255, 255, 0.2)',
              opacity: 1,
              borderTopLeftRadius: 0
            }}
          >
            <span 
              className="text-xs font-bold cursor-pointer hover:bg-white/10 px-2 py-1 rounded flex items-center gap-1"
              data-profiles-button="true"
              style={{ 
                color: '#FFFFFF', 
                pointerEvents: 'auto',
                backgroundColor: selectedHoverItem === 'profiles' ? 'rgba(255, 255, 255, 0.2)' : 'transparent'
              }}
              onClick={(e) => {
                e.stopPropagation();
                
                // Close any existing prompt bubbles first
                setRoutePromptBubbles({});
                
                const willOpen = !profilesDropdown.visible;
                setProfilesDropdown({
                  visible: willOpen,
                  x: 0,
                  y: 0
                });
                
                // Update selected hover item to ensure only one nav item is highlighted
                setSelectedHoverItem(willOpen ? 'profiles' : null);
              }}
            >
              {selectedProfile || 'Profiles'}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </span>
            <div className="w-px h-4 bg-white/30"></div>
            <span 
              className="text-xs font-bold cursor-pointer hover:bg-white/10 px-2 py-1 rounded"
              style={{ 
                color: '#FFFFFF', 
                pointerEvents: 'auto',
                backgroundColor: selectedHoverItem === 'add-theme' ? 'rgba(255, 255, 255, 0.2)' : 'transparent'
              }}
              onClick={(e) => {
                e.stopPropagation();
                console.log('=== ADD THEME CLICKED ===');
                
                // Close profiles dropdown if it's open
                setProfilesDropdown({ visible: false, x: 0, y: 0 });
                
                // Select this item and show prompt bubble using fresh anchor
                setSelectedHoverItem('add-theme');
                openFjbPromptBelowHoverTip('flight-journey-bar');
              }}
            >
              Add theme
            </span>
            <div className="w-px h-4 bg-white/30"></div>
            <span 
              className="text-xs font-bold cursor-pointer hover:bg-white/10 px-2 py-1 rounded"
              style={{ 
                color: '#FFFFFF', 
                pointerEvents: 'auto',
                backgroundColor: selectedHoverItem === 'animation' ? 'rgba(255, 255, 255, 0.2)' : 'transparent'
              }}
              onClick={(e) => {
                e.stopPropagation();
                console.log('=== ANIMATION CLICKED ===');
                
                // Close profiles dropdown if it's open
                setProfilesDropdown({ visible: false, x: 0, y: 0 });
                
                // Select this item and show prompt bubble using fresh anchor
                setSelectedHoverItem('animation');
                openFjbPromptBelowHoverTip('flight-journey-bar-animation');
              }}
            >
              Animation
            </span>
          </div>
        </div>
      )}

      {/* Profiles dropdown */}
        {profilesDropdown.visible && (
          <div
            className="fixed"
            data-dropdown="true"
            style={{
              left: hoverAnchor.x, // Align left edge with hover tip
              top: hoverAnchor.y + 8, // Position just below hover tip
              pointerEvents: 'auto',
              zIndex: 999999999
            }}
          >
          <div
            className="bg-[#1f2937] border border-white/20 rounded-lg shadow-lg py-1 min-w-[120px]"
            style={{
              backgroundColor: '#1f2937',
              borderColor: 'rgba(255, 255, 255, 0.2)'
            }}
          >
            {['Business', 'Economy', 'Under 18', 'Holiday'].map((item, index) => {
              const isSelected = selectedProfile === item;
              return (
                <div
                  key={item}
                  className={`px-3 py-2 text-xs font-medium cursor-pointer transition-colors ${
                    isSelected 
                      ? 'bg-blue-600 text-white' 
                      : 'text-white hover:bg-white/10'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log(`=== PROFILE SELECTED: ${item} ===`);
                    
                    // Store the selected profile for the current route
                    // This persists the profile selection per route without leaking to other routes
                    setCurrentRouteProfile(item);
                    
                    // Close the dropdown after selection
                    setProfilesDropdown({ visible: false, x: 0, y: 0 });
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span>{item}</span>
                    {isSelected && (
                      <svg className="w-3 h-3 ml-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      




      {/* IFE frame logic - DISABLED to keep flight cards in original position */}
      {false && (
        <>
          {/* In-flight GUI text - HIDDEN */}
          {false && (
          <div 
            className="w-full flex justify-center" 
            style={{ 
              marginTop: isThemeBuildStarted ? 12 : 24, 
              marginBottom: 32,
              opacity: showInFlightGUI ? 1 : 0,
              transform: showInFlightGUI ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 1.2s ease-in-out, transform 1.2s ease-in-out'
            }}
          >
            <div style={{ width: '1302px' }}>
              <p className="block font-bold text-black text-center" style={{ fontSize: '28px', lineHeight: '36px', margin: 0 }}>In-flight GUI</p>
            </div>
          </div>
          )}

          {/* Selected Flight Card below In-flight GUI text - HIDDEN */}
          {false && (selectedFlightSegment || (origin && destination)) && (
          <div 
            className="w-full flex justify-center" 
            style={{ 
                marginBottom: 24,
                opacity: showInFlightGUI ? 1 : 0,
                transform: showInFlightGUI ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 1.2s ease-in-out, transform 1.2s ease-in-out'
            }}
          >
              <div className="flex items-center gap-4" style={{ width: '434px' }}>
                <div 
                  className="backdrop-blur-[10px] backdrop-filter pl-5 pr-3 py-4 rounded-full shadow-sm flex-1"
                  style={{
                    ...(typeof activeThemeColor === 'string' && activeThemeColor.includes('gradient')
                      ? { background: activeThemeColor }
                      : { backgroundColor: activeThemeColor })
                  }}
                >
                  <div className="flex justify-between items-stretch opacity-100">
                    <div className="flex items-start gap-1 flex-none pr-0" style={{ paddingRight: 6 }}>
                      <div className="flex-none">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-white break-words">
                            {selectedFlightSegment 
                              ? `${selectedFlightSegment.origin?.airport?.code} → ${selectedFlightSegment.destination?.airport?.code}`
                              : `${origin?.airport?.code} → ${destination?.airport?.code}`
                            }
                          </h3>
                        </div>
                        <div className="text-xs text-white mt-1 flex items-center gap-3 flex-wrap break-words">
                          <span className="flex items-center gap-1 font-semibold">Selected Flight</span>
                        </div>
                      </div>
                    </div>
                    <div className="hidden md:flex w-px mx-0" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
                    <div className="hidden md:flex items-center gap-1" style={{ marginLeft: 5 }}>
                      <button 
                        type="button" 
                        className="inline-flex items-center rounded-[24px] bg-white/10 text-white hover:bg-white/15 h-9 w-9 justify-center px-0 shrink-0" 
                        title="Add Airline Logo"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isPromptMode && typeof handlePromptClick === 'function') {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const position = { x: rect.left, y: rect.top };
                            handlePromptClick('logo-placeholder', {}, position);
                          }
                        }}
                      >
                        <PhotoIcon className="w-4 h-4" />
                      </button>
                      {/* Removed: FJB Change Theme button that opened color prompt */}
                      <button 
                        type="button" 
                        className="inline-flex items-center rounded-[24px] bg-white/10 text-white hover:bg-white/15 h-9 w-9 justify-center px-0 shrink-0" 
                        title="Add Flight Content"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isPromptMode && typeof handlePromptClick === 'function') {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const position = { x: rect.left, y: rect.top };
                            handlePromptClick('flight-phase-button', { progress: 0.5, minutesLeft: 200 }, position);
                          }
                        }}
                      >
                        <img src={process.env.PUBLIC_URL + '/flight icon.svg'} alt="Flight icon" className="w-4 h-4" />
                      </button>
            </div>
          </div>
                </div>
                <ChevronRightIcon className="w-6 h-6 text-black opacity-60 flex-shrink-0" />
              </div>
            </div>
          )}

          {/* Preview elements will be added here later */}

        </>
      )}




    </div>
  );
} 
