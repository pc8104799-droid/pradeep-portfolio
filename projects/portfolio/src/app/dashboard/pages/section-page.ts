import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SECTION_BY_ID, type SectionDef } from '@pc/core';
import { Icon } from '@pc/ui';
import { About } from '../../portfolio/sections/about/about';
import { Contact } from '../../portfolio/sections/contact/contact';
import { EducationSection } from '../../portfolio/sections/education/education';
import { Experience } from '../../portfolio/sections/experience/experience';
import { Hero } from '../../portfolio/sections/hero/hero';
import { Projects } from '../../portfolio/sections/projects/projects';
import { Skills } from '../../portfolio/sections/skills/skills';
import type { DashboardPage } from '../dashboard-nav';
import { CollectionEditor } from '../editors/collection-editor';
import { ObjectEditor } from '../editors/object-editor';

/**
 * One dashboard section. Renders the real component from the public site on the
 * Preview tab and the schema-driven editors on the Edit tab, so a change can be
 * made and checked without leaving the page.
 */
@Component({
  selector: 'app-section-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Icon,
    CollectionEditor,
    ObjectEditor,
    Hero,
    About,
    Skills,
    Experience,
    Projects,
    EducationSection,
    Contact,
  ],
  templateUrl: './section-page.html',
  styleUrl: './section-page.scss',
})
export class SectionPage {
  protected readonly page = inject(ActivatedRoute).snapshot.data['page'] as DashboardPage;

  protected readonly tab = signal<'preview' | 'edit'>(this.page.preview ? 'preview' : 'edit');

  /** The schema entries this page edits, resolved once from their ids. */
  protected readonly sections = computed<SectionDef[]>(() =>
    this.page.editors
      .map((id) => SECTION_BY_ID.get(id))
      .filter((section): section is SectionDef => Boolean(section)),
  );

  protected show(tab: 'preview' | 'edit'): void {
    this.tab.set(tab);
  }
}
