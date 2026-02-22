# Frequen-C UI/UX + Brand Strategy Research Synthesis

## 0) Understanding Check

Yes — Frequen-C is understood as a **collaborative listening control layer** (rooms + shared queue authority dynamics), not a DSP catalog/streaming platform. The core UX job is to make the three governance modes (Campfire, Spotlight, Open Floor) instantly legible while preserving familiar interaction patterns from incumbent streaming apps so switching cost is near zero.

This document translates comparative market patterns into a practical, buildable strategy for React Native + Expo.

---

## 1) Comparative Research: What top streaming apps do well

## Spotify
- **Strengths users feel:** speed, confidence, consistent hierarchy, recommendation reliability.
- **UX signatures:** dark base + high-contrast CTAs, strong card rhythm, simple tab model, sticky mini-player, low-friction playlist actions.
- **Psychology:** users trust “it will find something good fast.”

## Apple Music
- **Strengths users feel:** premium polish, cleaner typography, editorial authority.
- **UX signatures:** larger whitespace, refined motion, fewer competing visual accents.
- **Psychology:** users feel guided by “tasteful curation.”

## SoundCloud
- **Strengths users feel:** underground authenticity, creator proximity, community vibe.
- **UX signatures:** waveform prominence, comment/reaction energy, less “corporate grid” feeling.
- **Psychology:** users feel participation and scene belonging.

## YouTube Music
- **Strengths users feel:** breadth of content + effortless fallback to familiar videos/tracks.
- **UX signatures:** image-heavy discovery, algorithm confidence, quick context pivots.
- **Psychology:** users feel there is always “something that works right now.”

## Tidal
- **Strengths users feel:** quality + audiophile credibility + premium identity.
- **UX signatures:** upscale minimalism, restrained UI, content-first layout.
- **Psychology:** users feel elevated intent and quality signal.

---

## 2) Collective commonalities users have been trained on

1. **Persistent playback context**
   - Mini-player always available.
   - Fast return to now-playing with one tap.

2. **Low cognitive search/add flows**
   - Search always close.
   - Add action exposed at card level and detail level.

3. **Predictable navigation rhythm**
   - 4–5 primary tabs.
   - Home is recommendation hub.

4. **Immediate feedback loops**
   - Tap feedback (visual + haptic).
   - Save/like state updates instantly.

5. **Card-based modularity**
   - Users scan by artwork cards/rows.
   - Repetition of component shapes lowers mental load.

6. **Progressive disclosure**
   - Core actions visible; advanced actions tucked behind sheets/menus.

---

## 3) Where incumbents fail (opportunity spaces for Frequen-C)

- **Collaboration is shallow** (shared playlists ≠ synchronized social queue governance).
- **Mode ambiguity** (users rarely know who truly controls playback).
- **Weak group-state visibility** (no ambient sense of room momentum).
- **Social interactions feel bolted-on**, not primary.
- **Gamification is often extractive, not musical** (streaks > session quality).

**Frequen-C opportunity:** make social curation mechanics the primary UX grammar, not an edge feature.

---

## 4) Behavioral design principles for Frequen-C

1. **Familiar skeleton, novel core**
   - Keep navigation and media controls familiar.
   - Innovate in queue governance + room dynamics.

2. **Mode legibility over mode explanation**
   - Users should *feel* the rules in <10 seconds without reading docs.

3. **Collective state as first-class UI data**
   - Show room energy, consensus, conflict, momentum live.

4. **Fast contribution loops**
   - “I found it → I added it → room reacted” within seconds.

5. **Constructive competition only**
   - CV economy and Power Moves must feel playful, never punitive.

---

## 5) Brand strategy: “Rack x Chrome” pushed to conviction

## Brand core
- **Positioning:** "The live control surface for collaborative listening."
- **Personality:** Industrial, warm, electric, scene-native.
- **Voice:** Direct, rhythmic, slightly technical, never corporate-jargony.

## Material language (implementation-ready)
- **Void** for app foundation and depth layers.
- **Chrome / Brushed Steel** for controls and authority surfaces.
- **Glass** for overlays, queue sheets, and transient panels.
- **Ice Emission** = system/neutral power, activity, network pulse.
- **Amber Emission** = human warmth, social resonance, battery sag mode.

## Visual motifs
- Rack screw anchors for module corners.
- Subtle grain/noise overlays for anti-sterile feel.
- Patch-point connectors to imply flow between people and queue.
- Waveform + signal bars as living room telemetry.

---

## 6) Mode-specific UI identity system (same brand, 3 distinct atmospheres)

## Campfire (equal turns)
- **Color bias:** warmer neutrals + amber accents.
- **Motion:** smooth, breathing pulses.
- **Shape language:** soft corners, balanced spacing.
- **Primary cue:** turn-order ring showing upcoming contributors.

## Spotlight (host-led)
- **Color bias:** cool chrome + sharp white highlights.
- **Motion:** crisp, decisive transitions.
- **Shape language:** tighter grid, stronger alignment lines.
- **Primary cue:** explicit host badge + pending suggestions tray.

## Open Floor (democratic)
- **Color bias:** higher contrast mixed neon (ice + amber sparks).
- **Motion:** dynamic reorder animations, faster micro-movement.
- **Shape language:** slightly more angular stack/ladder feel.
- **Primary cue:** live vote velocity meter + queue turbulence indicator.

---

## 7) Screen-by-screen guidance

## Home
**Goal:** immediate re-entry into active social music context.

- Top: “Resume Room” if recent room exists.
- Middle: “Create Room” + “Join via Code/QR.”
- Lower modules: active friends, trending public rooms, recent modes.
- Persistent mini-player dock.
- Add ambient room-energy chips (Low / Building / Peaking).

## Room / Session (core surface)
**Goal:** make governance and contribution obvious in one glance.

Layout zones:
1. **Now Playing deck** (art, waveform, elapsed, source service).
2. **Mode header strip** (mode name + one-line rule summary).
3. **Queue rail** (next tracks + vote/turn/approval markers).
4. **Contribution dock** (add/search/suggest/power moves).
5. **Social pulse bar** (reactions, participation rate, resonance events).

Critical behaviors:
- Track cards encode permission state (addable, votable, host-review).
- Queue item transitions animate according to mode logic.
- Power Moves surfaced contextually (not always loud).

## Discover
**Goal:** source great additions for current room, not solo browsing.

- Contextual recommendations anchored to room mood + mode.
- “Best for now” ranking label (fit confidence).
- Quick preview + one-tap add/suggest depending on mode.
- Source badge clarity (Spotify/SoundCloud/Tidal).

## Library
**Goal:** reusable social utility inventory.

- Saved tracks/playlists + “room-proven” items.
- Smart bins: Most Upvoted, Campfire-safe, Spotlight-approved, Duel winners.
- CV-eligible actions visible (earn potential cues).

## Profile
**Goal:** identity as collaborator, not passive listener.

- Stats: contribution quality, approval ratio, resonance participation.
- CV wallet + recent spends/earns.
- Reputation tags (Crowd Igniter, Smooth Curator, etc.).
- Service connections + preferred sources.

---

## 8) Motion & interaction philosophy

## Motion rules
- **Purposeful movement only**: state change, hierarchy change, confirmation.
- **Room heartbeat cadence**: subtle ambient pulse every 4–6s tied to playback.
- **Mode-tuned timing**:
  - Campfire: 260–320ms ease-out.
  - Spotlight: 180–240ms ease-in-out.
  - Open Floor: 160–220ms spring-lite.

## Interaction principles
- Tap targets minimum 44dp.
- All critical actions get haptic + visual confirmation.
- Reorder animations should preserve object continuity (never teleport).
- Use bottom sheets for secondary actions to keep queue context visible.

## Voltage Sag behavior
- Auto-shift toward amber/low-power palette.
- Reduce blur, particles, and non-essential animations.
- Keep audio-critical controls full fidelity.

---

## 9) Information architecture and familiarity mapping

Recommended tabs:
1. Home
2. Discover
3. Room (dynamic: appears as active session hub)
4. Library
5. Profile

Familiar carryovers from incumbents:
- Mini-player dock and swipe-up now-playing.
- Search placement and filter chips.
- Track row anatomy (artwork, title, artist, source, action).

Novel Frequen-C layers:
- Governance strip.
- Queue legitimacy markers (turn, vote, approved).
- CV economy + Power Moves.

---

## 10) Component style language

- **Cards:** slightly raised metal/glass cards with 1 highlight edge + 1 shadow edge.
- **Buttons:**
  - Primary = chrome plate + emission rim.
  - Secondary = brushed steel flat.
  - Destructive/block = amber-red edge, never pure red slab.
- **Badges/chips:** compact mono labels for mode, service, permissions.
- **Lists:** dense but breathable; 8pt base spacing with 4pt micro-adjustments.
- **Typography:**
  - Display for room/mode headers only.
  - Mono for telemetry (CV, votes, latency-ish stats).
  - Body for track metadata and settings.

---

## 11) Psychological retention loops (healthy, non-addictive framing)

- **Belonging loop:** room identity, shared wins, resonance moments.
- **Competence loop:** better suggestions get visible impact.
- **Autonomy loop:** different modes satisfy different social comfort levels.
- **Surprise loop:** forecast + resonance + duel moments create narrative peaks.

Guardrail:
- Never let monetizable-style pressure dominate music enjoyment.

---

## 12) Practical implementation path (Expo/RN feasible)

Phase 1 (Foundation)
- Solid mode headers, queue markers, mini-player parity, room telemetry strip.

Phase 2 (Material conviction)
- Introduce grain overlays, screws, chrome gradients, emission glows.
- Refine dark surface contrast and text legibility.

Phase 3 (Dynamics)
- Mode-specific motion tuning.
- Vote velocity / turn pulses / host approval transitions.

Phase 4 (Signature features)
- CV wallet affordances.
- Power Moves contextual panel.
- Voltage Sag and Resonance event choreography.

---

## 13) Design QA checklist

- Can a new user identify who controls queue changes in 5 seconds?
- Is adding a song possible in <=2 taps from Room screen?
- Are mode transitions visually obvious without tutorial text?
- Are source-service constraints transparent at action time?
- Does low-battery mode remain brand-consistent and usable?
- Do all critical states have accessible contrast in dark theme?

---

## 14) Suggested next artifacts

1. Mode-specific high-fidelity Room screen variants (Campfire/Spotlight/Open Floor).
2. Tokenized motion spec sheet (durations/easings by interaction class).
3. UI copy deck for microcopy (host approvals, vote results, power moves).
4. Component inventory audit mapped to current RN codebase.

