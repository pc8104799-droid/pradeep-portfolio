import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { lastValueFrom } from 'rxjs';

/**
 * Where the API lives. Overridable at bootstrap so the same build can point at
 * a different host without a rebuild.
 */
export const API_BASE_URL = new InjectionToken<string>('MediCare360 API base URL', {
  providedIn: 'root',
  factory: () => 'http://127.0.0.1:3000/api',
});

/** Query-string values a caller may pass; `null` and `''` are dropped. */
export type QueryInput = Record<string, string | number | boolean | null | undefined>;

/**
 * The only place in the app that talks HTTP.
 *
 * Every feature service goes through here, which is what makes the auth header,
 * the error shape and the base URL single decisions rather than something each
 * service re-implements. Methods return promises because the screens are built
 * on signals — an observable would only be converted at every call site.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  get<T>(path: string, query?: QueryInput): Promise<T> {
    return lastValueFrom(this.http.get<T>(this.url(path), { params: toParams(query) }));
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return lastValueFrom(this.http.post<T>(this.url(path), body ?? {}));
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return lastValueFrom(this.http.patch<T>(this.url(path), body ?? {}));
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return lastValueFrom(this.http.put<T>(this.url(path), body ?? {}));
  }

  delete<T>(path: string): Promise<T> {
    return lastValueFrom(this.http.delete<T>(this.url(path)));
  }

  private url(path: string): string {
    return `${this.base}${path.startsWith('/') ? path : `/${path}`}`;
  }
}

/**
 * Builds the query string, dropping anything empty.
 *
 * Filters live in signals that start out unset, so without this every list URL
 * would carry `?status=&department=` and the server would have to treat blank
 * as "no filter" itself.
 */
export function toParams(query?: QueryInput): HttpParams {
  let params = new HttpParams();
  if (!query) return params;

  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '' || value === 'all') continue;
    params = params.set(key, String(value));
  }

  return params;
}
