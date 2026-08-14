# UniConnect Client — Overview

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.12 |
| UI Library | React | 19.2.4 |
| Language | TypeScript (strict) | ^5 |
| Styling | Tailwind CSS | ^4.3.3 |
| Component Library | daisyUI | ^5.7.7 |
| Icons | lucide-react | ^1.28.0 |
| Package Manager | pnpm | — |

## Folder Structure

```
client/
├── app/                          # Next.js App Router pages
│   ├── globals.css               # Tailwind v4 + daisyUI theme + CSS vars + gradient
│   ├── layout.tsx                # Root layout (Poppins font, metadata)
│   ├── page.tsx                  # Landing page / role selection
│   ├── lecturer/page.tsx         # Lecturer dashboard (794 lines)
│   ├── manage/page.tsx           # Management dashboard (992 lines)
│   └── student-affair/page.tsx   # Student Affairs dashboard (934 lines)
├── components/shared/            # Reusable UI components (15 files)
│   ├── PageLayout.tsx            # daisyUI drawer shell (sidebar + navbar + main)
│   ├── Sidebar.tsx               # Role-based gradient sidebar navigation
│   ├── Navbar.tsx                # Glass top bar with search + notifications
│   ├── WelcomeBar.tsx            # Greeting + current date
│   ├── StatCard.tsx              # KPI card (icon, value, trend)
│   ├── ComposeBox.tsx            # Post composer (textarea + actions)
│   ├── FeedItem.tsx              # Social feed post (avatar, content, actions)
│   ├── EventItem.tsx             # Calendar event row
│   ├── MessageItem.tsx           # Chat message row
│   ├── InboxItem.tsx             # Email inbox row
│   ├── ExploreCard.tsx           # Discovery card (clubs, workshops)
│   ├── QuickAccess.tsx           # 2×2 shortcut grid
│   ├── DataTable.tsx             # Generic data table
│   ├── constants.ts              # Mock data + role-based nav config
│   └── types.ts                  # TypeScript interfaces
├── public/
│   ├── uniconnect_sketch_design.html  # Original design prototype
│   └── *.svg                          # Default Next.js assets
├── .agents/skills/daisyui/       # daisyUI skill files (component docs + config)
├── AGENTS.md                     # AI agent rules (Next.js 16 breaking changes)
├── CLAUDE.md                     # Points to AGENTS.md
├── next.config.ts                # Empty Next.js config
├── tsconfig.json                 # Strict TS, @/* alias, bundler module
├── postcss.config.mjs            # @tailwindcss/postcss plugin
├── eslint.config.mjs             # ESLint 9 flat config
├── package.json                  # Scripts: dev, build, start, lint
└── pnpm-lock.yaml                # pnpm lockfile
```

## Architecture

### Routing

- `/` → Role selection landing page (3 portal cards)
- `/lecturer` → Lecturer dashboard (static, SPA within page)
- `/manage` → Management dashboard (static, SPA within page)
- `/student-affair` → Student Affairs dashboard (static, SPA within page)

Each dashboard is a single `page.tsx` that uses `useState` for internal page navigation (`activePage`), switching between sections like dashboard, feed, students, timetable, etc. No external routing library or API calls — all mock data from `constants.ts`.

### Layout

Every dashboard page wraps content in `<PageLayout>`:

```
PageLayout (drawer container)
├── input#layout-drawer.drawer-toggle  (uncontrolled checkbox for mobile)
├── div.drawer-content
│   ├── Navbar                         (search, notifications, settings)
│   └── main
│       └── max-w-[1280px] wrapper
│           └── [page-specific content]
└── div.drawer-side
    ├── label.drawer-overlay           (closes drawer on tap)
    └── Sidebar                        (role-based nav, user profile)
```

- `lg:drawer-open` — sidebar visible on large screens, overlay on mobile
- `drawerRef` (useRef) controls toggle programmatically; navigating closes drawer
- Sidebar passes `activePage` + `onNavigate` + `role`

### State

- Each route page manages its own `activePage` via `useState<'dashboard' | 'feed' | 'students' | ...>`
- Role is hardcoded per route (`'lecturer' | 'manage' | 'student-affair'`)
- All data is mock data from `constants.ts` — no API/backend

## Components

### Layout Components

| Component | Description |
|---|---|
| **PageLayout** | Drawer shell, responsive sidebar toggle, passes props to Sidebar/Navbar |
| **Sidebar** | 260px gradient sidebar, SVG dot overlay, role-based MAIN_NAV, user profile footer |
| **Navbar** | Glass top bar (rgba + blur), hamburger (mobile), search with focus ring, bell/settings icon buttons |

### Shared UI Components

| Component | Props | Description |
|---|---|---|
| **WelcomeBar** | `name`, `greeting?`, `subtitle?` | Glass greeting card with current date |
| **StatCard** | `icon`, `iconBgClass?`, `value`, `label`, `trend?`, `extra?` | KPI card with glass background |
| **ComposeBox** | `placeholder?`, `avatarInitials?` | Post composer with textarea + attach/post buttons |
| **FeedItem** | `item: FeedItemData` | Social post with avatar, content, tags, actions |
| **EventItem** | `day`, `month`, `title`, `description`, `action` | Calendar event row with date block |
| **MessageItem** | `initials`, `color`, `name`, `preview`, `time`, `unread?` | Chat message row |
| **InboxItem** | `item: InboxItemData` | Email row with star/trash actions |
| **ExploreCard** | `title`, `meta`, `description`, `tags` | Discovery card with tag badges |
| **QuickAccess** | (none) | 2×2 grid: Exam Results, Roll Call, Timetable, Finance |
| **DataTable** | `columns`, `data` | Generic table with typed columns + custom render |

## Styling & Theming

### daisyUI Theme

Custom `uniconnect-dark` theme set as default with OKLCH blue color palette:

- **base-100:** `oklch(0.14 0.03 260)` — dark navy surface
- **primary:** `oklch(0.50 0.13 260)` — medium blue
- **accent:** `oklch(0.58 0.12 265)` — lighter blue accent

### CSS Custom Properties

```css
--primary: #3a8bc2;       /* link/hover blue */
--primary-dark: #2a7aaa;  /* darker variant */
--accent: #c8d8e8;        /* headings */
--text: #d0dce8;          /* body text (light on dark) */
--text-light: #8a9aaa;    /* secondary text */
--secondary: rgba(255,255,255,0.08);  /* borders */
--shadow-sm/md/lg: rgba(0,0,0,0.3-0.5);
--radius-sm/md/lg/xl: 12px-24px;
```

### Glassmorphism

All surfaces use the glass effect pattern:

```css
bg-white/[0.06] backdrop-blur-xl
```

- Cards, sidebar, navbar, welcome bar, quick access tiles — all glass
- Subtle white borders (`rgba(255,255,255,0.08)`) on card edges
- Dividers use `rgba(255,255,255,0.06)` or lower opacity

### Background

Fixed dark gradient on both `html` and `body`:

```
linear-gradient(160deg, #0a1628 → #0f2040 → #152545 → #0a1628)
```

`background-attachment: fixed` keeps the gradient fixed during scroll.

## Route Pages

Each dashboard page follows the same pattern:

```tsx
export default function LecturerPage() {
  const [activePage, setActivePage] = useState('dashboard');
  const handleNavigate = (p: string) => setActivePage(p);

  return (
    <PageLayout activePage={activePage} onNavigate={handleNavigate} role="lecturer">
      {/* section content rendered based on activePage */}
    </PageLayout>
  );
}
```

### Lecturer (`794 lines`)
- dashboard, feed, students, timetable, roll-call, announcements, exam-results, lost-found

### Management (`992 lines`)
- dashboard, feed, students, timetable, staff, finance, announcements, explore, inbox, events

### Student Affairs (`934 lines`)
- dashboard, feed, students, events, lost-found, announcements, support, settings

## Data Flow

```
constants.ts (mock data + MAIN_NAV)
    ↓  imported by
route pages (lecturer/manage/student-affair)
    ↓  passed as props
shared components (FeedItem, EventItem, DataTable, etc.)
```

No API calls, no backend, no state management library. Pure props-down React with useState for page navigation.

## Build & Development

```bash
pnpm dev       # Start dev server (Turbopack)
pnpm build     # Production build (static pages)
pnpm start     # Start production server
pnpm lint      # ESLint check
```

The project generates 5 static routes: `/`, `/lecturer`, `/manage`, `/student-affair`, `/_not-found`.

## Notes

- **Next.js 16 has breaking changes** — read `node_modules/next/dist/docs/` before writing code
- Tailwind v4 uses `@import "tailwindcss"` instead of `@tailwind base/components/utilities`
- daisyUI 5 uses `@plugin "daisyui"` in CSS (no `tailwind.config.js`)
- No SSR data fetching — all pages are static (`○ Static` in build output)
- `eslint.config.mjs` uses ESLint 9 flat config format
