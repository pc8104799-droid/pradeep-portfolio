import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { QrService } from '@pc/medicare-core';
import QRCode from 'qrcode';

/**
 * QR generation.
 *
 * Rendered to a canvas in the browser, so a prescription or patient card can be
 * printed with no image request and nothing about the patient leaving the page.
 * The payload is only ever an id — see `QrService.payloadFor`.
 */
@Component({
  selector: 'mc-qr-code',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="qr">
      <canvas #canvas [attr.aria-label]="'QR code for ' + value()" role="img"></canvas>

      @if (caption()) {
        <figcaption>
          <span class="mono">{{ value() }}</span>
          <span class="muted text-xs">{{ caption() }}</span>
        </figcaption>
      }

      @if (failed()) {
        <p class="field__error">This code could not be drawn. The ID is {{ value() }}.</p>
      }
    </figure>
  `,
  styles: `
    .qr {
      display: grid;
      gap: 0.5rem;
      justify-items: center;
    }

    canvas {
      /* White plate regardless of theme: a dark QR on a dark surface does not
         scan, and a scanner expects a light quiet zone. */
      background: #fff;
      padding: 0.5rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--stroke);
      width: 100%;
      max-width: var(--qr-size, 11rem);
      height: auto;
    }

    figcaption {
      display: grid;
      gap: 0.1rem;
      justify-items: center;
      text-align: center;
      font-size: 0.8rem;
    }
  `,
})
export class QrCode {
  readonly value = input.required<string>();
  readonly caption = input('');
  readonly size = input(440);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly qr = inject(QrService);

  protected readonly failed = signal(false);

  constructor() {
    effect(() => {
      const payload = this.qr.payloadFor(this.value());

      QRCode.toCanvas(this.canvas().nativeElement, payload, {
        width: this.size(),
        margin: 1,
        // Medium correction survives a creased printout without bloating the
        // code the way high correction does.
        errorCorrectionLevel: 'M',
        color: { dark: '#0d2231ff', light: '#ffffffff' },
      })
        .then(() => this.failed.set(false))
        .catch(() => this.failed.set(true));
    });
  }
}

/* ----------------------------------------------------------------- scanner */

/**
 * QR scanning, with manual entry as a first-class path rather than a fallback.
 *
 * Two things make a camera scanner unreliable in practice: `BarcodeDetector`
 * only exists in Chromium, and camera permission is often denied on a shared
 * device. So the typed field is always available, and the camera is offered when
 * it can actually work.
 */
@Component({
  selector: 'mc-qr-scanner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="scanner stack">
      @if (cameraSupported) {
        <div class="scanner__stage" [class.is-live]="scanning()">
          <!-- muted + playsinline are what let the preview autoplay on iOS. -->
          <video #video class="scanner__video" muted playsinline></video>

          @if (!scanning()) {
            <div class="scanner__idle">
              <p class="muted text-sm">The camera preview appears here.</p>
              <button type="button" class="btn btn--primary btn--sm" (click)="start()">
                Start camera
              </button>
            </div>
          } @else {
            <div class="scanner__reticle" aria-hidden="true"></div>
            <button type="button" class="btn btn--ghost btn--sm scanner__stop" (click)="stop()">
              Stop
            </button>
          }
        </div>
      } @else {
        <p class="field__hint">
          This browser cannot scan with the camera. Type or paste the ID instead — every
          MediCare360 card and printout shows it under the code.
        </p>
      }

      @if (cameraError(); as message) {
        <p class="field__error" role="alert">{{ message }}</p>
      }

      <form class="scanner__manual" (ngSubmit)="submitManual()">
        <label class="field">
          <span class="field__label">Enter an ID</span>
          <input
            name="code"
            [(ngModel)]="manual"
            placeholder="PT-000001, AP-20260911-0003, RX-000012…"
            autocapitalize="characters"
            autocomplete="off"
            spellcheck="false"
          />
        </label>

        <button type="submit" class="btn btn--outline" [disabled]="!manual().trim()">Look up</button>
      </form>
    </div>
  `,
  styles: `
    .scanner__stage {
      position: relative;
      display: grid;
      place-items: center;
      aspect-ratio: 4 / 3;
      max-height: 20rem;
      border-radius: var(--radius);
      border: 1px solid var(--stroke);
      background: var(--surface-3);
      overflow: hidden;
    }

    .scanner__video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: none;
    }

    .scanner__stage.is-live .scanner__video {
      display: block;
    }

    .scanner__idle {
      display: grid;
      gap: 0.6rem;
      justify-items: center;
      text-align: center;
      padding: 1rem;
    }

    .scanner__reticle {
      position: absolute;
      width: 58%;
      aspect-ratio: 1;
      border: 2px solid var(--primary);
      border-radius: var(--radius);
      box-shadow: 0 0 0 100vmax rgb(6 18 26 / 35%);
    }

    .scanner__stop {
      position: absolute;
      bottom: 0.6rem;
      background: var(--surface);
    }

    .scanner__manual {
      display: flex;
      gap: var(--gap-sm);
      align-items: flex-end;
      flex-wrap: wrap;
    }

    .scanner__manual .field {
      flex: 1;
      min-width: min(100%, 16rem);
    }
  `,
})
export class QrScanner {
  /** Emitted for both a camera read and a typed id — callers treat them alike. */
  readonly scanned = output<string>();

  readonly manual = signal('');

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private readonly qr = inject(QrService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly scanning = signal(false);
  protected readonly cameraError = signal<string | null>(null);

  protected readonly cameraSupported =
    this.qr.support() === 'barcode-detector' && this.qr.canUseCamera();

  private stream: MediaStream | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    // A camera left running after the page closes is a privacy problem, not
    // just a leak, so teardown is wired up as soon as the component exists.
    this.destroyRef.onDestroy(() => this.stop());
  }

  protected async start(): Promise<void> {
    this.cameraError.set(null);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      const video = this.video()?.nativeElement;
      if (!video) return;

      video.srcObject = this.stream;
      await video.play();
      this.scanning.set(true);

      const Detector = (window as unknown as { BarcodeDetector: new (options: { formats: string[] }) => BarcodeReader })
        .BarcodeDetector;
      const detector = new Detector({ formats: ['qr_code'] });

      // Polling four times a second is enough to feel instant and leaves the
      // main thread alone between frames.
      this.timer = setInterval(async () => {
        try {
          const codes = await detector.detect(video);
          const value = codes[0]?.rawValue;

          if (value) {
            this.stop();
            this.scanned.emit(value);
          }
        } catch {
          // A single dropped frame is not worth reporting.
        }
      }, 250);
    } catch (error) {
      this.scanning.set(false);
      this.cameraError.set(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Camera permission was denied. Enter the ID below instead.'
          : 'The camera could not be started. Enter the ID below instead.',
      );
    }
  }

  protected stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;

    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;

    const video = this.video()?.nativeElement;
    if (video) video.srcObject = null;

    this.scanning.set(false);
  }

  protected submitManual(): void {
    const value = this.manual().trim();
    if (value) this.scanned.emit(value);
  }
}

/** The slice of the `BarcodeDetector` API this component uses. */
interface BarcodeReader {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
