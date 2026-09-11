import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService, ClinicalService, trackedState } from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { DataState } from '../../shared/ui/data-state';
import { QrCode } from '../../shared/ui/qr';
import { MC_PIPES } from '../../shared/pipes';

/**
 * A prescription, laid out like the slip a patient is handed.
 *
 * It prints on one page with the hospital header, the QR and the doctor's
 * details, because that is what a pharmacy counter actually asks for. The
 * patient view adds one thing a paper slip cannot: a button that turns the
 * whole list into a basket at today's prices.
 */
@Component({
  selector: 'mc-prescription-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, QrCode, ...MC_ATOMS, ...MC_PIPES],
  templateUrl: './prescription-detail-page.html',
  styleUrl: './prescription-detail-page.scss',
})
export class PrescriptionDetailPage {
  readonly prescriptionId = input.required<string>();

  private readonly clinical = inject(ClinicalService);

  protected readonly auth = inject(AuthService);
  protected readonly panel = computed(() => this.auth.panel());

  protected readonly prescription = trackedState(
    () => this.prescriptionId(),
    () => this.clinical.prescription(this.prescriptionId()),
  );

  /** How many lines this hospital's own pharmacy can actually dispense. */
  protected readonly stocked = computed(
    () => this.prescription.data()?.medicines.filter((line) => line.catalogue).length ?? 0,
  );

  protected print(): void {
    window.print();
  }
}
