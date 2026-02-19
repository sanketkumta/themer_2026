import { getReadableOnColor, getLightCardBackgroundColor } from '../utils/color';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getPromoCardContent, shouldUseFestivalContent } from '../utils/festivalUtils';
import { getNonFestiveCardContent, getBusinessProfileCardContent } from '../data/festivalContent';
import { getPollinationsImage } from '../utils/unsplash';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useImageState } from '../hooks/useIsolatedState';
import { generateContextKey, useContextValidator, clearAllState, logStateChange } from '../utils/contextValidation';
import { useStateLeakageDetection } from '../utils/stateLeakageDetector';


export default function Component3Cards({ 
  themeColor = '#1E1E1E', 
  routes = [], 
  showMovingIcon = false,
  isPromptMode = false, 
  onPromptHover, 
  onPromptClick, 
  promptStates = {}, 
  animationProgress = 0, 
  cruiseLabelShown = false, 
  middleCardPromptClosed = false, 
  isThemeBuildStarted = true,
  colorPromptSaved = false,
  origin,
  destination,
  selectedFlightPhase,
  promoCardContents,
  colorPromptClosedWithoutSave,
  currentRouteKey,
  isModifyClicked,
  selectedDates,
  isCurrentThemeFestive,
  getRouteSelectedThemeChip,
  selectedProfile,
  hasReachedTakeoff = undefined, // undefined = Dashboard mode, false/true = Landing Page mode
  visibleCardIndices = undefined, // undefined = Dashboard mode, Set = Landing Page mode
  isCardAnimationInProgress = undefined // undefined = Dashboard mode, false/true = Landing Page mode
}) {
  // Generate unique context key for state isolation
  // Include a themeVariantKey so that per-route theme tweaks (like chip selection or modified colors)
  // never leak across routes or phases
  const themeVariantKey = (() => {
    try {
      // Prefer selected theme chip label if available via prop function
      if (typeof getRouteSelectedThemeChip === 'function') {
        const chip = getRouteSelectedThemeChip();
        if (chip && (chip.label || chip.id)) {
          const label = (chip.label || chip.id || '').toString().toLowerCase();
          const color = (chip.color || '').toString().toLowerCase();
          return `chip:${label}|color:${color}`;
        }
      }
    } catch {}
    return 'no-variant';
  })();

  const contextKey = generateContextKey(
    currentRouteKey,
    selectedFlightPhase,
    themeColor,
    selectedDates,
    themeVariantKey
  );
  
  // Use isolated state management to prevent leakage
  const {
    remixedImages,
    editableDescriptions,
    editableTitles,
    imageLoadingStates,
    savedDescriptions,
    remixLoading,
    setRemixedImage,
    setImageLoading,
    setEditableDescription,
    setEditableTitle,
    setRemixLoading,
    clearState,
    // Legacy function names for backward compatibility
    setEditableTitles,
    setEditableDescriptions
  } = useImageState(contextKey);
  
  // Context validator to ensure proper isolation
  const { validateContext } = useContextValidator(contextKey, 'Component3Cards');
  
  // State leakage detection
  const { hasLeakage, warnings } = useStateLeakageDetection('Component3Cards', contextKey, {
    remixedImages,
    editableDescriptions,
    editableTitles,
    imageLoadingStates,
    savedDescriptions,
    remixLoading
  });
  
  // Track if tooltip is locked so we can hide built-in remix panel
  const [tooltipLocked, setTooltipLocked] = useState(false);
  
  // Log leakage warnings
  useEffect(() => {
    if (hasLeakage) {
      console.error('🚨 STATE LEAKAGE DETECTED IN COMPONENT3CARDS', {
        contextKey,
        warnings,
        state: { remixedImages, editableDescriptions, editableTitles, imageLoadingStates, savedDescriptions, remixLoading }
      });
    }
  }, [hasLeakage, warnings, contextKey, remixedImages, editableDescriptions, editableTitles, imageLoadingStates, savedDescriptions, remixLoading]);
  
  // Cleanup function to remove any lingering DOM elements
  useEffect(() => {
    return () => {
      const existingPanel = document.getElementById('locked-remix-panel');
      if (existingPanel) {
        // Clean up scroll listener
        if (existingPanel._scrollHandler) {
          window.removeEventListener('scroll', existingPanel._scrollHandler, true);
          window.removeEventListener('resize', existingPanel._scrollHandler);
          delete existingPanel._scrollHandler;
        }
        if (existingPanel.parentNode) existingPanel.parentNode.removeChild(existingPanel);
      }
      const performancePanel = document.getElementById('performance-empty-panel');
      if (performancePanel && performancePanel.parentNode) performancePanel.parentNode.removeChild(performancePanel);
      const tooltip = document.getElementById('custom-tooltip');
      if (tooltip && tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
      window.__tooltipLocked = false;
    };
  }, []);
  
  // Grid-based layout removes the need for JS measurement

  // Utility: place caret at the end of a contentEditable element
  const placeCaretAtEnd = (el) => {
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      if (!sel) return;
      sel.removeAllRanges();
      sel.addRange(range);
    } catch {}
  };

  // Compute linear caret offset within a contentEditable element
  const getCaretOffset = (el) => {
    try {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return null;
      const range = sel.getRangeAt(0).cloneRange();
      // Ensure the selection is inside the element
      if (!el.contains(range.endContainer)) return null;
      const pre = document.createRange();
      pre.selectNodeContents(el);
      pre.setEnd(range.endContainer, range.endOffset);
      return pre.toString().length;
    } catch {
      return null;
    }
  };

  // Restore caret to a linear offset within a contentEditable element
  const setCaretOffset = (el, offset) => {
    try {
      let remaining = Math.max(0, offset);
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      let node = walker.nextNode();
      while (node) {
        const len = node.nodeValue?.length || 0;
        if (remaining <= len) {
          const range = document.createRange();
          range.setStart(node, remaining);
          range.collapse(true);
          const sel = window.getSelection();
          if (!sel) return;
          sel.removeAllRanges();
          sel.addRange(range);
          return;
        }
        remaining -= len;
        node = walker.nextNode();
      }
      // Fallback to end
      placeCaretAtEnd(el);
    } catch {}
  };

  // Refs for inline editable spans
  const titleEditableRef = useRef(null);
  const descEditableRef = useRef(null);
  const [activeEditable, setActiveEditable] = useState('title'); // 'title' | 'desc'

  // Keep DOM in sync with state without disturbing caret when content doesn't change
  useEffect(() => {
    const el = titleEditableRef.current;
    if (!el) return;
    const stateText = editableTitles[0] ?? (() => { const c = getDefaultCardContent(0); return c.text || ''; })();
    if (el.innerText !== stateText) {
      const offset = getCaretOffset(el);
      el.innerText = stateText;
      // If user is currently editing title, try to keep caret close to previous offset
      if (activeEditable === 'title' && offset != null) {
        const newOffset = Math.min(offset, stateText.length);
        setCaretOffset(el, newOffset);
      }
    }
  }, [editableTitles, activeEditable]);

  useEffect(() => {
    const el = descEditableRef.current;
    if (!el) return;
    const stateText = editableDescriptions[0] ?? (() => { const c = getDefaultCardContent(0); return c.image || c.text || ''; })();
    if (el.innerText !== stateText) {
      const offset = getCaretOffset(el);
      el.innerText = stateText;
      if (activeEditable === 'desc' && offset != null) {
        const newOffset = Math.min(offset, stateText.length);
        setCaretOffset(el, newOffset);
      }
    }
  }, [editableDescriptions, activeEditable]);
  

  // Helper functions for image loading state management
  const isImageLoading = (cardIndex) => {
    return imageLoadingStates[cardIndex] || false;
  };

  // Force re-render when colorPromptSaved changes
  useEffect(() => {
    console.log('=== COMPONENT3CARDS COLORPROMPTSAVED CHANGED ===', {
      colorPromptSaved,
      selectedFlightPhase,
      origin,
      destination,
      themeColor,
      selectedDates,
      hasOrigin: !!origin,
      hasDestination: !!destination,
      hasSelectedFlightPhase: !!selectedFlightPhase,
      hasSelectedDates: !!selectedDates && selectedDates.length > 0
    });
  }, [colorPromptSaved, selectedFlightPhase, origin, destination, themeColor, selectedDates]);

  // Log context changes for debugging
  useEffect(() => {
    console.log('🔄 COMPONENT3CARDS CONTEXT CHANGED', {
      contextKey,
      currentRouteKey,
      selectedFlightPhase,
      themeColor,
      selectedDates,
      reason: 'Context change detected - state will be automatically cleared'
    });
  }, [contextKey, currentRouteKey, selectedFlightPhase, themeColor, selectedDates]);

  // Debug when promoCardContents changes
  useEffect(() => {
    console.log('=== COMPONENT3CARDS PROMOCARDCONTENTS CHANGED ===', {
      currentRouteKey,
      selectedFlightPhase,
      promoCardContents,
      routeContents: currentRouteKey ? promoCardContents[currentRouteKey] : null,
      phaseKey: currentRouteKey && selectedFlightPhase ? `${currentRouteKey}-${selectedFlightPhase}` : null,
      phaseContents: (currentRouteKey && selectedFlightPhase) ? promoCardContents[`${currentRouteKey}-${selectedFlightPhase}`] : null
    });
  }, [promoCardContents, currentRouteKey, selectedFlightPhase]);




  // Skeleton component for loading state
  const SkeletonCard = () => (
    <div
      className="h-[200px] overflow-clip relative rounded-lg shrink-0 flex items-center justify-center bg-white/60 border border-gray-300"
      style={{ width: '416px' }}
    >
      <div className="space-y-3 text-center w-full px-6">
        <div className="h-8 rounded w-48 mx-auto bg-gray-200"></div>
        <div className="h-6 rounded w-32 mx-auto bg-gray-200"></div>
      </div>
    </div>
  );

  // Show skeleton state based on routes length and theme build status
  const showAllSkeletons = ((!isThemeBuildStarted && !isPromptMode) || (routes.length < 2 && !isPromptMode));








  // Helper function for default card content
  const getDefaultCardContent = (cardIndex) => {
    console.log('=== GETDEFAULTCARDCONTENT CALLED ===', {
      cardIndex,
      currentRouteKey,
      selectedFlightPhase,
      promoCardContents,
      colorPromptSaved,
      hasRouteKey: !!currentRouteKey,
      hasRouteContents: !!(currentRouteKey && promoCardContents[currentRouteKey]),
      hasCardContent: !!(currentRouteKey && promoCardContents[currentRouteKey] && promoCardContents[currentRouteKey][cardIndex])
    });

    // CRITICAL: Only show content if theme has been saved for this route
    if (!colorPromptSaved) {
      console.log('=== NO CONTENT - THEME NOT SAVED ===', {
        cardIndex,
        colorPromptSaved,
        reason: 'Theme must be saved before showing any content'
      });
      return { text: "Add experience", bgColor: getLightCardBackgroundColor(themeColor) };
    }

    // Prefer content saved for the current phase, then fallback to route-level saved content
    const phaseKey = (currentRouteKey && selectedFlightPhase)
      ? `${currentRouteKey}-${selectedFlightPhase}`
      : null;

    const savedForPhase = phaseKey && promoCardContents[phaseKey]
      ? promoCardContents[phaseKey][cardIndex]
      : undefined;

    const savedForRoute = (currentRouteKey && promoCardContents[currentRouteKey])
      ? promoCardContents[currentRouteKey][cardIndex]
      : undefined;

    const savedContent = savedForPhase || savedForRoute;

    if (savedContent) {
      console.log('=== USING SAVED PROMO CARD CONTENT ===', {
        currentRouteKey,
        phaseKey,
        cardIndex,
        from: savedForPhase ? 'phase' : 'route',
        savedContent,
        textValue: savedContent.text,
        imageValue: savedContent.image
      });
      return {
        text: savedContent.text || "Add experience",
        image: savedContent.image || '',
        backgroundImage: savedContent.backgroundImage || '',
        bgColor: getLightCardBackgroundColor(themeColor)
      };
    }
    
    // Only generate festival content if:
    // 1. Theme is saved for this route (already checked above)
    // 2. Current theme is actually festive (not non-festive like Lufthansa)
    // 3. Required data is available
    if (isCurrentThemeFestive && isCurrentThemeFestive() && selectedFlightPhase && origin && destination) {
      console.log('=== GETTING FESTIVAL CONTENT FOR PROMO CARD ===', {
        colorPromptSaved,
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
      
      const festivalContent = getPromoCardContent(segment, datesToUse, selectedFlightPhase, cardIndex, themeColor);
      console.log('=== FESTIVAL CONTENT RESULT ===', {
        festivalContent,
        hasText: !!festivalContent?.text,
        hasImage: !!festivalContent?.image
      });
      
      if (festivalContent && festivalContent.text) {
        return { 
          text: festivalContent.text, 
          image: festivalContent.image || '', 
          bgColor: getLightCardBackgroundColor(themeColor) 
        };
      }
    } else {
      console.log('=== SKIPPING FESTIVAL CONTENT GENERATION FOR PROMO CARD ===', {
        colorPromptSaved,
        isFestive: isCurrentThemeFestive ? isCurrentThemeFestive() : 'function not provided',
        selectedThemeChip: getRouteSelectedThemeChip ? getRouteSelectedThemeChip() : 'function not provided',
        reason: !isCurrentThemeFestive ? 'validation function not provided' :
                !isCurrentThemeFestive() ? 'theme not festive' : 
                'missing required data'
      });
    }
    
    // For non-festive themes or when theme is saved but not festive, use profile-specific content
    if (selectedFlightPhase) {
      console.log('=== GETTING NON-FESTIVE CONTENT FOR PROMO CARD ===', {
        selectedFlightPhase,
        cardIndex,
        colorPromptSaved,
        selectedProfile
      });
      
      // Use business profile content if user has selected "Business" profile
      let profileContent = null;
      if (selectedProfile === 'Business') {
        console.log('=== USING BUSINESS PROFILE CONTENT ===');
        profileContent = getBusinessProfileCardContent(selectedFlightPhase, 'promo', cardIndex, destination);
      } else {
        console.log('=== USING DEFAULT NON-FESTIVE CONTENT ===');
        profileContent = getNonFestiveCardContent(selectedFlightPhase, 'promo', cardIndex);
      }
      
      console.log('=== PROFILE CONTENT RESULT ===', {
        profileContent,
        hasText: !!profileContent?.text,
        hasImage: !!profileContent?.image,
        selectedProfile
      });
      
      if (profileContent && profileContent.text) {
        return { 
          text: profileContent.text, 
          image: profileContent.image || '', 
          bgColor: getLightCardBackgroundColor(themeColor) 
        };
      }
    }
    
    // Final fallback for unsaved themes
    return { text: "Add experience", bgColor: getLightCardBackgroundColor(themeColor) };
  };






  // Helper function to render a single card with original styling
  const renderCard = (originalCardIndex, displayPosition) => {
    // Phase-based visibility only applies in Landing Page
    // Dashboard doesn't pass hasReachedTakeoff prop, so it's undefined (uses default false)
    // Landing Page explicitly passes hasReachedTakeoff (even if false initially)
    // Check if we're in Landing Page mode: if hasReachedTakeoff prop was explicitly provided
    // If hasReachedTakeoff is undefined, we're in Dashboard mode (always show content)
    // If hasReachedTakeoff is provided (even if false), we're in Landing Page mode (phase-based visibility)
    const isLandingPageMode = hasReachedTakeoff !== undefined;
    
    // Check if card should be visible (promo cards are indices 0-2)
    // In Dashboard mode, always visible
    // In Landing Page mode, check if card index is in visibleCardIndices
    const isCardVisible = isLandingPageMode ? (visibleCardIndices && visibleCardIndices.has(originalCardIndex)) : true;
    // Check if climb phase is reached (for enabling interactions only)
    // In Dashboard mode, always enabled (no phase restrictions)
    const hasReachedClimb = isLandingPageMode ? (selectedFlightPhase === 'climb') : true;
    // Show content when takeoff is reached and card is visible
    // In Dashboard mode (hasReachedTakeoff is undefined), always show content
    // In Landing Page mode (hasReachedTakeoff is provided), only show when hasReachedTakeoff is true
    const shouldShowContent = isLandingPageMode ? (hasReachedTakeoff && isCardVisible) : true;
    
    // Simple card content - always show "Add experience"
    const cardContent = getDefaultCardContent(originalCardIndex);
    
    // Use edited title if available, otherwise use original card content
    const displayTitle = editableTitles[originalCardIndex] || cardContent.text;
    
    console.log('=== RENDER CARD DEBUG ===', {
      originalCardIndex,
      displayPosition,
      cardContent,
      textValue: cardContent.text,
      imageValue: cardContent.image,
      textType: typeof cardContent.text,
      imageType: typeof cardContent.image
    });
    
    // Get card type mapping
    const cardTypeMap = {
      0: { type: 'shopping', name: 'add experience', id: 'node-82_35814' },
      1: { type: 'meal', name: 'add experience', id: 'node-82_35815' },
      2: { type: 'movie', name: 'add experience', id: 'node-82_35816' }
    };
    
    const cardInfo = cardTypeMap[originalCardIndex];
    
    const cardStyle = {
      width: '416px',
      background: cardContent.bgColor,
      boxSizing: 'border-box'
    };

    return (
      <div
        key={`card-${originalCardIndex}-${displayPosition}`}
        className="h-[200px] relative shrink-0 flex items-center justify-center rounded-lg cursor-pointer hover:shadow-[0_0_0_3px_#1E1E1E] group"
        style={{
          ...cardStyle,
          opacity: isCardVisible ? 1 : 0.3, // Fade in when visible
          transition: 'opacity 0.2s ease-in'
        }}
        onMouseEnter={(e) => {
          // Disable user interactions in Landing Page mode (demo mode)
          if (isLandingPageMode) return;
          // Disable interactions before climb phase
          if (!hasReachedClimb) return;
          if (window.__tooltipLocked) return; // prevent new tooltips while locked
          
          // Check if any prompt bubble is open (promo card or recommendation card)
          const promoPanel = document.getElementById('locked-remix-panel');
          if (promoPanel && promoPanel.parentNode) return; // Don't show tooltip if promo bubble is open
          
          // Check if any recommendation card prompt bubble is open
          for (let i = 0; i < 4; i++) {
            const recPanel = document.getElementById(`recommended-locked-remix-panel-${i}`);
            if (recPanel && recPanel.parentNode) return; // Don't show tooltip if any recommendation bubble is open
          }
          
          // Create a lightweight, fixed-position tooltip that follows the cursor
          const tooltip = document.createElement('div');
          tooltip.style.cssText = `
            position: fixed;
            background: #1E1E1E;
            color: white;
            padding: 4px 8px;
            border-radius: 0 24px 24px 24px;
            font-size: 12px;
            z-index: 2147483647;
            pointer-events: ${showMovingIcon ? 'none' : 'auto'};
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

          // Remove any existing tooltip to avoid duplicates
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
              if (panel) {
                // Clean up scroll listener
                if (panel._scrollHandler) {
                  window.removeEventListener('scroll', panel._scrollHandler, true);
                  window.removeEventListener('resize', panel._scrollHandler);
                  delete panel._scrollHandler;
                }
                if (panel.parentNode) panel.parentNode.removeChild(panel);
              }
              const performancePanel = document.getElementById('performance-empty-panel');
              if (performancePanel && performancePanel.parentNode) performancePanel.parentNode.removeChild(performancePanel);
              window.__tooltipLocked = false;
              try { setTooltipLocked(false); } catch {}
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
                const rect = tooltip.getBoundingClientRect();
                const cardContent = getDefaultCardContent(originalCardIndex);
                const displayTitle = (editableTitles && editableTitles[originalCardIndex]) || cardContent.text || 'Add experience';
                const displayDesc = (editableDescriptions && editableDescriptions[originalCardIndex]) || cardContent.image || cardContent.text || '';

                // Create the exact same UI as the built-in remix panel (directly positioned)
                const remixContainer = document.createElement('div');
                remixContainer.id = 'locked-remix-panel';
                remixContainer.className = 'px-4 py-3 flex flex-col items-center';
                remixContainer.style.cssText = 'position:fixed;left:' + rect.left + 'px;top:' + (rect.bottom + 8) + 'px;z-index:2147483647;background-color:#1C1C1C;border:1px solid rgba(255,255,255,0.2);width:312px;gap:40px;box-shadow:rgba(0,0,0,0.35) 0px 8px 20px;border-radius:0 24px 24px 24px' + (showMovingIcon ? ';pointer-events:none' : '');

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
                titleSpan.textContent = displayTitle;

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
                descSpan.textContent = displayDesc;

                // Assemble the paragraph
                textP.appendChild(changeTitleSpan);
                textP.appendChild(titleSpan);
                textP.appendChild(describeSpan);
                textP.appendChild(descSpan);
                textDiv.appendChild(textP);

                // Buttons container
                const buttonsDiv = document.createElement('div');
                buttonsDiv.className = 'flex gap-2 justify-end w-full';

                // Upload button (icon only, no functionality)
                const lockedUploadBtn = document.createElement('button');
                lockedUploadBtn.id = 'locked-tooltip-upload';
                lockedUploadBtn.className = 'flex items-center justify-center transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
                lockedUploadBtn.style.cssText = 'background-color: transparent; color: white; border: none; width: 36px; height: 36px; padding: 0; cursor: pointer;';
                // Prevent any functionality
                lockedUploadBtn.addEventListener('click', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                });
                // Add hover state
                lockedUploadBtn.addEventListener('mouseenter', () => {
                  if (!lockedUploadBtn.disabled) {
                    lockedUploadBtn.style.opacity = '0.8';
                    lockedUploadBtn.style.transform = 'scale(1.1)';
                  }
                });
                lockedUploadBtn.addEventListener('mouseleave', () => {
                  if (!lockedUploadBtn.disabled) {
                    lockedUploadBtn.style.opacity = '1';
                    lockedUploadBtn.style.transform = 'scale(1)';
                  }
                });
                // Add active/clicked state
                lockedUploadBtn.addEventListener('mousedown', () => {
                  if (!lockedUploadBtn.disabled) {
                    lockedUploadBtn.style.transform = 'scale(0.95)';
                    lockedUploadBtn.style.opacity = '0.7';
                  }
                });
                lockedUploadBtn.addEventListener('mouseup', () => {
                  if (!lockedUploadBtn.disabled) {
                    lockedUploadBtn.style.transform = 'scale(1.1)';
                    lockedUploadBtn.style.opacity = '0.8';
                  }
                });
                lockedUploadBtn.addEventListener('mouseleave', () => {
                  if (!lockedUploadBtn.disabled) {
                    lockedUploadBtn.style.transform = 'scale(1)';
                    lockedUploadBtn.style.opacity = '1';
                  }
                });
                // Create ArrowUpTrayIcon SVG (upload icon)
                const uploadIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                uploadIcon.setAttribute('class', 'w-5 h-5');
                uploadIcon.setAttribute('fill', 'none');
                uploadIcon.setAttribute('stroke', 'currentColor');
                uploadIcon.setAttribute('viewBox', '0 0 24 24');
                const uploadPath1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                uploadPath1.setAttribute('stroke-linecap', 'round');
                uploadPath1.setAttribute('stroke-linejoin', 'round');
                uploadPath1.setAttribute('stroke-width', '2');
                uploadPath1.setAttribute('d', 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5');
                uploadIcon.appendChild(uploadPath1);
                lockedUploadBtn.appendChild(uploadIcon);

                // Remix button (icon only)
                const lockedRemixBtn = document.createElement('button');
                lockedRemixBtn.id = 'locked-tooltip-remix';
                lockedRemixBtn.className = 'flex items-center justify-center transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
                lockedRemixBtn.style.cssText = 'background-color: transparent; color: white; border: none; width: 36px; height: 36px; padding: 0; cursor: pointer;';
                // Add hover state
                lockedRemixBtn.addEventListener('mouseenter', () => {
                  if (!lockedRemixBtn.disabled) {
                    lockedRemixBtn.style.opacity = '0.8';
                    lockedRemixBtn.style.transform = 'scale(1.1)';
                  }
                });
                lockedRemixBtn.addEventListener('mouseleave', () => {
                  if (!lockedRemixBtn.disabled) {
                    lockedRemixBtn.style.opacity = '1';
                    lockedRemixBtn.style.transform = 'scale(1)';
                  }
                });
                // Add active/clicked state
                lockedRemixBtn.addEventListener('mousedown', () => {
                  if (!lockedRemixBtn.disabled) {
                    lockedRemixBtn.style.transform = 'scale(0.95)';
                    lockedRemixBtn.style.opacity = '0.7';
                  }
                });
                lockedRemixBtn.addEventListener('mouseup', () => {
                  if (!lockedRemixBtn.disabled) {
                    lockedRemixBtn.style.transform = 'scale(1.1)';
                    lockedRemixBtn.style.opacity = '0.8';
                  }
                });
                lockedRemixBtn.addEventListener('mouseleave', () => {
                  if (!lockedRemixBtn.disabled) {
                    lockedRemixBtn.style.transform = 'scale(1)';
                    lockedRemixBtn.style.opacity = '1';
                  }
                });
                // Create ArrowPathIcon SVG
                const remixIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                remixIcon.setAttribute('class', 'w-5 h-5');
                remixIcon.setAttribute('fill', 'none');
                remixIcon.setAttribute('stroke', 'currentColor');
                remixIcon.setAttribute('viewBox', '0 0 24 24');
                const remixPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                remixPath.setAttribute('stroke-linecap', 'round');
                remixPath.setAttribute('stroke-linejoin', 'round');
                remixPath.setAttribute('stroke-width', '2');
                remixPath.setAttribute('d', 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15');
                remixIcon.appendChild(remixPath);
                lockedRemixBtn.appendChild(remixIcon);

                // Save button
                const lockedSaveBtn = document.createElement('button');
                lockedSaveBtn.id = 'locked-tooltip-save';
                lockedSaveBtn.className = 'px-4 py-2 font-semibold text-xs uppercase transition-all duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed';
                lockedSaveBtn.style.cssText = 'background-color: #2563eb; color: white; border-top-left-radius: 0px; border-top-right-radius: 24px; border-bottom-left-radius: 24px; border-bottom-right-radius: 24px; border: none; cursor: pointer;';
                lockedSaveBtn.textContent = 'Save';
                // Add hover state
                lockedSaveBtn.addEventListener('mouseenter', () => {
                  if (!lockedSaveBtn.disabled) {
                    lockedSaveBtn.style.opacity = '0.9';
                    lockedSaveBtn.style.transform = 'scale(1.02)';
                  }
                });
                lockedSaveBtn.addEventListener('mouseleave', () => {
                  if (!lockedSaveBtn.disabled) {
                    lockedSaveBtn.style.opacity = '1';
                    lockedSaveBtn.style.transform = 'scale(1)';
                  }
                });
                // Add active/clicked state
                lockedSaveBtn.addEventListener('mousedown', () => {
                  if (!lockedSaveBtn.disabled) {
                    lockedSaveBtn.style.transform = 'scale(0.98)';
                    lockedSaveBtn.style.opacity = '0.85';
                    lockedSaveBtn.style.backgroundColor = '#1d4ed8';
                  }
                });
                lockedSaveBtn.addEventListener('mouseup', () => {
                  if (!lockedSaveBtn.disabled) {
                    lockedSaveBtn.style.transform = 'scale(1.02)';
                    lockedSaveBtn.style.opacity = '0.9';
                    lockedSaveBtn.style.backgroundColor = '#2563eb';
                  }
                });
                lockedSaveBtn.addEventListener('mouseleave', () => {
                  if (!lockedSaveBtn.disabled) {
                    lockedSaveBtn.style.transform = 'scale(1)';
                    lockedSaveBtn.style.opacity = '1';
                    lockedSaveBtn.style.backgroundColor = '#2563eb';
                  }
                });

                buttonsDiv.appendChild(lockedRemixBtn);
                buttonsDiv.appendChild(lockedSaveBtn);

                // Assemble the container
                remixContainer.appendChild(textDiv);
                remixContainer.appendChild(buttonsDiv);

                // Remove any existing remix panel
                const existingPanel = document.getElementById('locked-remix-panel');
                if (existingPanel) {
                  // Clean up scroll listener
                  if (existingPanel._scrollHandler) {
                    window.removeEventListener('scroll', existingPanel._scrollHandler, true);
                    window.removeEventListener('resize', existingPanel._scrollHandler);
                    delete existingPanel._scrollHandler;
                  }
                  if (existingPanel.parentNode) existingPanel.parentNode.removeChild(existingPanel);
                }

                document.body.appendChild(remixContainer);

                // Get card element for scroll tracking
                const cardElement = document.querySelector(`[data-card-index="${originalCardIndex}"]`) || document.getElementById(cardInfo.id);
                const initialCardRect = cardElement ? cardElement.getBoundingClientRect() : null;
                const initialTooltipLeft = rect.left;
                const initialTooltipTop = rect.top;
                const initialBubbleTop = rect.bottom + 8;
                const initialBubbleLeft = rect.left;
                
                // Function to update positions on scroll
                const updatePositionsOnScroll = () => {
                  requestAnimationFrame(() => {
                    const tooltip = document.getElementById('custom-tooltip');
                    const bubble = document.getElementById('locked-remix-panel');
                    if (!tooltip || !bubble || !cardElement) return;
                    
                    const currentCardRect = cardElement.getBoundingClientRect();
                    if (!initialCardRect) return;
                    
                    // Calculate scroll offset
                    const scrollDeltaY = currentCardRect.top - initialCardRect.top;
                    const scrollDeltaX = currentCardRect.left - initialCardRect.left;
                    
                    // Update tooltip position
                    tooltip.style.top = `${initialTooltipTop + scrollDeltaY}px`;
                    tooltip.style.left = `${initialTooltipLeft + scrollDeltaX}px`;
                    
                    // Update bubble position relative to tooltip
                    const tooltipRect = tooltip.getBoundingClientRect();
                    const bubbleTop = tooltipRect.bottom + 8;
                    
                    bubble.style.top = `${bubbleTop}px`;
                    bubble.style.left = `${initialBubbleLeft + scrollDeltaX}px`;
                  });
                };
                
                // Add scroll listener
                const scrollHandler = () => updatePositionsOnScroll();
                window.addEventListener('scroll', scrollHandler, true);
                window.addEventListener('resize', scrollHandler);
                
                // Store scroll handler for cleanup
                remixContainer._scrollHandler = scrollHandler;

                // Add event listeners for title editing
                titleSpan.addEventListener('input', (e) => {
                  const el = e.target;
                  const raw = el.innerText;
                  const clamped = raw.length > 50 ? raw.slice(0, 50) : raw;
                  if (clamped !== raw) el.innerText = clamped;
                  // Update the promo card title
                  setEditableTitle(originalCardIndex, clamped);
                });
                titleSpan.addEventListener('keydown', (e) => {
                  if (e.key === 'Enter') { e.preventDefault(); return; }
                });

                // Add event listeners for remix and save buttons
                const triggerRemix = () => {
                  try {
                    const imageDescription = (descSpan?.innerText || cardContent.image || cardContent.text || 'content');
                    const newImageUrl = getPollinationsImage(imageDescription, themeColor, { randomize: true });
                    const timestamp = Date.now();
                    const separator = newImageUrl.includes('?') ? '&' : '?';
                    const newUrl = `${newImageUrl}${separator}t=${timestamp}`;
                    setRemixedImage(originalCardIndex, newUrl);
                    setImageLoading(originalCardIndex, true);
                    console.log('Promo card remix generated from panel', { originalCardIndex, imageDescription, newUrl });
                  } catch (err) {
                    console.error('Promo card remix failed', err);
                  }
                };
                if (lockedRemixBtn) lockedRemixBtn.addEventListener('click', (ev) => { ev.stopPropagation(); triggerRemix(); });
                if (lockedSaveBtn) lockedSaveBtn.addEventListener('click', (ev) => { ev.stopPropagation(); triggerRemix(); });
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
              if (panel) {
                // Clean up scroll listener
                if (panel._scrollHandler) {
                  window.removeEventListener('scroll', panel._scrollHandler, true);
                  window.removeEventListener('resize', panel._scrollHandler);
                  delete panel._scrollHandler;
                }
                if (panel.parentNode) panel.parentNode.removeChild(panel);
              }
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
                emptyContainer.className = 'px-4 py-3 flex flex-col items-center';
                emptyContainer.style.cssText = 'position:fixed;left:' + rect.left + 'px;top:' + (rect.bottom + 8) + 'px;z-index:2147483647;background-color:#1C1C1C;border:1px solid rgba(255,255,255,0.2);width:312px;gap:40px;box-shadow:rgba(0,0,0,0.35) 0px 8px 20px;border-radius:0 24px 24px 24px';
                
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
          // No-op: keep existing lock state
        }}
        onMouseMove={(e) => {
          // Keep tooltip anchored to the mouse pointer
          const tooltip = document.getElementById('custom-tooltip');
          if (!tooltip || window.__tooltipLocked) return;
          tooltip.style.left = `${e.clientX + 18}px`;
          tooltip.style.top = `${e.clientY + 18}px`;
        }}
        onMouseLeave={() => {
          const tooltip = document.getElementById('custom-tooltip');
          if (tooltip && !window.__tooltipLocked) {
            tooltip.remove();
          }
        }}
        onClick={(e) => {
          // Disable user clicks in Landing Page mode (demo mode)
          // Allow programmatic clicks (e.isTrusted === false) for dummy mouse pointer animation
          if (isLandingPageMode && e.isTrusted === true) return;
          // Disable clicks before climb phase
          if (!hasReachedClimb) return;
          // Defer DOM manipulation to avoid conflicts with React's render cycle
          setTimeout(() => {
            // Lock the tooltip at the click position
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
            try { setTooltipLocked(true); } catch {}
            
            // Check if Dashboard content card bubble is open and save its content
            const dashboardContentPanel = document.getElementById('locked-remix-panel');
            if (dashboardContentPanel && dashboardContentPanel.parentNode) {
              // Check if this is a Dashboard content card bubble (has data-card-index attribute)
              const cardIndex = dashboardContentPanel.getAttribute('data-card-index');
              if (cardIndex !== null) {
                // This is a Dashboard content card bubble - save its content
                try {
                  const titleEl = dashboardContentPanel.querySelector('#locked-tooltip-title');
                  const descEl = dashboardContentPanel.querySelector('#locked-tooltip-desc');
                  
                  if (titleEl || descEl) {
                    // Get the current values
                    const titleValue = titleEl?.innerText || '';
                    const descValue = descEl?.innerText || '';
                    
                    // Trigger a custom event to save the content
                    const saveEvent = new CustomEvent('save-dashboard-content-card-content', {
                      detail: { cardIndex: parseInt(cardIndex), title: titleValue, description: descValue }
                    });
                    window.dispatchEvent(saveEvent);
                    
                    // Also trigger remix if description changed
                    if (descValue) {
                      const remixEvent = new CustomEvent('remix-dashboard-content-card-image', {
                        detail: { cardIndex: parseInt(cardIndex), description: descValue }
                      });
                      window.dispatchEvent(remixEvent);
                    }
                  }
                } catch (err) {
                  console.error('Error saving Dashboard content card content:', err);
                }
              }
            }
            
            // Close any recommendation card prompt bubbles, but retain text only (no remix)
            for (let i = 0; i < 4; i++) {
              const recPanel = document.getElementById(`recommended-locked-remix-panel-${i}`);
              if (recPanel && recPanel.parentNode) {
                // Retain the typed content in state before closing (but don't trigger remix)
                try {
                  const titleEl = recPanel.querySelector(`#recommended-locked-tooltip-title-${i}`);
                  const descEl = recPanel.querySelector(`#recommended-locked-tooltip-desc-${i}`);
                  
                  if (titleEl || descEl) {
                    // Get the current values
                    const titleValue = titleEl?.innerText || '';
                    const descValue = descEl?.innerText || '';
                    
                    // Trigger a custom event to save the content (retain text in state)
                    // The LandingPage component should listen for this and save the state
                    const saveEvent = new CustomEvent('save-recommended-card-content', {
                      detail: { cardIndex: i, title: titleValue, description: descValue }
                    });
                    window.dispatchEvent(saveEvent);
                    
                    // Do NOT trigger remix - only retain text, no image generation
                  }
                } catch (err) {
                  console.error('Error retaining recommendation card content:', err);
                }
              }
              
              // Now close the bubbles
              const recTooltip = document.getElementById(`recommended-tooltip-${i}`);
              if (recTooltip && recTooltip.parentNode) recTooltip.parentNode.removeChild(recTooltip);
              if (recPanel && recPanel.parentNode) recPanel.parentNode.removeChild(recPanel);
              const recPerfPanel = document.getElementById(`recommended-performance-empty-panel-${i}`);
              if (recPerfPanel && recPerfPanel.parentNode) recPerfPanel.parentNode.removeChild(recPerfPanel);
            }
            window.__recommendedTooltipLocked = false;
            
            // Create or update remix panel below the tooltip, left-aligned
            try {
              const existingPanel = document.getElementById('locked-remix-panel');
              if (existingPanel) {
                // Clean up scroll listener
                if (existingPanel._scrollHandler) {
                  window.removeEventListener('scroll', existingPanel._scrollHandler, true);
                  window.removeEventListener('resize', existingPanel._scrollHandler);
                  delete existingPanel._scrollHandler;
                }
                if (existingPanel.parentNode) existingPanel.parentNode.removeChild(existingPanel);
              }
            
            // If tooltip doesn't exist (because onMouseEnter was blocked by recommendation bubble),
            // create it now at the click position
            let t = document.getElementById('custom-tooltip');
            if (!t) {
              // Create the tooltip at click position
              t = document.createElement('div');
              t.style.cssText = `
                position: fixed;
                background: #1E1E1E;
                color: white;
                padding: 4px 8px;
                border-radius: 0 24px 24px 24px;
                font-size: 12px;
                z-index: 2147483647;
                pointer-events: ${showMovingIcon ? 'none' : 'auto'};
                white-space: nowrap;
                display: flex;
                align-items: center;
                gap: 8px;
                left: ${e.clientX + 12}px;
                top: ${e.clientY + 12}px;
              `;
              t.id = 'custom-tooltip';
              t.innerHTML = `
                <span id="tooltip-content-text" style="cursor:pointer;padding:2px 4px;border-radius:4px">Content</span>
                <span> | </span>
                <span id="tooltip-performance-text" style="cursor:pointer;padding:2px 4px;border-radius:4px">Performance</span>
                <span> |</span>
                <button id="custom-tooltip-close" aria-label="Close" style="background:transparent;border:none;color:white;opacity:.85;cursor:pointer;padding:0 2px;line-height:1">✕</button>
              `;
              document.body.appendChild(t);
              
              // Apply selected state to Content text
              const contentText = t.querySelector('#tooltip-content-text');
              if (contentText) {
                contentText.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                contentText.style.color = '#FFFFFF';
                contentText.style.padding = '2px 4px';
                contentText.style.borderRadius = '4px';
              }
              
              // Add close button handler
              const closeBtn = t.querySelector('#custom-tooltip-close');
              if (closeBtn) {
                closeBtn.addEventListener('click', (ev) => {
                  ev.stopPropagation();
                  const tooltip = document.getElementById('custom-tooltip');
                  if (tooltip) tooltip.remove();
                  const panel = document.getElementById('locked-remix-panel');
                  if (panel) {
                    // Clean up scroll listener
                    if (panel._scrollHandler) {
                      window.removeEventListener('scroll', panel._scrollHandler, true);
                      window.removeEventListener('resize', panel._scrollHandler);
                      delete panel._scrollHandler;
                    }
                    if (panel.parentNode) panel.parentNode.removeChild(panel);
                  }
                  const performancePanel = document.getElementById('performance-empty-panel');
                  if (performancePanel && performancePanel.parentNode) performancePanel.parentNode.removeChild(performancePanel);
                  window.__tooltipLocked = false;
                  try { setTooltipLocked(false); } catch {}
                });
              }
            }
            const rect = t.getBoundingClientRect();

            const cardContent = getDefaultCardContent(originalCardIndex);
            const displayTitle = (editableTitles && editableTitles[originalCardIndex]) || cardContent.text || 'Add experience';
            const displayDesc = (editableDescriptions && editableDescriptions[originalCardIndex]) || cardContent.image || cardContent.text || 'in-flight experience';

            // Create the exact same UI as the built-in remix panel (directly positioned)
            const remixContainer = document.createElement('div');
            remixContainer.id = 'locked-remix-panel';
            remixContainer.className = 'px-4 py-3 flex flex-col items-center';
            remixContainer.style.cssText = 'position:fixed;left:' + rect.left + 'px;top:' + (rect.bottom + 8) + 'px;z-index:2147483647;background-color:#1C1C1C;border:1px solid rgba(255,255,255,0.2);width:312px;gap:40px;box-shadow:rgba(0,0,0,0.35) 0px 8px 20px;border-radius:0 24px 24px 24px' + (showMovingIcon ? ';pointer-events:none' : '');

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
            titleSpan.textContent = displayTitle;

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
            descSpan.textContent = displayDesc || '';

            // Assemble the paragraph
            textP.appendChild(changeTitleSpan);
            textP.appendChild(titleSpan);
            textP.appendChild(describeSpan);
            textP.appendChild(descSpan);
            textDiv.appendChild(textP);

            // Create buttons container
            const buttonsDiv = document.createElement('div');
            buttonsDiv.className = 'flex gap-2 justify-end w-full';

            // Upload button (icon only, no functionality)
            const lockedUploadBtn = document.createElement('button');
            lockedUploadBtn.id = 'locked-tooltip-upload';
            lockedUploadBtn.className = 'flex items-center justify-center transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
            lockedUploadBtn.style.cssText = 'background-color: transparent; color: white; border: none; width: 36px; height: 36px; padding: 0; cursor: pointer;';
            // Prevent any functionality
            lockedUploadBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
            });
            // Add hover state
            lockedUploadBtn.addEventListener('mouseenter', () => {
              if (!lockedUploadBtn.disabled) {
                lockedUploadBtn.style.opacity = '0.8';
                lockedUploadBtn.style.transform = 'scale(1.1)';
              }
            });
            lockedUploadBtn.addEventListener('mouseleave', () => {
              if (!lockedUploadBtn.disabled) {
                lockedUploadBtn.style.opacity = '1';
                lockedUploadBtn.style.transform = 'scale(1)';
              }
            });
            // Add active/clicked state
            lockedUploadBtn.addEventListener('mousedown', () => {
              if (!lockedUploadBtn.disabled) {
                lockedUploadBtn.style.transform = 'scale(0.95)';
                lockedUploadBtn.style.opacity = '0.7';
              }
            });
            lockedUploadBtn.addEventListener('mouseup', () => {
              if (!lockedUploadBtn.disabled) {
                lockedUploadBtn.style.transform = 'scale(1.1)';
                lockedUploadBtn.style.opacity = '0.8';
              }
            });
            lockedUploadBtn.addEventListener('mouseleave', () => {
              if (!lockedUploadBtn.disabled) {
                lockedUploadBtn.style.transform = 'scale(1)';
                lockedUploadBtn.style.opacity = '1';
              }
            });
            // Create ArrowUpTrayIcon SVG (upload icon)
            const uploadIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            uploadIcon.setAttribute('class', 'w-5 h-5');
            uploadIcon.setAttribute('fill', 'none');
            uploadIcon.setAttribute('stroke', 'currentColor');
            uploadIcon.setAttribute('viewBox', '0 0 24 24');
            const uploadPath1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            uploadPath1.setAttribute('stroke-linecap', 'round');
            uploadPath1.setAttribute('stroke-linejoin', 'round');
            uploadPath1.setAttribute('stroke-width', '2');
            uploadPath1.setAttribute('d', 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5');
            uploadIcon.appendChild(uploadPath1);
            lockedUploadBtn.appendChild(uploadIcon);

            // Remix Style button (icon only)
            const lockedRemixBtn = document.createElement('button');
            lockedRemixBtn.id = 'locked-tooltip-remix';
            lockedRemixBtn.className = 'flex items-center justify-center transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
            lockedRemixBtn.style.cssText = 'background-color: transparent; color: white; border: none; width: 36px; height: 36px; padding: 0; cursor: pointer;';
            // Add hover state
            lockedRemixBtn.addEventListener('mouseenter', () => {
              if (!lockedRemixBtn.disabled) {
                lockedRemixBtn.style.opacity = '0.8';
                lockedRemixBtn.style.transform = 'scale(1.1)';
              }
            });
            lockedRemixBtn.addEventListener('mouseleave', () => {
              if (!lockedRemixBtn.disabled) {
                lockedRemixBtn.style.opacity = '1';
                lockedRemixBtn.style.transform = 'scale(1)';
              }
            });
            // Add active/clicked state
            lockedRemixBtn.addEventListener('mousedown', () => {
              if (!lockedRemixBtn.disabled) {
                lockedRemixBtn.style.transform = 'scale(0.95)';
                lockedRemixBtn.style.opacity = '0.7';
              }
            });
            lockedRemixBtn.addEventListener('mouseup', () => {
              if (!lockedRemixBtn.disabled) {
                lockedRemixBtn.style.transform = 'scale(1.1)';
                lockedRemixBtn.style.opacity = '0.8';
              }
            });
            lockedRemixBtn.addEventListener('mouseleave', () => {
              if (!lockedRemixBtn.disabled) {
                lockedRemixBtn.style.transform = 'scale(1)';
                lockedRemixBtn.style.opacity = '1';
              }
            });
            // Create ArrowPathIcon SVG
            const remixIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            remixIcon.setAttribute('class', 'w-5 h-5');
            remixIcon.setAttribute('fill', 'none');
            remixIcon.setAttribute('stroke', 'currentColor');
            remixIcon.setAttribute('viewBox', '0 0 24 24');
            const remixPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            remixPath.setAttribute('stroke-linecap', 'round');
            remixPath.setAttribute('stroke-linejoin', 'round');
            remixPath.setAttribute('stroke-width', '2');
            remixPath.setAttribute('d', 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15');
            remixIcon.appendChild(remixPath);
            lockedRemixBtn.appendChild(remixIcon);

            // Save button (exact same as built-in)
            const lockedSaveBtn = document.createElement('button');
            lockedSaveBtn.id = 'locked-tooltip-save';
            lockedSaveBtn.className = 'px-4 py-2 font-semibold text-xs uppercase transition-all duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed';
            lockedSaveBtn.style.cssText = 'background-color: #2563eb; color: white; border-top-left-radius: 0px; border-top-right-radius: 24px; border-bottom-left-radius: 24px; border-bottom-right-radius: 24px; border: none; cursor: pointer;';
            lockedSaveBtn.textContent = 'Save';
            // Add hover state
            lockedSaveBtn.addEventListener('mouseenter', () => {
              if (!lockedSaveBtn.disabled) {
                lockedSaveBtn.style.opacity = '0.9';
                lockedSaveBtn.style.transform = 'scale(1.02)';
              }
            });
            lockedSaveBtn.addEventListener('mouseleave', () => {
              if (!lockedSaveBtn.disabled) {
                lockedSaveBtn.style.opacity = '1';
                lockedSaveBtn.style.transform = 'scale(1)';
              }
            });
            // Add active/clicked state
            lockedSaveBtn.addEventListener('mousedown', () => {
              if (!lockedSaveBtn.disabled) {
                lockedSaveBtn.style.transform = 'scale(0.98)';
                lockedSaveBtn.style.opacity = '0.85';
                lockedSaveBtn.style.backgroundColor = '#1d4ed8';
              }
            });
            lockedSaveBtn.addEventListener('mouseup', () => {
              if (!lockedSaveBtn.disabled) {
                lockedSaveBtn.style.transform = 'scale(1.02)';
                lockedSaveBtn.style.opacity = '0.9';
                lockedSaveBtn.style.backgroundColor = '#2563eb';
              }
            });
            lockedSaveBtn.addEventListener('mouseleave', () => {
              if (!lockedSaveBtn.disabled) {
                lockedSaveBtn.style.transform = 'scale(1)';
                lockedSaveBtn.style.opacity = '1';
                lockedSaveBtn.style.backgroundColor = '#2563eb';
              }
            });

            buttonsDiv.appendChild(lockedUploadBtn);
            buttonsDiv.appendChild(lockedRemixBtn);
            buttonsDiv.appendChild(lockedSaveBtn);

            // Assemble the container
            remixContainer.appendChild(textDiv);
            remixContainer.appendChild(buttonsDiv);
            
            document.body.appendChild(remixContainer);

            // Get card element for scroll tracking
            const cardElement = document.querySelector(`[data-card-index="${originalCardIndex}"]`) || document.getElementById(cardInfo.id);
            const initialCardRect = cardElement ? cardElement.getBoundingClientRect() : null;
            const initialTooltipLeft = rect.left;
            const initialTooltipTop = rect.top;
            const initialBubbleTop = rect.bottom + 8;
            const initialBubbleLeft = rect.left;
            
            // Function to update positions on scroll
            const updatePositionsOnScroll = () => {
              requestAnimationFrame(() => {
                const tooltip = document.getElementById('custom-tooltip');
                const bubble = document.getElementById('locked-remix-panel');
                if (!tooltip || !bubble || !cardElement) return;
                
                const currentCardRect = cardElement.getBoundingClientRect();
                if (!initialCardRect) return;
                
                // Calculate scroll offset
                const scrollDeltaY = currentCardRect.top - initialCardRect.top;
                const scrollDeltaX = currentCardRect.left - initialCardRect.left;
                
                // Update tooltip position
                tooltip.style.top = `${initialTooltipTop + scrollDeltaY}px`;
                tooltip.style.left = `${initialTooltipLeft + scrollDeltaX}px`;
                
                // Update bubble position relative to tooltip
                const tooltipRect = tooltip.getBoundingClientRect();
                const bubbleTop = tooltipRect.bottom + 8;
                
                bubble.style.top = `${bubbleTop}px`;
                bubble.style.left = `${initialBubbleLeft + scrollDeltaX}px`;
              });
            };
            
            // Add scroll listener
            const scrollHandler = () => updatePositionsOnScroll();
            window.addEventListener('scroll', scrollHandler, true);
            window.addEventListener('resize', scrollHandler);
            
            // Store scroll handler for cleanup
            remixContainer._scrollHandler = scrollHandler;

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
                try { setEditableTitles(originalCardIndex, clamped); } catch {}
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
                try { setEditableDescriptions(originalCardIndex, clamped); } catch {}
              });
              descEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); return; }
              });
            }

            const triggerRemix = () => {
              try {
                const imageDescription = (descEl?.innerText || displayDesc || 'in-flight experience');
                const newImageUrl = getPollinationsImage(imageDescription, themeColor, { randomize: true });
                const timestamp = Date.now();
                const separator = newImageUrl.includes('?') ? '&' : '?';
                const newUrl = `${newImageUrl}${separator}t=${timestamp}`;
                setRemixedImage(originalCardIndex, newUrl);
                setImageLoading(originalCardIndex, true);
                setEditableDescription(originalCardIndex, imageDescription);
                console.log('Remix generated from panel', { originalCardIndex, imageDescription, newUrl });
              } catch (err) { console.error('Remix failed', err); }
            };

            if (remixBtn) remixBtn.addEventListener('click', (ev) => { ev.stopPropagation(); triggerRemix(); });
            if (saveBtn) saveBtn.addEventListener('click', (ev) => { ev.stopPropagation(); triggerRemix(); });
          } catch {}
          // Tooltip stays until explicit close button is clicked
          }, 0); // Close setTimeout
        }}
        data-name={cardInfo.name}
        data-card-index={originalCardIndex}
        id={cardInfo.id}
      >
          <div className="relative h-full w-full">
            
            {/* Image area - show empty placeholder before takeoff, content after */}
            {!shouldShowContent ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
              </div>
            ) : ((cardContent.image || remixedImages[originalCardIndex]) && colorPromptSaved) ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-full relative">
                  {/* Loading spinner */}
                  {isImageLoading(originalCardIndex) && (
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
                    const hasRemixedImage = !!remixedImages[originalCardIndex];
                    const baseDescription = cardContent.image || cardContent.text || 'in-flight experience';
                    
                    // CRITICAL: Only generate images if theme is saved or we have a remixed image
                    let imageSrc = null;
                    if (hasRemixedImage) {
                      imageSrc = remixedImages[originalCardIndex];
                    } else if (cardContent && cardContent.backgroundImage) {
                      imageSrc = cardContent.backgroundImage;
                    } else if (cardContent.image && colorPromptSaved) {
                      // Only generate Pollinations image if theme is saved and we have image content
                      imageSrc = getPollinationsImage(baseDescription, themeColor);
                    }
                    
                    // Don't render image if no valid source and theme not saved
                    if (!imageSrc) {
                      console.log('=== NO IMAGE - THEME NOT SAVED OR NO CONTENT ===', {
                        originalCardIndex,
                        hasRemixedImage,
                        cardContentImage: cardContent.image,
                        colorPromptSaved,
                        reason: 'No image source available and theme not saved'
                      });
                      return null;
                    }
                    
                    console.log('=== IMAGE RENDERING DEBUG ===', {
                      originalCardIndex,
                      hasRemixedImage,
                      remixedImages,
                      imageSrc,
                      cardContentImage: cardContent.image,
                      isLoading: isImageLoading(originalCardIndex),
                      colorPromptSaved
                    });
                    
                    return (
                      <img 
                        src={imageSrc}
                        alt={baseDescription}
                        className="w-full h-full object-cover rounded-lg"
                        style={{ display: isImageLoading(originalCardIndex) ? 'none' : 'block' }}
                        onLoad={() => {
                          console.log('=== POLLINATIONS IMAGE LOADED ===', { 
                            cardIndex: originalCardIndex, 
                            alt: cardContent.image, 
                            src: imageSrc,
                            wasRemixed: hasRemixedImage
                          });
                          setImageLoading(originalCardIndex, false);
                        }}
                        onError={(e) => {
                          console.log('=== POLLINATIONS IMAGE LOAD ERROR ===', { 
                            src: e.target.src, 
                            alt: cardContent.image,
                            wasRemixed: hasRemixedImage
                          });
                          setImageLoading(originalCardIndex, false);
                          e.target.style.display = 'none';
                        }}
                        onLoadStart={() => {
                          console.log('=== POLLINATIONS IMAGE LOAD START ===', { 
                            cardIndex: originalCardIndex, 
                            alt: cardContent.image, 
                            src: imageSrc,
                            wasRemixed: hasRemixedImage
                          });
                          setImageLoading(originalCardIndex, true);
                        }}
                      />
                    );
                  })()}
                </div>
              </div>
            ) : null}
            

            {/* Bottom rectangle with text field */}
            <div 
              className="absolute bottom-0 left-0 right-0 z-10 p-2 rounded-b-lg"
              style={{ 
                backgroundColor: getReadableOnColor(themeColor),
                minHeight: '40px',
                display: 'flex',
                alignItems: 'center'
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
                {shouldShowContent ? displayTitle : 'Add experience'}
              </p>
            </div>
          </div>
      </div>
    );
  };

  return (
    <>
      <div
        className="flex flex-col items-center justify-center mx-auto gap-4"
        style={{ width: '1302px' }}
        data-name="3-cards"
        id="node-82_36633"
      >
        <div className="flex flex-row gap-8 items-center justify-center">
          {showAllSkeletons ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              {/* Render cards in fixed order */}
              {[0, 1, 2].map((originalCardIndex, displayPosition) => 
                renderCard(originalCardIndex, displayPosition)
              )}
            </>
          )}
        </div>
        
        {/* Remix controls - DISABLED: only show for left card (index 0) after theme is saved and tooltip not locked */}
        {false && colorPromptSaved && !tooltipLocked && (
          <div 
            className="px-4 py-3 rounded-lg flex flex-col items-center"
            style={{
              backgroundColor: '#1C1C1C',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              width: '312px',
              gap: '40px'
            }}
          >
            {/* Continuous inline paragraph using contenteditable spans (inline flow, natural wrapping) */}
            <div className="w-full">
              <p className="whitespace-pre-wrap break-words text-lg leading-5 text-white m-0">
                <span
                  className="text-gray-300 select-none"
                  style={{ marginRight: 8 }}
                  onMouseDown={(e) => { e.preventDefault(); setActiveEditable('title'); if (titleEditableRef.current) { titleEditableRef.current.focus(); placeCaretAtEnd(titleEditableRef.current); } }}
                >
                  Change title to
                </span>
                <span
                  ref={titleEditableRef}
                  role="textbox"
                  aria-label="title"
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => {
                    const el = e.currentTarget;
                    const caretBefore = getCaretOffset(el);
                    const raw = el.innerText || '';
                    const clamped = raw.length > 50 ? raw.slice(0, 50) : raw;
                    const changed = clamped !== raw;
                    if (changed) {
                      el.innerText = clamped;
                    }
                    if (clamped !== (editableTitles[0] || '')) setEditableTitles(0, clamped);
                    if (changed) {
                      const newOffset = Math.min(caretBefore ?? clamped.length, clamped.length);
                      requestAnimationFrame(() => setCaretOffset(el, newOffset));
                    }
                  }}
                  onFocus={(e) => { setActiveEditable('title'); }}
                  
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); return; } }}
                  className="outline-none"
                  spellCheck={false}
                  style={{ textDecoration: 'underline dotted', textDecorationColor: 'rgba(156,163,175,0.8)', textUnderlineOffset: 6, caretColor: activeEditable === 'title' ? 'auto' : 'transparent', marginRight: 8 }}
                >
                </span>
                <span
                  className="text-gray-300 select-none"
                  style={{ marginRight: 8 }}
                  onMouseDown={(e) => { e.preventDefault(); setActiveEditable('desc'); if (descEditableRef.current) { descEditableRef.current.focus(); placeCaretAtEnd(descEditableRef.current); } }}
                >
                  describe image of
                </span>
                <span
                  ref={descEditableRef}
                  role="textbox"
                  aria-label="image description"
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => {
                    const el = e.currentTarget;
                    const caretBefore = getCaretOffset(el);
                    const raw = el.innerText || '';
                    const clamped = raw.length > 100 ? raw.slice(0, 100) : raw;
                    const changed = clamped !== raw;
                    if (changed) {
                      el.innerText = clamped;
                    }
                    if (clamped !== (editableDescriptions[0] || '')) setEditableDescriptions(0, clamped);
                    if (changed) {
                      const newOffset = Math.min(caretBefore ?? clamped.length, clamped.length);
                      requestAnimationFrame(() => setCaretOffset(el, newOffset));
                    }
                  }}
                  onFocus={(e) => { setActiveEditable('desc'); }}
                  
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); return; } }}
                  className="outline-none"
                  spellCheck={false}
                  style={{ textDecoration: 'underline dotted', textDecorationColor: 'rgba(156,163,175,0.8)', textUnderlineOffset: 6, caretColor: activeEditable === 'desc' ? 'auto' : 'transparent' }}
                >
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="px-4 py-2 rounded-lg font-semibold text-xs uppercase transition-all duration-200 hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: '#10B981',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.3)'
                }}
                disabled={(() => {
                  const currentDescription = editableDescriptions[0] || (() => {
                    const cardContent = getDefaultCardContent(0);
                    return cardContent.image || cardContent.text || 'in-flight experience';
                  })();
                  const currentTitle = editableTitles[0] || (() => {
                    const cardContent = getDefaultCardContent(0);
                    return cardContent.text || 'Add experience';
                  })();
                  const savedDescription = savedDescriptions[0];
                  const savedTitle = savedDescriptions[0]; // We'll track both in the same state for now
                  return currentDescription === savedDescription && currentTitle === savedTitle;
                })()}
                onClick={() => {
                  console.log('=== SAVE BUTTON CLICKED ===', {
                    editedDescription: editableDescriptions[0],
                    editedTitle: editableTitles[0],
                    cardIndex: 0
                  });
                  
                  // Generate new image based on the edited description
                  const editedDescription = editableDescriptions[0];
                  const editedTitle = editableTitles[0];
                  
                  if (editedDescription) {
                    console.log('=== GENERATING SAVED IMAGE ===', {
                      editedDescription,
                      editedTitle,
                      themeColor
                    });
                    
                    // Generate new image URL with the edited description
                    const newImageUrl = getPollinationsImage(editedDescription, themeColor, { randomize: true });
                    
                    // Update the remixed images state to show the new image
                    // Use isolated state management
                    setRemixedImage(0, newImageUrl);
                    setImageLoading(0, true);
                    setEditableDescription(0, editedDescription);
                    
                    console.log('=== SAVE COMPLETE ===', {
                      newImageUrl,
                      editedDescription,
                      editedTitle,
                      savedDescription: editedDescription
                    });
                  }
                }}
              >
                🎲 Remix Style
              </button>
              <button
                className="px-4 py-2 rounded-lg font-semibold text-xs uppercase transition-all duration-200 hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: '#10B981',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  backdropFilter: 'blur(10px)'
                }}
                disabled={false}
                onClick={async () => {
                  console.log('=== REMIX BUTTON CLICKED ===');
                  setRemixLoading(true);
                  
                  try {
                    // Get current card content to extract image description
                    const currentCardContent = getDefaultCardContent(0);
                    console.log('=== CURRENT CARD CONTENT ===', {
                      currentCardContent,
                      hasImage: !!currentCardContent.image,
                      imageDescription: currentCardContent.image,
                      text: currentCardContent.text
                    });
                    // Prefer live DOM text to avoid lag between DOM and state
                    const domDesc = (descEditableRef?.current?.innerText || '').trim();
                    const imageDescription = domDesc || editableDescriptions[0] || currentCardContent.image || currentCardContent.text || 'in-flight experience';
                    // Keep state in sync with DOM if user just typed
                    if (domDesc && domDesc !== editableDescriptions[0]) {
                      setEditableDescriptions(0, domDesc.slice(0, 100));
                    }
                    
                    if (imageDescription) {
                      console.log('=== GENERATING NEW IMAGE ===', {
                        imageDescription,
                        themeColor,
                        currentRouteKey,
                        selectedFlightPhase,
                        colorPromptSaved
                      });
                      
                      // Generate new image URL with current theme color and randomized seed for true remix
                      const newImageUrl = getPollinationsImage(imageDescription, themeColor, { randomize: true });
                      
                      // Force reload the image by updating the src with a cache-busting parameter
                      const timestamp = Date.now();
                      const separator = newImageUrl.includes('?') ? '&' : '?';
                      const newImageUrlWithCacheBust = `${newImageUrl}${separator}t=${timestamp}`;
                      
                      console.log('=== UPDATING STATE WITH NEW IMAGE ===', {
                        newImageUrl,
                        newImageUrlWithCacheBust,
                        currentRemixedImages: remixedImages
                      });
                      
                      // Update state to trigger re-render with new image
                      setRemixedImage(0, newImageUrlWithCacheBust);
                      console.log('=== NEW REMIXED IMAGE SET ===', {
                        cardIndex: 0,
                        newImageUrl: newImageUrlWithCacheBust
                      });
                      
                      
                      // Set loading state for the card
                      setImageLoading(0, true);
                      
                      console.log('=== REMIX COMPLETE ===', {
                        newImageUrl: newImageUrlWithCacheBust,
                        loadingState: true
                      });
                    } else {
                      console.log('=== NO IMAGE DESCRIPTION FOUND ===', {
                        currentCardContent,
                        reason: 'No image property in card content'
                      });
                    }
                  } catch (error) {
                    console.error('=== ERROR GENERATING REMIX IMAGE ===', error);
                  } finally {
                    setRemixLoading(false);
                  }
                }}
              >
                {remixLoading ? (
                  <div className="flex items-center space-x-2">
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    <span>Remixing...</span>
                  </div>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}