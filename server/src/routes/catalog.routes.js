import { Router } from 'express';
import { store } from '../db/store.js';
import { badRequest } from '../lib/http-error.js';
import { listQuery } from '../lib/query.js';
import { validate } from '../lib/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

/**
 * Reference data: branches, departments, the medicine catalogue and coupons.
 *
 * Everything here is readable without signing in — a visitor should be able to
 * browse departments and medicine prices before creating an account, exactly
 * like a real hospital site.
 */
export const catalogRoutes = Router();

catalogRoutes.get('/branches', (_req, res) => {
  res.json({ items: store.collection('hospitalBranches') });
});

catalogRoutes.get('/departments', (req, res) => {
  const departments = store.collection('departments');
  const doctors = store.collection('doctors');

  // Each department carries its own doctor count and cheapest fee, so the
  // department grid needs one request rather than one per card.
  const enriched = departments.map((department) => {
    const theirs = doctors.filter((doctor) => doctor.departmentId === department.id);

    return {
      ...department,
      doctorCount: theirs.length,
      fromFee: theirs.length ? Math.min(...theirs.map((doctor) => doctor.consultationFee)) : null,
    };
  });

  res.json(listQuery(enriched, req.query, { searchable: ['name', 'summary'], defaultSort: 'name' }));
});

catalogRoutes.get('/departments/:id', (req, res) => {
  const department = store.findOrFail('departments', req.params.id);
  const doctors = store.filter('doctors', (doctor) => doctor.departmentId === department.id);

  res.json({ ...department, doctors });
});

catalogRoutes.get('/medicine-categories', (_req, res) => {
  const medicines = store.collection('medicines');

  res.json({
    items: store.collection('medicineCategories').map((category) => ({
      ...category,
      count: medicines.filter((medicine) => medicine.category === category.id).length,
    })),
  });
});

catalogRoutes.get('/medicines', (req, res) => {
  let rows = store.collection('medicines');

  // `inStock=true` and a price ceiling are cheap to express here and awkward to
  // express as equality filters, so they sit outside the shared pipeline.
  if (req.query.inStock === 'true') rows = rows.filter((medicine) => medicine.stock > 0);
  if (req.query.maxPrice) rows = rows.filter((medicine) => medicine.price <= Number(req.query.maxPrice));
  if (req.query.prescriptionRequired === 'false') {
    rows = rows.filter((medicine) => !medicine.prescriptionRequired);
  }

  res.json(
    listQuery(rows, req.query, {
      filterable: ['category', 'form', 'manufacturer'],
      searchable: ['name', 'genericName', 'brand', 'categoryName', 'description'],
      defaultSort: 'name',
    }),
  );
});

catalogRoutes.get('/medicines/:id', (req, res) => {
  const medicine = store.findOrFail('medicines', req.params.id);
  const related = store
    .filter('medicines', (row) => row.category === medicine.category && row.id !== medicine.id)
    .slice(0, 6);

  res.json({ ...medicine, related });
});

/**
 * Restocking and repricing, from the pharmacy's inventory screen.
 *
 * Deliberately narrow: stock, price and expiry are what a pharmacist owns.
 * Renaming a medicine or changing whether it needs a prescription is a
 * regulatory matter, not a counter decision, so those are not editable here.
 */
catalogRoutes.patch('/medicines/:id', requireAuth, requireRole('pharmacy', 'admin'), (req, res) => {
  const medicine = store.findOrFail('medicines', req.params.id);

  const input = validate(req.body, {
    stock: { type: 'number', min: 0, max: 100000 },
    price: { type: 'number', min: 1 },
    expiryDate: { type: 'date' },
  });

  if (!Object.keys(input).length) {
    throw badRequest('Nothing to update.', { stock: 'Send a stock, price or expiry date.' });
  }

  // Price and MRP move together, so the displayed discount stays honest.
  const patch = { ...input };
  if (input.price !== undefined) {
    patch.mrp = Math.max(input.price, Math.round(input.price / (1 - medicine.discount / 100)));
  }

  res.json(store.update('medicines', medicine.id, patch));
});

catalogRoutes.get('/coupons', (req, res) => {
  const appliesTo = String(req.query.appliesTo ?? '');
  const coupons = store.collection('coupons');

  res.json({ items: appliesTo ? coupons.filter((row) => row.appliesTo === appliesTo) : coupons });
});
