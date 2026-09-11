/**
 * `@pc/medicare-core` — the MediCare360 domain layer.
 *
 * Models, the HTTP plumbing, the async-state primitive every screen renders
 * through, route guards, and one service per area of the hospital. No
 * components: the app in `projects/medicare` owns all the UI, and a second
 * client (a reception kiosk, a native shell) could sit on this library
 * unchanged.
 */

export * from './lib/models/medicare.models';

export * from './lib/api/api.service';
export * from './lib/api/api-error';
export * from './lib/api/async-state';

export * from './lib/interceptors/api.interceptors';
export * from './lib/guards/auth.guards';

export * from './lib/services/token.store';
export * from './lib/services/auth.service';
export * from './lib/services/theme.service';
export * from './lib/services/catalog.service';
export * from './lib/services/patient.service';
export * from './lib/services/doctor.service';
export * from './lib/services/appointment.service';
export * from './lib/services/clinical.service';
export * from './lib/services/pharmacy.service';
export * from './lib/services/payment.service';
export * from './lib/services/notification.service';
export * from './lib/services/qr.service';
export * from './lib/services/stats.service';
export * from './lib/services/toast.service';
