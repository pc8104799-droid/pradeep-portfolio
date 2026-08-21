/** Which preview component a dashboard page renders, if any. */
export type PreviewKey =
  | 'hero'
  | 'about'
  | 'skills'
  | 'experience'
  | 'projects'
  | 'education'
  | 'contact';

export interface DashboardPage {
  /** Route segment. */
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly blurb: string;
  /** The live section shown on the Preview tab. */
  readonly preview: PreviewKey | null;
  /** Ids from the content schema that this page can edit. */
  readonly editors: readonly string[];
}

/**
 * The left-hand navigation: one entry per part of the resume. Each page pairs
 * the real section from the public site with the editors for the content behind
 * it, so viewing and changing a section happen in the same place.
 */
export const DASHBOARD_PAGES: readonly DashboardPage[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: 'star',
    blurb: 'Who you are and the headline numbers.',
    preview: 'hero',
    editors: ['profile', 'stats'],
  },
  {
    id: 'about',
    label: 'About',
    icon: 'quote',
    blurb: 'The narrative, the capabilities and the tech ticker.',
    preview: 'about',
    editors: ['services', 'marquee'],
  },
  {
    id: 'skills',
    label: 'Skills',
    icon: 'code',
    blurb: 'Core stack and the grouped skill cards.',
    preview: 'skills',
    editors: ['core-stack', 'skills'],
  },
  {
    id: 'experience',
    label: 'Experience',
    icon: 'briefcase',
    blurb: 'Roles on the timeline, newest first.',
    preview: 'experience',
    editors: ['experience'],
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: 'sparkle',
    blurb: 'The work grid — the first card is featured.',
    preview: 'projects',
    editors: ['projects'],
  },
  {
    id: 'education',
    label: 'Education',
    icon: 'graduation',
    blurb: 'Degree, institute and the languages you speak.',
    preview: 'education',
    editors: ['education', 'languages'],
  },
  {
    id: 'contact',
    label: 'Contact',
    icon: 'mail',
    blurb: 'How people reach you, everywhere it appears.',
    preview: 'contact',
    editors: ['socials'],
  },
  {
    id: 'navigation',
    label: 'Navigation',
    icon: 'menu',
    blurb: 'The links across the top of the public site.',
    preview: null,
    editors: ['navigation'],
  },
];
