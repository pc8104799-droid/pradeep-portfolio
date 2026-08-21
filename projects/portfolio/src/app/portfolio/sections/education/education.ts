import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ContentService } from '@pc/core';
import { RevealDirective } from '@pc/ui';
import { Icon } from '@pc/ui';

/** Slim band between the projects grid and the contact form. */
@Component({
  selector: 'app-education',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RevealDirective],
  templateUrl: './education.html',
  styleUrl: './education.scss',
})
export class EducationSection {
  private readonly content = inject(ContentService);

  /** Built from content so editing education or languages updates the band. */
  protected readonly ways = computed(() => {
    const education = this.content.education();
    const languages = this.content.languages();

    return [
      {
        icon: 'graduation' as const,
        label: 'Education',
        title: `${education.degree} — ${education.field}`,
        detail: `${education.institute}, ${education.location} · ${education.period}`,
      },
      {
        icon: 'quote' as const,
        label: 'Languages',
        title: languages.join(' · '),
        detail: 'Comfortable working with distributed, multilingual teams',
      },
      {
        icon: 'star' as const,
        label: 'How I work',
        title: 'Agile / Scrum, code reviews, mentoring',
        detail: 'Sprint planning, stand-ups and retrospectives as a default, not a ceremony',
      },
    ];
  });
}
