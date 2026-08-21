import { ChangeDetectionStrategy, Component } from '@angular/core';
import { inject } from '@angular/core';
import { ContentService } from '@pc/core';
import { MagneticDirective } from '../directives/magnetic.directive';
import { Icon } from '../icon/icon';

/**
 * Fixed rails in the left and right margins, shown only once the viewport is
 * wide enough that the gutters would otherwise be dead space (the gutter widens
 * at the same breakpoint in styles.scss to make room).
 *
 * Purely supplementary — every link here also exists in the hero, contact
 * section and footer, so nothing is lost when the rails are hidden.
 */
@Component({
  selector: 'app-side-rails',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, MagneticDirective],
  template: `
    <div class="rail rail--left" aria-hidden="true">
      <ul class="rail__links">
        @for (social of socials; track social.label) {
          <li>
            <a
              [href]="social.href"
              [attr.target]="social.icon === 'linkedin' || social.icon === 'whatsapp' ? '_blank' : null"
              rel="noopener"
              tabindex="-1"
              [appMagnetic]="5"
            >
              <app-icon [name]="social.icon" [size]="17" />
            </a>
          </li>
        }
      </ul>
      <span class="rail__line"></span>
    </div>

    <div class="rail rail--right" aria-hidden="true">
      <a class="rail__mail" [href]="'mailto:' + profile.email" tabindex="-1">
        {{ profile.email }}
      </a>
      <span class="rail__line"></span>
    </div>
  `,
  styleUrl: './side-rails.scss',
})
export class SideRails {
  private readonly content = inject(ContentService);

  protected get profile() {
    return this.content.profile();
  }

  protected get socials() {
    return this.content.socials();
  }
}
