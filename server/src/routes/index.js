import { Router } from 'express';
import { store } from '../db/store.js';
import { authRoutes } from './auth.routes.js';
import { appointmentRoutes } from './appointments.routes.js';
import { catalogRoutes } from './catalog.routes.js';
import { clinicalRoutes } from './clinical.routes.js';
import { doctorRoutes } from './doctors.routes.js';
import { notificationRoutes } from './notifications.routes.js';
import { patientRoutes } from './patients.routes.js';
import { paymentRoutes } from './payments.routes.js';
import { pharmacyRoutes } from './pharmacy.routes.js';
import { qrRoutes } from './qr.routes.js';
import { statsRoutes } from './stats.routes.js';

/** Every route in the API, mounted under `/api`. */
export const api = Router();

api.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    collections: store.summary(),
  });
});

api.use('/auth', authRoutes);
api.use('/', catalogRoutes);
api.use('/doctors', doctorRoutes);
api.use('/patients', patientRoutes);
api.use('/appointments', appointmentRoutes);
api.use('/', clinicalRoutes);
api.use('/pharmacy', pharmacyRoutes);
api.use('/payments', paymentRoutes);
api.use('/notifications', notificationRoutes);
api.use('/qr', qrRoutes);
api.use('/stats', statsRoutes);
