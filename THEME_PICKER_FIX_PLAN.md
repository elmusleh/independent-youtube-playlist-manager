# ThemePicker / Appearance Dropdown Fix Plan

## Issues Identified

### 1. **Broken Button UI/UX** (ThemePicker.svelte lines 92-105)

- `.theme-card` uses `position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%)`
- This centers the card on the trigger button, but the trigger is INSIDE a dropdown menu
- Result: Theme card appears in wrong position, often off-screen or overlapping oddly

### 2. **Dialog Positioning Wrong**

- The theme card should open as a **submenu to the right** of the trigger (like a typical dropdown submenu)
- Current implementation treats it like a modal dialog centered on the button
- z-index: 2000 may conflict with ProfileDropdown's z-index: 1000

### 3. **Click-Outside Handling Conflict**

- ProfileDropdown has `handleWindowClick` that closes on click outside `.profile-container`
- ThemePicker has its own keydown handler but NO click-outside handler
- When theme card is open, clicking elsewhere in dropdown doesn't close theme card
- Escape key handling exists in both but may conflict

### 4. **"Device Default" May Not Work**

- Theme store uses `window.matchMedia("(prefers-color-scheme: dark)")`
- But the initial choice reads from localStorage `yph-theme-choice` which may not include "device"
- Need to verify the sync between extension storage and localStorage

### 5. **Mobile Responsive Issues**

- ThemePicker has mobile media query but it's for the card itself, not the dropdown context
- On mobile, the dropdown becomes full-screen, but theme card positioning breaks

## Fix Plan

### Phase 1: Fix ThemePicker Positioning & Structure

1. Change theme card from centered modal to **right-aligned submenu**
2. Position it relative to the trigger button within the dropdown
3. Use proper CSS for submenu positioning (right: 100%, top: 0)
4. Remove absolute centering transform

### Phase 2: Integrate with ProfileDropdown Click Handling

1. Add `onClose` callback that ThemePicker calls when theme selected
2. Ensure clicking elsewhere in dropdown closes theme card
3. Remove duplicate keydown handlers

### Phase 3: Fix "Device Default" Theme

1. Verify theme store properly applies device theme
2. Ensure localStorage sync works for "device" choice
3. Add listener for `prefers-color-scheme` changes when device theme active

### Phase 4: Mobile Responsive

1. Ensure submenu works in full-screen mobile dropdown
2. Test on various viewport sizes

## Files to Modify

1. `apps/browser-extension/playlist-manager/src/components/ThemePicker.svelte` - Main fix
2. `apps/browser-extension/playlist-manager/src/stores/theme.store.ts` - Device theme fix
3. `apps/browser-extension/playlist-manager/src/components/ProfileDropdown.svelte` - Integration
