---
name: DGEN Tech System
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1b1b1b'
  surface-container: '#1f1f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e2e2e2'
  on-surface-variant: '#bccabb'
  inverse-surface: '#e2e2e2'
  inverse-on-surface: '#303030'
  outline: '#869486'
  outline-variant: '#3d4a3e'
  surface-tint: '#56e083'
  primary: '#56e083'
  on-primary: '#003918'
  primary-container: '#19b35c'
  on-primary-container: '#003d1a'
  inverse-primary: '#006d34'
  secondary: '#bcc7de'
  on-secondary: '#263143'
  secondary-container: '#3e495d'
  on-secondary-container: '#aeb9d0'
  tertiary: '#c6c6c7'
  on-tertiary: '#2f3131'
  tertiary-container: '#9b9c9c'
  on-tertiary-container: '#323434'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#75fd9c'
  primary-fixed-dim: '#56e083'
  on-primary-fixed: '#00210b'
  on-primary-fixed-variant: '#005226'
  secondary-fixed: '#d8e3fb'
  secondary-fixed-dim: '#bcc7de'
  on-secondary-fixed: '#111c2d'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#131313'
  on-background: '#e2e2e2'
  surface-variant: '#353535'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  code-md:
    fontFamily: ui-monospace
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Brand & Style

This design system centers on the intersection of technical precision and biological innovation. It is designed to evoke a sense of high-performance computing and future-forward engineering, specifically tailored for complex AI and hardware demonstrations.

The aesthetic follows a **High-Tech Minimalism** approach, heavily utilizing dark surfaces to make vibrant green accents and crisp white typography appear more luminous. It incorporates subtle **Glassmorphism** to represent transparency and depth within the ADAM demo flow, using blurred layers to maintain focus on data-heavy interfaces without losing environmental context. The overall feeling is one of institutional reliability paired with the energy of a fast-moving laboratory.

## Colors

The palette is anchored by a high-energy "Vibrant Green" (#19B35C), used as a primary signal color for success states, active links, and key CTA buttons. This green should often be applied as a linear gradient (from #19B35C to a slightly darker shift) to provide a sense of movement and depth.

The neutral foundation is "Deep Black" (#000000), providing the highest possible contrast for "Crisp White" (#FFFFFF) typography. "Slate Blue" (#1E293B) serves as the secondary surface color, used for container backgrounds, input fields, and subtle borders to soften the interface and prevent visual fatigue in dark environments.

## Typography

The typography strategy uses a dual-font approach to balance character with utility. **Space Grotesk** is the primary display face; its geometric and technical construction reinforces the innovative brand identity. It should be used for all headlines and data labels, often in uppercase for labels to provide a "dashboard" feel.

**Inter** is utilized for all body copy and long-form descriptions. Its neutral, highly legible design ensures that complex technical information remains accessible. For code snippets or hardware telemetry data, **ui-monospace** provides a distinct visual break that suggests raw data processing and accuracy.

## Layout & Spacing

This design system employs a **12-column fluid grid** for desktop environments, transitioning to a **4-column grid** for mobile devices. The spacing rhythm is strictly based on an 8px base unit, ensuring all elements align to a predictable mathematical scale.

Layouts should favor wide margins and generous vertical breathing room between sections to maintain the minimalist, premium feel. Content blocks are organized into "logical modules" using 24px gutters. In the ADAM demo flow, use a centered content column for focused tasks and an asymmetrical layout for dashboard views where telemetry is displayed on the periphery.

## Elevation & Depth

Visual hierarchy is achieved through **Tonal Layering** and **Subtle Glows** rather than traditional drop shadows. Surfaces are stacked using color: the deepest level is Black (#000000), while interactive or elevated containers use Slate (#1E293B).

To emphasize importance, use "The Green Glow"—a low-opacity radial gradient or outer glow (15-20% opacity of #19B35C) behind primary cards or active states. Glassmorphism is applied to modal overlays and floating navigation bars with a 12px background blur and a 1px "ghost border" in White at 10% opacity, creating a sense of sophisticated machinery and digital transparency.

## Shapes

The shape language is "Modern-Rounded." A standard corner radius of 0.5rem (8px) is applied to most UI components, including buttons, cards, and input fields. This provides a approachable, "finished" quality to the technical interface.

For larger container elements, use `rounded-lg` (16px) to create soft framing. Progress bars and status tags should use the pill-shape (`rounded-full`) to differentiate them from structural layout blocks. All borders, when used, should be crisp and thin (1px) to maintain a sharp, high-tech appearance.

## Components

- **Buttons**: Primary buttons feature a solid #19B35C background with Black text for maximum legibility. Secondary buttons use a Slate background with White text or a 1px Green border (Ghost style).
- **Cards**: Use the Slate (#1E293B) color for card surfaces with a subtle 1px border (#FFFFFF, 5% opacity). In active states, the border should transition to #19B35C.
- **Input Fields**: Dark backgrounds (#000000 or a deeper shade of Slate) with a subtle bottom border or 1px stroke. The cursor and focus ring must use the primary Green.
- **Chips & Status**: Small, pill-shaped indicators. For "Active" or "Online," use a Green background at 10% opacity with Green text and a pulsing dot.
- **Gradients**: Use a "Velocity Gradient" for high-impact areas: a linear flow from #19B35C to a deeper forest green, angled at 135 degrees.
- **Lists**: Clean, borderless rows with 16px vertical padding, separated by 1px dividers at 5% White opacity. Use Space Grotesk for list item headers.