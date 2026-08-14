# UniConnect Client — Feature Details

## 1. Inbox Messages

**File:** `src/app/(main)/inbox/page.tsx` (366 lines)

Email-style inbox system with filter tabs: **All**, **Unread**, **Starred**, and **Exam Results**.

### Data Model

```typescript
interface Email {
  id: number; from: string; subject: string; preview: string;
  body: string; time: string; read: boolean; starred: boolean;
  avatar: string; role: string;
}
```

8 hardcoded emails from users like "University Admin", "Prof. Anderson", etc.

```typescript
interface ExamResultItem {
  id: number; studentName: string; regNumber: string; programme: string;
  semester: string; session: string; gpa: string; pdfUrl: string;
  status: "ready" | "pending";
}
```

5 hardcoded exam result PDF records.

### Key Functions

| Function | Line | Description |
|---|---|---|
| `toggleStar(id)` | 74 | Toggles star status on an email |
| `markRead(id)` | 78 | Marks a single email as read |
| `deleteEmail(id)` | 82 | Removes email after confirmation via `ConfirmModal` |
| `openEmail(email)` | 89 | Marks email as read and opens detail view |
| `handleSendAll()` | exam results section | Sends all pending results (uses `ConfirmModal`) |

### UI States
- **List view** — avatar, sender, subject, preview line, timestamp, star icon
- **Detail view** — full email body with Reply / Forward buttons
- **Exam results view** — per-student card with programme, semester, GPA, status badge, Download PDF button
- **Empty state** — handled per-filter (no emails message)
- **Delete confirmation** — uses `ConfirmModal` with danger styling
- **Success toast** — `Toast` component feedback after actions

---

## 2. Chat (Direct Messaging)

**File:** `src/app/(main)/chat/page.tsx` (264 lines)

Instant messaging interface with contacts list, 1-on-1 chat, and group creation.

### Data Model

```typescript
interface Message {
  id: number; sender: "me" | "other"; text: string; time: string;
}

interface Contact {
  id: number; name: string; avatar: string; role: string;
  online: boolean; lastSeen: string; unread: number;
}
```

6 hardcoded contacts; mock messages for contact `id: 1`; 8 users available for group creation.

### Key Functions

| Function | Line | Description |
|---|---|---|
| `sendMessage()` | 71 | Appends new `Message` from `"me"` to current chat messages |
| `toggleMember(name)` | 82 | Selects/deselects a user for group creation |
| `createGroup()` | 86 | Creates a new `Contact` from selected members (group avatar + member list) |

### UI States
- **Desktop split layout** — left sidebar (contacts) + right panel (chat)
- **Mobile responsive** — shows either contact list or chat pane, never both
- **Contact list** — search input, Create Group button, contact cards with avatar, online dot, unread badge
- **Chat pane** — message history with aligned bubbles (right = me, left = other), attachment button (paperclip, non-functional)
- **Group creation modal** — member picker grid with multi-select + Create button
- **Floating FAB** — rendered by `Navigation.tsx` (line 170-178) on mobile: New Group, Saved Messages, New Contact actions

---

## 3. Share Modal

**File:** `src/components/ShareModal.tsx` (102 lines)

Reusable modal for sharing posts with other users.

### Data
10 hardcoded suggested users with name, avatar, mutual friend count.

### Key Functions

| Function | Line | Description |
|---|---|---|
| `handleShare(name)` | 36 | Marks user as shared, triggers `onShare` callback |

### UI States
- Search input with live filtering
- Scrollable user list: avatar, name, "X mutual friends"
- Share / Shared button toggle per user
- Close on backdrop click or X button (via `ModalPortal`)

---

## 4. Notifications

**File:** `src/app/(main)/notifications/page.tsx` (158 lines)

Notification feed with **All** / **Unread** filter tabs.

### Data Model

```typescript
interface Notification {
  id: number; type: "like" | "comment" | "follow" | "event" | "announcement";
  message: string; time: string; read: boolean;
}
```

10 hardcoded notifications (e.g., "Sarah Chen liked your post", "Career Fair starts in 2 days").

### Key Functions

| Function | Line | Description |
|---|---|---|
| `markAllRead()` | 48 | Marks every notification as read |

### UI States
- Header with unread count badge + "Mark all read" button
- Per-notification cards with type-based icons, message, relative time
- Unread cards use highlighted styling
- Empty state when all read in "Unread" tab

### Notification Preferences (Settings)
**File:** `src/app/(main)/settings/page.tsx` lines 96-116

Toggle switches for: Push Notifications, Email Digest, Message Alerts, Event Reminders (stored in local state).

---

## 5. Feed / Posts

**File:** `src/app/(main)/feed/page.tsx` (1341 lines)

Core social feed with post creation, reactions, comments, sharing, and AI moderation.

### Data Model

```typescript
interface Post {
  id: number; user: { name: string; avatar: string; role: string };
  content: string; media?: { type: "image" | "video"; url: string };
  reactions: Record<ReactionType, number>; userReaction: ReactionType | null;
  comments: Comment[]; shares: number; time: string;
}

interface Comment {
  id: number; user: string; avatar: string; text: string;
  time: string; likes: number; liked: boolean; replies?: Comment[];
}
```

5 initial hardcoded posts; random comment generator utilities (`genComment`, `genComments` lines 731-749).

### Key Functions

| Function | Line | Description |
|---|---|---|
| `handlePost()` | 968 | Validates text via AI, creates post, prepends to feed |
| `handleTextModeration(text)` | 902 | Runs text through AI moderation with min 3600ms scan |
| `handleMediaModeration(file)` | 931 | Runs image/video through AI moderation with min 3600ms scan |
| `handleMediaSelect(e)` | 958 | Converts file to object URL, triggers media moderation |
| `upsert(postId, updates)` | 999 | Helper to update a single post in state |
| `PostCard` | 1197 | Renders individual post with all interactions |

### Post Creation Flow
1. User types in textarea (line 1047)
2. Optionally selects media (image/video) via file input (line 1142)
3. On "Post" click, text is sent to AI moderation
4. Media is sent to AI moderation immediately on selection
5. Both must pass moderation before Post button is enabled
6. Post is created and prepended to feed

### Reactions
**File:** `src/components/ReactionButton.tsx` (76 lines)

7 reaction types: `like`, `love`, `haha`, `wow`, `sad`, `angry`, `care`.
Click opens horizontal emoji bar above button; click outside closes; shows user's current reaction + total count.

### Comments
- Inline comment input in each `PostCard`
- "Load more comments" for posts with >2 comments (line 1276-1279)
- Like/unlike individual comments
- Nested reply support

### UI States
- **Feed** — scrollable post list with Trending / Latest filter buttons (non-functional)
- **Post creation** — textarea, media preview thumbnail, Post button (disabled during / after failed moderation)
- **Post card** — user info, content, media attachment, reaction bar, comment section, share count
- **Skeleton loading** — placeholder while posts load
- **Scan animations** — see AI Moderation section below

---

## 6. AI Validation (Moderation)

### Server-Side API Route

**File:** `src/app/api/moderate/route.ts` (144 lines)

**Endpoint:** `POST /api/moderate` — accepts `{ image?, text?, type }`.

#### FLAG_SYSTEM_PROMPT (lines 3-17)
Strict moderation instructions to flag: hate speech, harassment, violence, explicit content, self-harm, profanity, spam, academic dishonesty, doxxing, illegal content.

#### Model Configuration (lines 24-43)

| Type | Models |
|---|---|
| **Video** | nvidia/llama-3.2-nv-vlm:1, google/gemma-3-27b-it, google/gemini-2.0-flash-001, google/gemini-2.5-flash-preview-04-17 |
| **Image** | nvidia/llama-3.2-nv-vlm:1, google/gemma-3-27b-it, google/gemini-2.0-flash-001, google/gemini-2.5-flash-preview-04-17 |
| **Text** | nemotron-3-ultra-550b, nemotron-3-super-120b, llama-3.1-8b-instruct |

#### Key Functions

| Function | Line | Description |
|---|---|---|
| `callOpenRouter(model, apiKey, messages)` | 44 | HTTP POST to OpenRouter API |
| `parseResult(raw)` | 60 | Parses JSON from AI model response |
| `POST(req)` | 75 | Main handler — iterates models, aggregates results |

#### Aggregation Logic
- Iterates over all models for the given type
- If **any** model flags the content, the result is `{ safe: false }` with aggregated categories and reason
- Requires all configured env variables for API keys (e.g., `OPENROUTER_API_KEY`, `TEXT_MODEL_1_KEY`, etc.)

### Client-Side Library

**File:** `src/lib/moderate.ts` (93 lines)

#### Key Functions

| Function | Line | Description |
|---|---|---|
| `extractVideoFrame(file)` | 7 | Extracts a JPEG frame from video at 30% duration, max 640px |
| `imageToBase64(file)` | 55 | Converts image file to base64 string |
| `moderateMedia(file, type)` | 67 | Converts file to base64, POSTs to `/api/moderate`. Returns `{ safe: true }` on error |
| `moderateText(text)` | 81 | POSTs text to `/api/moderate`. Returns `{ safe: true }` on error |

### Scan Animations (Feed Page)

**File:** `src/app/(main)/feed/page.tsx` lines 6-501 (CSS keyframes)

Two animated scanning overlays for visual feedback during moderation:

#### Text Scanner (lines 298-501)
- Scanning beam sweep across text
- Green/red status bar result overlay

#### Media Scanner (lines 6-297)
- Scanning beam with glow
- Overlay grid pattern
- Floating noise particles
- Suspicious region pulse animation
- Result overlay: green "APPROVED" or red "BLOCKED" with reason

#### Scan Stages (`ScanStage` type, line 692)
```
idle → ocr → extracting → detecting → checking → finalizing → approved / failed
```
Each stage transitions every ~1800ms with direction reversal (lines 846-900).

### Integration Flow in Feed

```
User selects media
  → handleMediaSelect (958)
    → handleMediaModeration (931)
      → moderateMedia (lib/moderate.ts:67)
        → POST /api/moderate
      → scan animation plays (min 3600ms)
    → if blocked: show "BLOCKED" overlay, disable Post button
    → if approved: show "APPROVED" overlay, enable Post button

User clicks Post
  → handlePost (968)
    → handleTextModeration (902)
      → moderateText (lib/moderate.ts:81)
        → POST /api/moderate
      → scan animation plays (min 3600ms)
    → if unsafe: show red warning bar with reason
    → if safe: create post and prepend to feed
```

### Security & Error Handling
- Content is flagged **only on the server**; client never sees raw AI responses
- API keys stored in environment variables
- On network/API error, content is **allowed by default** (`safe: true`) to avoid blocking users due to service outages
- Multi-model consensus: any single model flagging blocks the content

---

## File Reference Map

| Feature | Primary Files | Key Lines |
|---|---|---|
| Inbox | `src/app/(main)/inbox/page.tsx` | 30-47 (data), 74-94 (actions) |
| Chat | `src/app/(main)/chat/page.tsx` | 36-52 (data), 71-86 (actions) |
| Share Modal | `src/components/ShareModal.tsx` | 6-17 (data), 36 (share logic) |
| Notifications | `src/app/(main)/notifications/page.tsx` | 14-25 (data), 48 (markRead) |
| Notif Settings | `src/app/(main)/settings/page.tsx` | 96-116 |
| Feed | `src/app/(main)/feed/page.tsx` | 680-700 (types), 757-763 (data), 902-968 (moderation flow), 1197 (PostCard) |
| Reactions | `src/components/ReactionButton.tsx` | 5 (types), 23 (picker) |
| AI API Route | `src/app/api/moderate/route.ts` | 3-17 (prompt), 24-43 (models), 44-73 (helpers), 75-144 (handler) |
| AI Client Lib | `src/lib/moderate.ts` | 7-54 (media util), 67-92 (moderation calls) |
| Navigation | `src/components/Navigation.tsx` | 170-178 (chat FAB) |
