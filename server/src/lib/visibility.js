/**
 * What each role is allowed to see of a patient record.
 *
 * A doctor treating someone needs the clinical picture; they do not need the
 * patient's home address, their occupation or their insurance policy number.
 * The pharmacy needs less again — enough to hand over the right bag.
 *
 * This lives on its own because more than one route returns a patient, and the
 * answer has to be the same in every one of them. A UI that says "withheld from
 * the clinical view" is only telling the truth if the server actually withholds
 * it.
 */

/** Fields stripped before a patient record reaches a doctor. */
const CLINICAL_HIDDEN = ['address', 'pincode', 'occupation', 'insuranceProvider', 'insuranceNumber'];

/** The pharmacy counter only ever needs to identify who is collecting. */
const PHARMACY_VISIBLE = [
  'id',
  'name',
  'firstName',
  'lastName',
  'age',
  'gender',
  'mobile',
  'allergies',
  'city',
  'status',
];

export function visiblePatient(patient, role) {
  if (!patient) return null;

  // The patient themselves, and the reception desk that registered them, see
  // the whole record.
  if (role === 'patient' || role === 'admin') return patient;

  if (role === 'pharmacy') {
    return Object.fromEntries(
      PHARMACY_VISIBLE.filter((key) => key in patient).map((key) => [key, patient[key]]),
    );
  }

  const visible = { ...patient };
  for (const key of CLINICAL_HIDDEN) delete visible[key];

  return visible;
}
