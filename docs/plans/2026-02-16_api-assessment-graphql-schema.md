# Frequen-C API Assessment & GraphQL Schema Design

**Date:** 2026-02-16
**Author:** Caleb Ruble + Claude (Creative Technologist)
**Status:** Draft

---

## Part 1: Current Data Layer Assessment

### What Exists

The mobile app currently runs on a **mock-first architecture** — all data flows through `api.ts` and `socket.ts` with `USE_MOCKS = true`. This is the right call for a demo-stage app. The real question is: how well does the current shape prepare us for a real backend?

### Strengths

**Resource-oriented thinking.** Types are cleanly separated: `User`, `Session`, `Track`, `QueueTrack`, `ChatMessage`. Each maps to a clear domain entity. This is the foundation GraphQL needs.

**Consistent naming.** `sessionApi.create`, `sessionApi.get`, `sessionApi.list`, `sessionApi.join` — verb-first, predictable. Socket events follow a `noun-verb` pattern: `track-added`, `vote-cast`, `chat-message`.

**Separation of concerns.** `queueEngine.ts` is pure functions (no side effects). `socket.ts` handles event bus. `api.ts` handles REST-shaped requests. `playbackEngine.ts` handles timer ticks. Clean boundaries.

**Error handling.** `ApiError` class with status codes. 404 on session not found. 400 on bad input. This translates directly to GraphQL error types.

### Gaps & Issues

**1. No pagination anywhere.**
`sessionApi.list()` and `sessionApi.discover()` return all sessions. Fine for 8 mock rooms. Broken at 500. GraphQL needs cursor-based pagination from day one.

**2. No field selection.**
REST endpoints return full objects every time. `sessionApi.list()` returns `listeners[]`, `currentTrack`, `queue[]` for every session even when DiscoverScreen only needs `name`, `genre`, `listenerCount`, `roomMode`. This is exactly the over-fetching problem GraphQL solves.

**3. Mixed concerns on `Track` type.**
`Track` serves double duty: it's both a catalog entity (search results) AND a queue item (with `addedBy`, `votes`, `reactions`). The `QueueTrack extends Track` pattern helps, but search results still carry `addedBy: { userId: '', username: '' }` and `votes: 0` — empty fields that don't belong on catalog tracks.

**4. No real-time data schema.**
Socket events (`track-added`, `vote-cast`, etc.) don't share a typed contract with the REST layer. The `SessionSocketEvents` interface is typed, but it's client-only. A GraphQL subscription schema would unify this.

**5. Auth tokens in plain REST headers.**
Current pattern: `Authorization: Bearer ${token}`. Fine for REST. GraphQL typically uses either connection params (for subscriptions) or a single auth header. Need to decide which.

**6. No user relationship modeling.**
No friends, followers, or social graph. The `Listener` type is ephemeral (exists only in a session). For a community-centric app, we need persistent user relationships.

**7. Voltage system is a placeholder.**
`voltageBalance` and `voltageBoost` exist as number fields but have no defined mechanics — no earning rules, spending rules, or transaction history.

**8. Connected services hold tokens client-side.**
`ServiceConnection.accessToken` and `refreshToken` are on the `User` type. These should NEVER hit the client. The backend should proxy service calls — the client only needs `{ connected: boolean, username?: string }`.

---

## Part 2: GraphQL Schema — User Profile System

### Design Principles Applied

- **Demand-driven fields**: Client asks for exactly what it needs
- **Node interface**: Every entity implements `Node` with a global `id`
- **Connections pattern**: Relay-style cursor pagination
- **Nullable by default**: Only mark `!` when the field genuinely cannot be null
- **Separate input types**: Mutations use dedicated input types, not entity types

```graphql
# ━━━ Scalars ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

scalar DateTime    # ISO 8601
scalar URL         # Validated URL string

# ━━━ Node Interface ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface Node {
  id: ID!
}

# ━━━ User Profile ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type User implements Node {
  id: ID!
  username: String!
  email: String!            # Only visible to self (resolver-level auth)
  avatarUrl: URL
  bio: String
  createdAt: DateTime!

  # ── Stats (computed, cacheable) ──
  stats: UserStats!

  # ── Connected Services (safe view — no tokens) ──
  connectedServices: [ConnectedService!]!

  # ── Social ──
  followers(first: Int, after: String): UserConnection!
  following(first: Int, after: String): UserConnection!
  isFollowedByViewer: Boolean!    # Requires auth context

  # ── Activity ──
  recentSessions(first: Int, after: String): SessionConnection!
  activeSessions: [Session!]!     # Currently live rooms this user hosts/is in
  topGenres: [GenreAffinity!]!    # Computed from listening history
  listeningHistory(first: Int, after: String): ListeningHistoryConnection!
}

type UserStats {
  sessionsHosted: Int!
  sessionsJoined: Int!
  tracksAdded: Int!
  totalListeningMinutes: Int!
  voltageBalance: Int!
  uniqueCollaborators: Int!      # How many distinct users they've shared rooms with
}

type ConnectedService {
  provider: MusicProvider!
  connected: Boolean!
  username: String               # Display name on that platform
  connectedAt: DateTime
}

enum MusicProvider {
  SPOTIFY
  APPLE_MUSIC
  SOUNDCLOUD
  YOUTUBE
  TIDAL
}

type GenreAffinity {
  genre: String!
  weight: Float!                  # 0.0–1.0, relative to user's total listening
  trackCount: Int!
}

# ── Listening History ──

type ListeningHistoryEntry implements Node {
  id: ID!
  track: Track!
  session: Session!
  listenedAt: DateTime!
  listenDurationSeconds: Int!     # How long they actually listened (vs skipping)
}

# ── Voltage Ledger ──

type VoltageTransaction implements Node {
  id: ID!
  amount: Int!                    # Positive = earned, negative = spent
  reason: VoltageReason!
  relatedSession: Session
  createdAt: DateTime!
}

enum VoltageReason {
  SESSION_HOSTED
  TRACK_VOTED_ON
  BOOST_SPENT
  DAILY_LOGIN
  STREAK_BONUS
}

# ── Connections (Relay pagination) ──

type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type UserEdge {
  node: User!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

# ━━━ Mutations: User Profile ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type Mutation {
  # Profile
  updateProfile(input: UpdateProfileInput!): UpdateProfilePayload!
  connectService(input: ConnectServiceInput!): ConnectServicePayload!
  disconnectService(provider: MusicProvider!): DisconnectServicePayload!

  # Social
  followUser(userId: ID!): FollowPayload!
  unfollowUser(userId: ID!): UnfollowPayload!

  # Voltage
  spendVoltage(input: SpendVoltageInput!): SpendVoltagePayload!
}

input UpdateProfileInput {
  username: String
  bio: String
  avatarUrl: URL
}

type UpdateProfilePayload {
  user: User
  errors: [UserError!]!
}

input ConnectServiceInput {
  provider: MusicProvider!
  authCode: String!              # OAuth code from provider redirect
}

type ConnectServicePayload {
  service: ConnectedService
  errors: [UserError!]!
}

type DisconnectServicePayload {
  provider: MusicProvider!
  errors: [UserError!]!
}

type FollowPayload {
  user: User                     # The user that was followed
  errors: [UserError!]!
}

type UnfollowPayload {
  user: User
  errors: [UserError!]!
}

input SpendVoltageInput {
  amount: Int!
  trackId: ID!                   # The track being boosted
  sessionId: ID!
}

type SpendVoltagePayload {
  transaction: VoltageTransaction
  newBalance: Int!
  errors: [UserError!]!
}

# ── Shared Error Type ──

type UserError {
  field: String
  message: String!
  code: ErrorCode!
}

enum ErrorCode {
  NOT_FOUND
  UNAUTHORIZED
  VALIDATION_ERROR
  INSUFFICIENT_VOLTAGE
  ALREADY_CONNECTED
  RATE_LIMITED
}

# ━━━ Queries: User Profile ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type Query {
  # Fetch by ID or username
  user(id: ID, username: String): User
  me: User                        # Authenticated user shortcut

  # Voltage history
  myVoltageHistory(first: Int, after: String): VoltageTransactionConnection!
}
```

---

## Part 3: GraphQL Schema — Music Feed System

This covers Discover, session browsing, track catalog, and the real-time session experience.

```graphql
# ━━━ Track (Catalog Entity) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type Track implements Node {
  id: ID!
  title: String!
  artist: String!
  album: String
  albumArtUrl: URL
  durationSeconds: Int!
  source: MusicProvider!
  sourceId: String!               # Provider-specific ID for playback

  # ── Social proof (aggregated across all sessions) ──
  timesQueued: Int!               # How often this track has been added globally
  averageRating: Float            # Aggregate from reactions
}

# ━━━ Session / Room ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

enum RoomMode {
  CAMPFIRE      # Round-robin, equal turns
  SPOTLIGHT     # Host curates, others suggest
  OPEN_FLOOR    # Democratic, votes reorder
}

type Session implements Node {
  id: ID!
  name: String!
  description: String
  host: User!
  genre: String
  roomMode: RoomMode!
  isPublic: Boolean!
  isLive: Boolean!
  joinCode: String!
  createdAt: DateTime!
  endedAt: DateTime               # Null if still live

  # ── Participants ──
  listeners(first: Int, after: String): ListenerConnection!
  listenerCount: Int!             # Cheaper than fetching full list

  # ── Queue ──
  currentTrack: QueueEntry
  queue(first: Int, after: String): QueueEntryConnection!
  suggestedQueue: [QueueEntry!]   # Spotlight mode only — pending tracks

  # ── Activity ──
  activityScore: Float!           # Computed: listeners * recency + votes
  chatMessages(first: Int, after: String, before: String): ChatMessageConnection!
}

# ── Queue Entry (Track in context of a session) ──

type QueueEntry implements Node {
  id: ID!
  track: Track!
  addedBy: User!
  addedAt: DateTime!
  status: QueueEntryStatus!
  votes: Int!
  votedByViewer: VoteDirection    # null = not voted, UP or DOWN
  voltageBoost: Int!
  reactions: [Reaction!]!
}

enum QueueEntryStatus {
  QUEUED
  PENDING       # Spotlight: awaiting host approval
  PLAYING
  PLAYED
  REJECTED      # Spotlight: host rejected
}

enum VoteDirection {
  UP
  DOWN
}

type Reaction {
  user: User!
  type: ReactionType!
  createdAt: DateTime!
}

enum ReactionType {
  FIRE
  VIBE
  SKIP
}

# ── Listener (ephemeral presence in session) ──

type Listener {
  user: User!
  joinedAt: DateTime!
  isActive: Boolean!              # Heartbeat-based
}

# ── Chat ──

type ChatMessage implements Node {
  id: ID!
  session: Session!
  author: User!
  text: String!
  type: ChatMessageType!
  createdAt: DateTime!
}

enum ChatMessageType {
  MESSAGE
  SYSTEM
  REACTION
}

# ━━━ Discover / Feed ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type DiscoverFeed {
  hotRightNow: [Session!]!                          # Top 3 by activity score
  happeningNow: [ActivityFeedEntry!]!               # Recent social proof
  genreSections: [GenreSection!]!                    # Grouped by genre (2+ rooms)
  moreRooms(first: Int, after: String): SessionConnection!  # Everything else
}

type GenreSection {
  genre: String!
  sessions: [Session!]!
}

type ActivityFeedEntry {
  id: ID!
  type: ActivityType!
  user: User!
  session: Session!
  track: Track                    # Present for TRACK_ADDED, REACTION
  createdAt: DateTime!
}

enum ActivityType {
  ROOM_CREATED
  TRACK_ADDED
  USER_JOINED
  REACTION
}

# ━━━ Search ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type SearchResults {
  tracks(first: Int, after: String): TrackConnection!
  sessions(first: Int, after: String): SessionConnection!
  users(first: Int, after: String): UserConnection!
}

# ━━━ Queries: Music Feed ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

extend type Query {
  # Discover
  discover(
    genre: String
    roomMode: RoomMode
    sortBy: DiscoverSort
  ): DiscoverFeed!

  # Session detail
  session(id: ID!): Session
  sessionByJoinCode(joinCode: String!): Session

  # Search
  search(query: String!, types: [SearchType!]): SearchResults!

  # Track catalog
  track(id: ID!): Track
}

enum DiscoverSort {
  ACTIVITY        # Default — activityScore desc
  NEWEST
  MOST_LISTENERS
}

enum SearchType {
  TRACKS
  SESSIONS
  USERS
}

# ━━━ Mutations: Music Feed ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

extend type Mutation {
  # Session lifecycle
  createSession(input: CreateSessionInput!): CreateSessionPayload!
  joinSession(joinCode: String!): JoinSessionPayload!
  leaveSession(sessionId: ID!): LeaveSessionPayload!
  endSession(sessionId: ID!): EndSessionPayload!

  # Queue
  addToQueue(sessionId: ID!, trackId: ID!): AddToQueuePayload!
  voteOnTrack(sessionId: ID!, queueEntryId: ID!, direction: VoteDirection!): VotePayload!
  skipTrack(sessionId: ID!): SkipPayload!

  # Spotlight mode
  approveTrack(sessionId: ID!, queueEntryId: ID!): ApproveTrackPayload!
  rejectTrack(sessionId: ID!, queueEntryId: ID!): RejectTrackPayload!

  # Reactions & Chat
  addReaction(sessionId: ID!, queueEntryId: ID!, type: ReactionType!): AddReactionPayload!
  sendMessage(sessionId: ID!, text: String!): SendMessagePayload!
}

input CreateSessionInput {
  name: String!
  description: String
  genre: String
  roomMode: RoomMode!
  isPublic: Boolean!
}

type CreateSessionPayload {
  session: Session
  errors: [UserError!]!
}

type JoinSessionPayload {
  session: Session
  errors: [UserError!]!
}

type LeaveSessionPayload {
  sessionId: ID!
  errors: [UserError!]!
}

type EndSessionPayload {
  session: Session
  errors: [UserError!]!
}

type AddToQueuePayload {
  queueEntry: QueueEntry          # The new entry (status=QUEUED or PENDING)
  errors: [UserError!]!
}

type VotePayload {
  queueEntry: QueueEntry          # Updated vote count + viewer vote state
  errors: [UserError!]!
}

type SkipPayload {
  nextTrack: QueueEntry           # New current track (or null if queue empty)
  errors: [UserError!]!
}

type ApproveTrackPayload {
  queueEntry: QueueEntry          # Status changed to QUEUED
  errors: [UserError!]!
}

type RejectTrackPayload {
  queueEntryId: ID!
  errors: [UserError!]!
}

type AddReactionPayload {
  reaction: Reaction
  errors: [UserError!]!
}

type SendMessagePayload {
  message: ChatMessage
  errors: [UserError!]!
}

# ━━━ Subscriptions (Real-time) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type Subscription {
  # Session-scoped real-time events
  sessionUpdated(sessionId: ID!): SessionEvent!
}

union SessionEvent =
    QueueUpdatedEvent
  | ParticipantEvent
  | TrackChangedEvent
  | ChatMessageEvent
  | ReactionEvent
  | SessionEndedEvent

type QueueUpdatedEvent {
  queue: [QueueEntry!]!
  action: QueueAction!
  affectedEntry: QueueEntry
}

enum QueueAction {
  TRACK_ADDED
  TRACK_REMOVED
  VOTE_CHANGED
  REORDERED              # Open Floor vote sort
  TRACK_APPROVED         # Spotlight
  TRACK_REJECTED         # Spotlight
}

type ParticipantEvent {
  action: ParticipantAction!
  user: User!
  listenerCount: Int!
}

enum ParticipantAction {
  JOINED
  LEFT
}

type TrackChangedEvent {
  currentTrack: QueueEntry
  previousTrack: QueueEntry
}

type ChatMessageEvent {
  message: ChatMessage!
}

type ReactionEvent {
  reaction: Reaction!
  queueEntry: QueueEntry!
}

type SessionEndedEvent {
  session: Session!
  reason: String
}

# ━━━ Relay Connections (remaining) ━━━━━━━━━━━━━━━━━━━━━━━━━━

type SessionConnection {
  edges: [SessionEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type SessionEdge {
  node: Session!
  cursor: String!
}

type TrackConnection {
  edges: [TrackEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type TrackEdge {
  node: Track!
  cursor: String!
}

type QueueEntryConnection {
  edges: [QueueEntryEdge!]!
  pageInfo: PageInfo!
}

type QueueEntryEdge {
  node: QueueEntry!
  cursor: String!
}

type ListenerConnection {
  edges: [ListenerEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type ListenerEdge {
  node: Listener!
  cursor: String!
}

type ChatMessageConnection {
  edges: [ChatMessageEdge!]!
  pageInfo: PageInfo!
}

type ChatMessageEdge {
  node: ChatMessage!
  cursor: String!
}

type ListeningHistoryConnection {
  edges: [ListeningHistoryEdge!]!
  pageInfo: PageInfo!
}

type ListeningHistoryEdge {
  node: ListeningHistoryEntry!
  cursor: String!
}

type VoltageTransactionConnection {
  edges: [VoltageTransactionEdge!]!
  pageInfo: PageInfo!
}

type VoltageTransactionEdge {
  node: VoltageTransaction!
  cursor: String!
}
```

---

## Part 4: Schema ↔ Current Code Mapping

How the GraphQL schema maps to what we already have:

| GraphQL Type | Current TS Type | Gap |
|---|---|---|
| `User` | `User` | Missing: `bio`, `followers/following`, `topGenres`, `listeningHistory` |
| `ConnectedService` | `ServiceConnection` | Remove `accessToken`/`refreshToken` from client type |
| `Session` | `Session` | Missing: `endedAt`, `activityScore` (exists in DiscoverScreen locally), `suggestedQueue` (exists in SessionRoomScreen locally) |
| `QueueEntry` | `QueueTrack` | Rename + add `status` enum, `votedByViewer` |
| `Track` | `Track` | Split: remove `addedBy`/`votes`/`reactions` from catalog Track |
| `ChatMessage` | `ChatMessage` | 1:1 match, good |
| `Listener` | `Listener` | Add `joinedAt`, `isActive` |
| `Reaction` | `Reaction` | Add `createdAt` |
| `DiscoverFeed` | DiscoverScreen logic | Currently computed client-side — move to server |
| `Subscription` | `SessionSocketEvents` | Direct mapping: each socket event → subscription event type |

### Migration Path (when backend work starts)

1. **Immediate:** Split `Track` into catalog `Track` + `QueueEntry` in types/index.ts
2. **Immediate:** Remove `accessToken`/`refreshToken` from `ConnectedServices` client type
3. **Phase 1:** Stand up GraphQL server (Apollo Server / Pothos) with mock resolvers matching current `mockData.ts`
4. **Phase 2:** Replace `api.ts` fetch calls with Apollo Client queries
5. **Phase 3:** Replace `socket.ts` event bus with GraphQL subscriptions (WebSocket transport)
6. **Phase 4:** Connect real data sources (Spotify API, DB, etc.)

---

## Part 5: UX Product Manager Pipeline Assessment

The uploaded `ux-product-manager.md` contains a 4-stage pipeline:

1. **Lite PRD Generator** — Converts rough ideas to 7-section demo PRDs
2. **PRD Clarifier** — Interactive Q&A to resolve ambiguities (5/10/20/35 questions)
3. **PRD to UX Spec** — 6-pass forced designer mindset (Mental Model → IA → Affordances → Cognitive Load → State Design → Flow Integrity)
4. **UX Spec to Build-Order Prompts** — Sequences self-contained prompts for UI gen tools

### Relevance to Frequen-C

**High relevance for new features.** We should run the PRD → UX Spec pipeline for these upcoming features:

- **Onboarding flow** — Multiple entry points, first-time user experience, needs all 6 UX passes
- **AI recommendation engine** — Complex mental model (how do users understand why a track was suggested?)
- **Notifications system** — State design is critical (what does the user see for each notification type?)
- **Search screen** — Affordances pass would catch interaction gaps

**Lower relevance for what's already built.** The Discover rework, Chat, and micro-interactions are already implemented and tested. Running retroactive UX passes would be academic (literally — could be good for DESN 374 documentation).

### Recommendation

Use the pipeline going forward for any new screen or feature. For DESN 374 deliverables, run the 6-pass UX spec retroactively on the Session Room experience — it's the core thesis feature and the analysis would strengthen the research paper.

---

## Part 6: GraphQL Schema Audit Against API Design Principles

*Retroactive assessment using the `api-design-principles` skill (backend-architect.md).*

### Checklist: GraphQL Best Practices

| Principle | Status | Notes |
|---|---|---|
| Schema-first development | ✅ Pass | Schema drafted before any resolver code |
| Strongly typed schema | ✅ Pass | Enums for all categorical fields, custom scalars (DateTime, URL) |
| Relay-style cursor pagination | ✅ Pass | All list fields use Connection/Edge/PageInfo pattern |
| Input types for mutations | ✅ Pass | `CreateSessionInput`, `UpdateProfileInput`, etc. |
| Structured error payloads | ✅ Pass | Every mutation returns `errors: [UserError!]!` with `field`, `message`, `code` |
| N+1 prevention (DataLoader) | ⚠️ Not yet | Schema is DataLoader-ready (relationships on types), but no resolvers written yet. When implementing: `User.followers`, `Session.listeners`, `QueueEntry.track` all need loaders |
| Avoid over-fetching | ✅ Pass | This is why we're doing GraphQL — `DiscoverFeed` lets client request only `name`+`listenerCount`+`genre` for browse, full `Session` for detail |
| Deprecation strategy | ⚠️ Missing | No `@deprecated` directives yet. Will need these when evolving the schema post-launch |
| Query complexity limits | ⚠️ Missing | No cost analysis. `discover` → `sessions` → `listeners` → `user` → `followers` is a deep nesting path. Need query depth/complexity limits |
| Subscriptions design | ✅ Pass | Union type `SessionEvent` with discriminated subtypes — clean pattern for typed real-time events |
| Introspection | ✅ Built-in | GraphQL gives this for free |

### Specific Issues Found

**1. Missing `@deprecated` on REST→GraphQL migration fields**
When we stand up the GraphQL server alongside the existing REST endpoints, any overlapping fields should be marked deprecated on the REST side. On the GraphQL side, plan for deprecation from day one:

```graphql
type Session {
  # When we change genre from free-text to enum:
  genre: String @deprecated(reason: "Use genreTag instead")
  genreTag: GenreTag
}
```

**2. Query complexity bomb: `discover` query**
`discover` returns `DiscoverFeed` which contains `hotRightNow: [Session!]!` — each `Session` has `listeners`, `queue`, `chatMessages`, all paginated. A malicious or naive client could request:
```graphql
{ discover { hotRightNow { listeners(first:100) { edges { node { followers(first:100) { ... } } } } } } }
```
**Fix:** Add query cost analysis. Budget: max depth 4, max complexity 500.

**3. No rate limiting strategy in schema**
The skill emphasizes rate limits. For GraphQL, this means:
- Per-IP rate limiting at the HTTP layer
- Per-query complexity budget
- Mutation-specific throttling (e.g., `sendMessage` max 1/sec, `addReaction` max 5/sec)

**4. `Track.sourceId` should be non-nullable**
Every track comes from a provider. If we have the track, we have the source ID. Change from `sourceId: String!` — already correct in the schema, but the current TS type has `sourceId?: string` (optional). Fix the TS type.

**5. Missing `node` root query**
Relay spec expects a `node(id: ID!): Node` query for refetching any entity by global ID. Add:
```graphql
extend type Query {
  node(id: ID!): Node
  nodes(ids: [ID!]!): [Node]!
}
```

### Summary Score

Against the 7 GraphQL best practices in the skill:

1. ✅ Schema First
2. ⚠️ DataLoader — schema ready, resolvers not written
3. ✅ Input Validation — schema-level types + resolver-level errors planned
4. ✅ Error Handling — structured payloads
5. ✅ Pagination — cursor-based everywhere
6. ⚠️ Deprecation — not yet needed but strategy missing
7. ⚠️ Monitoring — no complexity/cost analysis

**Overall: 4/7 fully passing, 3/7 planned but not implemented.** This is expected at schema-design stage — the 3 gaps are all resolver/infrastructure concerns that get addressed when we build the server.

---

## Part 7: Installed Skill Pipeline

All referenced skills are now installed at `.skills/skills/`:

```
.skills/skills/
├── brainstorming/SKILL.md       ← Design-first gate (HARD GATE before code)
├── writing-plans/SKILL.md       ← TDD implementation plans
├── api-design-principles/SKILL.md ← REST + GraphQL reference
└── ux-product-manager/SKILL.md  ← PRD → UX Spec → Build-Order Prompts
```

**Pipeline for all future features:**
```
brainstorming → design approval → writing-plans → execute
       ↑                              ↑
  api-design-principles          ux-product-manager
  (reference during design)    (reference during design)
```

CLAUDE.md updated to enforce this pipeline.
