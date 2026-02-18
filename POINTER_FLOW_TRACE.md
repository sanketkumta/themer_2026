# Dummy Mouse Pointer Flow Trace

## Intended Path (Landing Page with FJB)
1. **FJB** → pointer at FJB bar, click
2. **Paris** → pointer at Paris chip (theme bubble), click
3. **Paris→Save** → animate, click Save
4. **Save→Middle card** → animate, click card
5. **Card→Title** → animate, click title
6. **Title→Desc** → animate, click description
7. **Desc→Save** → animate, click save button
8. Done

---

## Architecture

### Effect A (Create/remove pointer)
- **Deps**: [showClimbPointer, showMovingIcon]
- Creates pointer DOM element when both true; removes when either false
- Sets base styles (position:fixed, z-index, etc.) but **NO left/top**

### Effect B (Position pointer)
- **Deps**: [showClimbPointer, showMovingIcon, climbPointerPosition.x, climbPointerPosition.y, isClimbPointerClicking]
- **Skips position** when `isPointerSequenceActiveRef` OR `isFJBThemePointerAnimatingRef` is true
- When not skipped: sets left/top from climbPointerPosition + containerRect

### Direct DOM updaters (bypass Effect B)
- `updatePointerViewport(left, top)` – viewport coords
- `updatePointerFromContainerCoords(x, y)` – container-relative, converts to viewport

---

## Phase-by-phase trace

### Phase 1: FJB effect
- **When**: showClimbLabel && showMovingIcon && onRequestFJBPrompt && !fjbThemeComplete
- **Delay**: 800ms
- **Sets**: isPointerSequenceActiveRef=true, showClimbPointer=true, climbPointerPositionRef, setClimbPointerPosition(fjbCenter)
- **Does**: Click animation at 200ms, onRequestFJBPrompt() at 350ms
- **Does NOT**: Call updatePointerViewport or updatePointerFromContainerCoords

**🐛 BUG**: Effect B is blocked (isPointerSequenceActiveRef). Pointer is created by Effect A with no position. So pointer appears at default (0,0 or wrong place) until something else positions it.

### Phase 2: Paris/Save effect
- **When**: showFJBPrompt && showMovingIcon && pointerElementRef.current
- **Delay**: 500ms
- **Guards**: runParisAndSaveAnimation requires parisChip and saveBtn; retries every 100ms if not found
- **Path**: updatePointerViewport(paris) → click Paris → 800ms → animate Paris→Save (600ms) → click Save
- **On Save**: climbPointerPositionRef, setClimbPointerPosition to Save; onFJBThemeApplyRequest

**Result**: Pointer jumps from wrong position to Paris. User never sees it at FJB.

**🐛 UNSTABLE DEP**: Effect deps include `onFJBThemeApplyRequest`. If LandingPage doesn't memoize it (useCallback), every parent re-render creates a new function reference → effect re-runs → cleanup clears 500ms timeout → new 500ms starts. Animation can be delayed, restarted, or never complete.

### Phase 3: Middle card effect
- **When**: showClimbLabel && showMovingIcon && (!onRequestFJBPrompt || fjbThemeComplete) && !isClimbPointerAnimating
- **Delay**: 500ms
- **Start**: climbPointerPositionRef (Save) when fjbThemeComplete, else CLIMB position
- **Path**: Save→card (1200ms), click
- **Calls**: animateTypingSequence with card center as startPosition

### Phase 4: animateTypingSequence
- **Start**: startPosition or climbPointerPositionRef
- **Path**: card→title (1000ms) → title→desc (800ms) → desc→save (800ms)
- **End**: isPointerSequenceActiveRef=false

---

## Root causes of randomness

1. **FJB never positions pointer** – Effect B blocked; FJB effect never calls updatePointer*. Pointer sits at 0,0 until Paris effect runs.

2. **onFJBThemeApplyRequest not memoized** – Paris/Save effect re-runs on parent re-renders, resetting its 500ms timer. Can cause delayed start, double runs, or inconsistent timing.

3. **Coordinate mixing** – Paris/Save uses viewport; middle card and typing use container-relative. If containerRect changes (scroll, resize), conversions can produce jumps.

4. **setClimbPointerPosition during sequence** – Triggers Effect B. When blocked, Effect B only updates transform. But climbPointerPosition changes can still cause re-renders; if isPointerSequenceActiveRef is cleared one frame early due to batching, Effect B could overwrite with stale position.

5. **Paris/Save effect runs on showFJBPrompt** – Pointer element might not exist yet if Effect A runs after Paris effect’s check. Paris effect has `if (!pointerElementRef.current) return` – so it could skip and never run if effect order/timing is wrong.

---

## Recommended fixes

1. **FJB effect**: After setShowClimbPointer(true), call `updatePointerFromContainerCoords(fjbCenterX, fjbCenterY)` so the pointer is actually placed at FJB.

2. **LandingPage**: Memoize `handleFJBThemeApplyRequest` and `handleRequestFJBPrompt` with `useCallback` so Paris/Save effect deps stay stable.

3. **Single orchestrator**: Replace separate FJB, Paris/Save, and middle card effects with one effect that runs the full sequence in order, reducing races and overlapping timers.
