/**
 * Typography System
 *
 * Standardized typography classes for consistent styling across the application.
 * Import and use these constants instead of writing inline classes.
 *
 * Usage:
 *   import { typography } from '../styles/typography';
 *   <h1 className={typography.pageTitle}>Page Title</h1>
 */

export const typography = {
  // ============ HEADINGS ============
  /** Page title - largest heading (e.g., "Clinic Configuration", "Good Morning, Dr. Baveja") */
  pageTitle: 'text-2xl font-bold text-slate-900 tracking-tight',

  /** Section title - card headers, major sections (e.g., "Patient Identity", "Medical Profile") */
  sectionTitle: 'text-sm font-bold text-slate-800',

  /** Card title - similar to section but can include icon */
  cardTitle: 'text-sm font-bold text-slate-800',

  /** Subsection title - within cards (e.g., "Surgical History", "IOL Master") */
  subsectionTitle: 'text-xs font-bold text-slate-700 uppercase tracking-wider',

  /** Widget/stat title - dashboard cards */
  widgetTitle: 'text-sm font-medium text-slate-500 tracking-tight',

  // ============ LABELS ============
  /** Form field label - standard form labels */
  label: 'text-xs font-semibold text-slate-500 uppercase tracking-wide',

  /** Inline label - for inline key-value pairs */
  inlineLabel: 'text-xs font-medium text-slate-400',

  /** Field label - alternative for non-uppercase labels */
  fieldLabel: 'text-xs font-semibold text-slate-600',

  // ============ BODY TEXT ============
  /** Primary body text */
  body: 'text-sm text-slate-600',

  /** Body text with medium weight */
  bodyMedium: 'text-sm font-medium text-slate-600',

  /** Body text bold - for emphasis */
  bodyBold: 'text-sm font-bold text-slate-700',

  /** Large body text */
  bodyLarge: 'text-base text-slate-600',

  // ============ INPUT TEXT ============
  /** Text inside form inputs */
  input: 'text-sm font-medium text-slate-700',

  /** Placeholder text */
  placeholder: 'text-sm text-slate-400',

  // ============ HELPER TEXT ============
  /** Helper/description text below fields */
  helper: 'text-xs text-slate-400',

  /** Helper with medium weight */
  helperMedium: 'text-xs font-medium text-slate-400',

  /** Hint text - very small */
  hint: 'text-[10px] text-slate-400',

  // ============ BADGES & STATUS ============
  /** Standard badge text */
  badge: 'text-[10px] font-bold uppercase tracking-wide',

  /** Badge with extra tracking */
  badgeWide: 'text-[10px] font-bold uppercase tracking-wider',

  /** Small badge/pill */
  badgeSmall: 'text-[10px] font-semibold uppercase',

  /** Tag text - for removable tags */
  tag: 'text-xs font-semibold',

  // ============ TABLE ============
  /** Table header */
  tableHeader: 'text-xs font-bold uppercase tracking-wider text-slate-500',

  /** Table cell text */
  tableCell: 'text-sm font-medium text-slate-700',

  /** Table cell secondary */
  tableCellSecondary: 'text-xs text-slate-400',

  // ============ NAVIGATION ============
  /** Nav item - sidebar/menu */
  navItem: 'text-sm font-semibold',

  /** Nav item active */
  navItemActive: 'text-sm font-semibold text-blue-600',

  /** Breadcrumb text */
  breadcrumb: 'text-sm font-medium',

  /** Breadcrumb current/active */
  breadcrumbActive: 'text-sm font-semibold text-slate-700',

  // ============ BUTTONS ============
  /** Primary button text */
  buttonPrimary: 'text-sm font-bold',

  /** Secondary button text */
  buttonSecondary: 'text-sm font-semibold',

  /** Small button text */
  buttonSmall: 'text-xs font-semibold',

  // ============ SPECIAL ============
  /** Large stat number - dashboard cards */
  statValue: 'text-3xl font-bold text-slate-900 leading-none',

  /** Patient name display */
  patientName: 'text-xl font-bold text-slate-900',

  /** ID/code display */
  code: 'text-xs font-medium text-slate-400 font-mono',

  /** Price display */
  price: 'text-lg font-bold text-slate-900',

  /** Error text */
  error: 'text-sm text-red-600',

  /** Success text */
  success: 'text-sm text-emerald-600',

  /** Warning text */
  warning: 'text-sm text-amber-600',

  // ============ EYE INDICATORS ============
  /** OD (Right eye) label */
  odLabel: 'text-[10px] text-blue-500',

  /** OS (Left eye) label */
  osLabel: 'text-[10px] text-emerald-500',
};

/**
 * Combined typography + color styles for common patterns
 */
export const typoStyles = {
  // Status badges with colors
  badgeSuccess: `${typography.badge} bg-emerald-100 text-emerald-700`,
  badgeWarning: `${typography.badge} bg-amber-100 text-amber-700`,
  badgeError: `${typography.badge} bg-rose-100 text-rose-700`,
  badgeInfo: `${typography.badge} bg-blue-100 text-blue-700`,
  badgeNeutral: `${typography.badge} bg-slate-100 text-slate-600`,

  // Form field complete styling
  formLabel: `block ${typography.label} mb-1.5 px-1`,
  formInput: `w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl ${typography.input} outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all`,

  // Card headers
  cardHeader: `flex items-center gap-2 ${typography.sectionTitle}`,
};

export default typography;
