# Cultivapp Design System & Redesign Guidelines

## Core Principles
1. **Mobile-First & Responsive:** The UI must feel like a native app on mobile (bottom navs, touch-friendly targets, drawers) and scale gracefully to tablet/desktop via Grid/Flexbox layouts.
2. **Bento Grid Architecture:** Use rounded, card-based layouts (`.bento-card`, `.bento-card-interactive`) for all main content areas to create a modern, structured feel.
3. **High Contrast & Readability:** Ensure accessibility with deep, OLED-friendly blacks in dark mode and crisp off-whites in light mode.
4. **Subtle Feedback:** Use micro-interactions, like subtle hover lifts (`-translate-y-1`) and shadow expansions (`shadow-bento-hover`), to make the interface feel alive.

## Color Palette
### Light Mode
- Background: Slate 50 (`#F8FAFC`)
- Surface (Cards): White (`#FFFFFF`)
- Text Primary: Slate 900 (`#0F172A`)
- Text Secondary: Slate 500 (`#64748B`)

### Dark Mode
- Background: Deep Blue-Black (`#0B0F19`)
- Surface (Cards): Elevated Dark (`#151B28`)
- Text Primary: Slate 50 (`#F8FAFC`)
- Text Secondary: Slate 400 (`#94A3B8`)

### Brand Colors (Shared)
- Primary: Emerald 500 (`#10B981`)
- Primary Hover: Emerald 600 (Light) / Emerald 400 (Dark)
- Secondary: Teal (`#0F766E` / `#0D9488`)
- Accent: Amber (`#F59E0B` / `#FBBF24`)

## Typography
- **Headings (Titles):** Playfair Display (Serif) - Adds an organic, sophisticated touch.
- **Body & UI Elements:** Inter (Sans-serif) - Ensures maximum legibility for data, dates, and technical information.

## Global Components (Bento Style)
- Utilize the `@apply bento-card` utility for standard containers.
- Utilize `@apply bento-card-interactive` for clickable cards (like plants or tasks).
- Borders should be subtle (`rgba(0,0,0,0.08)` in light, `rgba(255,255,255,0.08)` in dark).
- Border radii for cards should be generous (e.g., `rounded-3xl` / `1.5rem`).

## Task execution flow
- Only use standard Next.js `<Link>` for navigation.
- Ensure proper use of CSS grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) for Bento layouts.
