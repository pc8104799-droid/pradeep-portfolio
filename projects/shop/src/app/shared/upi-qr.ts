import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { toCanvas } from 'qrcode';

/**
 * Renders a real UPI payment QR.
 *
 * The encoded string is a standard `upi://pay` intent, so any UPI app — GPay,
 * PhonePe, Paytm, BHIM — will read it and pre-fill the payee and amount. What it
 * cannot do is tell this app whether the money arrived; that needs a server
 * callback from the PSP.
 */
@Component({
  selector: 'shop-upi-qr',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="frame" [class.is-empty]="!uri()">
      <canvas #canvas class="qr" [attr.aria-label]="'UPI payment QR code'"></canvas>

      @if (!uri()) {
        <p class="frame__empty">QR unavailable</p>
      }

      @if (error()) {
        <p class="frame__empty">{{ error() }}</p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .frame {
      position: relative;
      display: grid;
      place-items: center;
      padding: .75rem;
      width: fit-content;
      margin-inline: auto;
      border-radius: var(--radius-sm);
      border: 1px solid var(--stroke-strong);
      background: #fff;
    }

    .frame.is-empty {
      min-width: 200px;
      min-height: 200px;
      background: var(--surface-2);
    }

    .qr {
      display: block;
      border-radius: 4px;
    }

    .frame__empty {
      position: absolute;
      color: var(--ink-3);
      font-size: .82rem;
      text-align: center;
      padding-inline: 1rem;
    }
  `,
})
export class UpiQr {
  /** The `upi://pay?...` string to encode. Empty renders the blank state. */
  readonly uri = input('');
  readonly size = input(212);

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  protected readonly error = signal('');

  constructor() {
    // Draw once the canvas exists, and again whenever the amount changes.
    afterNextRender(() => this.draw());

    effect(() => {
      this.uri();
      this.size();
      this.draw();
    });
  }

  private draw(): void {
    const canvas = this.canvasRef()?.nativeElement;
    const uri = this.uri();

    if (!canvas) {
      return;
    }

    if (!uri) {
      canvas.width = 0;
      canvas.height = 0;
      return;
    }

    toCanvas(canvas, uri, {
      width: this.size(),
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0d1b12ff', light: '#ffffffff' },
    })
      .then(() => this.error.set(''))
      .catch((cause: unknown) =>
        this.error.set(cause instanceof Error ? cause.message : 'Could not draw the QR code.'),
      );
  }
}
