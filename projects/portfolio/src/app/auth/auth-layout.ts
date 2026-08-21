import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Aurora } from '@pc/ui';

/**
 * Frame shared by sign-in and sign-up: the animated backdrop on one side, the
 * form card on the other. Only the card swaps between the two routes.
 */
@Component({
  selector: 'app-auth-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Aurora],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.scss',
})
export class AuthLayout {}
