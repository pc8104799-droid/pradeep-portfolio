import { ChangeDetectionStrategy, Component } from '@angular/core';
import { About } from './sections/about/about';
import { Contact } from './sections/contact/contact';
import { EducationSection } from './sections/education/education';
import { Experience } from './sections/experience/experience';
import { Hero } from './sections/hero/hero';
import { Projects } from './sections/projects/projects';
import { Skills } from './sections/skills/skills';

/** The single page. Section order is the narrative order. */
@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Hero, About, Skills, Experience, Projects, EducationSection, Contact],
  template: `
    <app-hero />
    <app-about />
    <app-skills />
    <app-experience />
    <app-projects />
    <app-education />
    <app-contact />
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class Home {}
