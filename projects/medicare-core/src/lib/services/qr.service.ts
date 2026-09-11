import { inject, Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';
import type { QrResult } from '../models/medicare.models';

/** Whether this browser can actually scan, and how. */
export type ScanSupport = 'barcode-detector' | 'manual-only';

/**
 * QR scanning and generation.
 *
 * A MediCare360 code carries only an id. That is the point: a photographed code
 * is worthless without a session, because the server decides what the id
 * resolves to based on who is asking. Generation is local (a canvas, no
 * network); resolution is always a server call.
 */
@Injectable({ providedIn: 'root' })
export class QrService {
  private readonly api = inject(ApiService);

  /**
   * `BarcodeDetector` is Chromium-only, so every screen that scans also offers
   * manual entry. This reports which path is available rather than assuming.
   */
  support(): ScanSupport {
    return 'BarcodeDetector' in window ? 'barcode-detector' : 'manual-only';
  }

  /** True when the page is allowed to ask for a camera at all. */
  canUseCamera(): boolean {
    // getUserMedia is only exposed on a secure origin; localhost counts.
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  resolve(code: string): Promise<QrResult> {
    return this.api.post('/qr/resolve', { code });
  }

  /** The payload printed into a QR: just the id, as a deep link. */
  payloadFor(id: string): string {
    return `medicare360://${id}`;
  }
}
