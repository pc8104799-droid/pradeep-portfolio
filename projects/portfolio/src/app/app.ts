import { afterNextRender, ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from '@pc/core';

/**
 * Application root. Deliberately thin: each area brings its own chrome — the
 * portfolio shell, the auth layout, the workspace shell — so this only owns the
 * theme and handing over from the boot splash.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  // Instantiated here so the theme is applied before anything paints.
  private readonly theme = inject(ThemeService);

  constructor() {
    afterNextRender(() => {
      const boot = document.getElementById('boot');
      if (!boot) {
        return;
      }

      boot.classList.add('is-done');
      boot.addEventListener('transitionend', () => boot.remove(), { once: true });
    });
  }
}
