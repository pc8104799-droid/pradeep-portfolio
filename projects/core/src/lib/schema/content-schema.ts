import type { PortfolioContent } from '../models/resume.models';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'list'
  | 'color'
  | 'icon';

export interface FieldDef {
  /** Dotted path within the item — `keyProject.title`, `accent.0`. */
  readonly key: string;
  readonly label: string;
  readonly type: FieldType;
  readonly hint?: string;
  readonly required?: boolean;
  /** Span the whole form width instead of one column. */
  readonly wide?: boolean;
}

export interface SectionDef {
  /** Route segment and sidebar id. */
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly blurb: string;
  /** `list` edits an array of items; `object` edits one object. */
  readonly kind: 'list' | 'object';
  /**
   * Which branch of the content this section edits. An empty string means the
   * content root itself, used by the section that edits the plain string lists.
   */
  readonly key: keyof PortfolioContent | '';
  readonly fields: readonly FieldDef[];
  /** List sections only: which field labels each row. */
  readonly titleKey?: string;
  readonly subtitleKey?: string;
  /** List sections only: the shape of a newly added row. */
  readonly blank?: Record<string, unknown>;
}

/**
 * The admin area is generated entirely from this array — sidebar, routes, forms
 * and validation. Adding a new editable collection means adding an entry here
 * and a matching branch in content.json; no new component is needed.
 */
export const SECTIONS: readonly SectionDef[] = [
  {
    id: 'profile',
    label: 'Profile',
    icon: 'star',
    blurb: 'Your name, headline and the copy that carries the hero section.',
    kind: 'object',
    key: 'profile',
    fields: [
      { key: 'name', label: 'Full name', type: 'text', required: true },
      { key: 'firstName', label: 'First name', type: 'text', required: true },
      { key: 'role', label: 'Job title', type: 'text', required: true },
      { key: 'availability', label: 'Availability badge', type: 'text' },
      { key: 'tagline', label: 'Hero tagline', type: 'textarea', wide: true, required: true },
      {
        key: 'summary',
        label: 'Professional summary',
        type: 'textarea',
        wide: true,
        hint: 'Shown as the opening paragraph of the About section.',
      },
      {
        key: 'rotatingRoles',
        label: 'Rotating roles',
        type: 'list',
        wide: true,
        hint: 'One per line. The hero types through these in order.',
      },
      { key: 'email', label: 'Email', type: 'text', required: true },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'location', label: 'Location', type: 'text' },
      {
        key: 'resumeUrl',
        label: 'Résumé file',
        type: 'text',
        hint: 'Path inside public/ — e.g. Pradeep_Chauhan_Resume.pdf',
      },
    ],
  },
  {
    id: 'socials',
    label: 'Contact links',
    icon: 'mail',
    blurb: 'The links in the hero, contact panel, footer and side rails.',
    kind: 'list',
    key: 'socials',
    titleKey: 'label',
    subtitleKey: 'handle',
    blank: { label: 'New link', href: 'https://', icon: 'external', handle: '' },
    fields: [
      { key: 'label', label: 'Label', type: 'text', required: true },
      { key: 'icon', label: 'Icon', type: 'icon', required: true },
      { key: 'href', label: 'URL', type: 'text', required: true, wide: true },
      { key: 'handle', label: 'Display text', type: 'text', wide: true },
    ],
  },
  {
    id: 'stats',
    label: 'Stats',
    icon: 'gauge',
    blurb: 'The counting figures in the About section.',
    kind: 'list',
    key: 'stats',
    titleKey: 'label',
    subtitleKey: 'detail',
    blank: { value: 0, suffix: '+', label: 'New stat', detail: '' },
    fields: [
      { key: 'label', label: 'Label', type: 'text', required: true },
      { key: 'value', label: 'Number', type: 'number', required: true },
      { key: 'suffix', label: 'Suffix', type: 'text', hint: 'Such as + or %' },
      { key: 'detail', label: 'Supporting line', type: 'textarea', wide: true },
    ],
  },
  {
    id: 'services',
    label: 'What I bring',
    icon: 'layers',
    blurb: 'The capability cards under the About section.',
    kind: 'list',
    key: 'services',
    titleKey: 'title',
    subtitleKey: 'copy',
    blank: { title: 'New capability', icon: 'sparkle', copy: '' },
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'icon', label: 'Icon', type: 'icon', required: true },
      { key: 'copy', label: 'Description', type: 'textarea', wide: true, required: true },
    ],
  },
  {
    id: 'core-stack',
    label: 'Core stack',
    icon: 'zap',
    blurb: 'The highlighted strip above the skill groups.',
    kind: 'list',
    key: 'coreStack',
    titleKey: 'name',
    subtitleKey: 'note',
    blank: { name: 'New tool', note: '' },
    fields: [
      { key: 'name', label: 'Tool', type: 'text', required: true },
      { key: 'note', label: 'Note', type: 'text', hint: 'A short qualifier, e.g. strict mode' },
    ],
  },
  {
    id: 'skills',
    label: 'Skill groups',
    icon: 'code',
    blurb: 'Each group renders as one card of tags.',
    kind: 'list',
    key: 'skillGroups',
    titleKey: 'title',
    subtitleKey: 'blurb',
    blank: { title: 'New group', icon: 'code', blurb: '', skills: [] },
    fields: [
      { key: 'title', label: 'Group title', type: 'text', required: true },
      { key: 'icon', label: 'Icon', type: 'icon', required: true },
      { key: 'blurb', label: 'Blurb', type: 'text', wide: true },
      {
        key: 'skills',
        label: 'Skills',
        type: 'list',
        wide: true,
        required: true,
        hint: 'One per line. Each becomes a tag on the card.',
      },
    ],
  },
  {
    id: 'experience',
    label: 'Experience',
    icon: 'briefcase',
    blurb: 'Roles on the timeline, newest first.',
    kind: 'list',
    key: 'experiences',
    titleKey: 'company',
    subtitleKey: 'period',
    blank: {
      role: 'Front-End Developer',
      company: 'New company',
      period: '',
      location: '',
      current: false,
      points: [],
      stack: [],
      keyProject: { title: '', points: [] },
    },
    fields: [
      { key: 'company', label: 'Company', type: 'text', required: true },
      { key: 'role', label: 'Role', type: 'text', required: true },
      { key: 'period', label: 'Period', type: 'text', hint: 'e.g. Jul 2025 — Present' },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'current', label: 'Current role', type: 'boolean' },
      { key: 'points', label: 'Responsibilities', type: 'list', wide: true, required: true },
      { key: 'stack', label: 'Tech used', type: 'list', wide: true },
      { key: 'keyProject.title', label: 'Key project', type: 'text', wide: true },
      { key: 'keyProject.points', label: 'Key project points', type: 'list', wide: true },
    ],
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: 'sparkle',
    blurb: 'The project grid. The first card is featured and shows its highlights.',
    kind: 'list',
    key: 'projects',
    titleKey: 'title',
    subtitleKey: 'kind',
    blank: {
      title: 'New project',
      kind: '',
      year: '',
      company: '',
      summary: '',
      highlights: [],
      stack: [],
      accent: ['#7c5cff', '#00d4ff'],
      confidential: false,
    },
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'kind', label: 'Kind', type: 'text', hint: 'e.g. Fintech · Web + Mobile' },
      { key: 'company', label: 'Company', type: 'text' },
      { key: 'year', label: 'Year', type: 'text' },
      { key: 'accent.0', label: 'Accent from', type: 'color' },
      { key: 'accent.1', label: 'Accent to', type: 'color' },
      { key: 'confidential', label: 'Under NDA', type: 'boolean' },
      { key: 'summary', label: 'Summary', type: 'textarea', wide: true, required: true },
      { key: 'highlights', label: 'Highlights', type: 'list', wide: true },
      { key: 'stack', label: 'Tech used', type: 'list', wide: true },
    ],
  },
  {
    id: 'education',
    label: 'Education',
    icon: 'graduation',
    blurb: 'The degree shown in the About card and the closing band.',
    kind: 'object',
    key: 'education',
    fields: [
      { key: 'degree', label: 'Degree', type: 'text', required: true },
      { key: 'field', label: 'Field', type: 'text', required: true },
      { key: 'institute', label: 'Institute', type: 'text' },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'period', label: 'Period', type: 'text' },
    ],
  },
  {
    id: 'marquee',
    label: 'Tech ticker',
    icon: 'zap',
    blurb: 'The scrolling strip above the About section.',
    kind: 'object',
    key: '',
    fields: [
      {
        key: 'marquee',
        label: 'Marquee items',
        type: 'list',
        wide: true,
        hint: 'One per line. The strip repeats them seamlessly.',
      },
    ],
  },
  {
    id: 'languages',
    label: 'Languages',
    icon: 'quote',
    blurb: 'Spoken languages, shown in the closing band.',
    kind: 'object',
    key: '',
    fields: [{ key: 'languages', label: 'Languages', type: 'list', wide: true }],
  },
  {
    id: 'navigation',
    label: 'Navigation',
    icon: 'menu',
    blurb: 'The header links.',
    kind: 'list',
    key: 'nav',
    titleKey: 'label',
    subtitleKey: 'id',
    blank: { id: '', label: 'New link', index: '07' },
    fields: [
      { key: 'label', label: 'Label', type: 'text', required: true },
      { key: 'index', label: 'Index', type: 'text', hint: 'The small number beside the label.' },
      {
        key: 'id',
        label: 'Section id',
        type: 'text',
        required: true,
        wide: true,
        hint: 'Must match a section id on the page (home, about, skills, experience, projects, contact) or the link will not scroll anywhere.',
      },
    ],
  },
];

export const SECTION_BY_ID = new Map(SECTIONS.map((section) => [section.id, section]));
