import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { ContentService } from '@pc/core';
import { MagneticDirective } from '@pc/ui';
import { TiltDirective } from '@pc/ui';
import { MotionService } from '@pc/core';
import { ScrollService } from '@pc/core';
import { Icon } from '@pc/ui';

type TokenKind = 'kw' | 'fn' | 'str' | 'var' | 'num' | 'com' | 'punc' | 'plain';

interface Token {
  readonly t: string;
  readonly c: TokenKind;
}

/** Typing speeds, in milliseconds per character. */
const TYPE_MS = 65;
const ERASE_MS = 32;
const HOLD_MS = 1500;

@Component({
  selector: 'app-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, MagneticDirective, TiltDirective],
  templateUrl: './hero.html',
  styleUrl: './hero.scss',
})
export class Hero {
  private readonly motion = inject(MotionService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly scroll = inject(ScrollService);

  private readonly content = inject(ContentService);

  protected get profile() {
    return this.content.profile();
  }

  protected get socials() {
    return this.content.socials();
  }

  /** The most recent role, shown as the current position. */
  protected get current() {
    return this.content.experiences()[0];
  }

  /** Name split for the per-letter entrance. */
  protected readonly letters = computed(() => [...this.content.profile().name]);

  /** Falls back to the job title if no rotating roles are configured. */
  private readonly roles = computed(() => {
    const profile = this.content.profile();
    return profile.rotatingRoles.length ? profile.rotatingRoles : [profile.role];
  });

  private readonly typedLength = signal(0);
  private readonly roleIndex = signal(0);

  protected readonly typedRole = computed(() => {
    const roles = this.roles();
    return roles[this.roleIndex() % roles.length].slice(0, this.typedLength());
  });

  /** Longest role reserves the line width so the layout never jumps. */
  protected readonly widestRole = computed(() =>
    this.roles().reduce((a, b) => (b.length > a.length ? b : a), ''),
  );

  /** Hand-tokenised snippet — cheaper and smaller than shipping a highlighter. */
  protected readonly snippet: readonly Token[][] = [
    [{ t: '// signals + zoneless = fewer surprises', c: 'com' }],
    [
      { t: '@Component', c: 'fn' },
      { t: '({ selector: ', c: 'punc' },
      { t: "'app-hire-pradeep'", c: 'str' },
      { t: ' })', c: 'punc' },
    ],
    [
      { t: 'export class ', c: 'kw' },
      { t: 'Portfolio ', c: 'fn' },
      { t: '{', c: 'punc' },
    ],
    [
      { t: '  readonly ', c: 'kw' },
      { t: 'years', c: 'var' },
      { t: ' = signal(', c: 'punc' },
      { t: '5', c: 'num' },
      { t: ');', c: 'punc' },
    ],
    [
      { t: '  readonly ', c: 'kw' },
      { t: 'stack', c: 'var' },
      { t: ' = [', c: 'punc' },
      { t: "'Angular'", c: 'str' },
      { t: ', ', c: 'punc' },
      { t: "'RxJS'", c: 'str' },
      { t: '];', c: 'punc' },
    ],
    [
      { t: '  readonly ', c: 'kw' },
      { t: 'perfGain', c: 'var' },
      { t: ' = ', c: 'punc' },
      { t: "'+30%'", c: 'str' },
      { t: ';', c: 'punc' },
    ],
    [{ t: '', c: 'plain' }],
    [
      { t: '  ship', c: 'fn' },
      { t: '() ', c: 'punc' },
      { t: '{ ', c: 'punc' },
      { t: 'return ', c: 'kw' },
      { t: "'on time'", c: 'str' },
      { t: '; }', c: 'punc' },
    ],
    [{ t: '}', c: 'punc' }],
  ];

  constructor() {
    if (this.motion.allowsMotion) {
      this.runTypewriter();
    } else {
      this.typedLength.set(this.roles()[0].length);
    }
  }

  protected jumpTo(id: string, event: Event): void {
    event.preventDefault();
    this.scroll.scrollTo(id);
  }

  /**
   * Types a role out, holds, erases it, then advances — a self-rescheduling
   * timeout rather than one interval, so each phase gets its own cadence.
   */
  private runTypewriter(): void {
    let erasing = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const roles = this.roles();
      const role = roles[this.roleIndex() % roles.length];
      const length = this.typedLength();

      if (!erasing) {
        if (length < role.length) {
          this.typedLength.set(length + 1);
          timer = setTimeout(tick, TYPE_MS);
          return;
        }

        erasing = true;
        timer = setTimeout(tick, HOLD_MS);
        return;
      }

      if (length > 0) {
        this.typedLength.set(length - 1);
        timer = setTimeout(tick, ERASE_MS);
        return;
      }

      erasing = false;
      this.roleIndex.update((i) => (i + 1) % this.roles().length);
      timer = setTimeout(tick, TYPE_MS * 3);
    };

    timer = setTimeout(tick, 700);
    this.destroyRef.onDestroy(() => clearTimeout(timer));
  }
}
