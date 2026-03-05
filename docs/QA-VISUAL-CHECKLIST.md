# Frequen-C — On-Device Visual QA Checklist
**Date:** 2026-03-05
**Build:** preview:apk (Android)
**Focus:** Warm palette refresh verification

---

## Build Instructions

```bash
cd MusicApp/Frequen-C-Mobile

# Option A: EAS cloud build (recommended)
eas build --profile preview:apk --platform android
# Download APK link from terminal → sideload to device

# Option B: Local dev (needs backend running)
# Terminal 1: cd ../Frequen-C-Backend && npm run dev
# Terminal 2: npx expo start
# Scan QR with Expo Go app
```

**Backend note:** If testing with real backend, make sure `LOCAL_IP` in `src/services/config.ts` matches your machine's LAN IP. Current default: `192.168.1.3:5000`.

---

## Global Checks (every screen)

- [ ] Background color is warm near-black (#0F1012), NOT cold blue-black
- [ ] Text is warm off-white (#F5F0EB), NOT cold blue-white
- [ ] Secondary text (silver #9CA3A8) is readable but clearly secondary
- [ ] Tertiary text (slate #7A8388) is readable on both void and card bgs
- [ ] Card backgrounds are warm charcoal (#161819), NOT navy/blue
- [ ] Borders are subtle (8% white), NOT bright metallic chrome lines
- [ ] No cold cyan (#00E5FF) anywhere — should be soft teal (#5AC8C8)
- [ ] No neon green (#00FF88) — should be soft emerald (#34D399)
- [ ] Orange accent feels warm (#FF7A45), NOT harsh
- [ ] Cards have uniform 12px radius (all corners), NOT flat-top/curved-bottom

---

## Screen-by-Screen

### 1. Login Screen
- [ ] Warm dark background, no grain/noise visible
- [ ] Sine wave animation uses warm palette
- [ ] Input fields have warm gunmetal bg (#262829)
- [ ] "FREQUEN-C" brand text is warm off-white
- [ ] Orange CTA button is solid fill with rounded corners (10px)
- [ ] No chrome gradient on any button

### 2. Register Screen
- [ ] Same warm background as Login
- [ ] Sawtooth waveform uses warm palette
- [ ] Form inputs match Login styling
- [ ] No harsh cyan or neon accents

### 3. Home Screen (Tab 1)
- [ ] Top bar: logo, CV badge, friends/activity/notification icons, avatar
- [ ] CV badge uses soft teal or emerald (not electric cyan)
- [ ] Notification bell icon is warm silver when no unreads
- [ ] Notification badge uses accent color
- [ ] "LIVE CONNECTION" label is warm dim text
- [ ] Active room card: warm charcoal bg, 12px radius, soft border
- [ ] StatusLight dots are soft teal (not electric cyan)
- [ ] "RECENT FLIGHT CASES" section cards have warm styling
- [ ] Pull-to-refresh tint matches accent

### 4. Discover Screen (Tab 2)
- [ ] Sonar visualization uses warm palette colors
- [ ] Filter chips have warm surface colors
- [ ] Room cards are warm charcoal with soft borders
- [ ] StatusLight for live rooms is teal, not cyan
- [ ] Search input has warm gunmetal background

### 5. Create Session (Tab 3 — modal)
- [ ] Modal background is warm overlay
- [ ] All form sections use ModuleFaceplate (warm card, 12px radius)
- [ ] NO screw SVGs visible anywhere
- [ ] ChromeButtons are solid fill, rounded — no metallic gradient
- [ ] Room mode selector uses warm signal colors
- [ ] Preset cards have warm styling

### 6. Library / Flight Cases (Tab 4)
- [ ] Segmented tabs have warm active/inactive states
- [ ] Session history cards are warm charcoal
- [ ] Favorites section uses warm styling
- [ ] Modal overlays (if any) have warm tint

### 7. Session Room
- [ ] Now Playing card: warm bg, readable text, soft border
- [ ] Queue sheet: warm surface, no brushed steel texture
- [ ] Participant avatars area has warm styling
- [ ] Reaction buttons use warm accent colors
- [ ] AI feature cards (Oracle, Sonic Aesthetic, etc.) warm styling
- [ ] LEDReadout shows clean mono text — NO glow rectangles behind text
- [ ] CV spend indicators use warm emerald/orange
- [ ] Bottom controls: solid buttons, no chrome gradients

### 8. Profile Screen (modal)
- [ ] Profile header has warm charcoal card bg
- [ ] Settings toggles (Monitor Out, etc.) use warm surfaces
- [ ] "NOISE GATE" / section labels are readable dim text
- [ ] ChromeButtons are rounded, solid fill
- [ ] Connected services section is warm styled
- [ ] Logout button is properly styled

### 9. Friends Screen
- [ ] Three tabs (Online/All/Requests) have warm active states
- [ ] Friend cards are warm charcoal with soft borders
- [ ] Online status dots are soft emerald (#34D399)
- [ ] Action buttons (Accept/Decline) use warm palette

### 10. Activity Feed Screen
- [ ] "SIGNAL MONITOR" header is warm
- [ ] Event icons use warm colors (teal, emerald, orange, pink)
- [ ] Timestamps use warm slate color, readable
- [ ] Card/row separators are very subtle
- [ ] Pull-to-refresh tint matches accent
- [ ] Empty state icon and text use warm colors

### 11. User Profile Screen
- [ ] Profile header warm styled
- [ ] Stats section readable
- [ ] Activity feed items use warm palette
- [ ] Friendship action buttons warm

### 12. Search Screen
- [ ] Search input: warm gunmetal bg, soft border
- [ ] Segment chips (Tracks/People/Rooms) warm
- [ ] Result cards warm charcoal
- [ ] Recent searches section warm

### 13. Notification Drawer (modal)
- [ ] "SIGNAL LOG" header warm
- [ ] Unread notifications have subtle warm highlight
- [ ] Read notifications are dimmer but readable
- [ ] "CLEAR ALL" button uses warm accent
- [ ] Empty state message warm

### 14. Join Session Screen
- [ ] Code input has warm styling
- [ ] QR scanner button warm
- [ ] Join button uses ChromeButton (solid, rounded)

---

## Voltage Sag Mode
If battery is ≤10% or you toggle it manually:
- [ ] Accent shifts to amber (#FFB860) across all screens
- [ ] LEDReadouts shift from teal to amber
- [ ] StatusLights shift from teal to amber
- [ ] Animations reduce/stop
- [ ] Overall feel shifts warmer/dimmer

---

## Splash Screen
- [ ] Background is warm near-black (#0F1012), not cold
- [ ] Icon renders cleanly on warm background

---

## Known Acceptable Items
- Modal backdrop overlays use hardcoded `rgba(0,0,0,0.7)` — this is fine
- FriendsScreen/UserProfileScreen have a few `rgba(255,255,255,0.03-0.04)` subtle borders — intentional
- Typography is unchanged (ChakraPetch display, SpaceMono mono, Outfit body)

---

## If Something Looks Wrong
1. Note the screen name and element
2. Screenshot it
3. Check if it's pulling from `palette.*` or a hardcoded hex
4. File it in the session for the next dev pass
