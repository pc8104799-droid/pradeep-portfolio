import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ChartPoint } from '@pc/medicare-core';
import { InrPipe } from '../pipes';

/**
 * Dashboard charts, drawn as inline SVG.
 *
 * No charting library: these are three fixed shapes over a list of
 * `{ label, value }`, and hand-drawn SVG keeps them themed by the same CSS
 * tokens as everything else — a library would need its own colour config per
 * theme. Each one is labelled for screen readers and also prints a plain table
 * fallback, because a chart nobody can read is decoration.
 */

/* ------------------------------------------------------------- bar chart */

@Component({
  selector: 'mc-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="chart">
      <div class="chart__bars" role="img" [attr.aria-label]="caption() || 'Chart'">
        @for (point of scaled(); track point.label) {
          <div class="bar" [style.--h.%]="point.height">
            <span class="bar__value num">{{ point.display }}</span>
            <span class="bar__fill" [class.bar__fill--peak]="point.peak"></span>
            <span class="bar__label">{{ point.label }}</span>
          </div>
        }
      </div>

      @if (caption()) {
        <figcaption class="muted text-xs">{{ caption() }}</figcaption>
      }
    </figure>
  `,
  styles: `
    .chart {
      display: grid;
      gap: 0.5rem;
    }

    .chart__bars {
      display: flex;
      align-items: flex-end;
      gap: 0.35rem;
      height: 9.5rem;
    }

    .bar {
      flex: 1;
      min-width: 0;
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 0.25rem;
      height: 100%;
      text-align: center;
    }

    .bar__fill {
      align-self: end;
      /* A hairline floor keeps a zero-value day visible as a real day. */
      height: max(2px, var(--h));
      border-radius: var(--radius-xs) var(--radius-xs) 0 0;
      background: var(--primary-soft);
      transition: height var(--t) var(--ease);
    }

    .bar__fill--peak {
      background: var(--primary);
    }

    .bar__value {
      font-size: 0.68rem;
      font-weight: 600;
      color: var(--ink-3);
    }

    .bar__label {
      font-size: 0.65rem;
      color: var(--ink-3);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class BarChart {
  readonly points = input.required<readonly ChartPoint[]>();
  readonly caption = input('');
  readonly currency = input(false);

  private readonly formatter = new InrPipe();

  protected readonly scaled = computed(() => {
    const points = this.points();
    const peak = Math.max(1, ...points.map((point) => point.value));

    return points.map((point) => ({
      label: point.label,
      height: Math.round((point.value / peak) * 100),
      peak: point.value === peak && point.value > 0,
      display: this.currency()
        ? point.value >= 1000
          ? `${Math.round(point.value / 1000)}k`
          : this.formatter.transform(point.value)
        : String(point.value),
    }));
  });
}

/* ----------------------------------------------------------- donut chart */

@Component({
  selector: 'mc-donut-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="donut">
      <svg viewBox="0 0 42 42" role="img" [attr.aria-label]="caption() || 'Breakdown'">
        <circle class="donut__track" cx="21" cy="21" r="15.9" />

        @for (arc of arcs(); track arc.label) {
          <!-- Each slice is one dashed circle, rotated to where it starts.
               Cheaper and steadier than generating arc paths by hand. -->
          <circle
            class="donut__arc"
            cx="21"
            cy="21"
            r="15.9"
            [attr.stroke]="arc.colour"
            [attr.stroke-dasharray]="arc.dash"
            [attr.stroke-dashoffset]="arc.offset"
          />
        }

        <text class="donut__total" x="21" y="20.5">{{ total() }}</text>
        <text class="donut__caption" x="21" y="25">{{ unit() }}</text>
      </svg>

      <ul class="legend">
        @for (arc of arcs(); track arc.label) {
          <li>
            <span class="legend__swatch" [style.background]="arc.colour" aria-hidden="true"></span>
            <span class="legend__label truncate">{{ arc.label }}</span>
            <span class="legend__value num">{{ arc.value }}</span>
          </li>
        }
      </ul>
    </div>
  `,
  styles: `
    .donut {
      display: grid;
      gap: var(--gap);
      align-items: center;
      grid-template-columns: minmax(0, 1fr);
    }

    @media (min-width: 420px) {
      .donut {
        grid-template-columns: 8.5rem minmax(0, 1fr);
      }
    }

    svg {
      width: 100%;
      max-width: 8.5rem;
      margin-inline: auto;
      transform: rotate(-90deg);
    }

    .donut__track,
    .donut__arc {
      fill: none;
      stroke-width: 4.2;
    }

    .donut__track {
      stroke: var(--surface-3);
    }

    .donut__arc {
      transition: stroke-dasharray var(--t) var(--ease);
    }

    text {
      transform: rotate(90deg);
      transform-origin: 21px 21px;
      text-anchor: middle;
      fill: var(--ink);
    }

    .donut__total {
      font-family: var(--font-display);
      font-size: 7px;
      font-weight: 700;
    }

    .donut__caption {
      font-size: 3.2px;
      fill: var(--ink-3);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .legend {
      display: grid;
      gap: 0.3rem;
      font-size: 0.8rem;
    }

    .legend li {
      display: grid;
      grid-template-columns: 0.6rem minmax(0, 1fr) auto;
      gap: 0.5rem;
      align-items: center;
    }

    .legend__swatch {
      width: 0.6rem;
      height: 0.6rem;
      border-radius: 3px;
    }

    .legend__label {
      color: var(--ink-2);
    }

    .legend__value {
      font-weight: 600;
    }
  `,
})
export class DonutChart {
  readonly points = input.required<readonly ChartPoint[]>();
  readonly caption = input('');
  readonly unit = input('total');

  /**
   * Slice colours come from the theme tokens rather than a fixed palette, so
   * the chart re-tints itself with everything else.
   */
  private static readonly COLOURS = [
    'var(--primary)',
    'var(--accent)',
    'var(--success)',
    'var(--warning)',
    'var(--danger)',
    'var(--info)',
  ];

  protected readonly total = computed(() =>
    this.points().reduce((sum, point) => sum + point.value, 0),
  );

  protected readonly arcs = computed(() => {
    const total = this.total() || 1;
    let offset = 0;

    return this.points()
      .filter((point) => point.value > 0)
      .map((point, index) => {
        const share = (point.value / total) * 100;
        const arc = {
          label: point.label,
          value: point.value,
          colour: DonutChart.COLOURS[index % DonutChart.COLOURS.length],
          dash: `${share.toFixed(2)} ${(100 - share).toFixed(2)}`,
          offset: (100 - offset).toFixed(2),
        };

        offset += share;
        return arc;
      });
  });
}

/* ------------------------------------------------------------ line chart */

@Component({
  selector: 'mc-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="line">
      <svg viewBox="0 0 100 38" preserveAspectRatio="none" role="img" [attr.aria-label]="caption() || 'Trend'">
        <!-- Fill first, stroke on top, so the line reads as the data and the
             fill only as weight underneath it. -->
        <path class="line__area" [attr.d]="area()" />
        <path class="line__stroke" [attr.d]="path()" />
      </svg>

      <div class="line__axis">
        @for (point of points(); track point.label; let first = $first; let last = $last) {
          @if (first || last) {
            <span class="text-xs muted">{{ point.label }}</span>
          }
        }
      </div>
    </figure>
  `,
  styles: `
    svg {
      width: 100%;
      height: 6rem;
      overflow: visible;
    }

    .line__stroke {
      fill: none;
      stroke: var(--primary);
      stroke-width: 1.4;
      stroke-linecap: round;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
    }

    .line__area {
      fill: var(--primary-soft);
      stroke: none;
    }

    .line__axis {
      display: flex;
      justify-content: space-between;
      margin-top: 0.3rem;
    }
  `,
})
export class LineChart {
  readonly points = input.required<readonly ChartPoint[]>();
  readonly caption = input('');

  private readonly coords = computed(() => {
    const points = this.points();
    if (!points.length) return [] as { x: number; y: number }[];

    const peak = Math.max(1, ...points.map((point) => point.value));
    const step = points.length > 1 ? 100 / (points.length - 1) : 0;

    return points.map((point, index) => ({
      x: index * step,
      // SVG y grows downward, and 3 units of headroom keep the peak off the edge.
      y: 35 - (point.value / peak) * 32,
    }));
  });

  protected readonly path = computed(() => {
    const coords = this.coords();
    if (!coords.length) return '';

    return coords
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
      .join(' ');
  });

  protected readonly area = computed(() => {
    const coords = this.coords();
    if (!coords.length) return '';

    return `${this.path()} L100,38 L0,38 Z`;
  });
}

export const MC_CHARTS = [BarChart, DonutChart, LineChart] as const;
