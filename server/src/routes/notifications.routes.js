import { Router } from 'express';
import { store } from '../db/store.js';
import { listQuery } from '../lib/query.js';
import { requireAuth } from '../middleware/auth.js';

/**
 * A person's notifications.
 *
 * Rows are addressed to a patient or doctor id, so "mine" is simply the rows
 * pointing at my profile — there is no separate inbox to keep in step.
 */
export const notificationRoutes = Router();

notificationRoutes.use(requireAuth);

notificationRoutes.get('/', (req, res) => {
  const mine = store.filter('notifications', (row) => row.ownerId === req.auth.profileId);

  const result = listQuery(mine, req.query, {
    filterable: ['kind', 'read'],
    searchable: ['title', 'body'],
    defaultSort: '-createdAt',
  });

  res.json({ ...result, unread: mine.filter((row) => !row.read).length });
});

notificationRoutes.get('/unread-count', (req, res) => {
  res.json({
    count: store.filter('notifications', (row) => row.ownerId === req.auth.profileId && !row.read).length,
  });
});

notificationRoutes.post('/:id/read', (req, res) => {
  const notification = store.findOrFail('notifications', req.params.id);

  // Silently ignore someone else's notification rather than confirming it
  // exists — a 404 here would leak that an id is real.
  if (notification.ownerId !== req.auth.profileId) {
    return res.status(404).json({ error: { status: 404, message: 'Not found.' } });
  }

  res.json(store.update('notifications', notification.id, { read: true }));
});

notificationRoutes.post('/read-all', (req, res) => {
  const mine = store.filter('notifications', (row) => row.ownerId === req.auth.profileId && !row.read);

  for (const notification of mine) store.update('notifications', notification.id, { read: true });

  res.json({ updated: mine.length });
});

notificationRoutes.delete('/:id', (req, res) => {
  const notification = store.findOrFail('notifications', req.params.id);

  if (notification.ownerId !== req.auth.profileId) {
    return res.status(404).json({ error: { status: 404, message: 'Not found.' } });
  }

  store.remove('notifications', notification.id);
  res.json({ ok: true });
});
