import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { asyncState, CatalogService, type DoctorQuery } from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { MC_CONTROLS } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

const LANGUAGES = ['English', 'Hindi', 'Marathi', 'Kannada', 'Tamil', 'Telugu', 'Malayalam', 'Bengali', 'Gujarati'];

const SORTS = [
  { id: '-rating', label: 'Best rated' },
  { id: '-experience', label: 'Most experienced' },
  { id: 'consultationFee', label: 'Lowest fee' },
  { id: '-consultationFee', label: 'Highest fee' },
  { id: 'name', label: 'Name A–Z' },
];

/**
 * Doctor search.
 *
 * Filters live in the URL, not just in component state: a patient can share or
 * bookmark "cardiologists in Mumbai under ₹1000" and come back to the same
 * list. The URL is therefore the single source of truth, and every control
 * writes to it rather than to a local copy.
 */
@Component({
  selector: 'mc-doctor-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DataState, ...MC_ATOMS, ...MC_CONTROLS, ...MC_PIPES],
  templateUrl: './doctor-search-page.html',
  styleUrl: './doctor-search-page.scss',
})
export class DoctorSearchPage {
  protected readonly catalog = inject(CatalogService);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly languages = LANGUAGES;
  protected readonly sorts = SORTS;
  protected readonly today = new Date().toISOString().slice(0, 10);

  /** The live filter state, seeded from the query string on first render. */
  protected readonly filters = signal<DoctorQuery>(this.readQuery());

  protected readonly results = asyncState(() => this.catalog.doctors(this.filters()));

  protected readonly activeCount = computed(() => {
    const { q, departmentId, gender, languages, minExperience, maxFee, branchId, availableOn } =
      this.filters();

    return [q, departmentId, gender, languages, minExperience, maxFee, branchId, availableOn].filter(
      Boolean,
    ).length;
  });

  /** Applies a change, resets to page 1, and mirrors it into the URL. */
  protected patch(change: Partial<DoctorQuery>): void {
    const next = { ...this.filters(), ...change, page: change.page ?? 1 };
    this.filters.set(next);

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: clean(next),
      replaceUrl: true,
    });

    void this.results.load();
  }

  protected clearAll(): void {
    this.patch({
      q: '',
      departmentId: '',
      gender: '',
      languages: '',
      minExperience: undefined,
      maxFee: undefined,
      branchId: '',
      availableOn: '',
      sort: '-rating',
    });
  }

  protected departmentName(id: string | undefined): string {
    return id ? (this.catalog.department(id)?.name ?? id) : 'All departments';
  }

  private readQuery(): DoctorQuery {
    const params = this.route.snapshot.queryParamMap;

    return {
      q: params.get('q') ?? '',
      departmentId: params.get('departmentId') ?? '',
      gender: params.get('gender') ?? '',
      languages: params.get('languages') ?? '',
      minExperience: numberOrUndefined(params.get('minExperience')),
      maxFee: numberOrUndefined(params.get('maxFee')),
      branchId: params.get('branchId') ?? '',
      availableOn: params.get('availableOn') ?? '',
      sort: params.get('sort') ?? '-rating',
      page: Number(params.get('page') ?? 1),
      limit: 12,
    };
  }
}

function numberOrUndefined(value: string | null): number | undefined {
  return value ? Number(value) : undefined;
}

/** Drops empty values so the URL stays readable. */
function clean(query: DoctorQuery): Record<string, string | number> {
  const result: Record<string, string | number> = {};

  for (const [key, value] of Object.entries(query)) {
    if (value === '' || value === null || value === undefined || key === 'limit') continue;
    if (key === 'page' && value === 1) continue;
    result[key] = value as string | number;
  }

  return result;
}
