/** Shapes for every piece of content rendered by the portfolio. */

export interface SocialLink {
  label: string;
  href: string;
  /** Key resolved by the icon component. */
  icon: string;
  handle: string;
}

export interface Profile {
  name: string;
  firstName: string;
  role: string;
  tagline: string;
  /** Rotated through by the hero typewriter. */
  rotatingRoles: string[];
  summary: string;
  location: string;
  email: string;
  phone: string;
  availability: string;
  /** Served straight from public/ — drop the PDF there to enable the download. */
  resumeUrl: string;
}

export interface Stat {
  value: number;
  suffix: string;
  label: string;
  detail: string;
}

export interface SkillGroup {
  title: string;
  icon: string;
  blurb: string;
  skills: string[];
}

export interface CoreTool {
  name: string;
  note: string;
}

export interface KeyProject {
  title: string;
  points: string[];
}

export interface Experience {
  role: string;
  company: string;
  period: string;
  location: string;
  current: boolean;
  points: string[];
  stack: string[];
  keyProject?: KeyProject;
}

export interface Project {
  title: string;
  kind: string;
  year: string;
  company: string;
  summary: string;
  highlights: string[];
  stack: string[];
  /** Two hex stops used for the card's signature gradient. */
  accent: string[];
  confidential: boolean;
}

export interface Service {
  title: string;
  icon: string;
  copy: string;
}

export interface Education {
  degree: string;
  field: string;
  institute: string;
  location: string;
  period: string;
}

export interface NavItem {
  id: string;
  label: string;
  index: string;
}

/**
 * The whole site's content in one object — mirrors `core/data/content.json`,
 * which is both the build-time fallback and the file fetched at startup.
 */
export interface PortfolioContent {
  profile: Profile;
  socials: SocialLink[];
  nav: NavItem[];
  stats: Stat[];
  services: Service[];
  coreStack: CoreTool[];
  skillGroups: SkillGroup[];
  experiences: Experience[];
  projects: Project[];
  education: Education;
  languages: string[];
  marquee: string[];
}

/** Keys of PortfolioContent that hold an editable array. */
export type ContentListKey = {
  [K in keyof PortfolioContent]: PortfolioContent[K] extends unknown[] ? K : never;
}[keyof PortfolioContent];
