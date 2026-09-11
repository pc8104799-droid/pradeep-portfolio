import { Router } from 'express';
import { store } from '../db/store.js';
import { listQuery } from '../lib/query.js';

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

catalogRoutes.get('/coupons', (req, res) => {
  const appliesTo = String(req.query.appliesTo ?? '');
  const coupons = store.collection('coupons');

  res.json({ items: appliesTo ? coupons.filter((row) => row.appliesTo === appliesTo) : coupons });
});
