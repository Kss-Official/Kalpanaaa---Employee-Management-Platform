# 🎯 MASTER REDESIGN PROMPT — Kalpanaaa Employee Management PWA
## From "Basic Responsive" to "Top 1% Enterprise-Grade Mobile Experience"

---

## 0. CONTEXT & CURRENT STATE

**Project**: Kalpanaaa Employee Management Platform (PWA)
**Stack**: React + TypeScript (TSX) + Tailwind CSS + PWA
**Current URL**: kalpanaaa.in
**Company**: Kalpanaaa Software Solutions Pvt. Ltd.

### Current Features (MUST Preserve Functionality)
- Daily Check-In / Check-Out with GPS geo-location tracking
- Working duration calculation & display
- Admin portal with full employee oversight
- Employee Directory with search, filters, pagination
- Employee Profile with details, attendance history, leaves
- Printable Enterprise ID Badge (Front Barcode / Back QR Code)
- Leave Management (Apply, Approve, Track)
- Attendance reports & analytics
- Role-based access (Admin vs Employee views)
- PWA installable with offline capability

### Current Pain Points (MUST Fix)
- Looks like a generic Bootstrap/Tailwind admin panel
- No "premiumness" — feels like a free template
- Mobile experience is just "shrunk desktop", not native-feeling
- Zero meaningful animations or micro-interactions
- No haptic feedback, no gesture support
- Bottom nav is basic, no active state glow/physics
- Modals are generic browser popups, not native bottom sheets
- Cards are flat, dense, overwhelming on mobile
- No loading states, skeletons, or transition choreography
- Color palette is default Tailwind slate/blue — no brand identity
- Typography hierarchy is weak
- No "delight" moments — purely functional, zero emotional design

---

## 1. DESIGN PHILOSOPHY — "The Top 1% Standard"

### Core Principles
1. **Mobile-First, Not Mobile-Compatible** — Design FOR the thumb zone first. Desktop is an enhancement.
2. **Native App Illusion** — User should forget this is a web app. It must feel like a downloaded iOS/Android app.
3. **Every Pixel Earns Its Place** — No decorative clutter. Every element has purpose + motion + feedback.
4. **Progressive Disclosure** — Show only what the user needs RIGHT NOW. Everything else is one tap away.
5. **Emotional Design** — Small moments of delight (success animations, smooth transitions, haptic pops) build loyalty.
6. **Enterprise Trust** — Despite being beautiful, it must scream "secure, reliable, professional" — like Workday + Notion + Linear had a baby.

### Inspiration References (Study These)
- **Linear.app** — Motion design, loading states, empty states, subtle glows
- **Notion Mobile** — Clean information density, bottom sheets, smooth transitions
- **Apple Wallet / Apple Health** — Card-based layouts, spring animations, haptic feedback
- **Wise (TransferWise) App** — Transaction flows, confirmation states, micro-animations
- **BambooHR Mobile** — Enterprise HR done right (but we go 10x better)
- **Microsoft Teams Mobile** — Bottom nav ergonomics, tab switching physics

---

## 2. DESIGN SYSTEM — "Kalpanaaa Obsidian"

### 2.1 Color Palette (STRICT — No Default Tailwind Colors)

```
// Primary Backgrounds
--bg-primary:       #000000        // Pure black OLED base
--bg-secondary:     #0a0a0f        // Slightly lifted black
--bg-tertiary:      #111118        // Card backgrounds
--bg-elevated:      #1a1a24        // Elevated surfaces, modals, sheets
--bg-overlay:       rgba(10,10,15,0.85)  // Backdrop blur base

// Text Colors
--text-primary:     #ffffff        // Headlines, key data
--text-secondary:   #a1a1aa        // Body text, descriptions
--text-tertiary:    #71717a        // Metadata, timestamps, hints
--text-muted:       #52525b        // Disabled, placeholders

// Accent Colors (Use Sparingly — These Are the ONLY Colors)
--accent-emerald:   #10b981        // Success, Present, Approved, Active
--accent-blue:      #3b82f6        // Primary actions, links, active states
--accent-amber:     #f59e0b        // Warnings, Late, Pending, Grace period
--accent-rose:      #f43f5e        // Danger, Absent, Rejected, Errors
--accent-violet:    #8b5cf6        // Premium highlights, badges, special states

// Accent Glows (For Active States & Premium Feel)
--glow-emerald:     rgba(16,185,129,0.3)
--glow-blue:        rgba(59,130,246,0.35)
--glow-amber:       rgba(245,158,11,0.3)
--glow-rose:        rgba(244,63,94,0.3)

// Border & Divider
--border-subtle:    rgba(255,255,255,0.06)
--border-medium:    rgba(255,255,255,0.1)
--border-strong:    rgba(255,255,255,0.15)

// Gradients (Subtle, Never Flashy)
--gradient-card:    linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)
--gradient-glow:    radial-gradient(ellipse at top, rgba(59,130,246,0.08) 0%, transparent 60%)
--gradient-success: linear-gradient(135deg, #10b981 0%, #059669 100%)
--gradient-premium: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)  // ONLY for ID card / premium badges
```

### 2.2 Typography Scale (Mobile-Optimized)

```
Font Family: Inter or SF Pro Display (system-ui fallback)

--text-xs:    11px / 16px   // Timestamps, micro labels
--text-sm:    13px / 18px   // Secondary info, metadata
--text-base:  15px / 22px   // Body text (prevents iOS zoom on inputs)
--text-lg:    17px / 24px   // Card titles, section headers
--text-xl:    20px / 28px   // Page titles
--text-2xl:   24px / 32px   // Hero numbers, big stats
--text-3xl:   30px / 38px   // Splash screens, empty states

Font Weights:
- 400: Body, descriptions
- 500: Labels, buttons, navigation
- 600: Card titles, section headers
- 700: Page titles, key numbers
- 800: Hero stats, splash headlines

Tabular Numbers: ALL duration, time, counts, percentages MUST use font-variant-numeric: tabular-nums
```

### 2.3 Spacing & Layout Grid

```
Base Unit: 4px
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px
--space-5:  20px
--space-6:  24px
--space-8:  32px
--space-10: 40px

Mobile Container:
- Horizontal padding: 16px (px-4)
- Max content width: 100% (no artificial constraints)
- Card border-radius: 16px (rounded-2xl)
- Button border-radius: 12px (rounded-xl)
- Chip/badge border-radius: 9999px (full)
- Input border-radius: 12px (rounded-xl)

Touch Targets:
- Minimum: 48px × 48px
- Buttons: 56px height minimum on mobile
- Icon buttons: 44px × 44px
- List items: 64px minimum height
```

### 2.4 Shadows & Elevation (Dark Mode Optimized)

```
--shadow-sm:    0 1px 2px rgba(0,0,0,0.3)
--shadow-md:    0 4px 12px rgba(0,0,0,0.4)
--shadow-lg:    0 8px 24px rgba(0,0,0,0.5)
--shadow-xl:    0 16px 48px rgba(0,0,0,0.6)
--shadow-glow-blue: 0 0 20px rgba(59,130,246,0.2), 0 0 40px rgba(59,130,246,0.1)
--shadow-glow-emerald: 0 0 20px rgba(16,185,129,0.2), 0 0 40px rgba(16,185,129,0.1)
```

---

## 3. ANIMATION SYSTEM — "The Soul of the App"

### 3.1 Animation Philosophy
- Every state change must be animated. Zero jarring instant transitions.
- Use spring physics (not linear/ease) for organic, alive feeling.
- Stagger children elements — never animate everything at once.
- Respect `prefers-reduced-motion` — provide instant fallback.

### 3.2 Easing Curves (CSS Custom Properties)

```css
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);        // Bouncy, for modals, cards
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);              // Standard, for most transitions
--ease-decelerate: cubic-bezier(0, 0, 0.2, 1);            // Entering elements
--ease-accelerate: cubic-bezier(0.4, 0, 1, 1);           // Exiting elements
--ease-elastic: cubic-bezier(0.68, -0.55, 0.265, 1.55);   // Playful, for success states
```

### 3.3 Duration Tokens

```
--duration-instant:  100ms  // Micro-feedback (button press)
--duration-fast:     200ms  // Hover, color changes, opacity
--duration-normal:   300ms  // Standard transitions, tab switches
--duration-slow:     400ms  // Page transitions, sheet opens
--duration-dramatic: 600ms  // Hero animations, splash reveals
```

### 3.4 Key Animation Patterns (IMPLEMENT ALL)

#### A. Page Entry Animation
```
- Elements fade in + translateY(20px → 0)
- Stagger: 50ms between each element
- Duration: 400ms
- Easing: --ease-decelerate
```

#### B. Card Hover / Press (Mobile Tap)
```
- Scale: 1 → 0.97 on press (100ms, --ease-smooth)
- Background: lighten by 3% on press
- On release: spring back to 1 (200ms, --ease-spring)
- Ripple effect from touch point (CSS-only, radial-gradient animation)
```knklk

#### C. Bottom Sheet Entry
```
- Sheet: translateY(100%) → translateY(0)
- Duration: 400ms
- Easing: --ease-spring (slight overshoot for native feel)
- Backdrop: opacity 0 → 1, 300ms
- Content inside: stagger fade-in, 30ms delay per item
```

#### D. Bottom Sheet Exit
```
- Sheet: translateY(0) → translateY(100%)
- Duration: 300ms
- Easing: --ease-accelerate
- Backdrop: opacity 1 → 0, 200ms
```

#### E. Tab Switching (Bottom Navigation)
```
- Active indicator: width/position morph with spring physics
- Icon: scale 1 → 1.1 → 1 (pop effect), 200ms
- Label: opacity 0 → 1, translateY(4px → 0), 150ms
- Content crossfade: opacity swap, 200ms
- Haptic: navigator.vibrate(10) on every tab press
```

#### F. List Item Entry (Stagger)
```
- Each item: opacity 0 → 1, translateX(-20px → 0)
- Stagger: 40ms between items
- Duration: 300ms per item
- Easing: --ease-decelerate
```

#### G. Skeleton Loading
```
- Shimmer animation: gradient sweep left to right
- Background: --bg-tertiary
- Shimmer: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)
- Animation: 1.5s infinite
- NEVER use spinners for content loading — always skeletons
```

#### H. Success / Confirmation Animation
```
- Checkmark: SVG path draw animation (stroke-dashoffset)
- Scale: 0 → 1.2 → 1 (elastic)
- Confetti burst: 12 small particles, radial explosion
- Duration: 600ms total
- Haptic: navigator.vibrate([50, 30, 50]) — success pattern
```

#### I. Pull-to-Refresh
```
- Custom spinner: rotating gradient ring (not default browser)
- Ring color: --accent-blue
- Release threshold: 80px
- Success: checkmark morph + haptic
```

#### J. Number Counter Animation
```
- When stats update: count up/down with easing
- Duration: 800ms
- Easing: --ease-decelerate
- Use requestAnimationFrame, not CSS
```

#### K. Toast Notifications
```
- Entry: translateY(-100%) → translateY(0), opacity 0 → 1
- Duration: 300ms, --ease-spring
- Exit: translateY(0) → translateY(-20px), opacity 1 → 0
- Duration: 200ms, --ease-accelerate
- Auto-dismiss: 4s with progress bar shrink
```

---

## 4. COMPONENT REDESIGN SPECIFICATIONS

### 4.1 Bottom Navigation (Mobile-Only, < 768px)

```
Structure:
- Fixed bottom, safe-area-inset-bottom padding
- Height: 64px + safe area
- Background: --bg-secondary with backdrop-blur-xl
- Border-top: 1px --border-subtle
- Box-shadow: 0 -4px 20px rgba(0,0,0,0.3)

Tabs (Admin): Overview | Directory | Attendance | ID Card | More
Tabs (Employee): Workspace | Attendance | Leaves | ID Pass | More

Active State:
- Icon: --accent-blue, scale 1.1
- Label: visible, --accent-blue, font-weight 600
- Indicator pill: 4px height, --accent-blue, rounded-full, width matches icon
- Glow: box-shadow --shadow-glow-blue beneath indicator
- Background highlight: subtle radial gradient behind active icon

Inactive State:
- Icon: --text-tertiary
- Label: hidden (or opacity 0.5, very small)

Interaction:
- Tap: haptic vibrate(10), icon pop animation
- Long-press: subtle scale pulse to indicate "more options" (if applicable)
```

### 4.2 Employee Directory Cards (Mobile)

```
Card Structure (per employee):
┌─────────────────────────────────────────┐
│ [Avatar]  Name                    [→]  │
│           Designation · Department      │
│ ─────────────────────────────────────── │
│ 🟢 Present    KS2407001    id@k.com     │
│ [Details] [ID Pass] [Edit]              │
└─────────────────────────────────────────┘

Visual Spec:
- Background: --bg-tertiary with --gradient-card
- Border: 1px --border-subtle
- Border-radius: 16px
- Padding: 16px
- Margin-bottom: 12px
- Shadow: --shadow-sm

Avatar:
- Size: 48px
- Border: 2px solid with status color ring
- Status dot: 14px, positioned bottom-right, with 2px border matching card bg

Status Colors:
- Present/Active: --accent-emerald + glow
- Late: --accent-amber + glow
- Absent/Inactive: --accent-rose + glow
- On Leave: --accent-violet + glow

Action Buttons (Bottom of Card):
- Layout: 3 equal columns, gap 8px
- Height: 40px
- Border-radius: 10px
- Background: --bg-elevated
- Icon + Label, --text-secondary
- Active: background --accent-blue/10, text --accent-blue
- Press: scale 0.95
```

### 4.3 Check-In / Check-Out Button (Hero Component)

```
Design:
- Size: 180px diameter circle (mobile)
- Border: 3px solid with animated gradient border
- Background: radial gradient from center
- Inner glow: pulsating when "ready to check in"

States:

1. READY (Not checked in):
   - Border: animated gradient (blue → violet → blue)
   - Background: --bg-elevated with subtle blue tint
   - Icon: Fingerprint / Location icon
   - Label: "Tap to Check In"
   - Pulse animation: subtle scale 1 → 1.02 → 1, 2s infinite
   - Glow: --shadow-glow-blue

2. CHECKING IN (Loading):
   - Border: spinning gradient
   - Icon: Loading spinner (custom, not default)
   - Label: "Verifying Location..."
   - Haptic: continuous light pulses

3. CHECKED IN (Active):
   - Border: --accent-emerald
   - Background: --accent-emerald/10
   - Icon: Checkmark with animated draw
   - Label: "Checked In · 10:23 AM"
   - Subtle green glow pulse
   - Timer: live updating duration "03h 24m"

4. CHECK OUT:
   - Border: --accent-amber
   - Background: --accent-amber/10
   - Label: "Tap to Check Out"
   - Warning: "Auto-checkout at 7:30 PM"

Success Animation:
- Ripple burst from center
- Confetti (if first check-in of day)
- Haptic: success pattern
- Toast: "Welcome back, [Name]! 👋"
```

### 4.4 Attendance Stats Dashboard (Admin Overview)

```
Layout: 2×2 Grid of stat cards + 1 wide chart card

Stat Cards:
- Background: --bg-tertiary
- Top border: 3px accent color
- Number: --text-2xl, font-weight 800, tabular-nums
- Label: --text-sm, --text-tertiary
- Change indicator: ↑ 12% vs yesterday, --accent-emerald
- Press: scale 0.97, highlight

Chart Card (Weekly Attendance):
- Smooth area chart, not bar chart
- Gradient fill under line (accent color → transparent)
- Animated line draw on entry
- Touch: tooltip appears with exact value
- No grid lines — only subtle axis
```

### 4.5 Employee Profile Bottom Sheet

```
Structure:
┌─────────────────────────────────────────┐
│ ▔▔▔▔▔▔▔▔▔▔▔ (drag handle)              │
│                                         │
│     [Large Avatar 96px]                 │
│     Name                                │
│     Designation · Department            │
│     [Present] [KS2407001]               │
│                                         │
│ ─────────────────────────────────────── │
│ Tabs: Info | Attendance | Leaves        │
│ ─────────────────────────────────────── │
│                                         │
│ [Scrollable Content Area]               │
│                                         │
└─────────────────────────────────────────┘

Specs:
- Max-height: 92vh
- Border-radius: 24px 24px 0 0
- Background: --bg-elevated
- Backdrop: blur + dark overlay
- Drag to dismiss: threshold 100px velocity
- Content: smooth scroll with snap points

Tab Switching:
- Active tab: --accent-blue underline (2px, animated width)
- Inactive: --text-tertiary
- Content crossfade: 200ms
```

### 4.6 ID Card / Badge

```
Design: Premium credit card aesthetic
- Aspect ratio: 1.586 (credit card standard)
- Background: --gradient-premium (subtle, not flashy)
- Or: Dark glassmorphism with holographic shimmer
- Company logo: top-left, white
- Employee photo: right side, circular with white border
- Info: left side, name, id, department
- Barcode/QR: bottom center, inverted colors
- Holographic strip: animated shimmer on tilt (CSS perspective transform)

Flip Animation (Front ↔ Back):
- 3D flip with perspective(1000px)
- Duration: 600ms
- Easing: --ease-spring
- Shadow changes during flip for depth
```

### 4.7 Leave Request Card

```
Status Badge:
- Pending: --accent-amber, pulsing dot
- Approved: --accent-emerald
- Rejected: --accent-rose
- Cancelled: --text-muted

Card:
- Left border: 3px status color
- Date range: prominent, tabular-nums
- Type badge: rounded-full, tinted background
- Days count: large number
- Action buttons: Approve/Reject (admin) or Cancel (employee)
```

### 4.8 Form Inputs (Mobile-Optimized)

```
- Height: 52px minimum
- Font-size: 16px (prevents iOS zoom)
- Border: 1px --border-medium
- Border-radius: 12px
- Background: --bg-tertiary
- Focus: border --accent-blue, subtle glow
- Label: floating label pattern (animates up on focus)
- Error: border --accent-rose, shake animation (translateX ±5px, 3 cycles)
- Success: border --accent-emerald, checkmark icon appears
```

---

## 5. SCREEN-BY-SCREEN REDESIGN

### 5.1 Login / Splash Screen
```
- Full black background
- Company logo: fade in + scale from 0.8 → 1
- Tagline: "Empowering Teams" — typewriter effect
- Login form: slides up from bottom
- Biometric prompt: Face ID / Touch ID icon with pulse
- Background: subtle animated gradient mesh (very low opacity)
```

### 5.2 Employee Dashboard (Home)
```
- Greeting: "Good Morning, [Name]" with time-appropriate emoji
- Date: prominent, elegant typography
- Weather widget: small, top-right (if API available)
- Hero: Check-In Button (see 4.3)
- Today's Status Card:
  - Check-in time, current duration, location
  - Progress bar: shift completion %
- Quick Actions: 4-icon grid (Apply Leave, View ID, Directory, More)
- Recent Activity: last 3 items, "View All" link
```

### 5.3 Admin Overview Dashboard
```
- Date range selector: pill buttons, swipeable
- Summary Cards: 2×2 grid
  - Total Employees (with online count)
  - Present Today (with % vs total)
  - On Leave
  - Late Today
- Live Activity Feed: scrolling list of recent check-ins
- Department Breakdown: horizontal bar chart
- Bottom CTA: "Export Report" — full width, prominent
```

### 5.4 Attendance History
```
- Calendar view: month picker, dot indicators for status
- List view: grouped by date
- Filter chips: All | Present | Late | Absent | Leave
- Swipe actions: Swipe right → View Details, Swipe left → Request Correction
```

### 5.5 Leave Management
```
- Balance cards: Annual, Sick, Casual — circular progress indicators
- Apply button: FAB (Floating Action Button), bottom-right
- Request list: cards with status
- Approval view (admin): swipe to approve/reject with haptic
```

---

## 6. INTERACTION PATTERNS & GESTURES

### 6.1 Swipe Gestures
```
- List items: Swipe left → Actions (Edit, Delete)
- Swipe right → Quick action (View Details)
- Cards: Swipe up → Expand to full sheet
- Bottom sheet: Swipe down → Dismiss
- Image gallery: Pinch to zoom, double-tap to reset
```

### 6.2 Long Press
```
- Employee card: Long press → Context menu (Call, Message, View Details)
- Check-in button: Long press → Force refresh location
- Avatar: Long press → Preview enlarged photo
```

### 6.3 Haptic Feedback Map
```
- Tab switch: vibrate(10)
- Button press: vibrate(5)
- Success action: vibrate([50, 30, 50])
- Error: vibrate([30, 50, 30])
- Check-in: vibrate(20)
- Long press menu: vibrate(15)
- Pull-to-refresh release: vibrate(10)
```

---

## 7. PWA ENHANCEMENTS

### 7.1 Install Experience
```
- Custom install prompt: Bottom sheet, not browser default
- Icon: Adaptive icon with maskable shape
- Theme: #000000 background, #3b82f6 theme
- Splash: Black background, centered logo, animated
```

### 7.2 Offline States
```
- No connection: Full-screen illustration + "You're offline" message
- Cached data: Show with "Last updated [time]" badge
- Sync queue: Pending actions shown with cloud-upload icon
```

### 7.3 Push Notifications
```
- Check-in reminder: 9:45 AM (if not checked in)
- Check-out reminder: 7:15 PM
- Leave approval: Rich notification with action buttons
- Admin alerts: Employee late/absent notifications
```

---

## 8. PERFORMANCE REQUIREMENTS

```
- First Contentful Paint: < 1.5s on 4G
- Time to Interactive: < 3s
- Animation frame rate: 60fps minimum
- Bundle size: < 200KB initial (lazy load everything else)
- Images: WebP format, lazy loaded, blur-up placeholder
- Fonts: Preload Inter, font-display: swap
- Code splitting: Per route + per major component
```

---

## 9. ACCESSIBILITY

```
- All animations respect prefers-reduced-motion
- Touch targets: 48px minimum
- Color contrast: WCAG AA minimum
- Screen reader labels on all interactive elements
- Focus states: visible, 2px --accent-blue outline
- Dynamic type: Support iOS/Android font scaling
```

---

## 10. IMPLEMENTATION CHECKLIST

### Phase 1: Foundation (Week 1)
- [ ] Set up design system tokens (CSS variables)
- [ ] Configure Tailwind with custom colors, spacing, animations
- [ ] Create animation utility hooks (useSpring, useStagger, useHaptic)
- [ ] Build core layout shell (bottom nav, page transitions)
- [ ] Implement dark mode as default (no light mode needed)

### Phase 2: Core Screens (Week 2)
- [ ] Redesign Login/Splash
- [ ] Redesign Employee Dashboard with hero check-in
- [ ] Redesign Admin Overview with stats
- [ ] Redesign Bottom Navigation with animations

### Phase 3: Data Screens (Week 3)
- [ ] Redesign Directory with cards
- [ ] Redesign Profile Bottom Sheet
- [ ] Redesign ID Card with flip animation
- [ ] Redesign Attendance History

### Phase 4: Polish (Week 4)
- [ ] Add all micro-interactions
- [ ] Implement haptic feedback throughout
- [ ] Add skeleton loading states
- [ ] Add empty states with illustrations
- [ ] Add error states with retry actions
- [ ] PWA manifest and service worker updates
- [ ] Performance audit and optimization

---

## 11. TECHNICAL ARCHITECTURE NOTES

### Recommended Libraries
```
- Framer Motion: Page transitions, gestures, spring animations
- GSAP + ScrollTrigger: Complex scroll animations (if needed)
- Lottie: Complex icon animations (checkmark, empty states)
- date-fns: Date formatting
- react-spring: Physics-based animations (alternative to Framer)
```

### File Structure Recommendation
```
src/
  components/
    ui/              # Atomic: Button, Input, Badge, Card
    composite/       # Molecules: EmployeeCard, StatCard
    layout/          # Shell: BottomNav, PageTransition, Sheet
  screens/
    auth/
    employee/
    admin/
  hooks/
    useHaptic.ts
    useSpring.ts
    useStagger.ts
    useBottomSheet.ts
  styles/
    tokens.css       # All CSS variables
    animations.css   # Keyframe definitions
  lib/
    animations.ts    # Animation config objects
```

### Critical Rules
1. NEVER use default browser scrollbars — custom thin scrollbar
2. NEVER show empty white screens — always skeleton or placeholder
3. NEVER use alert()/confirm() — custom bottom sheet dialogs
4. NEVER use default select dropdowns — custom bottom sheet picker
5. NEVER use default date picker — custom calendar sheet
6. ALWAYS preload next route's data
7. ALWAYS debounce search inputs (300ms)
8. ALWAYS cache API responses with SWR/React Query
9. ALWAYS show optimistic UI updates
10. ALWAYS handle errors with retry buttons, not just messages

---

## 12. QUALITY GATES

Before marking ANY screen complete, verify:
- [ ] Does it feel native on iOS Safari?
- [ ] Does it feel native on Android Chrome?
- [ ] Are all touch targets 48px+?
- [ ] Is there a loading state?
- [ ] Is there an empty state?
- [ ] Is there an error state?
- [ ] Does it work offline (cached)?
- [ ] Are animations 60fps?
- [ ] Does it pass WCAG AA contrast?
- [ ] Does it respect reduced motion?
- [ ] Is the haptic feedback appropriate?
- [ ] Does the bottom nav feel satisfying to tap?

---

## FINAL REMINDER

This is NOT a redesign. This is a **rebirth**.

The goal is simple: When an employee opens this app at 9:45 AM to check in, they should feel like they're using something built by Apple, Notion, or Linear — not a company internal tool.

Every tap should delight. Every transition should flow. Every pixel should earn its place.

Make Kalpanaaa Software Solutions proud.
