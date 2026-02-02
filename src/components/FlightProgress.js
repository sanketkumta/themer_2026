import './FlightProgress.css';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getReadableOnColor } from '../utils/color';

function parseTime(str) {
  // Example: "LANDING IN 2H 55M"
  const match = str.match(/(\d+)H\s*(\d+)M/);
  if (!match) return 0;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours * 60 + minutes;
}

function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `LANDING IN ${h}H ${m.toString().padStart(2, '0')}M`;
}

export default function FlightProgress({ landingIn = "LANDING IN 2H 55M", maxFlightMinutes = 370, minutesLeft: externalMinutesLeft, onProgressChange, themeColor = '#1E72AE', isPromptMode = false, onPromptHover, onPromptClick, fpsPrompts = {}, showMovingIcon = false, onAnimationProgressChange, onPromoCardLoadingChange, onAnimationProgress, onCruiseLabelShow, onMiddleCardPromptClose, onThemeColorChange, flightsGenerated = false, onFlightPhaseSelect, selectedFlightPhase = null }) {
  
  // Helper function to determine color based on theme type
  const getElementColor = () => {
    return themeColor.includes('gradient') ? '#000000' : themeColor;
  };

  // Helper function to get a darker version of the color for flight progress
  const getDarkerProgressColor = () => {
    if (themeColor.includes('gradient')) {
      return '#000000'; // Keep black for gradients
    }
    
    // For regular colors, make them darker
    if (themeColor.startsWith('#')) {
      const hex = themeColor.slice(1);
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      
      // Make it 20% darker
      const darkerR = Math.max(0, Math.floor(r * 0.8));
      const darkerG = Math.max(0, Math.floor(g * 0.8));
      const darkerB = Math.max(0, Math.floor(b * 0.8));
      
      return `#${darkerR.toString(16).padStart(2, '0')}${darkerG.toString(16).padStart(2, '0')}${darkerB.toString(16).padStart(2, '0')}`;
    }
    
    // Fallback to original color if not hex
    return themeColor;
  };
  // Readable on-color for text/icons over theme surfaces
  const onColor = getReadableOnColor(themeColor);
  
  const barWidth = 1302;
  const [dragging, setDragging] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(showMovingIcon ? 0.02 : 0); // Start with 2% progress if showing moving icon
  const [hasReachedTarget, setHasReachedTarget] = useState(false);
  const [showPointer, setShowPointer] = useState(false);
  const [showPlusButton, setShowPlusButton] = useState(false);
  const [showPromptBubble, setShowPromptBubble] = useState(false);
  const [promptBubblePosition, setPromptBubblePosition] = useState({ x: 0, y: 0 });
  const [showTakeoffLabel, setShowTakeoffLabel] = useState(false);
  const [showCruiseLabel, setShowCruiseLabel] = useState(false);
  const [showClimbLabel, setShowClimbLabel] = useState(false);
  const [movePointerToCard, setMovePointerToCard] = useState(false);
  const [pointerCardPosition, setPointerCardPosition] = useState({ x: 0, y: 0 });
  const [showPlusButtonAtCard, setShowPlusButtonAtCard] = useState(false);
  const [showPromptBubbleAtCard, setShowPromptBubbleAtCard] = useState(false);
  const [promptBubbleCardPosition, setPromptBubbleCardPosition] = useState({ x: 0, y: 0 });
  const [promoCardLoading, setPromoCardLoading] = useState(false);
  const [promptBubbleLoading, setPromptBubbleLoading] = useState(false);
  const [movePointerToSecondTile, setMovePointerToSecondTile] = useState(false);
  const [secondTilePosition, setSecondTilePosition] = useState({ x: 0, y: 0 });
  const lastProgressRef = useRef(0.02);
  const [movePointerToMiddleCard, setMovePointerToMiddleCard] = useState(false);
  const [middleCardPosition, setMiddleCardPosition] = useState({ x: 0, y: 0 });
  const [showPlusButtonAtMiddleCard, setShowPlusButtonAtMiddleCard] = useState(false);
  const [middleCardPromptClosed, setMiddleCardPromptClosed] = useState(false);
  const [movePointerToFJB, setMovePointerToFJB] = useState(false);
  const [fjbPosition, setFjbPosition] = useState({ x: 0, y: 0 });
  const [showPlusButtonAtFJB, setShowPlusButtonAtFJB] = useState(false);
  const [showPromptBubbleAtFJB, setShowPromptBubbleAtFJB] = useState(false);
  const [promptBubbleFJBPosition, setPromptBubbleFJBPosition] = useState({ x: 0, y: 0 });
  const [showClimbPointer, setShowClimbPointer] = useState(false);
  const pointerElementRef = useRef(null);
  const [climbPointerPosition, setClimbPointerPosition] = useState({ x: 0, y: 0 });
  const [isClimbPointerAnimating, setIsClimbPointerAnimating] = useState(false);
  const [isClimbPointerClicking, setIsClimbPointerClicking] = useState(false);
  const [showFlightPhases, setShowFlightPhases] = useState(false);
  const barRef = useRef();
  const iconRef = useRef();

  // Show flight phases when flights are generated or when in prompt mode
  useEffect(() => {
    if (flightsGenerated || isPromptMode) {
      setShowFlightPhases(true);
    }
  }, [flightsGenerated, isPromptMode]);

  // NEW: Handle flight phase click and notify parent
  const handleFlightPhaseClick = (phase) => {
    // Notify parent component about the selection
    // This should only update the flight phase, not open any prompt bubbles
    if (onFlightPhaseSelect) {
      onFlightPhaseSelect(phase);
    }
    
    // Ensure no prompt bubbles are opened when flight phase chips are clicked
    console.log('=== FLIGHT PHASE CLICKED ===', { phase, action: 'flight phase selection only' });
  };

  // Set CSS custom property for theme color
  useEffect(() => {
    if (barRef.current) {
      barRef.current.style.setProperty('--theme-color', themeColor);
    }
  }, [themeColor]);

  // Debug: Track when showPromptBubble changes
  useEffect(() => {
    console.log('=== STATE DEBUG ===', {
      showPromptBubble, 
      showMovingIcon, 
      hasReachedTarget,
      animationProgress 
    });
  }, [showPromptBubble, showMovingIcon, hasReachedTarget, animationProgress]);

  // Move pointer to FJB after middle card prompt closes
  useEffect(() => {
    if (middleCardPromptClosed && showMovingIcon) {
      
      // Move pointer to FJB after a delay
      setTimeout(() => {
        setShowPointer(false);
        setMovePointerToMiddleCard(false);
        setShowPlusButtonAtMiddleCard(false);
        setMovePointerToFJB(true);
        
        // Show plus button after pointer appears at FJB
        setTimeout(() => {
          setShowPlusButtonAtFJB(true);
          
          // Show prompt bubble after plus button appears
          setTimeout(() => {
            // Calculate FJB prompt bubble position
            // Add a small delay to ensure DOM is ready
            setTimeout(() => {
              // Calculate absolute position like Dashboard does
              // Find the flight progress bar container to get its absolute position
              const flightProgressContainer = document.querySelector('.flight-progress-bar-container');
              if (flightProgressContainer) {
                const containerRect = flightProgressContainer.getBoundingClientRect();
                
                // Plus button is at barWidth / 2 + 20, top: -12px (relative to progress bar)
                // Calculate absolute position relative to viewport
                const absoluteX = containerRect.left + barWidth / 2 + 20; // Plus button X (no spacing)
                const absoluteY = containerRect.top + (-12 + 16); // Plus button Y + half button height (reduced Y distance)
                
                console.log('=== FJB POSITION DEBUG ===', {
                  barWidth,
                  containerRect: { left: containerRect.left, top: containerRect.top },
                  absoluteX,
                  absoluteY
                });
                
                setPromptBubbleFJBPosition({ x: absoluteX, y: absoluteY });
                              setShowPromptBubbleAtFJB(true);
                console.log('=== PROMPT BUBBLE AT FJB ===', {
                  showPromptBubbleAtFJB: true, 
                  showMovingIcon,
                  position: { x: absoluteX, y: absoluteY } 
                });
              } else {
                console.error('flight-progress-bar-container not found');
              }
            }, 100); // Small delay to ensure DOM is ready
                      }, 800); // 0.8 second delay after plus button appears
        }, 300); // 0.3 second delay after pointer appears at FJB
      }, 500); // 0.5 second delay after middle card prompt closed
    }
  }, [middleCardPromptClosed, showMovingIcon]);

  // If externalMinutesLeft is provided, use it as the source of truth
  const displayMinutes = typeof externalMinutesLeft === 'number' ? externalMinutesLeft : parseTime(landingIn);
  const progress = 1 - (displayMinutes / maxFlightMinutes);
  
  // Target progress for landing page animation (20%)
  const targetProgress = 0.2;
  
  // Helper function to get progress for selected flight phase
  const getFlightPhaseProgress = (phase) => {
    const phaseProgressMap = {
      'takeoff': 0.05,
      'climb': 0.20,
      'cruise': 0.35,
      'descent': 0.75,
      'landing': 0.88
    };
    return phaseProgressMap[phase] || null;
  };

  // Use animation progress for moving icon, selected flight phase progress, or normal progress
  const iconLeft = (() => {
    if (showMovingIcon) {
      return Math.max(0, Math.min(barWidth * animationProgress - 16, barWidth - 32));
    } else if (selectedFlightPhase) {
      const phaseProgress = getFlightPhaseProgress(selectedFlightPhase);
      if (phaseProgress !== null) {
        return Math.max(0, Math.min(barWidth * phaseProgress - 16, barWidth - 32));
      }
    }
    return Math.max(0, Math.min(barWidth * progress - 16, barWidth - 32));
  })();

  // For moving icon, ensure we have a minimum progress width to show the bar
  const progressWidth = (() => {
    if (showMovingIcon) {
      return Math.max(4, Math.min(barWidth * animationProgress, barWidth)); // Minimum 4px width for visibility
    } else if (selectedFlightPhase) {
      const phaseProgress = getFlightPhaseProgress(selectedFlightPhase);
      if (phaseProgress !== null) {
        return Math.max(0, Math.min(barWidth * phaseProgress, barWidth));
      }
    }
    return Math.max(0, Math.min(barWidth * progress, barWidth));
  })();

  // Animation for moving icon to 20% and stopping
  useEffect(() => {
    if (!showMovingIcon) return;

    console.log('=== ANIMATION START DEBUG ===', {
      animationProgress, 
      startProgress: animationProgress, 
      targetProgress: 0.2,
      hasReachedTarget 
    });

    // Don't show Cruise label during animation - only show after prompt submission

    // If we've already reached the target, don't restart animation
    if (hasReachedTarget) return;

    // Add a delay to ensure DOM elements are ready
    const startAnimation = () => {
      const animationDuration = 2000; // 2 seconds to reach 20% (50% of previous 4000ms)
      const startTime = Date.now();
      // Always start from the highest progress we've achieved to prevent backward movement
      const currentProgress = Math.max(0.02, animationProgress);
      const startProgress = Math.max(currentProgress, lastProgressRef.current);
      lastProgressRef.current = startProgress;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progressRatio = Math.min(elapsed / animationDuration, 1);
        const newProgress = startProgress + (targetProgress - startProgress) * progressRatio;
        
        // Update both progress and icon position in the same frame
        setAnimationProgress(newProgress);
        
        // Update the last progress ref to track the highest progress achieved
        lastProgressRef.current = Math.max(lastProgressRef.current, newProgress);
        
        // Debug: Log animation progress (only log occasionally to avoid spam)
        if (newProgress % 0.05 < 0.01) { // Log every 5% progress
          console.log('=== ANIMATION PROGRESS DEBUG ===', {
            elapsed,
            progressRatio,
            startProgress,
            newProgress,
            percentage: (newProgress * 100).toFixed(1) + '%',
            lastProgress: lastProgressRef.current
          });
        }
        
        // Debug: Log progress values
        if (newProgress >= 0.19 && newProgress <= 0.21) {
          console.log('=== TARGET PROGRESS DEBUG ===', {
            newProgress,
            percentage: (newProgress * 100).toFixed(1) + '%',
            hasReachedTarget
          });
        }
        
        // Show Takeoff label at 5% progress
        if (newProgress >= 0.05 && newProgress <= 0.06 && !showTakeoffLabel) {
          setShowTakeoffLabel(true);
        }
        
        // Show Climb label at 20% progress
        if (newProgress >= 0.20 && newProgress <= 0.21 && !showClimbLabel) {
          setShowClimbLabel(true);
        }
        
        // Pass animation progress to parent
        if (onAnimationProgress) {
          onAnimationProgress(newProgress);
        }
        
        // Don't show Cruise label during animation - only show after prompt submission
        
        // Show prompt bubble exactly at 20% progress
        if (newProgress >= 0.20 && newProgress <= 0.205 && !hasReachedTarget) {
          console.log('=== REACHED TARGET ===', {
            newProgress, 
            hasReachedTarget,
            exactProgress: (newProgress * 100).toFixed(1) + '%'
          });
          setHasReachedTarget(true);
        }
        
        // Calculate and update countdown timer based on animation progress
        if (onAnimationProgressChange) {
          const startMinutes = 185; // 3H 05M
          const endMinutes = 148;   // 2H 28M (20% progress)
          const currentMinutes = startMinutes - (newProgress * (startMinutes - endMinutes) / 0.2);
          onAnimationProgressChange(Math.round(currentMinutes));
        }
        
        if (progressRatio < 1) {
          requestAnimationFrame(animate);
        } else {
          // Animation has completed - flight icon has stopped
          console.log('=== ANIMATION COMPLETED ===', {
            finalProgress: newProgress,
            percentage: (newProgress * 100).toFixed(1) + '%'
          });
          
          // Show dummy mouse pointer first
          setTimeout(() => {
            setShowPointer(true);
          }, 500); // Reduced from 2000ms to 500ms
          
          // Show plus button after pointer appears
          setTimeout(() => {
            setShowPlusButton(true);
            
            // Show prompt bubble below the plus button after 1 second
            setTimeout(() => {
              setShowPromptBubble(true);
              setShowPlusButton(false); // Hide plus button when prompt bubble appears
              
              // Calculate position for prompt bubble below the plus button
              // Use target progress (20%) to ensure correct positioning
              const targetIconLeft = Math.max(0, Math.min(barWidth * targetProgress - 16, barWidth - 32));
              // Plus button is at targetIconLeft + 8, top: 48px
              // Position bubble 2px away from the plus button
              const bubbleX = targetIconLeft + 8 + 2; // 2px to the right of plus button
              const bubbleY = 48 + 32 + 10; // Plus button Y + button height + spacing
              
              console.log('=== PROMPT BUBBLE POSITION DEBUG ===', {
                iconLeft,
                targetIconLeft,
                plusButtonX: targetIconLeft + 8,
                plusButtonY: 48,
                bubbleX,
                bubbleY,
                animationProgress,
                barWidth,
                targetProgress
              });
              
              setPromptBubblePosition({ x: bubbleX, y: bubbleY });
            }, 1000); // Reduced from 2000ms to 1000ms
          }, 1000); // Reduced from 3000ms to 1000ms
        }
      };

      const animationId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animationId);
    };

    // Start animation after a delay to ensure DOM is ready
    const timer = setTimeout(startAnimation, 1000); // 1 second delay
    return () => clearTimeout(timer);
  }, [showMovingIcon, showTakeoffLabel, showCruiseLabel, showClimbLabel, hasReachedTarget]);

  // Animation when CLIMB phase is reached: move pointer to 2nd promo card and open tooltip
  useEffect(() => {
    if (!showClimbLabel || !showMovingIcon || isClimbPointerAnimating) return;
    
    // Wait a bit for CLIMB label to appear, then start animation
    const startAnimation = setTimeout(() => {
      setIsClimbPointerAnimating(true);
      
      // Calculate CLIMB position (20% of barWidth) - start position
      const climbPositionX = barWidth * 0.20;
      const climbPositionY = 48; // Below CLIMB label, same as plus button position
      
      // Calculate position for middle promo card (2nd card, index 1)
      // First, try to get the actual card element to calculate real position
      const selectors = [
        '#node-82_35815', // Middle card ID
        '[data-card-index="1"]',
        '.flex.flex-row.gap-8 > div:nth-child(2)',
        'div[style*="width: 416px"]:nth-child(2)'
      ];
      
      let middleCardElement = null;
      for (const selector of selectors) {
        middleCardElement = document.querySelector(selector);
        if (middleCardElement) break;
      }
      
      let targetX, targetY;
      
      if (middleCardElement && barRef.current) {
        // Get actual card position
        const cardRect = middleCardElement.getBoundingClientRect();
        const containerRect = barRef.current.getBoundingClientRect();
        
        // Calculate center of card relative to flight progress container
        const centerX = cardRect.left + cardRect.width / 2;
        const centerY = cardRect.top + cardRect.height / 2;
        
        targetX = centerX - containerRect.left;
        targetY = centerY - containerRect.top;
      } else {
        // Fallback calculation if card not found yet
        const containerWidth = 1302;
        const cardWidth = 416;
        const gap = 32;
        const totalCardsWidth = cardWidth * 3 + gap * 2;
        const startX = (containerWidth - totalCardsWidth) / 2;
        const middleCardX = startX + cardWidth + gap; // 2nd card position
        const middleCardY = 100; // Center of card height (200px / 2)
        const flightProgressHeight = 32;
        const gapBetweenFPSAndComponent3Cards = 32;
        
        targetX = middleCardX;
        targetY = flightProgressHeight + gapBetweenFPSAndComponent3Cards + middleCardY;
      }
      
      // Start pointer at CLIMB position
      setClimbPointerPosition({ x: climbPositionX, y: climbPositionY });
      setShowClimbPointer(true);
      setIsClimbPointerAnimating(true); // Enable animation state for smooth path following
      
      // Animate pointer following the red path: curve downward first, then move to card center
      const duration = 2000; // 2 seconds for realistic movement
      const startTime = Date.now();
      
      // Path follows red line: starts at CLIMB, curves downward, then moves right to card center
      // Control point 1: Curve downward (below CLIMB position)
      const control1X = climbPositionX; // Same X as start
      const control1Y = climbPositionY + 80; // Move down significantly
      
      // Control point 2: Move right toward card (before reaching card)
      const control2X = climbPositionX + (targetX - climbPositionX) * 0.6; // 60% of the way horizontally
      const control2Y = targetY - 20; // Slightly above target (card center)
      
      const animatePointer = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Linear progress for constant speed throughout (no easing)
        const t = progress;
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;
        const t2 = t * t;
        const t3 = t2 * t;
        
        // Cubic Bezier: (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
        const currentX = mt3 * climbPositionX + 
                         3 * mt2 * t * control1X + 
                         3 * mt * t2 * control2X + 
                         t3 * targetX;
        const currentY = mt3 * climbPositionY + 
                         3 * mt2 * t * control1Y + 
                         3 * mt * t2 * control2Y + 
                         t3 * targetY;
        
        setClimbPointerPosition({ x: currentX, y: currentY });
        
        if (progress < 1) {
          requestAnimationFrame(animatePointer);
        } else {
          // Animation complete - ensure we're exactly at center of card
          setClimbPointerPosition({ x: targetX, y: targetY });
          
          // Add click animation (brief scale down/up effect)
          setTimeout(() => {
            setIsClimbPointerClicking(true);
            
            // Find the 2nd promo card (middle card, index 1)
            const selectors = [
              '#node-82_35815', // Middle card ID
              '[data-card-index="1"]',
              '.flex.flex-row.gap-8 > div:nth-child(2)',
              'div[style*="width: 416px"]:nth-child(2)'
            ];
            
            let middleCardElement = null;
            for (const selector of selectors) {
              middleCardElement = document.querySelector(selector);
              if (middleCardElement) break;
            }
            
            if (middleCardElement) {
              const rect = middleCardElement.getBoundingClientRect();
              // Calculate exact center of the card
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;
              
              // Update pointer position to exact center
              const containerRect = barRef.current?.getBoundingClientRect();
              let cardClickX, cardClickY;
              if (containerRect) {
                cardClickX = centerX - containerRect.left;
                cardClickY = centerY - containerRect.top;
                setClimbPointerPosition({ x: cardClickX, y: cardClickY });
              }
              
              // Trigger click after brief animation at exact center
              setTimeout(() => {
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  clientX: centerX,
                  clientY: centerY
                });
                middleCardElement.dispatchEvent(clickEvent);
                
                // Reset click animation after click, but keep pointer visible
                setTimeout(() => {
                  setIsClimbPointerClicking(false);
                  // Keep pointer visible at card click position
                  setShowClimbPointer(true);
                  setClimbPointerPosition({ x: cardClickX, y: cardClickY });
                  
                  // Wait for prompt bubble to appear, then animate typing sequence
                  const waitForBubble = setInterval(() => {
                    const promptBubble = document.getElementById('locked-remix-panel');
                    const titleInput = document.getElementById('locked-tooltip-title');
                    const descInput = document.getElementById('locked-tooltip-desc');
                    
                    if (promptBubble && titleInput && descInput) {
                      clearInterval(waitForBubble);
                      
                      // Pointer is already visible at card click position
                      // Now start animation sequence: move from card click position to title input
                      animateTypingSequence(titleInput, descInput, barRef.current, { x: cardClickX, y: cardClickY });
                    }
                  }, 100);
                  
                  // Timeout after 3 seconds if bubble doesn't appear
                  setTimeout(() => clearInterval(waitForBubble), 3000);
                }, 200);
              }, 150); // Brief pause for click animation
            }
          }, 300); // Brief pause before click animation
        }
      };
      
      requestAnimationFrame(animatePointer);
    }, 500); // Wait 500ms after CLIMB label appears
    
    return () => clearTimeout(startAnimation);
  }, [showClimbLabel, showMovingIcon, barWidth, isClimbPointerAnimating]);

  // Manage pointer element via direct DOM manipulation to ensure it appears after tooltip/bubble
  useEffect(() => {
    if (!showClimbPointer || !showMovingIcon) {
      // Remove pointer when not needed
      if (pointerElementRef.current) {
        pointerElementRef.current.remove();
        pointerElementRef.current = null;
      }
      return;
    }

    // Create or update pointer element
    if (!pointerElementRef.current) {
      pointerElementRef.current = document.createElement('div');
      pointerElementRef.current.className = 'dummy-mouse-pointer';
      pointerElementRef.current.id = 'climb-dummy-pointer';
      // Append to body - this ensures it's added AFTER tooltip/bubble in DOM order
      document.body.appendChild(pointerElementRef.current);
    }

    // Update position and styles - useEffect already runs on position changes for smooth updates
    const containerRect = barRef.current?.getBoundingClientRect();
    const left = climbPointerPosition.x + (containerRect?.left || 0);
    const top = climbPointerPosition.y + (containerRect?.top || 0);
    const transform = `translate(-50%, -50%) ${isClimbPointerClicking ? 'scale(0.7)' : 'scale(1)'}`;
    // Disable transition during animation for smooth path following, only use for click animation
    const transition = isClimbPointerClicking ? 'transform 0.1s ease' : 'none';

    pointerElementRef.current.style.cssText = `
      position: fixed !important;
      left: ${left}px;
      top: ${top}px;
      z-index: 2147483647 !important;
      pointer-events: none;
      transform: ${transform};
      transition: ${transition};
      --cursor-svg-url: url(${process.env.PUBLIC_URL}/cursor-themer.svg);
    `;

    // Cleanup on unmount
    return () => {
      if (pointerElementRef.current) {
        pointerElementRef.current.remove();
        pointerElementRef.current = null;
      }
    };
  }, [showClimbPointer, showMovingIcon, climbPointerPosition.x, climbPointerPosition.y, isClimbPointerClicking, isClimbPointerAnimating]);

  // Animation sequence: move to prompt bubble, type "Perfume" in title and desc, then save
  const animateTypingSequence = (titleInput, descInput, container, startPosition) => {
    if (!titleInput || !descInput || !container) return;
    
    const containerRect = container.getBoundingClientRect();
    const inputRect = titleInput.getBoundingClientRect();
    
    // DEBUG: Log positions to understand the coordinate system
    console.log('=== POINTER POSITIONING DEBUG ===', {
      containerRect: { top: containerRect.top, left: containerRect.left },
      inputRect: { top: inputRect.top, left: inputRect.left, height: inputRect.height },
      promptBubble: document.getElementById('locked-remix-panel')?.getBoundingClientRect(),
      scrollY: window.pageYOffset || document.documentElement.scrollTop
    });
    
    // Calculate position of title input relative to container
    // The prompt bubble uses position:fixed, so inputRect is in viewport coordinates
    // We need to convert to container-relative coordinates
    // Account for scroll position: getBoundingClientRect() gives viewport coords, but we need container-relative
    const inputX = inputRect.left + inputRect.width / 2 - containerRect.left;
    // Position pointer at the top portion of the input field (not center) to appear above the text
    // Use top + 25% of height instead of center (50%) to position it higher
    // Both inputRect.top and containerRect.top are viewport coordinates, so subtraction gives relative position
    const inputY = inputRect.top + (inputRect.height * 0.25) - containerRect.top;
    
    console.log('=== CALCULATED POINTER POSITION ===', {
      inputX,
      inputY,
      calculatedFrom: {
        inputTop: inputRect.top,
        containerTop: containerRect.top,
        difference: inputRect.top - containerRect.top,
        inputHeight: inputRect.height,
        finalY: inputY
      }
    });
    
    // Move pointer to title input (slowly) - start from card click position, not CLIMB position
    const moveDuration = 1000; // 1 second to move to input
    const startX = startPosition ? startPosition.x : climbPointerPosition.x;
    const startY = startPosition ? startPosition.y : climbPointerPosition.y;
    
    // Set initial position to card click position
    setClimbPointerPosition({ x: startX, y: startY });
    setShowClimbPointer(true); // Ensure pointer is visible
    
    const moveStartTime = Date.now();
    
    const moveToInput = () => {
      const elapsed = Date.now() - moveStartTime;
      const progress = Math.min(elapsed / moveDuration, 1);
      
      const currentX = startX + (inputX - startX) * progress;
      const currentY = startY + (inputY - startY) * progress;
      
      setClimbPointerPosition({ x: currentX, y: currentY });
      
      if (progress < 1) {
        requestAnimationFrame(moveToInput);
      } else {
        // At input field - click on it
        setClimbPointerPosition({ x: inputX, y: inputY });
        
        setTimeout(() => {
          setIsClimbPointerClicking(true);
          
            // Focus and select all text in the input
          titleInput.focus();
          
          // Make cursor visible during typing
          titleInput.style.caretColor = 'auto';
          
          // Select all text
          const range = document.createRange();
          range.selectNodeContents(titleInput);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          
          // Reset click animation
          setTimeout(() => {
            setIsClimbPointerClicking(false);
            
            // Get current text (should be "Offers" or similar)
            const currentText = titleInput.innerText || titleInput.textContent || '';
            
            // Delete text character by character (backspace simulation)
            let textToDelete = currentText;
            let deleteIndex = textToDelete.length;
            const deleteDelay = 100; // 100ms per character
            
            const deleteText = () => {
              if (deleteIndex > 0) {
                // Simulate backspace
                const newText = textToDelete.slice(0, deleteIndex - 1);
                titleInput.innerText = newText;
                titleInput.textContent = newText;
                
                // Position cursor at the end of remaining text
                titleInput.focus();
                const range = document.createRange();
                const selection = window.getSelection();
                range.selectNodeContents(titleInput);
                range.collapse(false); // Collapse to end
                selection.removeAllRanges();
                selection.addRange(range);
                
                // Trigger input event
                const inputEvent = new InputEvent('input', {
                  bubbles: true,
                  cancelable: true,
                  inputType: 'deleteContentBackward'
                });
                titleInput.dispatchEvent(inputEvent);
                
                deleteIndex--;
                setTimeout(deleteText, deleteDelay);
              } else {
                // All text deleted, now type "Perfume"
                const textToType = 'Perfume';
                let typeIndex = 0;
                const typeDelay = 150; // 150ms per character
                
                const typeText = () => {
                  if (typeIndex < textToType.length) {
                    const char = textToType[typeIndex];
                    const currentText = titleInput.innerText || '';
                    titleInput.innerText = currentText + char;
                    titleInput.textContent = currentText + char;
                    
                    // Position cursor at the end of the text (after the newly typed character)
                    titleInput.focus();
                    const range = document.createRange();
                    const selection = window.getSelection();
                    range.selectNodeContents(titleInput);
                    range.collapse(false); // Collapse to end
                    selection.removeAllRanges();
                    selection.addRange(range);
                    
                    // Trigger input event
                    const inputEvent = new InputEvent('input', {
                      bubbles: true,
                      cancelable: true,
                      inputType: 'insertText',
                      data: char
                    });
                    titleInput.dispatchEvent(inputEvent);
                    
                    typeIndex++;
                    setTimeout(typeText, typeDelay);
                  } else {
                    // Title typing complete, now move to description field and type "perfume"
                    const descRect = descInput.getBoundingClientRect();
                    const descX = descRect.left + descRect.width / 2 - containerRect.left;
                    const descY = descRect.top + descRect.height / 2 - containerRect.top;
                    
                    // Move to description field
                    const descMoveDuration = 800; // 0.8 seconds
                    const descStartX = inputX;
                    const descStartY = inputY;
                    const descMoveStartTime = Date.now();
                    
                    const moveToDesc = () => {
                      const elapsed = Date.now() - descMoveStartTime;
                      const progress = Math.min(elapsed / descMoveDuration, 1);
                      
                      const currentX = descStartX + (descX - descStartX) * progress;
                      const currentY = descStartY + (descY - descStartY) * progress;
                      
                      setClimbPointerPosition({ x: currentX, y: currentY });
                      
                      if (progress < 1) {
                        requestAnimationFrame(moveToDesc);
                      } else {
                        // At description field - click on it
                        setClimbPointerPosition({ x: descX, y: descY });
                        
                        setTimeout(() => {
                          setIsClimbPointerClicking(true);
                          
                          // Focus and clear description input
                          descInput.focus();
                          
                          // Make cursor visible during typing
                          descInput.style.caretColor = 'auto';
                          
                          // Clear existing text
                          descInput.innerText = '';
                          descInput.textContent = '';
                          
                          // Reset click animation
                          setTimeout(() => {
                            setIsClimbPointerClicking(false);
                            
                            // Type "perfume" in description field
                            const descTextToType = 'perfume';
                            let descTypeIndex = 0;
                            const descTypeDelay = 150; // 150ms per character
                            
                            const typeDescText = () => {
                              if (descTypeIndex < descTextToType.length) {
                                const char = descTextToType[descTypeIndex];
                                const currentDescText = descInput.innerText || '';
                                descInput.innerText = currentDescText + char;
                                descInput.textContent = currentDescText + char;
                                
                                // Position cursor at the end of the text (after the newly typed character)
                                descInput.focus();
                                const range = document.createRange();
                                const selection = window.getSelection();
                                range.selectNodeContents(descInput);
                                range.collapse(false); // Collapse to end
                                selection.removeAllRanges();
                                selection.addRange(range);
                                
                                // Trigger input event
                                const inputEvent = new InputEvent('input', {
                                  bubbles: true,
                                  cancelable: true,
                                  inputType: 'insertText',
                                  data: char
                                });
                                descInput.dispatchEvent(inputEvent);
                                
                                descTypeIndex++;
                                setTimeout(typeDescText, descTypeDelay);
                              } else {
                                // Description typing complete, move to save button
                                const saveButton = document.getElementById('locked-tooltip-save');
                                if (saveButton) {
                                  const saveRect = saveButton.getBoundingClientRect();
                                  const saveX = saveRect.left + saveRect.width / 2 - containerRect.left;
                                  const saveY = saveRect.top + saveRect.height / 2 - containerRect.top;
                                  
                                  // Move to save button
                                  const saveMoveDuration = 800; // 0.8 seconds
                                  const saveStartX = descX;
                                  const saveStartY = descY;
                                  const saveMoveStartTime = Date.now();
                                  
                                  const moveToSave = () => {
                                    const elapsed = Date.now() - saveMoveStartTime;
                                    const progress = Math.min(elapsed / saveMoveDuration, 1);
                                    
                                    const currentX = saveStartX + (saveX - saveStartX) * progress;
                                    const currentY = saveStartY + (saveY - saveStartY) * progress;
                                    
                                    setClimbPointerPosition({ x: currentX, y: currentY });
                                    
                                    if (progress < 1) {
                                      requestAnimationFrame(moveToSave);
                                    } else {
                                      // At save button - ensure pointer is at exact center
                                      setClimbPointerPosition({ x: saveX, y: saveY });
                                      
                                      // Brief pause to show pointer at save button
                                      setTimeout(() => {
                                        setIsClimbPointerClicking(true);
                                        
                                        // Brief pause to show click animation
                                        setTimeout(() => {
                                          // Click save button to trigger save operation
                                          const saveClickEvent = new MouseEvent('click', {
                                            bubbles: true,
                                            cancelable: true,
                                            view: window,
                                            clientX: saveRect.left + saveRect.width / 2,
                                            clientY: saveRect.top + saveRect.height / 2
                                          });
                                          
                                          // Dispatch the click event to trigger save
                                          saveButton.dispatchEvent(saveClickEvent);
                                          
                                          // Also try direct click if event doesn't work
                                          if (typeof saveButton.click === 'function') {
                                            saveButton.click();
                                          }
                                          
                                          // Reset click animation but keep pointer visible to show save operation
                                          setTimeout(() => {
                                            setIsClimbPointerClicking(false);
                                            // Keep pointer visible longer to show save operation started
                                            setTimeout(() => {
                                              setShowClimbPointer(false);
                                            }, 800); // Hide after 800ms to show save operation
                                          }, 300);
                                        }, 200); // Show click animation for 200ms
                                      }, 200); // Pause before clicking
                                    }
                                  };
                                  
                                  requestAnimationFrame(moveToSave);
                                }
                              }
                            };
                            
                            setTimeout(typeDescText, 200); // Brief pause before typing description
                          }, 200);
                        }, 150);
                      }
                    };
                    
                    requestAnimationFrame(moveToDesc);
                  }
                };
                
                setTimeout(typeText, 200); // Brief pause before typing
              }
            };
            
            setTimeout(deleteText, 200); // Brief pause before deleting
          }, 200);
        }, 150);
      }
    };
    
    requestAnimationFrame(moveToInput);
  };

  // Drag logic (only start drag from icon)
  const handleIconMouseDown = (e) => {
    if (showMovingIcon) return; // Disable dragging when showing moving icon
    setDragging(true);
    e.preventDefault();
    e.stopPropagation();
  };
  const handleIconMouseLeave = () => {
    if (dragging) setDragging(false);
  };
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (dragging && barRef.current) {
        const barRect = barRef.current.getBoundingClientRect();
        const offsetX = e.clientX - barRect.left;
        const newProgress = Math.max(0, Math.min(1, offsetX / barWidth));
        const newMinutes = Math.round(maxFlightMinutes * (1 - newProgress));
        if (typeof onProgressChange === 'function') {
          onProgressChange(newMinutes);
        }
      }
    };

    const handleMouseUp = () => {
      if (dragging) {
        setDragging(false);
      }
    };

    if (dragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, maxFlightMinutes, onProgressChange]);

  const handleBarClick = (e) => {
    if (dragging || showMovingIcon) return;
    
    const barRect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - barRect.left;
    const newProgress = Math.max(0, Math.min(1, offsetX / barWidth));
    const newMinutes = Math.round(maxFlightMinutes * (1 - newProgress));
    
    if (typeof onProgressChange === 'function') {
      onProgressChange(newMinutes);
    }
    
  };

  const handlePromptBubbleClose = () => {
    setShowPromptBubble(false);
  };

  const handlePromoCardLoadingChange = (isLoading) => {
    setPromoCardLoading(isLoading);
    if (onPromoCardLoadingChange) {
      onPromoCardLoadingChange(isLoading);
    }
  };

  const handlePromoCardVisibilityChange = (isVisible) => {
    if (onPromoCardLoadingChange) {
      // Notify parent that the prompt bubble is visible (this will trigger showing the croissant image)
      onPromoCardLoadingChange(!isVisible); // Pass false to indicate loading is finished
    }
    
    // If the prompt bubble becomes visible, schedule the next steps
    if (isVisible) {
      // After 2 seconds, close the prompt bubble and move pointer to 2nd tile
      setTimeout(() => {
        setShowPromptBubbleAtCard(false);
        
        // Calculate position for 2nd tile in "Recommended for you" section
        // The 2nd tile is in a 4-column grid with gap-6 (24px gap)
        // Each tile takes 1/4 of the width minus the gaps
        const containerWidth = 1302;
        const tileWidth = (containerWidth - 72) / 4; // 72px = 3 gaps of 24px each
        const gap = 24;
        
        // Position of 2nd tile (index 1)
        const secondTileX = gap + tileWidth + gap; // First gap + first tile + second gap
        const secondTileY = 184 / 2; // Center of tile height
        
        // Convert to absolute position relative to the flight progress bar container
        // Component3Cards is positioned below the flight progress bar with gap: 32
        // "Recommended for you" section is below Component3Cards with gap: 24
        const flightProgressHeight = 32; // Height of flight progress bar
        const gapBetweenComponents = 32; // Gap between flight progress and Component3Cards
        const component3CardsHeight = 200; // Height of Component3Cards
        const gapToRecommended = 24; // Gap between Component3Cards and "Recommended for you"
        const recommendedTitleHeight = 28; // Height of "Recommended for you" title
        
        setSecondTilePosition({ 
          x: secondTileX, 
          y: flightProgressHeight + gapBetweenComponents + component3CardsHeight + gapToRecommended + recommendedTitleHeight + secondTileY 
        });
        
        // Move pointer to 2nd tile after a short delay
        setTimeout(() => {
          setMovePointerToCard(false); // Hide pointer at promo card
          setMovePointerToSecondTile(true);
        }, 500);
      }, 2000); // 2 seconds after prompt bubble appears
    }
  };

  const handlePromptBubbleSubmit = (promptText, elementType, elementData, positionKey) => {
    // Handle the prompt submission for landing page demo
    console.log('=== PROMPT SUBMISSION DEBUG ===', {
      submitted: promptText,
      expected: "Cruise",
      isMatch: promptText === "Cruise",
      trimmed: promptText.trim(),
      trimmedMatch: promptText.trim() === "Cruise"
    });
    
    // Show the Cruise label below the flight icon
    if (promptText.trim() === "Cruise") {
      setShowCruiseLabel(true);
      setShowPromptBubble(false); // Close prompt bubble immediately
      
      // Notify parent that Cruise label has appeared
      if (onCruiseLabelShow) {
        onCruiseLabelShow(true);
      }
      
      // Move cursor to middle promo card after a short delay
      setTimeout(() => {
        // Calculate position for middle promo card (Component3Cards)
        // Component3Cards is positioned below the flight progress bar with gap: 32
        // The middle card is the 2nd card (index 1) in a 3-card layout with gap-8 (32px gap)
        const containerWidth = 1302;
        const cardWidth = 416;
        const gap = 32;
        const totalCardsWidth = cardWidth * 3 + gap * 2; // 3 cards + 2 gaps
        const startX = (containerWidth - totalCardsWidth) / 2; // Center the cards
        
        // Position of middle card (index 1)
        const middleCardX = startX + cardWidth + gap; // First card + gap
        const middleCardY = 100; // Center of card height (200px / 2)
        
        // Position relative to the flight progress bar container (same as dummy mouse pointer)
        // Component3Cards is positioned below the flight progress bar with gap: 32
        const flightProgressHeight = 32; // Height of flight progress bar
        const gapBetweenFPSAndComponent3Cards = 32; // Gap between FPS and Component3Cards
        
        setMiddleCardPosition({ 
          x: middleCardX, 
          y: flightProgressHeight + gapBetweenFPSAndComponent3Cards + middleCardY 
        });
        
        // Hide pointer at flight icon and move to middle card
        setShowPointer(false);
        setMovePointerToMiddleCard(true);
        
        // Show plus button at middle card after cursor moves
        setTimeout(() => {
          setShowPlusButtonAtMiddleCard(true);
          
          // Show prompt bubble at middle card after 1 second
          setTimeout(() => {
            setShowPlusButtonAtMiddleCard(false); // Hide plus button
            
            // Trigger prompt bubble to appear on the actual middle card
            
            // Try multiple selectors to find the middle card
            const selectors = [
              '[data-name="autumn meal"]',
              '[data-name="3-cards"] > div:nth-child(2)', 
              '.flex.flex-row.gap-8 > div:nth-child(2)',
              'div[style*="width: 416px"]:nth-child(2)'
            ];
            
            let middleCardElement = null;
            let usedSelector = '';
            
            for (const selector of selectors) {
              middleCardElement = document.querySelector(selector);
              if (middleCardElement) {
                usedSelector = selector;
                break;
              }
            }
            
            if (middleCardElement) {
              const rect = middleCardElement.getBoundingClientRect();
              console.log('=== MIDDLE CARD CLICK DEBUG ===', {
                usedSelector, 
                rect,
                element: middleCardElement
              });
              
              // Create and dispatch a click event
              const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
              });
              
              console.log('=== DISPATCHING CLICK EVENT ===', {
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
              });
              
              middleCardElement.dispatchEvent(clickEvent);
            } else {
              console.error('Middle card element not found with any selector');
              document.querySelectorAll('[data-name="3-cards"] > div').forEach((el, i) => {
                console.log(`Card ${i}:`, el);
              });
            }
          }, 1000);
        }, 300);
      }, 1000); // 1 second delay after Cruise label appears
      
      // Animation ends here - no more interactions with promo cards
    } else {
    }
  };

  return (
    <div 
      className="flight-progress-bar-container"
      ref={barRef} 
      onClick={handleBarClick}
      style={{ overflow: 'visible', height: 'auto', minHeight: '32px' }}
    >
      <div className="flight-path"></div>
      <div className="flight-progress" style={{ 
        width: `${progressWidth}px`, 
        background: getDarkerProgressColor(),
        opacity: 1,
        // Ensure minimum contrast - if theme color is very light, use a darker fallback
        filter: themeColor.includes('gradient') ? 'none' : (themeColor && themeColor.toLowerCase() !== '#ffffff' && themeColor.toLowerCase() !== '#fff' ? 'none' : 'brightness(0.2)'),
        // Ensure minimum width for visibility when animating
        minWidth: showMovingIcon ? '4px' : '0px'
      }}></div>
      <div
        className={`flight-progress-icon ${showMovingIcon ? 'moving-icon' : ''} ${hasReachedTarget ? 'reached-target' : ''}`}
        ref={iconRef}
        style={{ 
          left: `${iconLeft}px`, 
          cursor: showMovingIcon ? 'default' : 'pointer', 
          background: getElementColor(), 
          borderColor: getElementColor(),
          opacity: 1,
          // Ensure minimum contrast for the icon as well
          filter: themeColor.includes('gradient') ? 'none' : (themeColor && themeColor.toLowerCase() !== '#ffffff' && themeColor.toLowerCase() !== '#fff' ? 'none' : 'brightness(0.2)'),
          // Ensure icon is visible even at start position
          visibility: showMovingIcon && iconLeft < 0 ? 'hidden' : 'visible'
        }}
        onMouseDown={handleIconMouseDown}
        onMouseLeave={(e) => {
          handleIconMouseLeave();
          if (isPromptMode && onPromptHover) {
            onPromptHover(false, 'flight-icon', { progress, minutesLeft: displayMinutes }, { x: e.clientX, y: e.clientY });
          }
        }}
        onMouseEnter={(e) => {
          if (isPromptMode && onPromptHover) {
            onPromptHover(true, 'flight-icon', { progress, minutesLeft: displayMinutes }, { x: e.clientX, y: e.clientY });
          }
        }}
        onMouseMove={(e) => {
          if (isPromptMode && onPromptHover) {
            onPromptHover(true, 'flight-icon', { progress, minutesLeft: displayMinutes }, { x: e.clientX, y: e.clientY });
          }
        }}
        onClick={(e) => {
          if (isPromptMode && onPromptClick) {
            e.stopPropagation();
            onPromptClick('flight-icon', { progress, minutesLeft: displayMinutes }, { x: e.clientX, y: e.clientY });
          }
        }}
      >
        {/* Inline SVG for flight icon */}
        <svg width="23" height="22" viewBox="0 0 23 22" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            {themeColor.includes('gradient') && (
              <linearGradient id="flightIconGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{stopColor: themeColor.match(/#([0-9a-fA-F]{6})/)?.[1] ? `#${themeColor.match(/#([0-9a-fA-F]{6})/)[1]}` : '#000000'}} />
                <stop offset="100%" style={{stopColor: themeColor.match(/#([0-9a-fA-F]{6})/g)?.[1] ? themeColor.match(/#([0-9a-fA-F]{6})/g)[1] : '#000000'}} />
              </linearGradient>
            )}
          </defs>
          <path d="M5.38928 1.85868C4.90331 0.817318 6.26994 -0.0872904 7.0387 0.766884L14.2535 8.78446H18.2301C18.4449 8.7845 18.6582 8.81911 18.8619 8.887L21.7086 9.83524C22.62 10.1392 22.6198 11.4286 21.7086 11.7327L18.8619 12.6819C18.6582 12.7498 18.4448 12.7844 18.2301 12.7845H14.2535L7.0387 20.802C6.26994 21.6562 4.90331 20.7516 5.38928 19.7102L8.70081 12.6136L4.45764 11.7649C4.18241 11.7099 3.97824 11.5673 3.84436 11.3831L2.49866 15.2308C2.12666 16.2933 0.554321 16.0255 0.554321 14.8997V6.66825C0.554625 5.54267 2.12677 5.27563 2.49866 6.33817L3.84436 10.1849C3.97825 10.0009 4.18265 9.85899 4.45764 9.80399L8.70081 8.95438L5.38928 1.85868Z" fill={themeColor.includes('gradient') ? 'url(#flightIconGradient)' : onColor}/>
        </svg>
      </div>
      
      {/* Plus button below flight icon - DISABLED */}
      {false && showPlusButton && showMovingIcon && !showPromptBubble && (
        <div 
          className="landing-plus-button"
          style={{
            position: 'absolute',
            left: `${iconLeft + 8}px`,
            top: '48px',
            zIndex: 15,
            pointerEvents: 'none'
          }}
        >
          <div 
            className="plus-button-inner"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '16px',
              backgroundColor: themeColor,
              border: '2px solid white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
              animation: 'plus-button-appear 0.5s ease-out'
            }}
          >
            <span 
              className="plus-icon"
              style={{
                color: 'white',
                fontSize: '16px',
                fontWeight: 'bold',
                lineHeight: '1'
              }}
            >
              +
            </span>
          </div>
        </div>
      )}
      
      {/* Dummy mouse pointer - DISABLED */}
      {false && showPointer && showMovingIcon && !movePointerToCard && !movePointerToSecondTile && (
        <div 
          className="dummy-mouse-pointer"
          style={{
            position: 'absolute',
            left: `${iconLeft + 16}px`,
            top: '48px', // Position below the flight icon (same as plus button)
            zIndex: 20, // Higher z-index to appear above plus button
            pointerEvents: 'none'
          }}
        >
        </div>
      )}
      
      {/* Dummy mouse pointer at promo card position */}
      {/* {movePointerToCard && showMovingIcon && (
        <div 
          className="dummy-mouse-pointer"
          style={{
            position: 'absolute',
            left: `${pointerCardPosition.x}px`,
            top: `${pointerCardPosition.y}px`,
            zIndex: 20,
            pointerEvents: 'none'
          }}
        >
        </div>
      )} */}
      
      {/* Dummy mouse pointer at 2nd tile position */}
      {/* {movePointerToSecondTile && showMovingIcon && (
        <div 
          className="dummy-mouse-pointer"
          style={{
            position: 'absolute',
            left: `${secondTilePosition.x}px`,
            top: `${secondTilePosition.y}px`,
            zIndex: 20,
            pointerEvents: 'none'
          }}
        >
        </div>
      )} */}
      
      {/* Dummy mouse pointer at middle promo card position */}
      {movePointerToMiddleCard && showMovingIcon && (
        <div 
          className="dummy-mouse-pointer"
          style={{
            position: 'absolute',
            left: `${middleCardPosition.x}px`,
            top: `${middleCardPosition.y}px`,
            zIndex: 20,
            pointerEvents: 'none'
          }}
        >
        </div>
      )}
      
      {/* Dummy mouse pointer for CLIMB animation - moves from CLIMB position to 2nd promo card */}
      {/* Render pointer via portal to document.body to ensure it's above prompt bubble */}
      {/* Pointer is managed via useEffect for DOM order control */}
      
      {/* Plus button at middle promo card position */}
      {showPlusButtonAtMiddleCard && showMovingIcon && (
        <div 
          className="landing-plus-button"
          style={{
            position: 'absolute',
            left: `${middleCardPosition.x + 8}px`,
            top: `${middleCardPosition.y + 8}px`,
            zIndex: 25,
            pointerEvents: 'none'
          }}
        >
          <div 
            className="plus-button-inner"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '16px',
              backgroundColor: themeColor,
              border: '2px solid white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
              animation: 'plus-button-appear 0.5s ease-out'
            }}
          >
            <span 
              className="plus-icon"
              style={{
                color: 'white',
                fontSize: '16px',
                fontWeight: 'bold',
              }}>
              +
            </span>
          </div>
        </div>
      )}

      {/* Dummy mouse pointer at FJB position */}
      {movePointerToFJB && showMovingIcon && (
        <div 
          className="dummy-mouse-pointer"
          style={{
            position: 'absolute',
            left: `${barWidth / 2}px`, // Center of the flight progress bar
            top: '-12px', // Position much higher above the flight progress bar
            zIndex: 20,
            pointerEvents: 'none',
            transform: 'translateX(-50%)' // Center the pointer horizontally
          }}
        >
        </div>
      )}

      {/* Plus button at FJB position */}
      {showPlusButtonAtFJB && showMovingIcon && (
        <div 
          className="landing-plus-button"
          style={{
            position: 'absolute',
            left: `${barWidth / 2 + 20}px`, // Position to the right of the dummy pointer
            top: '-12px',
            zIndex: 25,
            pointerEvents: 'none'
          }}
        >
          <div 
            className="plus-button-inner"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '16px',
              backgroundColor: themeColor,
              border: '2px solid white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
              animation: 'plus-button-appear 0.5s ease-out'
            }}
          >
            <span 
              className="plus-icon"
              style={{
                color: 'white',
                fontSize: '16px',
                fontWeight: 'bold',
              }}>
              +
            </span>
          </div>
        </div>
      )}


      
      {/* Takeoff Label - Sticky at 5% position */}
      {showTakeoffLabel && (
        <div 
          className="flight-prompt-label"
          style={{
            position: 'absolute',
            left: `${barWidth * 0.05}px`, // 5% position
            top: '40px',
            ...(themeColor.includes('gradient') 
              ? { background: themeColor, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }
              : { color: onColor }
            ),
            fontSize: '10px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            zIndex: 10,
            transform: 'translateX(-50%)' // Center the label text
          }}
        >
          TAKEOFF
        </div>
      )}
      
      {/* Takeoff Position Dot */}
      {showTakeoffLabel && (
        <div 
          className="flight-progress-dot"
          style={{
            position: 'absolute',
            left: `${barWidth * 0.05}px`, // 5% position
            top: '14px', // Center of the progress bar (adjusted for larger size)
            width: '12px',
            height: '12px',
            backgroundColor: getElementColor(),
            borderRadius: '50%',
            zIndex: 1,
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
            transform: 'translateX(-50%)' // Center the dot
          }}
        />
      )}
      

      
      {/* Climb Label - Fixed at 20% position */}
      {showClimbLabel && (
        <div 
          className="flight-prompt-label"
          style={{
            position: 'absolute',
            left: `${barWidth * 0.20}px`, // Fixed 20% position
            top: '40px', // Same spacing as Takeoff label
            ...(themeColor.includes('gradient') 
              ? { background: themeColor, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }
              : { color: onColor }
            ),
            fontSize: '10px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            zIndex: 10,
            animation: 'label-appear 0.5s ease-out',
            transform: 'translateX(-50%)', // Center the label text
            transition: 'none' // Ensure no CSS transitions affect positioning
          }}
        >
          CLIMB
        </div>
      )}
      
      {/* Climb Position Dot */}
      {showClimbLabel && (
        <div 
          className="flight-progress-dot"
          style={{
            position: 'absolute',
            left: `${barWidth * 0.20}px`, // Fixed 20% position
            top: '14px', // Center of the progress bar (same as Takeoff dot)
            width: '12px',
            height: '12px',
            backgroundColor: getElementColor(),
            borderRadius: '50%',
            zIndex: 1,
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
            transform: 'translateX(-50%)', // Center the dot
            transition: 'none' // Ensure no CSS transitions affect positioning
          }}
        />
      )}
      
      {/* Cruise Label - Fixed at 20% position (kept for backward compatibility) */}
      {showCruiseLabel && (
        <div 
          className="flight-prompt-label"
          style={{
            position: 'absolute',
            left: `${barWidth * 0.20}px`, // Fixed 20% position
            top: '40px', // Same spacing as Takeoff label
            ...(themeColor.includes('gradient') 
              ? { background: themeColor, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }
              : { color: onColor }
            ),
            fontSize: '10px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            zIndex: 10,
            animation: 'label-appear 0.5s ease-out',
            transform: 'translateX(-50%)', // Center the label text
            transition: 'none' // Ensure no CSS transitions affect positioning
          }}
        >
          CRUISE
        </div>
      )}
      
      {/* Cruise Position Dot */}
      {showCruiseLabel && (
        <div 
          className="flight-progress-dot"
          style={{
            position: 'absolute',
            left: `${barWidth * 0.20}px`, // Fixed 20% position
            top: '14px', // Center of the progress bar (same as Takeoff dot)
            width: '12px',
            height: '12px',
            backgroundColor: getElementColor(),
            borderRadius: '50%',
            zIndex: 1,
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
            transform: 'translateX(-50%)', // Center the dot
            transition: 'none' // Ensure no CSS transitions affect positioning
          }}
        />
      )}
      
      {/* Flight Phase Labels - Show when flights are generated */}
      {showFlightPhases && (
        <>
          {/* Takeoff - 5% */}
          <div 
            className="flight-phase-label"
            style={{
              position: 'absolute',
              left: `${barWidth * 0.05}px`,
              top: '40px',
              color: selectedFlightPhase === 'takeoff' 
                ? (themeColor.includes('gradient') ? undefined : getElementColor())
                : onColor,
              ...(selectedFlightPhase === 'takeoff' && themeColor.includes('gradient') 
                ? { 
                    background: themeColor, 
                    WebkitBackgroundClip: 'text', 
                    WebkitTextFillColor: 'transparent', 
                    backgroundClip: 'text' 
                  }
                : {}
              ),
              fontSize: '10px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              zIndex: 10,
              transform: 'translateX(-50%)',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '12px',
              backgroundColor: selectedFlightPhase === 'takeoff' 
                ? (themeColor.includes('gradient') ? '#FFFFFF' : getReadableOnColor(themeColor))
                : 'transparent',
              border: `1px solid ${onColor}`,
              transition: 'all 0.2s ease'
            }}
            onClick={() => handleFlightPhaseClick('takeoff')}
          >
            TAKEOFF
          </div>
          
          {/* Climb - 20% */}
          <div 
            className="flight-phase-label"
            style={{
              position: 'absolute',
              left: `${barWidth * 0.20}px`,
              top: '40px',
              color: selectedFlightPhase === 'climb' 
                ? (themeColor.includes('gradient') ? undefined : getElementColor())
                : onColor,
              ...(selectedFlightPhase === 'climb' && themeColor.includes('gradient') 
                ? { 
                    background: themeColor, 
                    WebkitBackgroundClip: 'text', 
                    WebkitTextFillColor: 'transparent', 
                    backgroundClip: 'text' 
                  }
                : {}
              ),
              fontSize: '10px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              zIndex: 10,
              transform: 'translateX(-50%)',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '12px',
              backgroundColor: selectedFlightPhase === 'climb' 
                ? (themeColor.includes('gradient') ? '#FFFFFF' : getReadableOnColor(themeColor))
                : 'transparent',
              border: `1px solid ${onColor}`,
              transition: 'all 0.2s ease'
            }}
            onClick={() => handleFlightPhaseClick('climb')}
          >
            CLIMB
          </div>
          
          {/* Cruise - 35% */}
          <div 
            className="flightPhase-label"
            style={{
              position: 'absolute',
              left: `${barWidth * 0.35}px`,
              top: '40px',
              color: selectedFlightPhase === 'cruise' 
                ? (themeColor.includes('gradient') ? undefined : getElementColor())
                : onColor,
              ...(selectedFlightPhase === 'cruise' && themeColor.includes('gradient') 
                ? { 
                    background: themeColor, 
                    WebkitBackgroundClip: 'text', 
                    WebkitTextFillColor: 'transparent', 
                    backgroundClip: 'text' 
                  }
                : {}
              ),
              fontSize: '10px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              zIndex: 10,
              transform: 'translateX(-50%)',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '12px',
              backgroundColor: selectedFlightPhase === 'cruise' 
                ? (themeColor.includes('gradient') ? '#FFFFFF' : getReadableOnColor(themeColor))
                : 'transparent',
              border: `1px solid ${onColor}`,
              transition: 'all 0.2s ease'
            }}
            onClick={() => handleFlightPhaseClick('cruise')}
          >
            CRUISE
          </div>
          
          {/* Descent - 75% */}
          <div 
            className="flight-phase-label"
            style={{
              position: 'absolute',
              left: `${barWidth * 0.75}px`,
              top: '40px',
              color: selectedFlightPhase === 'descent' 
                ? (themeColor.includes('gradient') ? undefined : getElementColor())
                : onColor,
              ...(selectedFlightPhase === 'descent' && themeColor.includes('gradient') 
                ? { 
                    background: themeColor, 
                    WebkitBackgroundClip: 'text', 
                    WebkitTextFillColor: 'transparent', 
                    backgroundClip: 'text' 
                  }
                : {}
              ),
              fontSize: '10px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              zIndex: 10,
              transform: 'translateX(-50%)',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '12px',
              backgroundColor: selectedFlightPhase === 'descent' 
                ? (themeColor.includes('gradient') ? '#FFFFFF' : getReadableOnColor(themeColor))
                : 'transparent',
              border: `1px solid ${onColor}`,
              transition: 'all 0.2s ease'
            }}
            onClick={() => handleFlightPhaseClick('descent')}
          >
            DESCENT
          </div>
          
          {/* Landing - 88% */}
          <div 
            className="flight-phase-label"
            style={{
              position: 'absolute',
              left: `${barWidth * 0.88}px`,
              top: '40px',
              color: selectedFlightPhase === 'landing' 
                ? (themeColor.includes('gradient') ? undefined : getElementColor())
                : onColor,
              ...(selectedFlightPhase === 'landing' && themeColor.includes('gradient') 
                ? { 
                    background: themeColor, 
                    WebkitBackgroundClip: 'text', 
                    WebkitTextFillColor: 'transparent', 
                    backgroundClip: 'text' 
                  }
                : {}
              ),
              fontSize: '10px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              zIndex: 10,
              transform: 'translateX(-50%)',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '12px',
              backgroundColor: selectedFlightPhase === 'landing' 
                ? (themeColor.includes('gradient') ? '#FFFFFF' : getReadableOnColor(themeColor))
                : 'transparent',
              border: `1px solid ${onColor}`,
              transition: 'all 0.2s ease'
            }}
            onClick={() => handleFlightPhaseClick('landing')}
          >
            LANDING
          </div>
        </>
      )}
      
      
      {/* Display ALL prompts at their FIXED positions */}
      {Object.entries(fpsPrompts).map(([positionKey, promptText]) => {
        if (!positionKey.startsWith('fps-')) return null;
        
        // Extract progress from position key
        const promptProgress = parseInt(positionKey.replace('fps-', '')) / 1000;
        const promptLeft = Math.max(0, Math.min(barWidth * promptProgress - 16, barWidth - 32));
        
        return (
          <div
            key={positionKey}
            className="flight-prompt-label"
            style={{
              position: 'absolute',
              left: `${promptLeft + 8}px`, // Fixed position based on original progress
              top: '40px',
              color: onColor,
              fontSize: '10px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              zIndex: 10
            }}
          >
            {promptText}
          </div>
        );
      })}
    </div>
  );
} 