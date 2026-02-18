import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, PaperAirplaneIcon, PlusIcon, PhotoIcon, ArrowLeftIcon, ArrowRightIcon, CheckIcon, BookmarkIcon, ArrowPathIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { HexColorPicker } from 'react-colorful';
import { getReadableOnColor } from '../utils/color';
import { argbFromHex } from '@material/material-color-utilities';
import { getFestivalsForFlightSegment, formatFestivalChips, getPromoCardContent, getContentCardContent, shouldUseFestivalContent } from '../utils/festivalUtils';
import { 
  getTextWidth, 
  calculateRequiredHeight, 
  initializePromoValues, 
  normalizeColor, 
  updateGradient 
} from '../utils/promptBubbleUtils';
import { 
  TEXT_CHAR_LIMIT, 
  getBubbleWidth, 
  FLIGHT_PHASE_CHIPS, 
  LOGO_CHIPS, 
  DEFAULT_GRADIENT_STOPS, 
  DEFAULT_GRADIENT_DIRECTION,
  ANIMATION_DELAYS,
  POSITION_OFFSETS 
} from '../constants/promptBubbleConstants';
// PromoCardPlaceholder component has been extracted to its own file
export default function PromptBubble({ 
  isVisible, 
  position, 
  elementType, 
  elementData, 
  onClose, 
  onSubmit,
  themeColor = '#1E1E1E',
  isThemeBuildStarted = false,
  existingText = '',
  positionKey,
  fpsPrompts = {},
  onLoadingStateChange,
  onVisibilityChange,
  onThemeColorChange,
  themeChips = [],
  selectedLogo = null,
  onLogoSelect,
  flightsGenerated = false,
  selectedFlightPhase = null,
    onFlightPhaseSelect,
    onCloseWithoutSave,
    selectedFlightSegment = null,
    selectedDates = [],
    modifiedChipColors = {},
    setModifiedChipColors
}) {
  console.log('=== PROMPT BUBBLE RENDER ===', {
    isVisible,
    position,
    elementType,
    positionKey,
    themeColor,
    existingText,
    existingTextLength: existingText?.length
  });
  const [promptText, setPromptText] = useState((elementType === 'flight-icon' || elementType === 'flight-phase-button') && positionKey === 'landing-demo' ? 'Cruise' : (elementType === 'promo-card' ? '' : ''));
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [autoTyping, setAutoTyping] = useState(false);
  const [autoTypeIndex, setAutoTypeIndex] = useState(0);
  const [stickyPosition, setStickyPosition] = useState(null);
  const [selectedChip, setSelectedChip] = useState((elementType === 'flight-icon' || elementType === 'flight-phase-button') && positionKey === 'landing-demo' ? 'cruise' : null);
  const [contentHeight, setContentHeight] = useState('auto');
  // calculateRequiredHeight function is now imported from utils
  // getTextWidth function is now imported from utils
  // initializePromoValues function is now imported from utils
  const initialPromoValues = initializePromoValues(elementType, existingText, elementData, selectedFlightSegment, selectedDates, selectedFlightPhase);
  // State for promo card editable inputs
  const [promoTextValue, setPromoTextValue] = useState(initialPromoValues.text);
  const [promoImageValue, setPromoImageValue] = useState(initialPromoValues.image);
  
  console.log('=== PROMPT BUBBLE INITIALIZATION ===', {
    elementType,
    existingText,
    initialPromoValues,
    promoTextValue,
    promoImageValue
  });
  const [isPromoTextFocused, setIsPromoTextFocused] = useState(false);
  const [isPromoImageFocused, setIsPromoImageFocused] = useState(false);
  const [promoResetTrigger, setPromoResetTrigger] = useState(0);
  const [promoEdited, setPromoEdited] = useState(false);
  // Update promo values when existingText changes (for promo cards)
  useEffect(() => {
    // Do not overwrite user edits while either field is focused
    if (isPromoTextFocused || isPromoImageFocused || promoEdited) return;
    console.log('=== PROMO VALUES USEEFFECT TRIGGERED ===', {
      elementType,
      existingText,
      existingTextLength: existingText?.length,
      isPromoCard: elementType === 'promo-card',
      hasExistingText: !!existingText,
      isVisible
    });
    
    if (elementType === 'promo-card' && existingText && isVisible) {
      const newPromoValues = initializePromoValues(elementType, existingText, elementData, selectedFlightSegment, selectedDates, selectedFlightPhase);
      console.log('=== UPDATING PROMO VALUES FROM EXISTING TEXT ===', {
        existingText,
        newPromoValues,
        currentPromoTextValue: promoTextValue,
        currentPromoImageValue: promoImageValue
      });
      setPromoTextValue(newPromoValues.text);
      setPromoImageValue(newPromoValues.image);
    }
  }, [existingText, elementType, elementData, selectedFlightSegment, selectedDates, selectedFlightPhase, isVisible, isPromoTextFocused, isPromoImageFocused, promoEdited]);

  // Additional useEffect to handle when prompt bubble becomes visible
  useEffect(() => {
    // Do not overwrite user edits while either field is focused
    if (isPromoTextFocused || isPromoImageFocused || promoEdited) return;
    if (isVisible && elementType === 'promo-card' && existingText) {
      console.log('=== PROMPT BUBBLE BECAME VISIBLE ===', {
        elementType,
        existingText,
        isVisible
      });
      const newPromoValues = initializePromoValues(elementType, existingText, elementData, selectedFlightSegment, selectedDates, selectedFlightPhase);
      console.log('=== SETTING VALUES ON VISIBILITY ===', {
        newPromoValues
      });
      setPromoTextValue(newPromoValues.text);
      setPromoImageValue(newPromoValues.image);
    }
  }, [isVisible, elementType, existingText, elementData, selectedFlightSegment, selectedDates, selectedFlightPhase, isPromoTextFocused, isPromoImageFocused, promoEdited]);

  // Debug promo state changes
  useEffect(() => {
    console.log('=== PROMO STATE CHANGE ===', {
      promoTextValue,
      promoImageValue,
      elementType,
      existingText,
      isVisible
    });
  }, [promoTextValue, promoImageValue, elementType, existingText, isVisible]);
  // Debug state changes
  useEffect(() => {
    console.log('=== PROMO TEXT VALUE CHANGED ===', { promoTextValue });
  }, [promoTextValue]);
  useEffect(() => {
    console.log('=== PROMO IMAGE VALUE CHANGED ===', { promoImageValue });
  }, [promoImageValue]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showGradientPicker, setShowGradientPicker] = useState(false);
  const [activeChipColorPicker, setActiveChipColorPicker] = useState(null); // Track which chip's color picker is open
  const [selectedChipData, setSelectedChipData] = useState(null); // Track which chip was clicked and its data
  const [gradientStops, setGradientStops] = useState(DEFAULT_GRADIENT_STOPS);
  const [gradientDirection, setGradientDirection] = useState(DEFAULT_GRADIENT_DIRECTION);
  const [selectedColor, setSelectedColor] = useState(() => {
    // Initialize with logo color if available, otherwise use themeColor
    if (selectedLogo && selectedLogo.id) {
      const logoColorMap = {
        'discover': '#1E72AE',
        'lufthansa': '#0A1D3D',
        'swiss': '#CB0300'
      };
      return logoColorMap[selectedLogo.id] || themeColor;
    }
    return themeColor;
  });
  const [pendingColor, setPendingColor] = useState(null); // Track color selection before save
  const bubbleRef = useRef(null);
  const inputRef = useRef(null);
  // Ensure selectedColor is always in sync with the current theme/logo
  useEffect(() => {
    // If we have a selected logo, prioritize its color
    if (selectedLogo && selectedLogo.id) {
      const logoColorMap = {
        'discover': '#1E72AE',
        'lufthansa': '#0A1D3D',
        'swiss': '#CB0300'
      };
      const logoColor = logoColorMap[selectedLogo.id];
      if (logoColor) {
        setSelectedColor(logoColor);
        return;
      }
    }
    // Otherwise, use the theme color
    setSelectedColor(themeColor);
  }, [selectedLogo, themeColor]);
  // When prompt bubble becomes visible, ensure selectedColor reflects the current theme
  useEffect(() => {
    if (isVisible && elementType === 'flight-journey-bar') {
      setSelectedColor(themeColor);
      // Clear any pending color when reopening to start fresh
      setPendingColor(null);
    }
  }, [isVisible, elementType, themeColor]);
  // Determine background color - use theme color for change theme prompts, blue for other flight card prompts
  const isChangeThemePrompt = elementType === 'flight-journey-bar';
  const isAnimationPrompt = elementType === 'flight-journey-bar-animation';
  const isFlightCardPrompt = (elementType === 'flight-phase-button') 
    && (positionKey && (positionKey.includes('inline-flight') || positionKey === 'fjb-dashboard' || positionKey === 'flight-phase-button-dashboard'));
  // IFE frame prompts have these position keys
  const isIFEFramePrompt = positionKey && (positionKey.includes('landing') || positionKey.includes('demo') || !positionKey.includes('dashboard') && !positionKey.includes('inline-flight'));
  const flightCardBlue = '#2563eb'; // Same blue as generate flights button (bg-blue-600)
  const darkContainerColor = '#1f2937'; // Dark gray container color (bg-gray-800)
  // Determine text/icon color for readability on promo-card bubbles (dashboard)
  const actualBackgroundColor = darkContainerColor; // Use dark container color for all prompt bubbles
  const isGradient = false; // Force to false since we're using solid dark container color
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
  const shouldUseLightText = (color) => {
    if (isGradient) {
      // For gradients, analyze the first color stop to determine text color
      const firstColorMatch = color.match(/#([0-9a-fA-F]{6})/);
      if (firstColorMatch) {
        const firstColor = `#${firstColorMatch[1]}`;
        const lum = getLuminance(parseHex(firstColor));
        return lum < 0.5; // dark bg => light text
      }
      // If we can't extract a color from gradient, default to light text for safety
      return true;
    }
    if (typeof color === 'string' && color.startsWith('#') && (color.length === 7)) {
      const lum = getLuminance(parseHex(color));
      return lum < 0.5; // dark bg => light text
    }
    // Fallback to light text
    return true;
  };
  // Decide readable text/icon color for ALL bubble types
  const useLightText = (() => {
    if (positionKey === 'middle-card-landing' || positionKey === 'fjb-landing') return true;
    // Since all bubbles now use dark container color, always use light text
    return true;
  })();
  // Choose a contrasting border color so the bubble edge is always visible
  const contrastingBorderColor = useLightText ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.35)';
  // Compute Material readable on-color for chip borders/text
  const onHex = getReadableOnColor(actualBackgroundColor);
  const onRgb = (() => {
    try {
      const { r, g, b } = parseHex(onHex);
      return { r, g, b };
    } catch (error) {
      console.warn('Failed to parse onHex color:', onHex, error);
      return { r: 255, g: 255, b: 255 }; // fallback to white
    }
  })();
  // Create adaptive text colors that ensure good contrast
  const adaptiveTextColor = (() => {
    // For very light backgrounds, use dark text; for dark backgrounds, use light text
    if (useLightText) {
      // Dark background - use light text with good contrast
      return '#FFFFFF'; // Pure white for maximum contrast
    } else {
      // Light background - use dark text with good contrast
      return '#000000'; // Pure black for maximum contrast
    }
  })();
  // Text colors with different opacities for hierarchy
  const onText90 = `rgba(${onRgb.r}, ${onRgb.g}, ${onRgb.b}, 0.9)`; // Primary text
  const onText70 = `rgba(${onRgb.r}, ${onRgb.g}, ${onRgb.b}, 0.7)`; // Secondary text
  const onText50 = `rgba(${onRgb.r}, ${onRgb.g}, ${onRgb.b}, 0.5)`; // Hint text
  const onBorder20 = `rgba(${onRgb.r}, ${onRgb.g}, ${onRgb.b}, 0.2)`;
  // Fallback border color if onBorder20 calculation fails - ensure it's always visible
  const fallbackBorderColor = useLightText ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';
  // Ensure we always have a valid border color
  const safeBorderColor = onBorder20 || fallbackBorderColor;
  // Additional safety: if the calculated border color is too transparent, use the fallback
  const finalBorderColor = (() => {
    if (safeBorderColor && safeBorderColor.includes('rgba')) {
      const alphaMatch = safeBorderColor.match(/rgba\([^)]+,\s*([^)]+)\)/);
      if (alphaMatch) {
        const alpha = parseFloat(alphaMatch[1]);
        if (alpha < 0.3) {
          console.log('Border color too transparent, using fallback');
          return fallbackBorderColor;
        }
      }
    }
    return safeBorderColor;
  })();
  // Debug logging for border colors
  console.log('Border color debug:', {
    actualBackgroundColor,
    onHex,
    onBorder20,
    fallbackBorderColor,
    safeBorderColor,
    finalBorderColor,
    useLightText
  });
  // Calculate contrast ratio between selected color and a reference color (white)
  const calculateContrastRatio = (color1, color2 = '#FFFFFF') => {
    try {
      if (!color1 || !color2) return null;
      // Handle gradients by extracting first hex color
      const extractHex = (input) => {
        if (typeof input !== 'string') return null;
        if (input.includes('gradient')) {
          const hexMatch = input.match(/#([0-9a-fA-F]{6})/);
          return hexMatch ? `#${hexMatch[1]}` : null;
        }
        return input.match(/^#([0-9a-fA-F]{6})$/) ? input : null;
      };
      const hex1 = extractHex(color1);
      const hex2 = extractHex(color2);
      if (!hex1 || !hex2) return null;
      const argb1 = argbFromHex(hex1);
      const argb2 = argbFromHex(hex2);
      // Convert ARGB to RGB
      const argbToRgb = (argb) => ({
        r: (argb >> 16) & 0xff,
        g: (argb >> 8) & 0xff, 
        b: argb & 0xff
      });
      // Calculate relative luminance
      const relativeLuminance = ({ r, g, b }) => {
        const toLinear = (c) => {
          const v = c / 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
      };
      const l1 = relativeLuminance(argbToRgb(argb1));
      const l2 = relativeLuminance(argbToRgb(argb2));
      const [L1, L2] = l1 > l2 ? [l1, l2] : [l2, l1];
      return (L1 + 0.05) / (L2 + 0.05);
    } catch (error) {
      console.warn('Error calculating contrast ratio:', error);
      return null;
    }
  };
  // Bubble width (wider for FJB to accommodate more chips)
  const bubbleWidth = getBubbleWidth(elementType);
  // Update content height when text changes
  useEffect(() => {
    if (elementType === 'promo-card') {
      const newHeight = calculateRequiredHeight(promoTextValue, promoImageValue);
      setContentHeight(newHeight);
    }
  }, [promoTextValue, promoImageValue, elementType, bubbleWidth]);
  // Flight phase chips for FPS
  const flightPhaseChips = FLIGHT_PHASE_CHIPS;
  // Festival chips based on route and dates
  const getFestivalChips = () => {
    if (!selectedFlightSegment || !selectedDates || selectedDates.length === 0) {
      return [];
    }
    const festivals = getFestivalsForFlightSegment(selectedFlightSegment, selectedDates);
    return formatFestivalChips(festivals);
  };
  const festivalChips = getFestivalChips();
  // Logo placeholder chips
  const logoChips = [
    { id: 'discover', label: 'Discover' },
    { id: 'lufthansa', label: 'Lufthansa' },
    { id: 'swiss', label: 'Swiss' }
  ];
  // Set sticky position when bubble becomes visible or when target changes
  useEffect(() => {
    console.log('=== PROMPT BUBBLE POSITION UPDATE ===', { 
      isVisible, position, elementType, positionKey 
    });
    if (!isVisible || !position) {
      setStickyPosition(null);
      return;
    }
    // Choose the appropriate container based on element type and position key
    let containerLeft = 0;
    let containerTop = 0;
    let containerSelector = '';
    if (elementType === 'flight-icon' || positionKey === 'landing-demo') {
      // Check if this is a button trigger (position is in viewport coords) vs progress bar trigger (container coords)
      // Button triggers have specific elementData values: progress: 0.5, minutesLeft: 200
      if (elementData && elementData.progress === 0.5 && elementData.minutesLeft === 200) {
        // Button trigger: position is given in viewport coords; convert to document
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        setStickyPosition({ x: position.x + scrollX, y: position.y + scrollY });
        return;
      }
      // FPS prompt bubbles use flight progress bar container; position is relative to container
      containerSelector = '.flight-progress-bar-container';
    } else if (elementType === 'flight-journey-bar' || elementType === 'flight-journey-bar-animation' || positionKey === 'fjb-demo' || positionKey === 'fjb-landing') {
      // FJB: position is given in viewport coords; convert to document
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      setStickyPosition({ x: position.x + scrollX, y: position.y + scrollY });
      return;
    } else if (elementType === 'promo-card' || elementType === 'content-card' || elementType === 'flight-phase-button' || positionKey === 'middle-card-demo' || positionKey === 'middle-card-landing') {
      // Promo-card/content-card/flight-phase-button: viewport -> document
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      setStickyPosition({ x: position.x + scrollX, y: position.y + scrollY });
      return;
    } else {
      containerSelector = '.flight-progress-bar-container';
    }
    const targetContainer = document.querySelector(containerSelector);
    if (targetContainer) {
      const containerRect = targetContainer.getBoundingClientRect();
      containerLeft = containerRect.left;
      containerTop = containerRect.top;
    }
    // Convert relative coordinates to document coordinates
    const absoluteX = containerLeft + position.x;
    const absoluteY = containerTop + position.y;
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const newStickyPosition = { x: absoluteX + scrollX, y: absoluteY + scrollY };
    console.log('=== SETTING STICKY POSITION ===', {
      elementType, positionKey, containerSelector, position, newStickyPosition
    });
    setStickyPosition(newStickyPosition);
  }, [isVisible, position, elementType, positionKey]);
  // Update selectedColor when themeColor changes (for automatic theme cycling)
  useEffect(() => {
    setSelectedColor(themeColor);
  }, [themeColor]);
  // Update position on scroll to maintain relative position
  useEffect(() => {
    if (!isVisible || !stickyPosition) return;
    const handleScroll = () => {
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      // Convert document coordinates back to viewport coordinates for fixed positioning
      const viewportX = stickyPosition.x - scrollX;
      const viewportY = stickyPosition.y - scrollY;
      // Position bubble at the pointer with minimal clamping (no offsets for flight card prompts)
      // For FJB clicks, position the bubble below the hover button
      let finalX, finalY;
      if (elementType === 'flight-journey-bar' || elementType === 'flight-journey-bar-animation' || positionKey === 'fjb-demo' || positionKey === 'fjb-landing') {
        // For FJB, position directly below the hover tip and align left with the tip
        // viewportX is the anchor X (left edge of hover tip); keep X as-is
        finalX = viewportX;
        // Maintain an 8px vertical gap between hover tip and bubble
        finalY = viewportY + 8;
        // Ensure the bubble doesn't go off-screen
        if (finalY + 200 > window.innerHeight) {
          // If bubble would go below viewport, position it above the hover tip instead
          finalY = Math.max(4, viewportY - 220);
        }
        if (finalX + bubbleWidth > window.innerWidth) {
          // If bubble would go off right edge, adjust X position
          finalX = window.innerWidth - bubbleWidth - 10;
        }
        if (finalX < 0) {
          // If bubble would go off left edge, adjust X position
          finalX = 10;
        }
      } else {
        // For other elements, apply minimal clamping
        const minX = isFlightCardPrompt ? 0 : 4; // No left margin for flight card prompts
        const minY = isFlightCardPrompt ? 0 : 4; // No top margin for flight card prompts
        finalX = Math.max(minX, Math.min(viewportX, window.innerWidth - (bubbleWidth + 10)));
        finalY = Math.max(minY, Math.min(viewportY, window.innerHeight - 200));
      }
      console.log('=== PROMPT BUBBLE SCROLL POSITION ===', {
        stickyPosition,
        scrollX,
        scrollY,
        viewportX,
        viewportY,
        finalX,
        finalY,
        elementType,
        positionKey
      });
      if (bubbleRef.current) {
        bubbleRef.current.style.left = `${finalX}px`;
        bubbleRef.current.style.top = `${finalY}px`;
      }
    };
    // Set initial position
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isVisible, stickyPosition]);
  // Keep FJB prompt bubble tethered to the hover tip even during transitions/animations
  useEffect(() => {
    if (!isVisible) return;
    if (!(elementType === 'flight-journey-bar' || elementType === 'flight-journey-bar-animation')) return;
    let rafId;
    const updateToHoverTip = () => {
      const el = document.querySelector('[data-fjb-hover-tip="true"]') || document.querySelector('[data-hover-tip]');
      if (el && bubbleRef.current) {
        const r = el.getBoundingClientRect();
        // Left-align to hover tip; keep 8px gap
        let x = r.left;
        let y = r.bottom + 8;
        // Clamp horizontally
        if (x + bubbleWidth > window.innerWidth) x = window.innerWidth - bubbleWidth - 10;
        if (x < 10) x = 10;
        // Clamp vertically to stay in viewport; if overflow, place above tip
        if (y + 200 > window.innerHeight) y = Math.max(4, r.bottom - 220);
        bubbleRef.current.style.left = `${x}px`;
        bubbleRef.current.style.top = `${y}px`;
      }
      rafId = requestAnimationFrame(updateToHoverTip);
    };
    rafId = requestAnimationFrame(updateToHoverTip);
    return () => cancelAnimationFrame(rafId);
  }, [isVisible, elementType, bubbleWidth]);
  // Auto-typing effect for middle card landing page; FJB landing uses theme chips only (no typing)
  useEffect(() => {
    if (isVisible && (positionKey === 'middle-card-landing' && elementType === 'promo-card') && !autoTyping) {
      console.log('=== STARTING AUTO TYPING ===', { positionKey, elementType });
      setIsLoading(false);
      setAutoTyping(true);
      setAutoTypeIndex(0);
      setPromptText('');
    }
  }, [isVisible, positionKey, elementType, autoTyping]);
  // Auto-typing animation
  useEffect(() => {
    if (autoTyping) {
      let targetText = '';
      let positionKeyToCheck = '';
      if (positionKey === 'middle-card-landing') {
        targetText = 'Croissants at 3€';
        positionKeyToCheck = 'middle-card-landing';
      } else if (positionKey === 'fjb-landing') {
        targetText = 'add spring theme in paris';
        positionKeyToCheck = 'fjb-landing';
      }
      if (targetText && positionKey === positionKeyToCheck) {
        if (autoTypeIndex < targetText.length) {
          const timer = setTimeout(() => {
            setPromptText(targetText.substring(0, autoTypeIndex + 1));
            setAutoTypeIndex(autoTypeIndex + 1);
          }, 100); // Type at 100ms per character
          return () => clearTimeout(timer);
        } else {
          // Finished typing - trigger continuation after a short delay
          setAutoTyping(false);
          console.log('=== AUTO TYPING COMPLETE ===', { positionKey });
          // Auto-submit after typing is complete
          setTimeout(() => {
            console.log('=== AUTO SUBMITTING PROMPT ===', { positionKey });
            console.log('=== CHECKING POSITION KEY ===', { 
              positionKey, 
              isFJBLanding: positionKey === 'fjb-landing',
              elementType,
              promptText 
            });
            // For FJB landing page, auto-click gradient button and then submit
            if (positionKey === 'fjb-landing') {
              console.log('=== AUTO CLICKING GRADIENT BUTTON ===');
              handleColorChange('#96e6a1'); // Set gradient color
              console.log('=== GRADIENT BUTTON CLICKED ===');
              // Auto-submit after a short delay
              setTimeout(() => {
                console.log('=== AUTO SUBMITTING FJB PROMPT ===');
                console.log('=== CALLING onSubmit WITH DATA ===', { 
                  promptText, 
                  elementType, 
                  elementData, 
                  positionKey,
                  onSubmitExists: !!onSubmit 
                });
                if (onSubmit) {
                  onSubmit(promptText, elementType, elementData, positionKey);
                  console.log('=== onSubmit CALLED SUCCESSFULLY ===');
                } else {
                  console.log('=== ERROR: onSubmit IS NULL ===');
                }
              }, 500); // 0.5 second delay after clicking gradient button
            } else {
              // For other prompt bubbles, submit normally
              console.log('=== NOT FJB LANDING - SUBMITTING NORMALLY ===', { positionKey });
              if (onSubmit) {
                onSubmit(promptText, elementType, elementData, positionKey);
              }
            }
          }, 1500); // 1.5 second delay after typing completes
        }
      }
    }
  }, [autoTyping, autoTypeIndex, positionKey]);
  // Get used prompts for filtering chips
  const getUsedPrompts = () => {
    const used = new Set();
    Object.values(fpsPrompts).forEach(promptText => {
      if (promptText) {
        used.add(promptText.toLowerCase());
      }
    });
    return used;
  };
  // Filter out chips that are already used at other positions
  const getAvailableChips = () => {
    if (elementType !== 'flight-icon' && elementType !== 'flight-phase-button') return flightPhaseChips;
    const usedPrompts = getUsedPrompts();
    const currentText = existingText.toLowerCase();
    // If flights are generated (showMovingIcon is true), show all chips as selected except "Add new"
    if (flightsGenerated) {
      return flightPhaseChips;
    }
    return flightPhaseChips.filter(chip => {
      const chipLabel = chip.label.toLowerCase();
      // Show chip if it's not used elsewhere, OR if it's the current position's text
      return !usedPrompts.has(chipLabel) || chipLabel === currentText;
    });
  };
  const availableChips = getAvailableChips();
  // Auto-click save button for landing page demo
  useEffect(() => {
    if (elementType === 'flight-icon' && positionKey === 'landing-demo' && isVisible) {
      console.log('=== LANDING DEMO AUTO-SUBMISSION CHECK ===', { 
        promptText, 
        isLoading, 
        promptTextTrimmed: promptText.trim(),
        shouldSubmit: promptText.trim() && !isLoading 
      });
      // Wait 3 seconds after prompt bubble appears, then auto-submit
      const timer = setTimeout(() => {
        if (promptText.trim() && !isLoading) {
          console.log('=== AUTO-SUBMITTING CRUISE ===');
          setIsLoading(true);
          onSubmit(promptText.trim(), elementType, elementData, positionKey);
          setPromptText('');
        } else {
          console.log('=== AUTO-SUBMISSION FAILED ===', { 
            promptText, 
            isLoading, 
            promptTextTrimmed: promptText.trim() 
          });
        }
      }, 3000); // 3 seconds delay after prompt bubble appears
      return () => clearTimeout(timer);
    }
  }, [isVisible, promptText, isLoading, elementType, positionKey, onSubmit, elementData]);
  // Auto-click save button for middle card demo
  useEffect(() => {
    if (elementType === 'promo-card' && positionKey === 'middle-card-demo' && isVisible && !isLoading && promptText.trim() && !isTyping) {
      console.log('=== MIDDLE CARD AUTO-SUBMISSION CHECK ===', { 
        promptText, 
        isLoading, 
        isTyping,
        promptTextTrimmed: promptText.trim(),
        shouldSubmit: promptText.trim() && !isLoading && !isTyping 
      });
      // Wait 2 seconds after typing animation completes, then auto-submit
      const timer = setTimeout(() => {
        console.log('=== AUTO-SUBMITTING MIDDLE CARD ===');
        setIsLoading(true);
        setPromptText('loading...');
        onSubmit(promptText.trim(), elementType, elementData, positionKey);
        // Close the bubble after submission
        setTimeout(() => {
          console.log('=== AUTO-CLOSING MIDDLE CARD BUBBLE ===');
          onClose();
        }, 500); // Close after 500ms to show loading state briefly
      }, 2000); // 2 seconds delay after text is ready
      return () => clearTimeout(timer);
    }
  }, [isVisible, promptText, isLoading, isTyping, elementType, positionKey, onSubmit, elementData, onClose]);
  // Function to simulate typing animation
  const startTypingAnimation = (text) => {
    console.log('=== STARTING TYPING ANIMATION ===', { text });
    setIsTyping(true);
    setTypedText('');
    let index = 0;
    const typeNextChar = () => {
      if (index < text.length) {
        setTypedText(prev => prev + text[index]);
        index++;
        setTimeout(typeNextChar, ANIMATION_DELAYS.TYPING_CHAR_DELAY); // Type each character with delay
      } else {
        console.log('=== TYPING ANIMATION COMPLETED ===');
        setIsTyping(false);
        setPromptText(text);
      }
    };
    typeNextChar();
  };
  // Focus input when bubble becomes visible and reset loading state
  useEffect(() => {
    if (isVisible && inputRef.current) {
      console.log('=== PROMPT BUBBLE BECAME VISIBLE ===', { elementType, positionKey, isVisible, existingText });
      inputRef.current.focus();
      if (elementType === 'promo-card' && positionKey === 'middle-card-demo') {
        console.log('=== STARTING MIDDLE CARD TYPING ANIMATION ===');
        // For middle card demo, start typing animation immediately without loading
        setIsLoading(false);
        setTimeout(() => {
          console.log('=== CALLING startTypingAnimation FOR MIDDLE CARD ===');
          startTypingAnimation('Croissants at 3€');
        }, 1000); // Increased delay to ensure DOM is ready
      } else if ((elementType === 'flight-journey-bar' || elementType === 'flight-journey-bar-animation') && positionKey === 'fjb-demo') {
        // For FJB demo, start typing animation immediately without loading
        setIsLoading(false);
        setTimeout(() => {
          if (elementType === 'flight-journey-bar-animation') {
            startTypingAnimation('add parallax animation');
          } else {
            startTypingAnimation('add eiffel tower animation');
          }
        }, 500); // Small delay before starting typing animation
      } else if (elementType === 'promo-card' && positionKey === 'middle-card-demo') {
        // Only demo card should auto type; dashboard promo cards should not
        setIsLoading(false);
        setTimeout(() => {
          startTypingAnimation('Croissants at 3€');
        }, 300);
      } else {
        console.log('=== PROMPT BUBBLE FALLBACK CASE ===', { elementType, positionKey, existingText });
        setIsLoading(false);
        // For promo cards, values are already initialized from existingText in useState
        if (elementType === 'promo-card') {
          console.log('=== PROMO CARD INITIALIZATION COMPLETE ===', { 
            elementType, 
            existingText, 
            currentPromoTextValue: promoTextValue,
            currentPromoImageValue: promoImageValue
          });
        } else {
          setPromptText(existingText); // Load existing text for this position
        }
      }
      // For landing page demo, show Cruise as already selected immediately
      if (elementType === 'flight-icon' && positionKey === 'landing-demo') {
        if (existingText === 'loading...') {
          setPromptText('loading...');
          setIsLoading(true);
        } else {
          setPromptText('Cruise');
          setSelectedChip('cruise');
        }
      }
    } else if (!isVisible) {
      // Reset states when bubble becomes invisible
      setSelectedChip(null);
      // Don't clear promo card values when bubble closes to keep them visible
      if (elementType !== 'promo-card') {
        setPromptText('');
      } else {
        // For promo cards, reset to empty when closing to ensure fresh state on reopen
        setPromoTextValue('');
        setPromoImageValue('');
        setPromoResetTrigger(prev => prev + 1);
      }
    }
  }, [isVisible, existingText, elementType, positionKey, onSubmit, elementData]);
  // Update content height when text changes
  useEffect(() => {
    if (elementType === 'promo-card' || elementType === 'content-card') {
      const newHeight = calculateRequiredHeight(promoTextValue, promoImageValue);
      setContentHeight(newHeight);
    }
  }, [promoTextValue, promoImageValue, elementType, bubbleWidth]);
  // Notify parent component when loading state changes
  useEffect(() => {
    if (onLoadingStateChange && elementType === 'promo-card') {
      onLoadingStateChange(isLoading);
    }
  }, [isLoading, elementType, onLoadingStateChange]);
  // Notify parent component when visibility changes
  useEffect(() => {
    if (onVisibilityChange && elementType === 'promo-card') {
      onVisibilityChange(isVisible);
    }
  }, [isVisible, elementType, onVisibilityChange]);
  // Handle click outside to close
  useEffect(() => {
    if (!isVisible) return;
    const handleClickOutside = (event) => {
      // Don't close if clicking on the hover tip
      const isHoverTip = event.target.closest('[data-hover-tip]') || 
                        event.target.closest('[class*="fjb-hover"]') ||
                        event.target.getAttribute('key')?.includes('fjb-hover');
      console.log('=== CLICK OUTSIDE CHECK ===', {
        isHoverTip,
        target: event.target,
        bubbleContains: bubbleRef.current?.contains(event.target),
        elementType
      });
      if (bubbleRef.current && !bubbleRef.current.contains(event.target) && !isHoverTip) {
        console.log('=== CLOSING PROMPT BUBBLE ===');
        // If this is a color changing prompt, call onCloseWithoutSave (regardless of pending changes)
        if ((elementType === 'flight-journey-bar' || elementType === 'flight-journey-bar-animation') && onCloseWithoutSave) {
          onCloseWithoutSave();
        }
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isVisible, onClose]);
  const handleSubmit = (e) => {
    e.preventDefault();
    // Check if submission is valid based on element type and step
    let isValidSubmission;
    if (elementType === 'flight-journey-bar' || elementType === 'flight-journey-bar-animation') {
      isValidSubmission = true; // No text input required for theme selection or animation
    } else if (elementType === 'promo-card') {
      if (elementData && elementData.cardType === 'content-card') {
        // For content cards, only text is required
        isValidSubmission = promoTextValue.trim();
      } else {
        // For regular promo cards, at least one field should be filled
        isValidSubmission = (promoTextValue.trim() || promoImageValue.trim());
      }
    } else {
      isValidSubmission = promptText.trim();
    }
    console.log('=== VALIDATION CHECK ===', { 
      elementType, 
      promoTextValue, 
      promoImageValue, 
      textTrimmed: promoTextValue.trim(), 
      imageTrimmed: promoImageValue.trim(), 
      isValidSubmission,
      isLoading
    });
    if (isValidSubmission && !isLoading) {
      setIsLoading(true);
      // For promo cards, combine the text and image values
      let submitText;
      if (elementType === 'promo-card') {
        if (elementData && elementData.cardType === 'content-card') {
          // For content cards, just use the text value
          submitText = promoTextValue.trim() || '';
        } else {
          // For regular promo cards, combine text and image values
          submitText = `text:${promoTextValue.trim()},image:${promoImageValue.trim()}`;
        }
      } else {
        submitText = promptText.trim() || '';
      }
      console.log('=== SUBMITTING PROMO CARD ===', { 
        elementType, 
        promoTextValue, 
        promoImageValue, 
        submitText, 
        elementData, 
        positionKey,
      });
      onSubmit(submitText, elementType, elementData, positionKey, {});
      // Clear promo card values after submission to show placeholder text again
      if (elementType === 'promo-card') {
        setPromoTextValue('');
        setPromoImageValue('');
        setPromoResetTrigger(prev => prev + 1); // Trigger reset of focus state
        setPromoEdited(false);
      } else {
        setPromptText('');
      }
    }
  };
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      // If this is a color changing prompt, call onCloseWithoutSave (regardless of pending changes)
      if ((elementType === 'flight-journey-bar' || elementType === 'flight-journey-bar-animation') && onCloseWithoutSave) {
        onCloseWithoutSave();
      }
      onClose();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift+Enter: allow line break
        return;
      } else {
        // Enter: submit and show loading
        e.preventDefault();
        // Check if submission is valid based on element type and step
        let isValidSubmission;
        if (elementType === 'flight-journey-bar') {
          isValidSubmission = true; // No text input required for theme selection
        } else if (elementType === 'promo-card') {
          if (elementData && elementData.cardType === 'content-card') {
            // For content cards, only text is required
            isValidSubmission = promoTextValue.trim();
          } else {
            // For regular promo cards, at least one field should be filled
            isValidSubmission = (promoTextValue.trim() || promoImageValue.trim());
          }
        } else {
          isValidSubmission = promptText.trim();
        }
        if (isValidSubmission) {
          setIsLoading(true);
          // For promo cards, combine the text and image values
          let submitText;
          if (elementType === 'promo-card') {
            if (elementData && elementData.cardType === 'content-card') {
              // For content cards, just use the text value
              submitText = promoTextValue.trim() || '';
            } else {
              // For regular promo cards, combine text and image values
              submitText = `text:${promoTextValue.trim()},image:${promoImageValue.trim()}`;
            }
          } else {
            submitText = promptText.trim() || '';
          }
          console.log('=== KEYBOARD SUBMITTING PROMO CARD ===', { 
            elementType, 
            promoTextValue, 
            promoImageValue, 
            submitText, 
            elementData, 
            positionKey,
          });
          onSubmit(submitText, elementType, elementData, positionKey, {});
          // Clear promo card values after submission to show placeholder text again  
          if (elementType === 'promo-card') {
            setPromoTextValue('');
            setPromoImageValue('');
            setPromoResetTrigger(prev => prev + 1); // Trigger reset of focus state
            setPromoEdited(false);
          } else {
            setPromptText('');
          }
        }
      }
    }
  };
  const handleChipClick = (chipLabel) => {
    setPromptText(chipLabel);
    // Find the chip id from the label
    const chip = flightPhaseChips.find(c => c.label === chipLabel);
    if (chip) {
      setSelectedChip(chip.id);
      // Also update the flight phase selection for flight-phase-button element type
      // This should only update the flight phase, not open any prompt bubbles
      if ((elementType === 'flight-icon' || elementType === 'flight-phase-button') && onFlightPhaseSelect) {
        onFlightPhaseSelect(chip.label.toLowerCase());
        console.log('=== FLIGHT PHASE CHIP CLICKED ===', { 
          chipLabel, 
          elementType, 
          action: 'flight phase selection only - no prompt bubble opening' 
        });
      }
    }
  };
  const handleColorChange = (color, chipData) => {
    // Only update visual selection, don't apply theme change immediately
    setPendingColor({ color, chipData });
  };
  const handleChipChevronClick = (e, chip, chipIndex) => {
    e.stopPropagation(); // Prevent the chip button click
    setSelectedChipData(chip);
    // Check if this is a gradient chip
    if (chip.isGradient || String(chip.color).includes('gradient')) {
      setShowGradientPicker(true);
      setActiveChipColorPicker(null);
      setShowColorPicker(false);
    } else {
      setActiveChipColorPicker(chipIndex);
      setShowGradientPicker(false);
      setShowColorPicker(false);
    }
  };
  // updateGradient and normalizeColor functions are now imported from utils
  const updateGradientLocal = () => {
    const gradientString = updateGradient(gradientStops, gradientDirection);
    handleColorChange(gradientString, { label: selectedChipData?.label || 'Custom Gradient', color: gradientString });
  };
  const handleLogoChipClick = (chip) => {
    if (chip.id === 'add-new') {
      try {
        // Logo file input functionality removed
      } catch {}
      return;
    }
    // Only update the visual selection state, don't apply logo/color changes yet
    // Logo chip selection functionality removed
  };
  if (!isVisible || !stickyPosition) return null;
  // Simple modal-style overlay approach - guaranteed to work
  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 999999999,
        pointerEvents: 'none',
        background: 'transparent'
      }}
    >
      <div
      ref={bubbleRef}
      className="shadow-xl border p-3 backdrop-blur-[10px] backdrop-filter"
      style={{
        position: 'absolute',
        left: `${stickyPosition.x}px`,
        top: `${stickyPosition.y}px`,
        pointerEvents: 'auto',
        backgroundColor: isGradient ? 'transparent' : actualBackgroundColor,
        backgroundImage: isGradient ? actualBackgroundColor : 'none',
        borderColor: elementType === 'promo-card' && positionKey === 'middle-card-demo'
          ? 'rgba(0,0,0,0.2)'
          : contrastingBorderColor,
        borderTopLeftRadius: 0,
        borderTopRightRadius: '24px',
        borderBottomLeftRadius: '24px',
        borderBottomRightRadius: '24px',
        width: `${bubbleWidth}px`,
        maxWidth: `${bubbleWidth}px`,
        height: (elementType === 'promo-card' || elementType === 'content-card') ? 'auto' : contentHeight,
        minHeight: (elementType === 'promo-card' || elementType === 'content-card') ? '120px' : 'auto',
        zIndex: 999999999 // DEBUG: Extra high z-index
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* Title */}
          <span className={`text-sm font-semibold ${useLightText ? 'text-white' : 'text-black'}`}>
            {(() => {
              switch (elementType) {
                case 'flight-journey-bar':
                  return '';
                case 'flight-icon':
                case 'flight-phase-button':
                  return 'Select Flight Phase';
                case 'content-card':
                  return '';
                case 'promo-card':
                  return '';
                default:
                  return 'Build theme';
              }
            })()}
          </span>
        </div>
      </div>
      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3" style={{ minHeight: 'fit-content' }}>
        {/* Hidden file input for logo upload (triggered by image icon) */}
        {elementType === 'logo-placeholder' && (
          <input
            ref={null}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files && e.target.files[0];
              if (file) {
                // Validate image dimensions
                const img = new Image();
                img.onload = () => {
                  if (img.width === 312 && img.height === 100) {
                    console.log('Valid logo image selected:', file.name, `${img.width}x${img.height}`);
                    // Handle valid image upload
                    // You can add logic here to process the uploaded image
                  } else {
                    console.warn('Invalid image dimensions:', `${img.width}x${img.height}`, 'Expected: 312x100');
                    alert('Please select an image with dimensions 312x100 pixels.');
                  }
                };
                img.src = URL.createObjectURL(file);
              }
            }}
          />
        )}
        <div className="relative flex-1">
          {/* blinkingCSS is now in PromoCardPlaceholder component */}
          {elementType !== 'flight-journey-bar' && elementType !== 'flight-icon' && elementType !== 'flight-phase-button' && elementType !== 'promo-card' && elementType !== 'content-card' && (
            <>
              <textarea
                ref={inputRef}
                value={isTyping ? typedText : (isLoading && elementType !== 'promo-card' ? 'loading...' : promptText)}
                onChange={(e) => setPromptText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isLoading && elementType !== 'promo-card'
                    ? 'loading...'
                    : elementType === 'promo-card'
                    ? '' // No placeholder for promo card, we'll use custom overlay
                    : elementType === 'content-card'
                    ? '' // No placeholder for content card, we'll use custom overlay
                    : elementType === 'flight-journey-bar'
                    ? 'change theme or add animation'
                    : elementType === 'flight-journey-bar-animation'
                    ? 'add animation to your experience'
                    : 'select flight phase'
                }
                className={`bg-transparent border-0 text-sm ${useLightText ? 'text-white placeholder-white/60' : 'text-black placeholder-black/60'} resize-none focus:ring-0 focus:outline-none`}
              style={{
                width: '200px',
                maxWidth: '200px',
                minWidth: '1px',
                height: '20px',
                lineHeight: '20px',
                padding: 0,
                margin: 0,
                whiteSpace: 'pre-wrap',
                overflow: 'hidden',
                resize: 'none',
                wordWrap: 'break-word',
                overflowWrap: 'break-word'
              }}
              onInput={(e) => {
                // Auto-resize height
                e.target.style.height = '20px';
                const scrollHeight = e.target.scrollHeight;
                if (scrollHeight > 20) {
                  e.target.style.height = `${scrollHeight}px`;
                }
              }}
            />
          </>
          )}
          {/* Use PromoCardPlaceholder for both promo and content cards */}
          {(elementType === 'promo-card' || elementType === 'content-card') && !isLoading && (
            <div 
              style={{
                color: useLightText ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
                fontSize: '14px',
                lineHeight: '20px',
                width: '100%',
                minHeight: 'fit-content'
              }}
            >
            </div>
          )}
          {/* Flight Phase Chips - Only show for flight-icon and flight-phase-button and filter out used ones */}
          {(elementType === 'flight-icon' || elementType === 'flight-phase-button') && availableChips.length > 0 && (
            <div className="mt-2">
              <div 
                className="flex gap-2 overflow-x-auto pb-2" 
                style={{ 
                  scrollbarWidth: 'none', 
                  msOverflowStyle: 'none',
                  cursor: 'grab'
                }}
                onWheel={(e) => {
                  // Enable natural horizontal scrolling with mouse wheel
                  e.preventDefault();
                  const container = e.currentTarget;
                  const scrollAmount = e.deltaY;
                  container.scrollLeft += scrollAmount;
                }}
                onMouseDown={(e) => {
                  // Enable click and drag scrolling
                  const container = e.currentTarget;
                  const startX = e.pageX - container.offsetLeft;
                  const startScrollLeft = container.scrollLeft;
                  const handleMouseMove = (e) => {
                    e.preventDefault();
                    const x = e.pageX - container.offsetLeft;
                    const walk = (x - startX) * 2;
                    container.scrollLeft = startScrollLeft - walk;
                  };
                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                    container.style.cursor = 'grab';
                  };
                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                  container.style.cursor = 'grabbing';
                }}
              >
                {availableChips.map((chip) => {
                  // Show all chips as selected when flights are generated, except "Add new"
                  // Also check if this chip matches the selected flight phase from the progress bar
                  const isSelected = flightsGenerated 
                    ? chip.id !== 'add-new' 
                    : (selectedChip === chip.id || selectedFlightPhase === chip.id);
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      data-chip={chip.id}
                      onClick={() => handleChipClick(chip.label)}
                      className={`inline-flex items-center px-3 py-2 rounded-full text-xs transition-all cursor-pointer border font-medium flex-shrink-0`}
                                              style={{
                          backgroundColor: (selectedFlightPhase === chip.id || selectedChip === chip.id) ? (useLightText ? 'white' : 'black') : `${chip.color}10`,
                          borderColor: (selectedFlightPhase === chip.id || selectedChip === chip.id) ? (useLightText ? '#000000' : '#FFFFFF') : finalBorderColor,
                          color: (selectedFlightPhase === chip.id || selectedChip === chip.id) ? (useLightText ? '#000000' : '#FFFFFF') : adaptiveTextColor
                        }}
                                              onMouseEnter={(e) => {
                          if (selectedFlightPhase !== chip.id && selectedChip !== chip.id) {
                            e.target.style.backgroundColor = `${chip.color}25`;
                          } else {
                            // Ensure selected chip styling is maintained
                            e.target.style.backgroundColor = useLightText ? 'white' : 'black';
                            e.target.style.borderColor = useLightText ? '#000000' : '#FFFFFF';
                            e.target.style.color = useLightText ? '#000000' : '#FFFFFF';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedFlightPhase !== chip.id && selectedChip !== chip.id) {
                            e.target.style.backgroundColor = `${chip.color}10`;
                          } else {
                            // Restore selected chip styling
                            e.target.style.backgroundColor = useLightText ? 'white' : 'black';
                            e.target.style.borderColor = useLightText ? '#000000' : '#FFFFFF';
                            e.target.style.color = useLightText ? '#000000' : '#FFFFFF';
                          }
                        }}
                    >
                                                                     {isSelected && <CheckIcon className="w-3 h-3 mr-1.5 flex-shrink-0" style={{ color: (selectedFlightPhase === chip.id || selectedChip === chip.id) ? (useLightText ? '#000000' : '#FFFFFF') : 'inherit' }} />}
                        {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {/* Logo Placeholder Label and Chips */}
          {false && (
            <>
              <div className="flex flex-wrap gap-1 p-3 rounded-lg" style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}>
                <div className="flex flex-wrap gap-1">
              {logoChips.map((chip) => {
                const isSelected = false;
                // Get logo image source based on chip ID
                const getLogoSource = (chipId) => {
                  switch (chipId) {
                    case 'discover':
                      return '/discover1.svg';
                    case 'lufthansa':
                      return '/lufthansa.png';
                            case 'swiss':
          return '/swiss-logo.svg';
                    default:
                      return null;
                  }
                };
                const logoSource = getLogoSource(chip.id);
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => handleLogoChipClick(chip)}
                    className={`inline-flex items-center px-2 text-xs transition-all cursor-pointer border font-medium`}
                    style={{
                      backgroundColor: `rgba(255,255,255,0.08)`,
                      borderColor: finalBorderColor,
                      color: adaptiveTextColor,
                      borderRadius: '8px',
                      width: '120px',
                      justifyContent: 'center',
                      paddingTop: '0px',
                      paddingBottom: '0px'
                    }}
                  >
                    {isSelected && <CheckIcon className="w-3 h-3 mr-1.5 flex-shrink-0" />}
                    {logoSource ? (
                      <img 
                        src={logoSource} 
                        alt={`${chip.label} logo`}
                        className="w-16 h-16 object-contain flex-shrink-0"
                        style={{
                          filter: `brightness(0) saturate(100%) invert(${adaptiveTextColor === '#FFFFFF' ? '1' : '0'})`
                        }}
                        onError={(e) => {
                          // Fallback to text if image fails to load
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'inline';
                        }}
                      />
                    ) : null}
                    <span style={{ display: logoSource ? 'none' : 'inline' }}>
                      {chip.label}
                    </span>
                  </button>
                );
              })}
                </div>
              </div>
            </>
          )}
          {false && (
            null
          )}
        </div>
        {/* Actions for promo cards and flight journey bar */}
        {elementType === 'flight-journey-bar-animation' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="flex flex-wrap gap-2 flex-1">
                {/* Dummy Animation Chips */}
                {[
                  { label: 'Parallax Scroll', color: '#FF6B6B', id: 'parallax' },
                  { label: 'Fade In', color: '#4ECDC4', id: 'fade-in' },
                  { label: 'Slide Up', color: '#45B7D1', id: 'slide-up' },
                  { label: 'Bounce', color: '#96CEB4', id: 'bounce' },
                  { label: 'Pulse', color: '#FECA57', id: 'pulse' },
                  { label: 'Rotate', color: '#FF9FF3', id: 'rotate' },
                  { label: 'Scale', color: '#A8E6CF', id: 'scale' },
                  { label: 'Wobble', color: '#FFD93D', id: 'wobble' }
                ].map((animation, idx) => {
                  const isSelected = selectedChip === animation.id;
                  return (
                    <button
                      key={animation.id}
                      type="button"
                      data-chip={animation.id}
                      onClick={() => setSelectedChip(animation.id)}
                      className={`inline-flex items-center px-3 py-2 rounded-full text-xs transition-all cursor-pointer border font-medium flex-shrink-0`}
                      style={{
                        backgroundColor: isSelected ? (useLightText ? 'white' : 'black') : `${animation.color}10`,
                        borderColor: isSelected ? (useLightText ? '#000000' : '#FFFFFF') : `${animation.color}30`,
                        color: isSelected ? (useLightText ? '#000000' : '#FFFFFF') : adaptiveTextColor
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.target.style.backgroundColor = `${animation.color}25`;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.target.style.backgroundColor = `${animation.color}10`;
                        }
                      }}
                    >
                      {isSelected && <CheckIcon className="w-3 h-3 mr-1.5 flex-shrink-0" style={{ color: isSelected ? (useLightText ? '#000000' : '#FFFFFF') : 'inherit' }} />}
                      {animation.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Save Button for Animation */}
            <div className="flex items-center justify-between mt-2">
              {/* Hint Text - left side */}
              <span 
                className="text-xs font-medium" 
                style={{ color: adaptiveTextColor }}
              >
                Select animation style for your UI
              </span>
              {/* Save Button - right side */}
              <button
                type="button"
                disabled={!selectedChip || isLoading}
                onClick={() => {
                  if (selectedChip && onSubmit) {
                    onSubmit(`Applied ${selectedChip} animation`, elementType, elementData, positionKey);
                  }
                }}
                className={`${useLightText ? 'text-white/70 hover:text-white' : 'text-black/70 hover:text-black'} transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 border`}
                style={{
                  color: useLightText ? '#FFFFFF' : 'rgba(0, 0, 0, 0.7)',
                  borderColor: useLightText ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)',
                  backgroundColor: useLightText ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  borderTopLeftRadius: '0px',
                  borderTopRightRadius: '9999px',
                  borderBottomLeftRadius: '9999px',
                  borderBottomRightRadius: '9999px'
                }}
              >
                <BookmarkIcon className="w-4 h-4" />
                <span className="text-xs font-medium">Apply Animation</span>
              </button>
            </div>
          </div>
        )}
        {elementType === 'flight-journey-bar' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="flex flex-wrap gap-2 flex-1">
              {(() => {
                // Create custom chips based on flight data (origin, destination, airline)
                const customChips = [];
                // Debug: Log the selectedFlightSegment data
                console.log('=== CREATING CUSTOM CHIPS ===', {
                  selectedFlightSegment,
                  elementData,
                  originCity: selectedFlightSegment?.origin?.airport?.city || elementData?.origin?.airport?.city,
                  destCity: selectedFlightSegment?.destination?.airport?.city || elementData?.destination?.airport?.city
                });
                // 1. Brand chip (based on selected airline)
                if (selectedLogo && selectedLogo.id) {
                  const logoColorMap = {
                    'discover': { label: 'Discover', color: '#1E72AE' },
                    'lufthansa': { label: 'Lufthansa', color: '#050F43' },
                    'swiss': { label: 'Swiss', color: '#CB0300' }
                  };
                  const logoChip = logoColorMap[selectedLogo.id];
                  if (logoChip) {
                    customChips.push({
                      ...logoChip,
                      originalColor: logoChip.color
                    });
                  }
                                  } else {
                    // Default brand chip if no airline selected
                    customChips.push({ 
                      label: 'Brand', 
                      color: '#1E1E1E',
                      originalColor: '#1E1E1E'
                    });
                  }
                // 2. Origin city chip - use selectedFlightSegment if available, otherwise fallback to elementData
                const originCity = selectedFlightSegment?.origin?.airport?.city || elementData?.origin?.airport?.city || 'Paris';
                const originColorMap = {
                  'Paris': '#FF6B6B',
                  'London': '#4ECDC4', 
                  'Berlin': '#45B7D1',
                  'Madrid': '#FFA07A',
                  'Rome': '#98D8C8',
                  'Amsterdam': '#F7DC6F',
                  'Barcelona': '#BB8FCE',
                  'Vienna': '#85C1E9',
                  'Munich': '#82E0AA',
                  'Copenhagen': '#F8C471',
                  'Milan': '#9B59B6'
                };
                customChips.push({ 
                  label: originCity, 
                  color: originColorMap[originCity] || '#FF6B6B',
                  originalColor: originColorMap[originCity] || '#FF6B6B'
                });
                // 3. Destination city chip - use selectedFlightSegment if available, otherwise fallback to elementData
                const destCity = selectedFlightSegment?.destination?.airport?.city || elementData?.destination?.airport?.city || 'Milan';
                const destColorMap = {
                  'Milan': '#9B59B6',
                  'Paris': '#FF6B6B',
                  'London': '#4ECDC4',
                  'Berlin': '#45B7D1', 
                  'Madrid': '#FFA07A',
                  'Rome': '#98D8C8',
                  'Amsterdam': '#F7DC6F',
                  'Barcelona': '#BB8FCE',
                  'Vienna': '#85C1E9',
                  'Munich': '#82E0AA',
                  'Copenhagen': '#F8C471'
                };
                customChips.push({ 
                  label: destCity, 
                  color: destColorMap[destCity] || '#9B59B6',
                  originalColor: destColorMap[destCity] || '#9B59B6'
                });
                // 4. Origin-Destination gradient chip
                const originColor = originColorMap[originCity] || '#FF6B6B';
                const destColor = destColorMap[destCity] || '#9B59B6';
                customChips.push({ 
                  label: `${originCity}-${destCity}`, 
                  color: `linear-gradient(135deg, ${originColor} 0%, ${destColor} 100%)`,
                  originalColor: `linear-gradient(135deg, ${originColor} 0%, ${destColor} 100%)`,
                  isGradient: true
                });
                // 5. Festival chips - add festival chips to the main theme chips
                if (festivalChips.length > 0) {
                  festivalChips.forEach(festivalChip => {
                    customChips.push({
                      label: festivalChip.label,
                      color: festivalChip.color,
                      originalColor: festivalChip.color,
                      isFestival: true,
                      location: festivalChip.location,
                      type: festivalChip.type
                    });
                  });
                }
                // 6. For fjb-landing demo: add Oktoberfest (Beerfest) chip
                if (positionKey === 'fjb-landing') {
                  customChips.push({ label: 'Oktoberfest', color: '#FCD34D', originalColor: '#FCD34D', isFestival: true });
                }
                return customChips;
              })().map((chip, idx) => {
                // Get the original chip color for the color circle
                const originalChipColor = typeof chip === 'object' ? chip.originalColor || chip.color : String(chip);
                // Check if this chip has a modified color
                const chipKey = `${chip.label}-${originalChipColor}`;
                const modifiedColor = modifiedChipColors[chipKey];
                const displayColor = modifiedColor || originalChipColor;
                // In routes view, use the same color for chip display but keep original for color circles
                const chipColor = !isThemeBuildStarted ? themeColor : displayColor;
                const label = typeof chip === 'object'
                  ? chip.label
                  : (String(originalChipColor).includes('gradient') ? 'Gradient' : String(originalChipColor));
                const isGrad = chip.isGradient || String(displayColor).includes('gradient');
                const isSelected = pendingColor 
                  ? normalizeColor(pendingColor.color) === normalizeColor(displayColor)
                  : normalizeColor(selectedColor) === normalizeColor(displayColor) || normalizeColor(themeColor) === normalizeColor(displayColor) || normalizeColor(displayColor) === normalizeColor(themeColor);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleColorChange(displayColor, chip)}
                    className={`transition-colors`}
                    title={chip.isFestival ? `${label} - ${chip.location} (${chip.type})` : label}
                    {...(positionKey === 'fjb-landing' && label === 'Paris' ? { 'data-fjb-chip': 'Paris' } : {})}
                  >
                    <div 
                      className={`flex items-center gap-2 px-2 py-1 border rounded-full max-w-full`} 
                      style={{ 
                        borderColor: finalBorderColor,
                        backgroundColor: isSelected ? (useLightText ? 'white' : 'black') : 'transparent'
                      }}
                    >
                      <div
                        className="w-4 h-4 rounded-full border flex-shrink-0"
                        style={{
                          background: isGrad ? displayColor : undefined,
                          backgroundColor: isGrad ? undefined : displayColor,
                          borderColor: finalBorderColor
                        }}
                      />
                      <span className={`text-xs font-medium break-words`} style={{ color: isSelected ? (useLightText ? '#000000' : '#FFFFFF') : adaptiveTextColor }}>{label}</span>
                      <ChevronDownIcon 
                        className="w-3 h-3 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" 
                        style={{ color: isSelected ? (useLightText ? '#000000' : '#FFFFFF') : adaptiveTextColor }}
                        onClick={(e) => handleChipChevronClick(e, chip, idx)}
                      />
                    </div>
                  </button>
                );
              })}
              {/* Color Picker Chip - moved inline with other chips */}
              <button
                type="button"
                onClick={() => {
                  setShowColorPicker(!showColorPicker);
                  setShowGradientPicker(false);
                }}
                className={`transition-colors flex-shrink-0`}
              >
                <div className="flex items-center gap-2 px-2 py-1 border rounded-full" style={{ borderColor: finalBorderColor }}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <defs>
                      <radialGradient id="colorWheelGradient" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="white"/>
                        <stop offset="100%" stopColor="transparent"/>
                      </radialGradient>
                      <linearGradient id="colorWheelSpectrum" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#ff0000"/>
                        <stop offset="14.28%" stopColor="#ff8000"/>
                        <stop offset="28.57%" stopColor="#ffff00"/>
                        <stop offset="42.86%" stopColor="#80ff00"/>
                        <stop offset="57.14%" stopColor="#00ffff"/>
                        <stop offset="71.43%" stopColor="#0080ff"/>
                        <stop offset="85.71%" stopColor="#8000ff"/>
                        <stop offset="100%" stopColor="#ff0080"/>
                      </linearGradient>
                    </defs>
                    <circle cx="12" cy="12" r="10" fill="url(#colorWheelSpectrum)" stroke="#333" strokeWidth="0.5"/>
                    <circle cx="12" cy="12" r="3" fill="url(#colorWheelGradient)"/>
                  </svg>
                  <span className={`text-xs font-medium`} style={{ color: adaptiveTextColor }}>Custom</span>
                  <ChevronDownIcon 
                    className="w-3 h-3 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" 
                    style={{ color: adaptiveTextColor }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowColorPicker(!showColorPicker);
                      setShowGradientPicker(false);
                      setActiveChipColorPicker(null);
                    }}
                  />
                </div>
              </button>
            </div>
            </div>
            <div className="flex items-center justify-between">
              {/* Accessibility Score Text - left side */}
              {(() => {
                const ratioWhite = calculateContrastRatio(selectedColor, '#FFFFFF');
                const ratioBlack = calculateContrastRatio(selectedColor, '#000000');
                if (!ratioWhite || !ratioBlack) return null;
                // Choose the better contrast ratio to display
                const ratio = Math.max(ratioWhite, ratioBlack);
                const background = ratioWhite > ratioBlack ? 'vs white' : 'vs black';
                const formattedRatio = ratio.toFixed(1);
                // Determine readability level based on contrast ratio
                let readabilityLevel;
                if (ratio >= 7) {
                  readabilityLevel = 'Very high';
                } else if (ratio >= 4.5) {
                  readabilityLevel = 'High';
                } else if (ratio >= 3) {
                  readabilityLevel = 'Low';
                } else {
                  readabilityLevel = 'Very low';
                }
                return (
                  <span 
                    className="text-xs font-medium" 
                    style={{ color: adaptiveTextColor }}
                    title={`Best contrast ratio ${background}: ${formattedRatio}:1`}
                  >
                    Readability: {readabilityLevel}
                  </span>
                );
              })()}
              {/* Save Button - right side */}
              <button
                type="button"
                {...(positionKey === 'fjb-landing' ? { id: 'fjb-landing-save' } : {})}
                disabled={!pendingColor || isLoading}
                onClick={() => {
                  if (pendingColor && onThemeColorChange) {
                    setSelectedColor(pendingColor.color);
                    onThemeColorChange(pendingColor.color, pendingColor.chipData);
                    setPendingColor(null);
                    // Clear the closed without save state since this is a save action
                    // This will be handled by Dashboard when onThemeColorChange is called
                  }
                }}
                className={`${useLightText ? 'text-white/70 hover:text-white' : 'text-black/70 hover:text-black'} transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 border`}
                style={{
                  color: useLightText ? '#FFFFFF' : 'rgba(0, 0, 0, 0.7)',
                  borderColor: useLightText ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)',
                  backgroundColor: useLightText ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  borderTopLeftRadius: '0px',
                  borderTopRightRadius: '9999px',
                  borderBottomLeftRadius: '9999px',
                  borderBottomRightRadius: '9999px'
                }}
              >
                <BookmarkIcon className="w-4 h-4" />
                <span className="text-xs font-medium">Save</span>
              </button>
            </div>
          </div>
        )}
        {(elementType === 'promo-card' || elementType === 'content-card') && (
          <div className="flex items-center gap-3 justify-between">
            {/* Character counter - show when either field is focused */}
            {(isPromoTextFocused || isPromoImageFocused) && (
              <span style={{ 
                fontSize: '12px', 
                color: useLightText ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
                opacity: 0.7
              }}>
                {isPromoTextFocused 
                  ? `${30 - (promoTextValue ? promoTextValue.length : 0)} characters left`
                  : `${100 - (promoImageValue ? promoImageValue.length : 0)} characters left`
                }
              </span>
            )}
            {/* Spacer when counter is not shown */}
            {!isPromoTextFocused && !isPromoImageFocused && <div></div>}
            {/* Right side: Image Icon + Save Button */}
            <div className="flex items-center gap-3">
              {/* Image Icon */}
              <button
                type="button"
                onClick={() => {}}
                className="p-1 hover:opacity-80 transition-opacity"
                title="Upload custom image"
                style={{
                  color: useLightText ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'
                }}
              >
                <PhotoIcon className="w-4 h-4" />
              </button>
              {/* Save Button */}
              <button
                type="submit"
                disabled={
                  isLoading || 
                  (elementData && elementData.cardType === 'content-card' 
                    ? !promoTextValue.trim() 
                    : !(promoTextValue.trim() || promoImageValue.trim())
                  )
                }
                className={`${useLightText ? 'text-white/70 hover:text-white' : 'text-black/70 hover:text-black'} transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 border`}
                style={{
                  color: useLightText ? '#FFFFFF' : 'rgba(0, 0, 0, 0.7)',
                  borderColor: useLightText ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)',
                  backgroundColor: useLightText ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  borderTopLeftRadius: '0px',
                  borderTopRightRadius: '9999px',
                  borderBottomLeftRadius: '9999px',
                  borderBottomRightRadius: '9999px'
                }}
              >
                <BookmarkIcon className="w-4 h-4" />
                <span className="text-xs font-medium">Save</span>
              </button>
            </div>
          </div>
        )}
        {elementType === 'logo-placeholder' && (
          <div className="flex items-center justify-between mt-2">
            {/* Hint Text - left side */}
            <span 
              className="text-xs font-medium" 
              style={{ color: adaptiveTextColor }}
            >
              Logo functionality disabled
            </span>
            {/* Right side: Image Icon + Save Button */}
            <div className="flex items-center gap-3">
              {/* Image Icon */}
              <button
                type="button"
                onClick={() => {}}
                className="p-1 hover:opacity-80 transition-opacity"
                title="Upload custom logo (312x100 dimensions)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: adaptiveTextColor }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </button>
              {/* Save Button */}
              <button
                type="submit"
                disabled={
                  isLoading || 
                  !promptText.trim()
                }
                className={`${useLightText ? 'text-white/70 hover:text-white' : 'text-black/70 hover:text-black'} transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0`}
                style={{
                  color: useLightText ? '#FFFFFF' : 'rgba(0, 0, 0, 0.7)'
                }}
              >
                <BookmarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        {/* Color Picker for FJB */}
        {elementType === 'flight-journey-bar' && showColorPicker && (
          <div className="absolute top-full left-0 mt-2 z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-lg p-3">
            <HexColorPicker
              color={pendingColor ? pendingColor.color : selectedColor}
              onChange={(color) => handleColorChange(color, { label: 'Custom Color', color: color })}
              className="rounded-lg"
            />
            <button
              onClick={() => setShowColorPicker(false)}
              className="w-full mt-2 px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Save Color
            </button>
          </div>
        )}
        {/* Advanced Gradient Picker */}
        {elementType === 'flight-journey-bar' && showGradientPicker && (
          <div className="absolute top-full left-0 mt-2 z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-lg p-4" style={{ width: '320px' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <select 
                className="text-xs border border-gray-500 bg-gray-700 text-gray-200 rounded px-2 py-1"
                value={gradientDirection}
                onChange={(e) => {
                  const direction = e.target.value;
                  setGradientDirection(direction);
                  updateGradientLocal();
                }}
              >
                <option value="120deg">Linear</option>
                <option value="0deg">Horizontal →</option>
                <option value="90deg">Vertical ↓</option>
                <option value="180deg">Horizontal ←</option>
                <option value="270deg">Vertical ↑</option>
                <option value="45deg">Diagonal ↘</option>
                <option value="135deg">Diagonal ↙</option>
                <option value="225deg">Diagonal ↖</option>
                <option value="315deg">Diagonal ↗</option>
              </select>
              <div className="flex gap-2">
                <button 
                  className="p-1 text-gray-400 hover:text-gray-200"
                  onClick={() => {
                    const reversedStops = [...gradientStops].reverse().map(stop => ({
                      ...stop,
                      position: 100 - stop.position
                    }));
                    setGradientStops(reversedStops);
                    updateGradientLocal();
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </button>
                <button 
                  className="p-1 text-gray-400 hover:text-gray-200"
                  onClick={() => {
                    const rotatedStops = gradientStops.map(stop => ({
                      ...stop,
                      position: (stop.position + 25) % 100
                    }));
                    setGradientStops(rotatedStops);
                    updateGradientLocal();
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>
            {/* Gradient Visualizer */}
            <div 
              className="relative h-8 bg-gray-700 rounded mb-3 cursor-pointer" 
              style={{ 
                background: `linear-gradient(${gradientDirection}, ${gradientStops.map(stop => `${stop.color}${stop.opacity !== 100 ? Math.round(stop.opacity * 2.55) : ''} ${stop.position}%`).join(', ')})`
              }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const percentage = Math.round((clickX / rect.width) * 100);
                const newStop = { position: percentage, color: '#808080', opacity: 100 };
                setGradientStops([...gradientStops, newStop].sort((a, b) => a.position - b.position));
                updateGradientLocal();
              }}
            >
              {gradientStops.map((stop, index) => (
                <div
                  key={index}
                  className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 border-2 border-white shadow-lg cursor-pointer"
                  style={{
                    left: `${stop.position}%`,
                    backgroundColor: stop.color,
                    transform: 'translate(-50%, -50%)'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Open color picker for this stop
                    const newColor = prompt('Enter hex color:', stop.color);
                    if (newColor && /^#[0-9A-Fa-f]{6}$/.test(newColor)) {
                      const newStops = [...gradientStops];
                      newStops[index].color = newColor;
                      setGradientStops(newStops);
                      updateGradientLocal();
                    }
                  }}
                />
              ))}
            </div>
            {/* Stops Management */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-300">Stops</span>
              <button 
                className="text-gray-400 hover:text-gray-200"
                onClick={() => {
                  if (gradientStops.length < 5) {
                    const newStop = { position: 50, color: '#808080', opacity: 100 };
                    setGradientStops([...gradientStops, newStop].sort((a, b) => a.position - b.position));
                    updateGradientLocal();
                  }
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            {/* Stop Controls */}
            {gradientStops.map((stop, index) => (
              <div key={index} className="flex items-center gap-2 mb-2">
                <button className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">
                  {stop.position}%
                </button>
                <div 
                  className="w-4 h-4 border border-gray-500"
                  style={{ backgroundColor: stop.color }}
                />
                <input
                  type="text"
                  value={stop.color}
                  onChange={(e) => {
                    const newColor = e.target.value;
                    if (/^#[0-9A-Fa-f]{6}$/.test(newColor)) {
                      const newStops = [...gradientStops];
                      newStops[index].color = newColor;
                      setGradientStops(newStops);
                      updateGradientLocal();
                    }
                  }}
                  className="flex-1 px-2 py-1 text-xs bg-gray-700 text-gray-200 border border-gray-500 rounded"
                  placeholder="#000000"
                />
                <input
                  type="text"
                  value={`${stop.opacity} %`}
                  onChange={(e) => {
                    const newOpacity = parseInt(e.target.value);
                    if (!isNaN(newOpacity) && newOpacity >= 0 && newOpacity <= 100) {
                      const newStops = [...gradientStops];
                      newStops[index].opacity = newOpacity;
                      setGradientStops(newStops);
                      updateGradientLocal();
                    }
                  }}
                  className="w-16 px-2 py-1 text-xs bg-gray-700 text-gray-200 border border-gray-500 rounded"
                />
                {gradientStops.length > 2 && (
                  <button 
                    className="text-gray-400 hover:text-red-400"
                    onClick={() => {
                      const newStops = gradientStops.filter((_, i) => i !== index);
                      setGradientStops(newStops);
                      updateGradientLocal();
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => {
                // Apply the gradient change
                if (selectedChipData && pendingColor) {
                  if (onThemeColorChange) {
                    onThemeColorChange(pendingColor.color, selectedChipData);
                  }
                }
                // Close the gradient picker
                setShowGradientPicker(false);
                setSelectedChipData(null);
                setPendingColor(null);
              }}
              className="w-full mt-2 px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Save Color
            </button>
          </div>
        )}
        {/* Color Picker for Chip Chevron Clicks */}
        {elementType === 'flight-journey-bar' && activeChipColorPicker !== null && (
          <div className="absolute top-full left-0 mt-2 z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-lg p-3">
            {(() => {
              // Get the modified color for this chip if it exists
              // Use the original chip color as the key, not the potentially modified one
              const originalChipColor = selectedChipData.originalColor || selectedChipData.color;
              const chipKey = `${selectedChipData.label}-${originalChipColor}`;
              const modifiedColor = modifiedChipColors[chipKey];
              const initialColor = pendingColor ? pendingColor.color : (modifiedColor || selectedColor);
              return (
                <>
                  <HexColorPicker
                    color={initialColor}
                    onChange={(color) => handleColorChange(color, { label: 'Custom Color', color: color })}
                    className="rounded-lg"
                  />
                  <div className="mt-3">
                    <label className="block text-xs text-gray-300 mb-1">Hex Color</label>
                    <input
                      type="text"
                      value={initialColor}
                      onChange={(e) => {
                        const hexValue = e.target.value;
                        if (/^#[0-9A-Fa-f]{6}$/.test(hexValue)) {
                          handleColorChange(hexValue, { label: 'Custom Color', color: hexValue });
                        }
                      }}
                      className="w-full px-2 py-1 text-xs bg-gray-700 text-gray-200 border border-gray-500 rounded focus:outline-none focus:border-gray-400"
                      placeholder="#000000"
                      maxLength="7"
                    />
                  </div>
                </>
              );
            })()}
            <button
              onClick={() => {
                // Apply the color change to the selected chip
                if (pendingColor && selectedChipData) {
                  // Create a key for the modified chip color using the original color
                  const originalChipColor = selectedChipData.originalColor || selectedChipData.color;
                  const chipKey = `${selectedChipData.label}-${originalChipColor}`;
                  // Store the modified color (supports route-scoped setter from parent)
                  try {
                    // If parent provided a route-scoped helper, it may accept (chipKey, color)
                    setModifiedChipColors(chipKey, pendingColor.color);
                  } catch (e) {
                    // Fallback to object-updater signature
                    setModifiedChipColors(prev => ({
                      ...prev,
                      [chipKey]: pendingColor.color
                    }));
                  }
                  // Update the chip's color with the new color
                  const updatedChip = { ...selectedChipData, color: pendingColor.color };
                  // Set the selected color to the new color
                  setSelectedColor(pendingColor.color);
                  // Update pending color to reflect the change
                  setPendingColor({ color: pendingColor.color, chipData: updatedChip });
                }
                // Close the color picker
                setActiveChipColorPicker(null);
              }}
              className="w-full mt-2 px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Save Color
            </button>
          </div>
        )}
        {/* Save Button for Flight Phase Selection (FPS) */}
        {elementType !== 'promo-card' && elementType !== 'flight-journey-bar' && elementType !== 'content-card' && (
          <button
            type="submit"
            disabled={!promptText.trim() || isLoading}
            className="transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 self-end"
            style={{
              color: selectedChip === 'cruise' ? '#10B981' : (useLightText ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)')
            }}
          >
            <BookmarkIcon className="w-4 h-4" />
          </button>
        )}
      </form>
    </div>
    </div>,
    document.body
  );
} 