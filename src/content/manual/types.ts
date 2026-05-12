/**
 * Shared types for "Read Manual" content entries.
 *
 * The ManualPanel component renders a structured guidance card with:
 *   - eyebrow context label (e.g. "AUTH BUS")
 *   - title + optional subtitle
 *   - ordered steps (tag + body text)
 *   - optional callouts grid (key-value pairs)
 *   - optional footer text
 *   - optional accent color override
 *
 * This mirrors ManualPanel's props 1:1 (minus rendering-only fields
 * like `style` and `variant`). Content lives in `src/content/manual/`
 * as plain data so copy edits can land without diving into screen
 * components. Each screen imports its corresponding content entry.
 *
 * Adding a new screen's manual content:
 *   1. Create `src/content/manual/myScreen.ts` exporting a const of
 *      type `ManualContent` (or `ManualContentWithVariant` if you
 *      want to override the default 'hero' variant).
 *   2. Re-export from `src/content/manual/index.ts`.
 *   3. Import in your screen, spread into <ManualPanel {...content} />.
 */

export interface ManualStep {
  tag: string;
  text: string;
}

export interface ManualCallout {
  label: string;
  value: string;
}

export interface ManualContent {
  /** Eyebrow label at the top of the panel, e.g. "AUTH BUS". */
  contextLabel: string;
  /** Hero text for the panel. */
  title: string;
  /** Optional one-line subtitle below the title. */
  subtitle?: string;
  /** Ordered step list. Each step is a labeled tag + body text. */
  steps: ManualStep[];
  /** Optional key-value callouts rendered in a grid below the steps. */
  callouts?: ManualCallout[];
  /** Optional fine-print footer below the callouts. */
  footer?: string;
  /** Accent color (border + tag color). Defaults to tacticalTokens.colors.guide. */
  accent?: string;
}
