// Helper function to get Pollinations AI generated images for content cards and promo cards
// Updated to use the current Pollinations image URL pattern.
export const getPollinationsImage = (description, themeColor = null, options = {}) => {
  if (!description || typeof description !== 'string') {
    console.warn('getPollinationsImage called with invalid description', { description });
    return null;
  }

  console.log('=== GETTING POLLINATIONS AI IMAGE ===', { description, themeColor, options });

  // Clean and optimize the description for AI image generation
  const cleanDescription = description
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove special characters
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();

  // Base enhanced prompt
  let enhancedPrompt = `high quality, professional, ${cleanDescription}, modern, clean, 4k resolution`;

  // Add theme color background for smartphone/device style images
  if (themeColor && cleanDescription.includes('smartphone device')) {
    const colorName = getColorName(themeColor);
    enhancedPrompt = `high quality, professional, ${cleanDescription}, ${colorName} background, modern, clean, 4k resolution`;
  }

  // Options with sensible defaults, while preserving existing behaviour where possible
  const {
    seed,
    randomize,
    width = 416,
    height = 200,
    model = 'flux', // current recommended default model
    nologo = true,
    enhance = false
  } = options || {};

  // Seed handling: deterministic by default, randomized when requested
  const deterministicSeed = Math.abs(
    description.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
  );
  const chosenSeed =
    typeof seed === 'number'
      ? seed
      : randomize
      ? Math.floor(Math.random() * 1_000_000_000)
      : deterministicSeed;

  // Build query params according to current Pollinations pattern
  const params = new URLSearchParams();
  params.set('width', width);
  params.set('height', height);
  params.set('model', model);
  if (chosenSeed !== undefined && chosenSeed !== null) {
    params.set('seed', String(chosenSeed));
  }
  if (nologo) {
    params.set('nologo', 'true');
  }
  if (enhance) {
    params.set('enhance', 'true');
  }

  // Attach API key if available (prefer env var; falls back to publishable key provided by user)
  const apiKey = process.env.REACT_APP_POLLINATIONS_KEY || 'pk_85ToFCr181MZE7An';
  if (apiKey) {
    params.set('key', apiKey);
  }

  // Current Pollinations image endpoint pattern using gen.pollinations.ai
  const pollinationsUrl = `https://gen.pollinations.ai/image/${encodeURIComponent(
    enhancedPrompt
  )}?${params.toString()}`;

  console.log('=== POLLINATIONS AI URL GENERATED ===', {
    originalDescription: description,
    cleanDescription,
    enhancedPrompt,
    themeColor,
    chosenSeed,
    width,
    height,
    model,
    nologo,
    enhance,
    pollinationsUrl
  });

  return pollinationsUrl;
};

// Helper function to convert hex color to descriptive color name
const getColorName = (hexColor) => {
  const colorMap = {
    '#1E1E1E': 'dark gray',
    '#0A1D3D': 'dark blue',
    '#CB0300': 'red',
    '#1E72AE': 'blue',
    '#2563eb': 'blue',
    '#EF4444': 'red',
    '#10B981': 'green',
    '#F59E0B': 'orange',
    '#8B5CF6': 'purple',
    '#EC4899': 'pink',
    '#06B6D4': 'cyan',
    '#84CC16': 'lime',
    '#F97316': 'orange',
    '#EF4444': 'red',
    '#6366F1': 'indigo',
    '#14B8A6': 'teal',
    '#F59E0B': 'amber',
    '#DC2626': 'red',
    '#059669': 'emerald',
    '#7C3AED': 'violet'
  };
  
  return colorMap[hexColor] || 'colored';
};

// Legacy function name for backward compatibility - now uses Pollinations AI
export const getUnsplashFallback = (description) => {
  return getPollinationsImage(description);
};