import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getReadableOnColor } from '../utils/color';
import FlightJourneyBar from './FlightJourneyBar';
import FlightProgress from './FlightProgress';
import Component3Cards from './Component3Cards';
import PromptBubble from './PromptBubble';
import { getPollinationsImage } from '../utils/unsplash';

// Helper function to generate AI images for content cards


export default function LandingPage() {
  const navigate = useNavigate();
  
  
  // Mock data for the theme preview
  const mockOrigin = { airport: { city: 'Berlin', code: 'BER' } };
  const mockDestination = { airport: { city: 'Paris', code: 'CDG' } };
  const mockRoutes = [mockOrigin, mockDestination];
  
  // Countdown state for landing time
  const maxFlightMinutes = 185; // 3h 05m
  const [minutesLeft, setMinutesLeft] = useState(maxFlightMinutes);
  const timerRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [showMovingIcon, setShowMovingIcon] = useState(true); // Start with animation
  const [promoCardLoading, setPromoCardLoading] = useState(false);
  const [promoCardFinishedLoading, setPromoCardFinishedLoading] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);
  // Theme colors for landing page: brand blue, Paris, Berlin, Oktoberfest (FJB demo chips)
  const themeColors = [
    '#2563eb',  // Brand blue (initial)
    '#FF6B6B',  // Paris (coral-red)
    '#45B7D1',  // Berlin (teal)
    '#FCD34D'   // Oktoberfest (yellow)
  ];
  
  const [cruiseLabelShown, setCruiseLabelShown] = useState(false);
  const [middleCardPromptClosed, setMiddleCardPromptClosed] = useState(false);
  const [showMiddleCardPrompt, setShowMiddleCardPrompt] = useState(false);
  const [middleCardPromptPosition, setMiddleCardPromptPosition] = useState({ x: 0, y: 0 });
  const [showFJBPrompt, setShowFJBPrompt] = useState(false);
  const [fJBPromptPosition, setFJBPromptPosition] = useState({ x: 0, y: 0 });
  const [fjbThemeComplete, setFjbThemeComplete] = useState(false);
  const [recommendedTiles, setRecommendedTiles] = useState([
    { id: 1, color: themeColors[0] },
    { id: 2, color: themeColors[0] },
    { id: 3, color: themeColors[0] },
    { id: 4, color: themeColors[0] }
  ]);
  const [draggedTile, setDraggedTile] = useState(null);
  
  // State for promo card content storage (for image generation)
  const [promoCardContents, setPromoCardContents] = useState({});
  const [colorPromptSaved, setColorPromptSaved] = useState(true); // Set to true for landing page demo
  const [selectedFlightPhase, setSelectedFlightPhase] = useState('cruise'); // Default to cruise for landing page
  const currentRouteKey = 'landing-page'; // Simple route key for landing page
  
  // State for recommended content cards (4 cards at bottom)
  const [recommendedContentCards, setRecommendedContentCards] = useState([
    { id: 0, title: 'A Podcast', imageDescription: 'podcast audio', imageUrl: null, type: 'podcast' },
    { id: 1, title: 'A Movie', imageDescription: 'movie poster', imageUrl: null, type: 'movie' },
    { id: 2, title: 'News', imageDescription: 'news article', imageUrl: null, type: 'news' },
    { id: 3, title: 'Combo Food Offer', imageDescription: 'combo food meal', imageUrl: null, type: 'food' }
  ]);
  const [recommendedCardRemixedImages, setRecommendedCardRemixedImages] = useState({});
  const [recommendedCardImageLoading, setRecommendedCardImageLoading] = useState({});
  const [recommendedCardTitles, setRecommendedCardTitles] = useState({});
  
  // State for flight phase-based card visibility and interaction
  const [hasReachedTakeoff, setHasReachedTakeoff] = useState(false);
  const [hasReachedClimb, setHasReachedClimb] = useState(false);
  const [visibleCardIndices, setVisibleCardIndices] = useState(new Set()); // Track which cards are visible (promo + recommended)
  const [isCardAnimationInProgress, setIsCardAnimationInProgress] = useState(false);
  
  // Calculate current flight phase from progress
  // takeoff = 5% (0.05), climb = 20% (0.20)
  const getCurrentFlightPhase = (progress) => {
    if (progress >= 0.20) return 'climb';
    if (progress >= 0.05) return 'takeoff';
    return 'pre-takeoff';
  };
  
  // Monitor animation progress to detect phase changes
  useEffect(() => {
    const currentPhase = getCurrentFlightPhase(animationProgress);
    
    // When takeoff is reached for the first time, animate cards appearing
    if (currentPhase === 'takeoff' && !hasReachedTakeoff) {
      setHasReachedTakeoff(true);
      setIsCardAnimationInProgress(true);
      
      // Animate cards appearing one by one (3 promo + 4 recommended = 7 cards total)
      // Images will use the current selectedFlightPhase (default: 'cruise') until climb phase
      const totalCards = 7;
      const delayBetweenCards = 100; // 100ms delay between each card
      
      for (let i = 0; i < totalCards; i++) {
        setTimeout(() => {
          setVisibleCardIndices(prev => new Set([...prev, i]));
          if (i === totalCards - 1) {
            setIsCardAnimationInProgress(false);
          }
        }, i * delayBetweenCards);
      }
    }
    
    // When climb phase is reached, enable prompt bubbles and change images
    if (currentPhase === 'climb' && !hasReachedClimb) {
      setHasReachedClimb(true);
      // Images will be changed based on selectedFlightPhase being set to 'climb'
      setSelectedFlightPhase('climb');
      
      // Regenerate recommended card images with climb phase theme (Paris)
      recommendedContentCards.forEach((card, index) => {
        if (card.imageDescription) {
          // Add Paris context to image description for climb phase
          const climbImageDescription = `${card.imageDescription} Related to Paris`;
          const newImageUrl = getPollinationsImage(climbImageDescription, mockThemeColor, { randomize: true });
          const timestamp = Date.now();
          const separator = newImageUrl.includes('?') ? '&' : '?';
          const newUrl = `${newImageUrl}${separator}t=${timestamp}`;
          setRecommendedCardRemixedImage(index, newUrl);
          setRecommendedCardImageLoadingState(index, true);
        }
      });
    }
  }, [animationProgress, hasReachedTakeoff, hasReachedClimb]);
  
  const formatTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `LANDING IN ${h}H ${m.toString().padStart(2, '0')}M`;
  };
  
  // Countdown timer effect - only run when not in animation mode
  useEffect(() => {
    setMinutesLeft(maxFlightMinutes);
  }, [maxFlightMinutes]);

  useEffect(() => {
    if (dragging) return; // Pause timer while dragging
    if (minutesLeft <= 0) return;
    if (showMovingIcon) return; // Pause timer during flight icon animation
    
    timerRef.current = setTimeout(() => {
      setMinutesLeft((m) => (m > 0 ? m - 1 : 0));
    }, 60000); // Update every minute (same as Dashboard)
    return () => clearTimeout(timerRef.current);
  }, [minutesLeft, dragging, showMovingIcon]);

  // Handle animation progress changes
  const handleAnimationProgressChange = (newMinutes) => {
    setMinutesLeft(newMinutes);
  };

  // Handle animation progress from FlightProgress
  const handleAnimationProgress = (progress) => {
    setAnimationProgress(progress);
  };

  // Handle Cruise label show event
  const handleCruiseLabelShow = (isShown) => {
    setCruiseLabelShown(isShown);
  };

  const handleMiddleCardPromptClose = (isClosed) => {
    setMiddleCardPromptClosed(isClosed);
  };

  const handleMiddleCardPromptClick = (elementType, elementData, position) => {
    console.log('=== MIDDLE CARD PROMPT CLICK ===', {
      elementType, 
      elementData, 
      position,
      showMiddleCardPrompt,
      middleCardPromptClosed
    });
    setMiddleCardPromptPosition(position);
    setShowMiddleCardPrompt(true);
    console.log('=== UPDATED MIDDLE CARD STATE ===', {
      newPosition: position, 
      showPrompt: true 
    });
  };

  const handleMiddleCardPromptBubbleClose = () => {
    setShowMiddleCardPrompt(false);
    setMiddleCardPromptClosed(true);
    handleMiddleCardPromptClose(true);
  };

  const handleFJBPromptBubbleClose = () => {
    setShowFJBPrompt(false);
  };

  // Backup: ensure theme updates when pointer "clicks" Save (in case React synthetic click doesn't fire)
  const handleFJBThemeApplyRequest = (color) => {
    const normalized = (c) => c?.toLowerCase().replace(/\s/g, '');
    const idx = themeColors.findIndex(c => normalized(c) === normalized(color));
    setCurrentThemeColor(color);
    if (idx !== -1) setCurrentThemeColorIndex(idx);
    setIsGradientMode(false);
    setShowFJBPrompt(false);
    setFjbThemeComplete(true);
  };

  // Called by FlightProgress when pointer "clicks" FJB - show theme bubble (Paris, Berlin, Oktoberfest)
  const handleRequestFJBPrompt = () => {
    const fjbElement = document.querySelector('[data-name="flight journey bar"]');
    if (fjbElement) {
      const rect = fjbElement.getBoundingClientRect();
      setFJBPromptPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      });
      setShowFJBPrompt(true);
    }
  };

  const handleFJBPromptSubmit = (promptText, elementType, elementData, positionKey) => {
    setShowFJBPrompt(false);
    
    if (positionKey === 'fjb-landing') {
      // Paris theme primary color (coral-red from theme chips)
      setCurrentThemeColor('#FF6B6B');
      setIsGradientMode(false);
      
      // Generate AI images for content cards when color is saved
      const contentCardTitles = [
        'Crocodile Dundee Movie',
        'Get Your Guide', 
        'Game Poster',
        'A Podcast'
      ];
      
      // Content cards no longer use images - simplified to text only
    } else {
    }
  };

  const handleMiddleCardPromptSubmit = (promptText, elementType, elementData, positionKey) => {
    console.log('=== MIDDLE CARD PROMPT SUBMIT ===', {
      promptText,
      elementType,
      elementData,
      positionKey
    });
    
    // Parse the prompt text if it's in format "text:...,image:..."
    let cardText = '';
    let imageDescription = '';
    
    if (elementType === 'promo-card' && promptText.includes('text:') && promptText.includes('image:')) {
      // Parse format: "text:Title,image:Description"
      const textMatch = promptText.match(/text:([^,]+)/);
      const imageMatch = promptText.match(/image:([^,]+)/);
      cardText = textMatch ? textMatch[1].trim() : '';
      imageDescription = imageMatch ? imageMatch[1].trim() : '';
    } else {
      // Simple text prompt - use as both text and image description
      cardText = promptText.trim();
      imageDescription = promptText.trim();
    }
    
    // Determine which card index to update (middle card is index 1)
    const cardIndex = elementData?.cardIndex !== undefined ? elementData.cardIndex : 1;
    
    // Generate Pollinations image URL if we have an image description
    let imageUrl = null;
    if (imageDescription) {
      imageUrl = getPollinationsImage(imageDescription, mockThemeColor);
      console.log('=== GENERATED POLLINATIONS IMAGE ===', {
        imageDescription,
        imageUrl,
        cardIndex,
        themeColor: mockThemeColor
      });
    }
    
    // Store the content in promoCardContents
    // Use phase-specific key: 'landing-page-cruise'
    const phaseKey = `${currentRouteKey}-${selectedFlightPhase}`;
    setPromoCardContents(prev => {
      const newContents = { ...prev };
      if (!newContents[phaseKey]) {
        newContents[phaseKey] = [];
      }
      // Ensure array has enough elements
      while (newContents[phaseKey].length <= cardIndex) {
        newContents[phaseKey].push(null);
      }
      // Update the specific card
      newContents[phaseKey][cardIndex] = {
        text: cardText || 'Add experience',
        image: imageDescription || '',
        backgroundImage: imageUrl || ''
      };
      console.log('=== UPDATED PROMO CARD CONTENTS ===', {
        phaseKey,
        cardIndex,
        content: newContents[phaseKey][cardIndex],
        allContents: newContents
      });
      return newContents;
    });
    
    setShowMiddleCardPrompt(false);
    setMiddleCardPromptClosed(true);
    handleMiddleCardPromptClose(true);
  };

  const handleThemeColorChange = (newColor) => {
    const isGradient = newColor.includes('gradient');
    setIsGradientMode(isGradient);
    setCurrentThemeColor(newColor);
    
    if (!isGradient) {
      // Find matching theme index (normalize for hex comparison)
      const normalized = (c) => c?.toLowerCase().replace(/\s/g, '');
      const colorIndex = themeColors.findIndex(c => normalized(c) === normalized(newColor));
      if (colorIndex !== -1) {
        setCurrentThemeColorIndex(colorIndex);
      }
    }
    
    // When FJB prompt is open and user saves theme, close prompt and signal completion
    if (showFJBPrompt) {
      setShowFJBPrompt(false);
      setFjbThemeComplete(true);
    }
  };

  // Drag and drop handlers for recommended tiles
  const handleDragStart = (e, tileId) => {
    setDraggedTile(tileId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetTileId) => {
    e.preventDefault();
    if (draggedTile && draggedTile !== targetTileId) {
      const draggedIndex = recommendedTiles.findIndex(tile => tile.id === draggedTile);
      const targetIndex = recommendedTiles.findIndex(tile => tile.id === targetTileId);
      
      const newTiles = [...recommendedTiles];
      const [draggedItem] = newTiles.splice(draggedIndex, 1);
      newTiles.splice(targetIndex, 0, draggedItem);
      
      setRecommendedTiles(newTiles);
    }
    setDraggedTile(null);
  };

  const handleDragEnd = () => {
    setDraggedTile(null);
  };

  // Handle progress bar drag
  const handleProgressChange = (newMinutes) => {
    setDragging(true);
    setMinutesLeft(newMinutes);
  };

  const handlePromoCardLoadingChange = (isLoading) => {
    setPromoCardLoading(isLoading);
    if (!isLoading && promoCardLoading) {
      // Loading just finished
      setPromoCardFinishedLoading(true);
    }
    // Don't automatically show prompt bubble - let FlightProgress control this
  };

  useEffect(() => {
    if (!dragging) return;
    const handleUp = () => setDragging(false);
    window.addEventListener('mouseup', handleUp);
    return () => window.removeEventListener('mouseup', handleUp);
  }, [dragging]);
  
  const [currentThemeColorIndex, setCurrentThemeColorIndex] = useState(0);
  const [currentThemeColor, setCurrentThemeColor] = useState(themeColors[0]);
  const [isGradientMode, setIsGradientMode] = useState(false);
  const mockThemeColor = currentThemeColor;
  
  // Helper function to convert hex to rgba with opacity
  const hexToRgba = (hex, opacity) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };
  
  // Helper function to get background color with proper opacity handling
  const getBackgroundColor = (color) => {
    if (color.includes('gradient')) {
      return color;
    } else {
      return hexToRgba(color, 0.14);
    }
  };
  
  // Helper function to create lighter version of theme color (matching Component3Cards)
  const getLightThemeColor = (opacity = 0.1) => {
    if (mockThemeColor.startsWith('#')) {
      // Convert hex to rgba with opacity
      const hex = mockThemeColor.slice(1);
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return `rgba(255,255,255,${opacity})`; // fallback
  };
  
  // Debug theme color changes
  useEffect(() => {
    if (mockThemeColor.includes('gradient')) {
      console.log('=== GRADIENT THEME DEBUG ===', {
        hasLinear: mockThemeColor.includes('linear-gradient'),
        hasDegrees: mockThemeColor.includes('120deg'),
        hasColors: mockThemeColor.includes('#d4fc79') && mockThemeColor.includes('#96e6a1')
      });
    }
  }, [currentThemeColor, mockThemeColor]);
  
  // Cycle through theme colors every 7 seconds
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     setCurrentThemeColorIndex((prevIndex) => 
  //       (prevIndex + 1) % themeColors.length
  //     );
  //   }, 7000);
    
  //   return () => clearInterval(interval);
  // }, []);

  // Update currentThemeColor when currentThemeColorIndex changes (only for solid colors)
  useEffect(() => {
    // Only update if not in gradient mode
    if (!isGradientMode) {
      setCurrentThemeColor(themeColors[currentThemeColorIndex]);
    }
  }, [currentThemeColorIndex, themeColors, isGradientMode]);

  // Update tiles when theme color changes
  useEffect(() => {
    setRecommendedTiles(prevTiles => 
      prevTiles.map(tile => ({
        ...tile,
        color: mockThemeColor
      }))
    );
  }, [mockThemeColor]);
  
  // Listen for save events from promo card clicks (when promo card closes recommendation bubbles)
  useEffect(() => {
    const handleSaveRecommendedContent = (e) => {
      const { cardIndex, title, description } = e.detail || {};
      if (cardIndex !== undefined) {
        // Save the title
        if (title !== undefined) {
          setRecommendedCardTitle(cardIndex, title);
        }
        // Save the description and update content cards
        if (description !== undefined) {
          setRecommendedContentCards(prev => {
            const updated = [...prev];
            updated[cardIndex] = { ...updated[cardIndex], title: title || updated[cardIndex].title, imageDescription: description };
            return updated;
          });
        }
      }
    };
    
    const handleRemixRecommendedImage = (e) => {
      const { cardIndex, description } = e.detail || {};
      if (cardIndex !== undefined && description) {
        try {
          const newImageUrl = getPollinationsImage(description, mockThemeColor, { randomize: true });
          const timestamp = Date.now();
          const separator = newImageUrl.includes('?') ? '&' : '?';
          const newUrl = `${newImageUrl}${separator}t=${timestamp}`;
          setRecommendedCardRemixedImage(cardIndex, newUrl);
          setRecommendedCardImageLoadingState(cardIndex, true);
          console.log('Recommended card remix generated from promo card save', { cardIndex, description, newUrl });
        } catch (err) {
          console.error('Recommended card remix failed', err);
        }
      }
    };
    
    window.addEventListener('save-recommended-card-content', handleSaveRecommendedContent);
    window.addEventListener('remix-recommended-card-image', handleRemixRecommendedImage);
    
    return () => {
      window.removeEventListener('save-recommended-card-content', handleSaveRecommendedContent);
      window.removeEventListener('remix-recommended-card-image', handleRemixRecommendedImage);
    };
  }, [mockThemeColor]);
  
  // Initialize default images for recommended content cards on mount
  useEffect(() => {
    recommendedContentCards.forEach((card, index) => {
      if (!card.imageUrl) {
        const imageUrl = getPollinationsImage(card.imageDescription, mockThemeColor);
        setRecommendedContentCards(prev => {
          const updated = [...prev];
          if (!updated[index].imageUrl) {
            updated[index] = { ...updated[index], imageUrl };
          }
          return updated;
        });
      }
    });
  }, [mockThemeColor]); // Run when theme color is available
  
  // Helper functions for recommended card state management
  const getRecommendedCardContent = (cardIndex) => {
    return recommendedContentCards[cardIndex] || { title: 'Add content', imageDescription: '', imageUrl: null };
  };
  
  const getRecommendedCardTitle = (cardIndex) => {
    return recommendedCardTitles[cardIndex] || recommendedContentCards[cardIndex]?.title || 'Add content';
  };
  
  const setRecommendedCardTitle = (cardIndex, title) => {
    setRecommendedCardTitles(prev => ({ ...prev, [cardIndex]: title }));
  };
  
  const getRecommendedCardRemixedImage = (cardIndex) => {
    return recommendedCardRemixedImages[cardIndex] || null;
  };
  
  const setRecommendedCardRemixedImage = (cardIndex, imageUrl) => {
    setRecommendedCardRemixedImages(prev => ({ ...prev, [cardIndex]: imageUrl }));
  };
  
  const isRecommendedCardImageLoading = (cardIndex) => {
    return recommendedCardImageLoading[cardIndex] || false;
  };
  
  const setRecommendedCardImageLoadingState = (cardIndex, isLoading) => {
    setRecommendedCardImageLoading(prev => ({ ...prev, [cardIndex]: isLoading }));
  };
  
  const landingIn = formatTime(minutesLeft);
  
  // Helper function to get light card background color
  const getLightCardBackgroundColor = (color) => {
    if (color.includes('gradient')) {
      return color;
    }
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      return `rgba(${r}, ${g}, ${b}, 0.1)`;
    }
    return 'rgba(255,255,255,0.1)';
  };
  
  // Render function for recommended content cards
  const renderRecommendedCard = (cardIndex) => {
    // Card index in visibleCardIndices: promo cards are 0-2, recommended cards are 3-6
    const cardVisibilityIndex = cardIndex + 3; // Recommended cards start at index 3
    const isCardVisible = visibleCardIndices.has(cardVisibilityIndex);
    const shouldShowContent = hasReachedTakeoff && isCardVisible; // Show content at takeoff
    
    const cardContent = getRecommendedCardContent(cardIndex);
    const displayTitle = getRecommendedCardTitle(cardIndex);
    const hasRemixedImage = !!getRecommendedCardRemixedImage(cardIndex);
    const imageSrc = getRecommendedCardRemixedImage(cardIndex) || cardContent.imageUrl;
    
    const cardStyle = {
      width: '100%',
      height: '160px',
      background: getLightCardBackgroundColor(mockThemeColor),
      borderTopLeftRadius: '8px',
      borderTopRightRadius: '8px',
      borderBottomLeftRadius: '8px',
      borderBottomRightRadius: '8px',
      border: 'none',
      marginTop: '1px',
      opacity: isCardVisible ? 1 : 0.3, // Fade in when visible
      transition: 'opacity 0.2s ease-in'
    };
    
    return (
      <div
        key={`recommended-card-${cardIndex}`}
        data-card-index={cardIndex}
        className="overflow-clip relative shrink-0 flex items-center justify-center backdrop-blur-[10px] backdrop-filter group hover:shadow-[0_0_0_3px_#1E1E1E] cursor-pointer"
        style={cardStyle}
        onMouseEnter={(e) => {
          // Disable user interactions in Landing Page mode (demo mode)
          // Always return early to prevent tooltips on hover
          return;
          // Disable interactions before climb phase
          if (!hasReachedClimb) return;
          if (window.__recommendedTooltipLocked) return;
          
          // Check if any prompt bubble is open (promo card or recommendation card)
          const promoPanel = document.getElementById('locked-remix-panel');
          if (promoPanel && promoPanel.parentNode) return; // Don't show tooltip if promo bubble is open
          
          // Check if any recommendation card prompt bubble is open
          for (let i = 0; i < 4; i++) {
            const recPanel = document.getElementById(`recommended-locked-remix-panel-${i}`);
            if (recPanel && recPanel.parentNode) return; // Don't show tooltip if any recommendation bubble is open
          }
          
          const tooltip = document.createElement('div');
          tooltip.style.cssText = `
            position: fixed;
            background: #1E1E1E;
            color: white;
            padding: 4px 8px;
            border-radius: 0 24px 24px 24px;
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
          tooltip.id = `recommended-tooltip-${cardIndex}`;
          tooltip.innerHTML = `
            <span id="recommended-tooltip-content-text-${cardIndex}" style="cursor:pointer;padding:2px 4px;border-radius:4px">Content</span>
            <span> | </span>
            <span id="recommended-tooltip-performance-text-${cardIndex}" style="cursor:pointer;padding:2px 4px;border-radius:4px">Performance</span>
            <span> |</span>
            <button id="recommended-tooltip-close-${cardIndex}" aria-label="Close" style="background:transparent;border:none;color:white;opacity:.85;cursor:pointer;padding:0 2px;line-height:1">✕</button>
          `;
          const existing = document.getElementById(`recommended-tooltip-${cardIndex}`);
          if (existing) existing.remove();
          document.body.appendChild(tooltip);
          
          const closeBtn = document.getElementById(`recommended-tooltip-close-${cardIndex}`);
          if (closeBtn) {
            closeBtn.addEventListener('click', (ev) => {
              ev.stopPropagation();
              const t = document.getElementById(`recommended-tooltip-${cardIndex}`);
              if (t) t.remove();
              const panel = document.getElementById(`recommended-locked-remix-panel-${cardIndex}`);
              if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
              const existingPanel = document.getElementById(`recommended-locked-remix-panel-${cardIndex}`);
              if (existingPanel) {
                // Clean up scroll listener
                if (existingPanel._scrollHandler) {
                  window.removeEventListener('scroll', existingPanel._scrollHandler, true);
                  window.removeEventListener('resize', existingPanel._scrollHandler);
                  delete existingPanel._scrollHandler;
                }
                if (existingPanel.parentNode) existingPanel.parentNode.removeChild(existingPanel);
              }
              const performancePanel = document.getElementById(`recommended-performance-empty-panel-${cardIndex}`);
              if (performancePanel && performancePanel.parentNode) performancePanel.parentNode.removeChild(performancePanel);
              window.__recommendedTooltipLocked = false;
            });
          }
          
          // Add click handler for Content text
          const contentText = document.getElementById(`recommended-tooltip-content-text-${cardIndex}`);
          if (contentText) {
            contentText.addEventListener('click', (ev) => {
              ev.stopPropagation();
              const performancePanel = document.getElementById(`recommended-performance-empty-panel-${cardIndex}`);
              if (performancePanel && performancePanel.parentNode) performancePanel.parentNode.removeChild(performancePanel);
              contentText.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
              contentText.style.color = '#FFFFFF';
              const performanceText = document.getElementById(`recommended-tooltip-performance-text-${cardIndex}`);
              if (performanceText) {
                performanceText.style.backgroundColor = 'transparent';
                performanceText.style.color = '#FFFFFF';
              }
              
              // Close any promo card prompt bubbles
              const promoTooltip = document.getElementById('custom-tooltip');
              if (promoTooltip && promoTooltip.parentNode) promoTooltip.parentNode.removeChild(promoTooltip);
              const promoPanel = document.getElementById('locked-remix-panel');
              if (promoPanel && promoPanel.parentNode) promoPanel.parentNode.removeChild(promoPanel);
              const promoPerfPanel = document.getElementById('performance-empty-panel');
              if (promoPerfPanel && promoPerfPanel.parentNode) promoPerfPanel.parentNode.removeChild(promoPerfPanel);
              window.__tooltipLocked = false;
              
              // Close any other recommendation card prompt bubbles (from other cards)
              for (let i = 0; i < 4; i++) {
                if (i !== cardIndex) {
                  const otherTooltip = document.getElementById(`recommended-tooltip-${i}`);
                  if (otherTooltip && otherTooltip.parentNode) otherTooltip.parentNode.removeChild(otherTooltip);
                  const otherPanel = document.getElementById(`recommended-locked-remix-panel-${i}`);
                  if (otherPanel) {
                    // Clean up scroll listener
                    if (otherPanel._scrollHandler) {
                      window.removeEventListener('scroll', otherPanel._scrollHandler, true);
                      window.removeEventListener('resize', otherPanel._scrollHandler);
                      delete otherPanel._scrollHandler;
                    }
                    if (otherPanel.parentNode) otherPanel.parentNode.removeChild(otherPanel);
                  }
                  const otherPerfPanel = document.getElementById(`recommended-performance-empty-panel-${i}`);
                  if (otherPerfPanel && otherPerfPanel.parentNode) otherPerfPanel.parentNode.removeChild(otherPerfPanel);
                }
              }
              
              // Check if panel already exists (created by card click), if so, just show it
              const existingPanel = document.getElementById(`recommended-locked-remix-panel-${cardIndex}`);
              if (existingPanel) {
                // Panel already exists, just ensure it's visible
                return;
              }
              const tooltip = document.getElementById(`recommended-tooltip-${cardIndex}`);
              if (tooltip) {
                // Use requestAnimationFrame to ensure tooltip is fully positioned
                requestAnimationFrame(() => {
                  const rect = tooltip.getBoundingClientRect();
                  const contentDataLocal = getRecommendedCardContent(cardIndex);
                  const remixContainer = document.createElement('div');
                  remixContainer.id = `recommended-locked-remix-panel-${cardIndex}`;
                  remixContainer.className = 'px-4 py-3 flex flex-col items-center';
                  
                  // Calculate proper spacing: bubble bottom should be 8px above tooltip bottom
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
                  
                  remixContainer.style.cssText = `position:fixed;left:${rect.left}px;top:${bubbleTop}px;z-index:2147483647;background-color:#1C1C1C;border:1px solid rgba(255,255,255,0.2);width:312px;gap:40px;box-shadow:rgba(0,0,0,0.35) 0px 8px 20px;border-radius:0 24px 24px 24px`;
                
                const textDiv = document.createElement('div');
                textDiv.className = 'w-full';
                const textP = document.createElement('p');
                textP.className = 'whitespace-pre-wrap break-words text-md leading-6 text-white m-0';
                
                const changeTitleSpan = document.createElement('span');
                changeTitleSpan.className = 'text-gray-300 select-none';
                changeTitleSpan.style.marginRight = '8px';
                changeTitleSpan.textContent = 'Change title to';
                
                const titleSpan = document.createElement('span');
                titleSpan.id = `recommended-locked-tooltip-title-${cardIndex}`;
                titleSpan.role = 'textbox';
                titleSpan.setAttribute('aria-label', 'title');
                titleSpan.contentEditable = true;
                titleSpan.className = 'outline-none';
                titleSpan.spellCheck = false;
                titleSpan.style.cssText = 'text-decoration:underline dotted;text-decoration-color:rgba(156,163,175,0.8);text-underline-offset:6px;caret-color:transparent;margin-right:8px';
                titleSpan.textContent = getRecommendedCardTitle(cardIndex) || contentDataLocal.title || 'Add content';
                
                const describeSpan = document.createElement('span');
                describeSpan.className = 'text-gray-300 select-none';
                describeSpan.style.marginRight = '8px';
                describeSpan.textContent = 'describe image of';
                
                const descSpan = document.createElement('span');
                descSpan.id = `recommended-locked-tooltip-desc-${cardIndex}`;
                descSpan.role = 'textbox';
                descSpan.setAttribute('aria-label', 'image description');
                descSpan.contentEditable = true;
                descSpan.className = 'outline-none';
                descSpan.spellCheck = false;
                descSpan.style.cssText = 'text-decoration:underline dotted;text-decoration-color:rgba(156,163,175,0.8);text-underline-offset:6px;caret-color:auto';
                descSpan.textContent = contentDataLocal.imageDescription || contentDataLocal.title || '';
                
                textP.appendChild(changeTitleSpan);
                textP.appendChild(titleSpan);
                textP.appendChild(describeSpan);
                textP.appendChild(descSpan);
                textDiv.appendChild(textP);
                
                const buttonsDiv = document.createElement('div');
                buttonsDiv.className = 'flex gap-2 justify-end w-full';
                
                // Upload button (icon only, no functionality)
                const lockedUploadBtn = document.createElement('button');
                lockedUploadBtn.id = `recommended-locked-tooltip-upload-${cardIndex}`;
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
                
                const lockedRemixBtn = document.createElement('button');
                lockedRemixBtn.id = `recommended-locked-tooltip-remix-${cardIndex}`;
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
                
                const lockedSaveBtn = document.createElement('button');
                lockedSaveBtn.id = `recommended-locked-tooltip-save-${cardIndex}`;
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
                
                remixContainer.appendChild(textDiv);
                remixContainer.appendChild(buttonsDiv);
                
                document.body.appendChild(remixContainer);
                
                // Get card element for scroll tracking
                const cardElement = document.querySelector(`[data-card-index="${cardIndex}"]`);
                const initialCardRect = cardElement ? cardElement.getBoundingClientRect() : null;
                const initialTooltipRect = rect;
                const initialBubbleTop = bubbleTop;
                const initialTooltipLeft = rect.left;
                const initialTooltipTop = rect.top;
                
                // Function to update positions on scroll
                const updatePositionsOnScroll = () => {
                  requestAnimationFrame(() => {
                    const tooltip = document.getElementById(`recommended-tooltip-${cardIndex}`);
                    const bubble = document.getElementById(`recommended-locked-remix-panel-${cardIndex}`);
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
                    const bubbleRect = bubble.getBoundingClientRect();
                    const actualBubbleHeight = bubbleRect.height;
                    const spacing = 8;
                    const tooltipHeight = tooltipRect.height || 30;
                    
                    let bubbleTop = tooltipRect.top - spacing - actualBubbleHeight;
                    
                    // Viewport boundary check
                    const minTop = 10;
                    if (bubbleTop < minTop) {
                      bubbleTop = Math.max(minTop, tooltipRect.top - tooltipHeight - spacing - actualBubbleHeight);
                    }
                    
                    bubble.style.top = `${bubbleTop}px`;
                    bubble.style.left = `${tooltipRect.left}px`;
                  });
                };
                
                // Add scroll listener
                const scrollHandler = () => updatePositionsOnScroll();
                window.addEventListener('scroll', scrollHandler, true);
                window.addEventListener('resize', scrollHandler);
                
                // Store scroll handler for cleanup
                remixContainer._scrollHandler = scrollHandler;
                
                // Function to reposition bubble based on actual height
                const repositionBubble = () => {
                  requestAnimationFrame(() => {
                    const tooltip = document.getElementById(`recommended-tooltip-${cardIndex}`);
                    const bubble = document.getElementById(`recommended-locked-remix-panel-${cardIndex}`);
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
                
                const titleEl = remixContainer.querySelector(`#recommended-locked-tooltip-title-${cardIndex}`);
                const descEl = remixContainer.querySelector(`#recommended-locked-tooltip-desc-${cardIndex}`);
                const remixBtn = remixContainer.querySelector(`#recommended-locked-tooltip-remix-${cardIndex}`);
                const saveBtn = remixContainer.querySelector(`#recommended-locked-tooltip-save-${cardIndex}`);
                
                if (titleEl) {
                  titleEl.addEventListener('input', (e) => {
                    const el = e.currentTarget;
                    const raw = el.innerText || '';
                    const clamped = raw.length > 50 ? raw.slice(0, 50) : raw;
                    if (clamped !== raw) el.innerText = clamped;
                    setRecommendedCardTitle(cardIndex, clamped);
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
                    // Reposition bubble after text change
                    repositionBubble();
                  });
                  descEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') { e.preventDefault(); return; }
                  });
                }
                
                const triggerRemix = () => {
                  try {
                    const imageDescription = (descEl?.innerText || contentDataLocal.imageDescription || contentDataLocal.title || 'content');
                    const newImageUrl = getPollinationsImage(imageDescription, mockThemeColor, { randomize: true });
                    const timestamp = Date.now();
                    const separator = newImageUrl.includes('?') ? '&' : '?';
                    const newUrl = `${newImageUrl}${separator}t=${timestamp}`;
                    setRecommendedCardRemixedImage(cardIndex, newUrl);
                    setRecommendedCardImageLoadingState(cardIndex, true);
                    console.log('Recommended card remix generated', { cardIndex, imageDescription, newUrl });
                  } catch (err) {
                    console.error('Recommended card remix failed', err);
                  }
                };
                
                if (remixBtn) remixBtn.addEventListener('click', (ev) => { ev.stopPropagation(); triggerRemix(); });
                if (saveBtn) saveBtn.addEventListener('click', (ev) => { 
                  ev.stopPropagation();
                  const titleValue = titleEl?.innerText || getRecommendedCardTitle(cardIndex);
                  const descValue = descEl?.innerText || contentDataLocal.imageDescription;
                  setRecommendedCardTitle(cardIndex, titleValue);
                  setRecommendedContentCards(prev => {
                    const updated = [...prev];
                    updated[cardIndex] = { ...updated[cardIndex], title: titleValue, imageDescription: descValue };
                    return updated;
                  });
                  triggerRemix();
                });
                
                // Initial reposition after bubble is created to ensure correct positioning
                repositionBubble();
                
                // Add document click listener to save and close when clicking outside
                const handleClickOutside = (e) => {
                  const tooltip = document.getElementById(`recommended-tooltip-${cardIndex}`);
                  const bubble = document.getElementById(`recommended-locked-remix-panel-${cardIndex}`);
                  
                  // Check if click is outside both tooltip and bubble
                  const isClickOnTooltip = tooltip && (tooltip.contains(e.target) || tooltip === e.target);
                  const isClickOnBubble = bubble && (bubble.contains(e.target) || bubble === e.target);
                  const isClickOnCard = e.target.closest(`[data-card-index="${cardIndex}"]`);
                  
                  if (!isClickOnTooltip && !isClickOnBubble && !isClickOnCard) {
                    // Click is outside - save content and close
                    const titleValue = titleEl?.innerText || getRecommendedCardTitle(cardIndex);
                    const descValue = descEl?.innerText || contentDataLocal.imageDescription;
                    
                    // Save the content
                    setRecommendedCardTitle(cardIndex, titleValue);
                    setRecommendedContentCards(prev => {
                      const updated = [...prev];
                      updated[cardIndex] = { ...updated[cardIndex], title: titleValue, imageDescription: descValue };
                      return updated;
                    });
                    
                    // Trigger remix if description changed
                    if (descValue && descValue !== contentDataLocal.imageDescription) {
                      triggerRemix();
                    }
                    
                    // Close tooltip and bubble
                    if (tooltip && tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
                    if (bubble && bubble.parentNode) bubble.parentNode.removeChild(bubble);
                    window.__recommendedTooltipLocked = false;
                    
                    // Remove this listener
                    document.removeEventListener('mousedown', handleClickOutside);
                  }
                };
                
                // Add the listener with a small delay to avoid immediate trigger
                setTimeout(() => {
                  document.addEventListener('mousedown', handleClickOutside);
                }, 100);
                });
              }
            });
          }
          
          // Add click handler for Performance text
          const performanceText = document.getElementById(`recommended-tooltip-performance-text-${cardIndex}`);
          if (performanceText) {
            performanceText.addEventListener('click', (ev) => {
              ev.stopPropagation();
              const panel = document.getElementById(`recommended-locked-remix-panel-${cardIndex}`);
              if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
              performanceText.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
              performanceText.style.color = '#FFFFFF';
              const contentText = document.getElementById(`recommended-tooltip-content-text-${cardIndex}`);
              if (contentText) {
                contentText.style.backgroundColor = 'transparent';
                contentText.style.color = '#FFFFFF';
              }
              const tooltip = document.getElementById(`recommended-tooltip-${cardIndex}`);
              if (tooltip) {
                const rect = tooltip.getBoundingClientRect();
                const emptyContainer = document.createElement('div');
                emptyContainer.id = `recommended-performance-empty-panel-${cardIndex}`;
                emptyContainer.className = 'px-4 py-3 flex flex-col items-center';
                
                // Calculate proper spacing: bubble bottom should be 8px above tooltip bottom
                // Performance panel height is approximately 80px (smaller than content panel)
                const bubbleHeight = 80;
                const spacing = 8;
                const tooltipHeight = rect.height || 30;
                
                // Position bubble: bottom of bubble = top of tooltip - spacing
                let bubbleTop = rect.top - spacing - bubbleHeight;
                
                // Viewport boundary check: ensure bubble doesn't go off-screen
                const minTop = 10;
                if (bubbleTop < minTop) {
                  bubbleTop = Math.max(minTop, rect.top - tooltipHeight - spacing - bubbleHeight);
                }
                
                emptyContainer.style.cssText = `position:fixed;left:${rect.left}px;top:${bubbleTop}px;z-index:2147483647;background-color:#1C1C1C;border:1px solid rgba(255,255,255,0.2);width:312px;gap:40px;box-shadow:rgba(0,0,0,0.35) 0px 8px 20px;border-radius:0 24px 24px 24px`;
                
                const emptyDiv = document.createElement('div');
                emptyDiv.className = 'w-full text-center';
                emptyDiv.innerHTML = '<p class="text-white text-sm opacity-70">Performance panel coming soon...</p>';
                emptyContainer.appendChild(emptyDiv);
                
                const existingPanel = document.getElementById(`recommended-performance-empty-panel-${cardIndex}`);
                if (existingPanel && existingPanel.parentNode) {
                  existingPanel.parentNode.removeChild(existingPanel);
                }
                
                document.body.appendChild(emptyContainer);
              }
            });
          }
          if (!window.__recommendedTooltipLocked) window.__recommendedTooltipLocked = false;
        }}
        onMouseMove={(e) => {
          const tooltip = document.getElementById(`recommended-tooltip-${cardIndex}`);
          if (!tooltip || window.__recommendedTooltipLocked) return;
          tooltip.style.left = `${e.clientX + 18}px`;
          tooltip.style.top = `${e.clientY + 18}px`;
        }}
        onMouseLeave={() => {
          const tooltip = document.getElementById(`recommended-tooltip-${cardIndex}`);
          if (tooltip && !window.__recommendedTooltipLocked) tooltip.remove();
        }}
        onClick={(e) => {
          // Disable user clicks in Landing Page mode (demo mode)
          // Allow programmatic clicks (e.isTrusted === false) for dummy mouse pointer animation
          if (e.isTrusted === true) return;
          // Disable clicks before climb phase
          if (!hasReachedClimb) return;
          setTimeout(() => {
            // Close any promo card prompt bubbles first
            const promoTooltip = document.getElementById('custom-tooltip');
            if (promoTooltip && promoTooltip.parentNode) promoTooltip.parentNode.removeChild(promoTooltip);
            const promoPanel = document.getElementById('locked-remix-panel');
            if (promoPanel && promoPanel.parentNode) promoPanel.parentNode.removeChild(promoPanel);
            const promoPerfPanel = document.getElementById('performance-empty-panel');
            if (promoPerfPanel && promoPerfPanel.parentNode) promoPerfPanel.parentNode.removeChild(promoPerfPanel);
            window.__tooltipLocked = false;
            
            // Close any other recommendation card prompt bubbles (from other cards)
            for (let i = 0; i < 4; i++) {
              if (i !== cardIndex) {
                const otherTooltip = document.getElementById(`recommended-tooltip-${i}`);
                if (otherTooltip && otherTooltip.parentNode) otherTooltip.parentNode.removeChild(otherTooltip);
                const otherPanel = document.getElementById(`recommended-locked-remix-panel-${i}`);
                if (otherPanel && otherPanel.parentNode) otherPanel.parentNode.removeChild(otherPanel);
                const otherPerfPanel = document.getElementById(`recommended-performance-empty-panel-${i}`);
                if (otherPerfPanel && otherPerfPanel.parentNode) otherPerfPanel.parentNode.removeChild(otherPerfPanel);
              }
            }
            
            // Ensure tooltip exists for current card, create if it doesn't
            let tooltip = document.getElementById(`recommended-tooltip-${cardIndex}`);
            if (!tooltip) {
              tooltip = document.createElement('div');
              tooltip.style.cssText = `
                position: fixed;
                background: #1E1E1E;
                color: white;
                padding: 4px 8px;
                border-radius: 0 24px 24px 24px;
                font-size: 12px;
                z-index: 2147483647;
                pointer-events: auto;
                white-space: nowrap;
                display: flex;
                align-items: center;
                gap: 8px;
                left: ${e.clientX + 12}px;
                top: ${e.clientY + 12}px;
              `;
              tooltip.id = `recommended-tooltip-${cardIndex}`;
              tooltip.innerHTML = `
                <span id="recommended-tooltip-content-text-${cardIndex}" style="cursor:pointer;padding:2px 4px;border-radius:4px">Content</span>
                <span> | </span>
                <span id="recommended-tooltip-performance-text-${cardIndex}" style="cursor:pointer;padding:2px 4px;border-radius:4px">Performance</span>
                <span> |</span>
                <button id="recommended-tooltip-close-${cardIndex}" aria-label="Close" style="background:transparent;border:none;color:white;opacity:.85;cursor:pointer;padding:0 2px;line-height:1">✕</button>
              `;
              document.body.appendChild(tooltip);
              
              // Set up close button handler
              const closeBtn = document.getElementById(`recommended-tooltip-close-${cardIndex}`);
              if (closeBtn) {
                closeBtn.addEventListener('click', (ev) => {
                  ev.stopPropagation();
                  const t = document.getElementById(`recommended-tooltip-${cardIndex}`);
                  if (t) t.remove();
                  const panel = document.getElementById(`recommended-locked-remix-panel-${cardIndex}`);
                  if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
                  const performancePanel = document.getElementById(`recommended-performance-empty-panel-${cardIndex}`);
                  if (performancePanel && performancePanel.parentNode) performancePanel.parentNode.removeChild(performancePanel);
                  window.__recommendedTooltipLocked = false;
                });
              }
              
              // Note: Content and Performance handlers are set up in onMouseEnter
              // If tooltip is created here, those handlers will be set up when mouse enters
            } else {
              // Update position if tooltip already exists
              tooltip.style.left = `${e.clientX + 12}px`;
              tooltip.style.top = `${e.clientY + 12}px`;
            }
            
            // Apply selected state to Content text
            const contentText = tooltip.querySelector(`#recommended-tooltip-content-text-${cardIndex}`);
            if (contentText) {
              contentText.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
              contentText.style.color = '#FFFFFF';
              contentText.style.padding = '2px 4px';
              contentText.style.borderRadius = '4px';
            }
            
            window.__recommendedTooltipLocked = true;
            
            // Show remix panel immediately on click (same as content cards)
            try {
              const existingPanel = document.getElementById(`recommended-locked-remix-panel-${cardIndex}`);
              if (existingPanel && existingPanel.parentNode) {
                existingPanel.parentNode.removeChild(existingPanel);
              }
              
              // Use the tooltip we already have (created or retrieved above)
              if (!tooltip) {
                console.error('Tooltip not found for card', cardIndex);
                return;
              }
              
              // Ensure tooltip is in the DOM and has been rendered
              // Use double requestAnimationFrame to ensure DOM is fully updated
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  // Re-query tooltip to ensure it's still in DOM
                  const t = document.getElementById(`recommended-tooltip-${cardIndex}`);
                  if (!t) {
                    console.error('Tooltip not found in requestAnimationFrame for card', cardIndex);
                    return;
                  }
                  const rect = t.getBoundingClientRect();
                const contentDataLocal = getRecommendedCardContent(cardIndex);
                
                const remixContainer = document.createElement('div');
                remixContainer.id = `recommended-locked-remix-panel-${cardIndex}`;
                remixContainer.className = 'px-4 py-3 flex flex-col items-center';
                
                // Calculate proper spacing: bubble bottom should be 8px above tooltip bottom
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
                
                remixContainer.style.cssText = `position:fixed;left:${rect.left}px;top:${bubbleTop}px;z-index:2147483647;background-color:#1C1C1C;border:1px solid rgba(255,255,255,0.2);width:312px;gap:40px;box-shadow:rgba(0,0,0,0.35) 0px 8px 20px;border-radius:0 24px 24px 24px`;
              
              const textDiv = document.createElement('div');
              textDiv.className = 'w-full';
              const textP = document.createElement('p');
              textP.className = 'whitespace-pre-wrap break-words text-md leading-6 text-white m-0';
              
              const changeTitleSpan = document.createElement('span');
              changeTitleSpan.className = 'text-gray-300 select-none';
              changeTitleSpan.style.marginRight = '8px';
              changeTitleSpan.textContent = 'Change title to';
              
              const titleSpan = document.createElement('span');
              titleSpan.id = `recommended-locked-tooltip-title-${cardIndex}`;
              titleSpan.role = 'textbox';
              titleSpan.setAttribute('aria-label', 'title');
              titleSpan.contentEditable = true;
              titleSpan.className = 'outline-none';
              titleSpan.spellCheck = false;
              titleSpan.style.cssText = 'text-decoration:underline dotted;text-decoration-color:rgba(156,163,175,0.8);text-underline-offset:6px;caret-color:transparent;margin-right:8px';
              titleSpan.textContent = getRecommendedCardTitle(cardIndex) || contentDataLocal.title || 'Add content';
              
              const describeSpan = document.createElement('span');
              describeSpan.className = 'text-gray-300 select-none';
              describeSpan.style.marginRight = '8px';
              describeSpan.textContent = 'describe image of';
              
              const descSpan = document.createElement('span');
              descSpan.id = `recommended-locked-tooltip-desc-${cardIndex}`;
              descSpan.role = 'textbox';
              descSpan.setAttribute('aria-label', 'image description');
              descSpan.contentEditable = true;
              descSpan.className = 'outline-none';
              descSpan.spellCheck = false;
              descSpan.style.cssText = 'text-decoration:underline dotted;text-decoration-color:rgba(156,163,175,0.8);text-underline-offset:6px;caret-color:auto';
              descSpan.textContent = contentDataLocal.imageDescription || contentDataLocal.title || '';
              
              textP.appendChild(changeTitleSpan);
              textP.appendChild(titleSpan);
              textP.appendChild(describeSpan);
              textP.appendChild(descSpan);
              textDiv.appendChild(textP);
              
              const buttonsDiv = document.createElement('div');
              buttonsDiv.className = 'flex gap-2';
              
              // Upload button (icon only, no functionality)
              const lockedUploadBtn = document.createElement('button');
              lockedUploadBtn.id = `recommended-locked-tooltip-upload-${cardIndex}`;
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
              
              const lockedRemixBtn = document.createElement('button');
              lockedRemixBtn.id = `recommended-locked-tooltip-remix-${cardIndex}`;
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
              
              const lockedSaveBtn = document.createElement('button');
              lockedSaveBtn.id = `recommended-locked-tooltip-save-${cardIndex}`;
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
              
              remixContainer.appendChild(textDiv);
              remixContainer.appendChild(buttonsDiv);
              
              document.body.appendChild(remixContainer);
              
              // Get card element for scroll tracking
              const cardElement = document.querySelector(`[data-card-index="${cardIndex}"]`);
              const initialCardRect = cardElement ? cardElement.getBoundingClientRect() : null;
              const initialTooltipRect = rect;
              const initialBubbleTop = bubbleTop;
              const initialTooltipLeft = rect.left;
              const initialTooltipTop = rect.top;
              
              // Function to update positions on scroll
              const updatePositionsOnScroll = () => {
                requestAnimationFrame(() => {
                  const tooltip = document.getElementById(`recommended-tooltip-${cardIndex}`);
                  const bubble = document.getElementById(`recommended-locked-remix-panel-${cardIndex}`);
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
                  const bubbleRect = bubble.getBoundingClientRect();
                  const actualBubbleHeight = bubbleRect.height;
                  const spacing = 8;
                  const tooltipHeight = tooltipRect.height || 30;
                  
                  let bubbleTop = tooltipRect.top - spacing - actualBubbleHeight;
                  
                  // Viewport boundary check
                  const minTop = 10;
                  if (bubbleTop < minTop) {
                    bubbleTop = Math.max(minTop, tooltipRect.top - tooltipHeight - spacing - actualBubbleHeight);
                  }
                  
                  bubble.style.top = `${bubbleTop}px`;
                  bubble.style.left = `${tooltipRect.left}px`;
                });
              };
              
              // Add scroll listener
              const scrollHandler = () => updatePositionsOnScroll();
              window.addEventListener('scroll', scrollHandler, true);
              window.addEventListener('resize', scrollHandler);
              
              // Store scroll handler for cleanup
              remixContainer._scrollHandler = scrollHandler;
              
              // Function to reposition bubble based on actual height
              const repositionBubble = () => {
                requestAnimationFrame(() => {
                  const tooltip = document.getElementById(`recommended-tooltip-${cardIndex}`);
                  const bubble = document.getElementById(`recommended-locked-remix-panel-${cardIndex}`);
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
              
              const titleEl = remixContainer.querySelector(`#recommended-locked-tooltip-title-${cardIndex}`);
              const descEl = remixContainer.querySelector(`#recommended-locked-tooltip-desc-${cardIndex}`);
              const remixBtn = remixContainer.querySelector(`#recommended-locked-tooltip-remix-${cardIndex}`);
              const saveBtn = remixContainer.querySelector(`#recommended-locked-tooltip-save-${cardIndex}`);
              
              if (titleEl) {
                titleEl.addEventListener('input', (e) => {
                  const el = e.currentTarget;
                  const raw = el.innerText || '';
                  const clamped = raw.length > 50 ? raw.slice(0, 50) : raw;
                  if (clamped !== raw) el.innerText = clamped;
                  setRecommendedCardTitle(cardIndex, clamped);
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
                  // Reposition bubble after text change
                  repositionBubble();
                });
                descEl.addEventListener('keydown', (e) => {
                  if (e.key === 'Enter') { e.preventDefault(); return; }
                });
              }
              
              const triggerRemix = () => {
                try {
                  const imageDescription = (descEl?.innerText || contentDataLocal.imageDescription || contentDataLocal.title || 'content');
                  const newImageUrl = getPollinationsImage(imageDescription, mockThemeColor, { randomize: true });
                  const timestamp = Date.now();
                  const separator = newImageUrl.includes('?') ? '&' : '?';
                  const newUrl = `${newImageUrl}${separator}t=${timestamp}`;
                  setRecommendedCardRemixedImage(cardIndex, newUrl);
                  setRecommendedCardImageLoadingState(cardIndex, true);
                  console.log('Recommended card remix generated', { cardIndex, imageDescription, newUrl });
                } catch (err) {
                  console.error('Recommended card remix failed', err);
                }
              };
              
                if (remixBtn) remixBtn.addEventListener('click', (ev) => { ev.stopPropagation(); triggerRemix(); });
                if (saveBtn) saveBtn.addEventListener('click', (ev) => { 
                  ev.stopPropagation();
                  const titleValue = titleEl?.innerText || getRecommendedCardTitle(cardIndex);
                  const descValue = descEl?.innerText || contentDataLocal.imageDescription;
                  setRecommendedCardTitle(cardIndex, titleValue);
                  setRecommendedContentCards(prev => {
                    const updated = [...prev];
                    updated[cardIndex] = { ...updated[cardIndex], title: titleValue, imageDescription: descValue };
                    return updated;
                  });
                  triggerRemix();
                });
                
                // Initial reposition after bubble is created to ensure correct positioning
                repositionBubble();
                
                // Add document click listener to save and close when clicking outside
                const handleClickOutside = (e) => {
                  const tooltip = document.getElementById(`recommended-tooltip-${cardIndex}`);
                  const bubble = document.getElementById(`recommended-locked-remix-panel-${cardIndex}`);
                  
                  // Check if click is outside both tooltip and bubble
                  const isClickOnTooltip = tooltip && (tooltip.contains(e.target) || tooltip === e.target);
                  const isClickOnBubble = bubble && (bubble.contains(e.target) || bubble === e.target);
                  const isClickOnCard = e.target.closest(`[data-card-index="${cardIndex}"]`);
                  
                  if (!isClickOnTooltip && !isClickOnBubble && !isClickOnCard) {
                    // Click is outside - save content and close
                    const titleValue = titleEl?.innerText || getRecommendedCardTitle(cardIndex);
                    const descValue = descEl?.innerText || contentDataLocal.imageDescription;
                    
                    // Save the content
                    setRecommendedCardTitle(cardIndex, titleValue);
                    setRecommendedContentCards(prev => {
                      const updated = [...prev];
                      updated[cardIndex] = { ...updated[cardIndex], title: titleValue, imageDescription: descValue };
                      return updated;
                    });
                    
                    // Trigger remix if description changed
                    if (descValue && descValue !== contentDataLocal.imageDescription) {
                      triggerRemix();
                    }
                    
                    // Clean up scroll listener
                    if (bubble && bubble._scrollHandler) {
                      window.removeEventListener('scroll', bubble._scrollHandler, true);
                      window.removeEventListener('resize', bubble._scrollHandler);
                      delete bubble._scrollHandler;
                    }
                    
                    // Close tooltip and bubble
                    if (tooltip && tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
                    if (bubble && bubble.parentNode) bubble.parentNode.removeChild(bubble);
                    window.__recommendedTooltipLocked = false;
                    
                    // Remove this listener
                    document.removeEventListener('mousedown', handleClickOutside);
                  }
                };
                
                // Add the listener with a small delay to avoid immediate trigger
                setTimeout(() => {
                  document.addEventListener('mousedown', handleClickOutside);
                }, 100);
                });
              });
            } catch {}
          }, 0);
        }}
      >
        {/* Image area */}
        {imageSrc && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-full relative">
              {/* Loading spinner */}
              {isRecommendedCardImageLoading(cardIndex) && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="w-6 h-6 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs text-gray-600">Loading image...</span>
                  </div>
                </div>
              )}
              
              {/* Image */}
              {shouldShowContent && imageSrc ? (
                <img 
                  src={imageSrc}
                  alt={cardContent.imageDescription || cardContent.title}
                  className="w-full h-full object-cover rounded-lg"
                  style={{ display: isRecommendedCardImageLoading(cardIndex) ? 'none' : 'block' }}
                  onLoad={() => {
                    console.log('=== RECOMMENDED CARD IMAGE LOADED ===', { 
                      cardIndex, 
                      src: imageSrc,
                      wasRemixed: hasRemixedImage
                    });
                    setRecommendedCardImageLoadingState(cardIndex, false);
                  }}
                  onError={(e) => {
                    console.log('=== RECOMMENDED CARD IMAGE LOAD ERROR ===', { 
                      src: e.target.src,
                      cardIndex
                    });
                    setRecommendedCardImageLoadingState(cardIndex, false);
                    e.target.style.display = 'none';
                  }}
                  onLoadStart={() => {
                    console.log('=== RECOMMENDED CARD IMAGE LOAD START ===', { 
                      cardIndex, 
                      src: imageSrc
                    });
                    setRecommendedCardImageLoadingState(cardIndex, true);
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Bottom rectangle with text field */}
        <div 
          className="absolute bottom-0 left-0 right-0 z-10 p-2 backdrop-blur-md backdrop-filter shadow-none"
          style={{ 
            backgroundColor: getReadableOnColor(mockThemeColor) + 'CC',
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
               ...(mockThemeColor.includes('gradient') 
                 ? { background: mockThemeColor, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }
                 : { color: mockThemeColor }
               )
             }}>
            {shouldShowContent ? displayTitle : 'Add content'}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#E9EFF5' }}>
      {/* Header */}
      <header className="absolute inset-x-0 top-0 z-50">
        <nav className="flex items-center justify-between p-6 lg:px-8">
          <div className="flex lg:flex-1">
            <a href="/" className="-m-1.5 p-1.5">
              <span className="text-2xl font-bold themer-gradient">Themer</span>
            </a>
          </div>
        </nav>
      </header>

      <main className="relative isolate">
        {/* Hero section */}
        <div className="overflow-hidden">
          <div className="mx-auto max-w-7xl px-6 pb-4 pt-36 sm:pt-60 lg:px-8 lg:pt-32">
            <div className="mx-auto max-w-4xl gap-x-20 lg:mx-0 lg:flex lg:max-w-none lg:items-center lg:justify-center">
              <div className="w-full max-w-3xl lg:basis-1/2 xl:basis-1/2 lg:shrink-0 xl:max-w-3xl flex flex-col items-center text-center">
                <h1 className="text-6xl font-extrabold tracking-tight text-gray-900 whitespace-nowrap text-center">
                  Personalize in-flight experiences.
                </h1>
                <p className="relative mt-6 text-lg leading-8 text-gray-600 sm:max-w-md lg:max-w-none text-center whitespace-nowrap">
                  Curate experiences your passengers would love.
                </p>
                <div className="mt-10 flex items-center justify-center">
                  <div
                    onClick={() => {
                      navigate('/dashboard');
                    }}
                    className="shadow-md cursor-pointer transition-all duration-200 hover:opacity-90"
                    style={{
                      width: '200px',
                      height: '48px',
                      borderTopLeftRadius: '0px',
                      borderTopRightRadius: '24px',
                      borderBottomLeftRadius: '24px',
                      borderBottomRightRadius: '24px',
                      backgroundColor: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <span
                      className="text-lg font-semibold"
                      style={{ color: '#FFFFFF' }}
                    >
                      Build themes
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
        
        {/* Theme Preview Section */}
        <div className="w-full flex justify-center" style={{ marginTop: 0 }}>
          <div style={{ position: 'relative', width: 1400, height: 1100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
            <img
              src={process.env.PUBLIC_URL + '/ife-frame.svg'}
              alt="Mobile Frame"
              style={{ position: 'absolute', top: -40, left: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' }}
            />
            <div style={{ position: 'relative', zIndex: 2, width: 1302, margin: '92px auto 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
              <div className="fjb-fps-container" style={{ width: 1328, maxWidth: 1328, marginLeft: -2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, background: mockThemeColor, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, padding: 16, paddingTop: 80, paddingBottom: 40, marginTop: 4, position: 'relative' }}>
                <div style={{ width: '100%', marginTop: -32, display: 'flex', flexDirection: 'column', gap: 28 }}>
                  <FlightJourneyBar origin={mockOrigin} destination={mockDestination} minutesLeft={minutesLeft} themeColor={mockThemeColor} isLandingPage={true} />
                  <FlightProgress 
                    landingIn={landingIn} 
                    maxFlightMinutes={maxFlightMinutes} 
                    minutesLeft={minutesLeft} 
                    onProgressChange={handleProgressChange} 
                    themeColor={mockThemeColor}
                    isPromptMode={false}
                    onPromptHover={() => {}}
                    onPromptClick={() => {}}
                    fpsPrompts={{}}
                    showMovingIcon={showMovingIcon}
                    onAnimationProgressChange={handleAnimationProgressChange}
                    onPromoCardLoadingChange={handlePromoCardLoadingChange}
                    onAnimationProgress={handleAnimationProgress}
                    onCruiseLabelShow={handleCruiseLabelShow}
                    onMiddleCardPromptClose={handleMiddleCardPromptClose}
                    onThemeColorChange={handleThemeColorChange}
                    onRequestFJBPrompt={handleRequestFJBPrompt}
                    fjbThemeComplete={fjbThemeComplete}
                    showFJBPrompt={showFJBPrompt}
                    onFJBThemeApplyRequest={handleFJBThemeApplyRequest}
                    flightsGenerated={false}
                    onFlightPhaseSelect={() => {}}
                    selectedFlightPhase={null}
                  />
                </div>
              </div>
              <Component3Cards 
                themeColor={mockThemeColor} 
                routes={mockRoutes}
                isPromptMode={hasReachedClimb && cruiseLabelShown && fjbThemeComplete && !middleCardPromptClosed}
                onPromptHover={() => {}}
                onPromptClick={hasReachedClimb ? handleMiddleCardPromptClick : () => {}} // Disable clicks before climb
                promptStates={{ 'promo-card-0': false }} // Don't show promo card prompt bubble until FlightProgress controls it
                animationProgress={animationProgress}
                cruiseLabelShown={cruiseLabelShown}
                middleCardPromptClosed={middleCardPromptClosed}
                isThemeBuildStarted={true}
                colorPromptSaved={colorPromptSaved}
                origin={mockOrigin}
                destination={mockDestination}
                selectedFlightPhase={selectedFlightPhase}
                promoCardContents={promoCardContents}
                colorPromptClosedWithoutSave={false}
                currentRouteKey={currentRouteKey}
                isModifyClicked={false}
                selectedDates={[]}
                isCurrentThemeFestive={() => false}
                getRouteSelectedThemeChip={() => null}
                selectedProfile={null}
                hasReachedTakeoff={hasReachedTakeoff}
                visibleCardIndices={visibleCardIndices}
                isCardAnimationInProgress={isCardAnimationInProgress}
              />
              
              {/* FJB Theme Prompt Bubble - Paris, Berlin, Oktoberfest chips */}
              {showFJBPrompt && createPortal(
                <PromptBubble
                  isVisible={true}
                  position={fJBPromptPosition}
                  elementType="flight-journey-bar"
                  elementData={{ origin: mockOrigin, destination: mockDestination }}
                  onClose={handleFJBPromptBubbleClose}
                  onSubmit={handleFJBPromptSubmit}
                  themeColor={mockThemeColor}
                  isThemeBuildStarted={true}
                  positionKey="fjb-landing"
                  selectedFlightSegment={{ origin: mockOrigin, destination: mockDestination }}
                  selectedDates={['2024-09-15']}
                  onThemeColorChange={handleThemeColorChange}
                />,
                document.body
              )}

              {/* Debug Info */}
              {console.log('=== COMPONENT RENDER DEBUG ===', {
                cruiseLabelShown,
                middleCardPromptClosed,
                fjbThemeComplete,
                showFJBPrompt,
                showMiddleCardPrompt,
                showMovingIcon
              })}
              
              {/* Recommended for you section */}
              <div
                className="flex flex-col items-start"
                style={{ width: '1302px', gap: '24px' }}
              >
                <p className="block text-left text-black font-bold" style={{ fontSize: '28px', lineHeight: '36px', margin: 0 }}>
                  Recommended for you
                </p>
                
                {/* 4 Recommended Content Cards */}
                <div
                  className="grid grid-cols-4 gap-6"
                  style={{ width: '100%' }}
                >
                  {[0, 1, 2, 3].map((cardIndex) => renderRecommendedCard(cardIndex))}
                        </div>
              </div>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
} 