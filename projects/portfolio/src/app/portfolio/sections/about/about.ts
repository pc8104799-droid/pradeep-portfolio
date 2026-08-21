import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ContentService } from '@pc/core';
import { CountUpDirective } from '@pc/ui';
import { RevealDirective } from '@pc/ui';
import { TiltDirective } from '@pc/ui';
import { Icon } from '@pc/ui';
import { Marquee } from '@pc/ui';
import { SectionHeading } from '@pc/ui';

@Component({
  selector: 'app-about',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Marquee, SectionHeading, RevealDirective, CountUpDirective, TiltDirective],
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class About {
  private readonly content = inject(ContentService);

  protected get profile() {
    return this.content.profile();
  }

  protected get stats() {
    return this.content.stats();
  }

  protected get services() {
    return this.content.services();
  }

  protected get languages() {
    return this.content.languages();
  }

  protected get education() {
    return this.content.education();
  }

  protected get marqueeItems() {
    return this.content.marquee();
  }

  /** Initials for the monogram card. */
  protected get initials() {
    return this.content
      .profile()
      .name.split(' ')
      .map((part) => part[0])
      .join('');
  }
}
