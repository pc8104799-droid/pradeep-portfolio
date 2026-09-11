/**
 * The MediCare360 domain, typed once.
 *
 * These interfaces mirror the collections the API serves. Every screen reads
 * through them rather than through `any`, so a renamed field on the server
 * breaks the build instead of a page at runtime.
 */

/* ------------------------------------------------------------------ people */

export type Role = 'patient' | 'doctor' | 'admin' | 'pharmacy';

export interface SessionUser {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly name: string;
  /** The patient, doctor or branch id this login is attached to. */
  readonly profileId: string;
}

export interface AuthSession {
  readonly token: string;
  readonly expiresIn: number;
  readonly user: SessionUser;
  readonly profile: Patient | Doctor | HospitalBranch | null;
}

export type Gender = 'male' | 'female' | 'other';

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown';

export const BLOOD_GROUPS: readonly BloodGroup[] = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
  'unknown',
];

export interface Patient {
  readonly id: string;
  readonly firstName: string;
  readonly middleName?: string;
  readonly lastName: string;
  readonly name: string;
  readonly dateOfBirth: string;
  readonly age: number;
  readonly gender: Gender;
  readonly bloodGroup: BloodGroup;
  readonly email: string;
  readonly mobile: string;
  readonly address: string;
  readonly city: string;
  readonly state: string;
  readonly country: string;
  readonly pincode: string;
  readonly emergencyContact: string;
  readonly emergencyContactName: string;
  readonly emergencyContactRelationship: string;
  readonly guardianName?: string;
  readonly guardianMobile?: string;
  readonly guardianRelationship?: string;
  readonly maritalStatus?: string;
  readonly occupation?: string;
  readonly conditions: readonly string[];
  readonly allergies: readonly string[];
  readonly currentMedicines: readonly string[];
  readonly previousHospital?: string;
  readonly insuranceProvider?: string;
  readonly insuranceNumber?: string;
  readonly preferredBranchId: string;
  readonly registeredAt: string;
  readonly status: string;
  readonly branch?: HospitalBranch | null;
}

export type Relationship =
  | 'Father'
  | 'Mother'
  | 'Son'
  | 'Daughter'
  | 'Spouse'
  | 'Brother'
  | 'Sister'
  | 'Guardian';

export const RELATIONSHIPS: readonly Relationship[] = [
  'Father',
  'Mother',
  'Son',
  'Daughter',
  'Spouse',
  'Brother',
  'Sister',
  'Guardian',
];

export interface FamilyMember {
  readonly id: string;
  readonly patientId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly name: string;
  readonly relationship: Relationship;
  readonly dateOfBirth: string;
  readonly age: number;
  readonly gender: Gender;
  readonly bloodGroup: BloodGroup;
  readonly mobile?: string;
  readonly conditions: readonly string[];
  readonly allergies: readonly string[];
  readonly guardianName?: string;
  readonly guardianMobile?: string;
  readonly guardianRelationship?: string;
  readonly createdAt: string;
}

export interface Address {
  readonly id: string;
  readonly ownerId: string;
  readonly label: string;
  readonly name: string;
  readonly phone: string;
  readonly line1: string;
  readonly city: string;
  readonly state: string;
  readonly pincode: string;
  readonly landmark?: string;
  readonly isDefault: boolean;
}

/* ------------------------------------------------------------ the hospital */

export interface HospitalBranch {
  readonly id: string;
  readonly name: string;
  readonly city: string;
  readonly state: string;
  readonly address: string;
  readonly phone: string;
  readonly beds: number;
  readonly emergency: boolean;
  readonly hours: string;
  readonly lat: number;
  readonly lng: number;
}

export interface Department {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly icon: string;
  readonly summary: string;
  readonly branchIds: readonly string[];
  readonly doctorCount?: number;
  readonly fromFee?: number | null;
  readonly doctors?: readonly Doctor[];
}

export interface Doctor {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly name: string;
  readonly gender: Gender;
  readonly departmentId: string;
  readonly departmentName: string;
  readonly specialization: string;
  readonly qualification: string;
  readonly registrationNumber: string;
  readonly experience: number;
  readonly consultationFee: number;
  readonly followUpFee: number;
  readonly languages: readonly string[];
  readonly branchIds: readonly string[];
  readonly email: string;
  readonly phone: string;
  readonly rating: number;
  readonly ratingCount: number;
  readonly consultations: number;
  readonly about: string;
  readonly photoInitials: string;
  readonly acceptsOnline: boolean;
  readonly status: string;
  readonly nextAvailable?: { date: string; time: string } | null;
  readonly availability?: DoctorAvailability | null;
  readonly branches?: readonly HospitalBranch[];
  readonly leaves?: readonly DoctorLeave[];
}

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const DAY_KEYS: readonly DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const DAY_LABELS: Readonly<Record<DayKey, string>> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

export interface TimeWindow {
  readonly start: string;
  readonly end: string;
}

export interface DaySchedule {
  readonly working: boolean;
  readonly windows: readonly TimeWindow[];
}

export interface DoctorAvailability {
  readonly id?: string;
  readonly doctorId: string;
  readonly slotMinutes: number;
  readonly maxPerSlot: number;
  readonly breakStart?: string;
  readonly breakEnd?: string;
  readonly schedule: Partial<Record<DayKey, DaySchedule>>;
}

export interface DoctorLeave {
  readonly id: string;
  readonly doctorId: string;
  readonly from: string;
  readonly to: string;
  readonly reason: string;
  readonly status: string;
  readonly createdAt: string;
}

export interface Slot {
  readonly time: string;
  readonly endTime: string;
  readonly available: boolean;
  readonly reason: 'past' | 'booked' | null;
}

export interface SlotDay {
  readonly date: string;
  readonly working: boolean;
  readonly slotMinutes?: number;
  readonly reason: string | null;
  readonly slots: readonly Slot[];
}

export interface SlotSummaryDay {
  readonly date: string;
  readonly working: boolean;
  readonly reason: string | null;
  readonly available: number;
  readonly total: number;
}

/* ----------------------------------------------------------- appointments */

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'checked-in'
  | 'in-consultation'
  | 'completed'
  | 'cancelled'
  | 'rescheduled'
  | 'no-show';

export type QueueStatus = 'waiting' | 'called' | 'in-consultation' | 'completed' | 'no-show';

export interface Appointment {
  readonly id: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly familyMemberId?: string | null;
  readonly doctorId: string;
  readonly doctorName: string;
  readonly departmentId: string;
  readonly departmentName: string;
  readonly branchId: string;
  readonly date: string;
  readonly time: string;
  readonly endTime: string;
  readonly consultationType: 'in-person' | 'online';
  readonly visitType: 'new' | 'follow-up';
  readonly reason: string;
  readonly symptoms?: readonly string[];
  readonly status: AppointmentStatus;
  readonly paymentId: string;
  readonly paymentStatus: string;
  readonly fee: number;
  readonly token: number | null;
  readonly queueStatus: QueueStatus | null;
  readonly checkedInAt: string | null;
  readonly consultationId: string | null;
  readonly cancelReason?: string;
  readonly rescheduledFrom?: { date: string; time: string };
  readonly createdAt: string;
  readonly updatedAt: string;

  /** Present only on the detail endpoint. */
  readonly patient?: Patient | null;
  readonly doctor?: Doctor | null;
  readonly branch?: HospitalBranch | null;
  readonly payment?: Payment | null;
  readonly consultation?: Consultation | null;
  readonly prescription?: Prescription | null;
  readonly reports?: readonly MedicalReport[];
}

export interface QueueBoard {
  readonly date: string;
  readonly doctorId: string;
  readonly items: readonly Appointment[];
  readonly counts: {
    readonly waiting: number;
    readonly called: number;
    readonly inConsultation: number;
    readonly completed: number;
    readonly noShow: number;
    readonly expected: number;
  };
}

/* -------------------------------------------------------------- clinical */

export interface Vitals {
  readonly heightCm?: number;
  readonly weightKg?: number;
  readonly temperatureF?: number;
  readonly pulse?: number;
  readonly systolic?: number;
  readonly diastolic?: number;
  readonly spo2?: number;
  readonly sugarMgDl?: number;
}

export interface Consultation {
  readonly id: string;
  readonly appointmentId: string;
  readonly patientId: string;
  readonly doctorId: string;
  readonly departmentId: string;
  readonly date: string;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly chiefComplaint: string;
  readonly symptoms: readonly string[];
  readonly examination: string;
  readonly vitals: Vitals;
  readonly diagnosis: string;
  readonly treatmentPlan: string;
  readonly notes: string;
  readonly prescriptionId: string | null;
  readonly testRequestIds: readonly string[];
  readonly followUpDate: string | null;
  readonly followUpReason: string;
  readonly status: 'in-progress' | 'completed';

  readonly appointment?: Appointment | null;
  readonly prescription?: Prescription | null;
  readonly testRequests?: readonly TestRequest[];
}

export interface PrescribedMedicine {
  readonly medicineId?: string;
  readonly name: string;
  readonly genericName?: string;
  readonly strength?: string;
  readonly form?: string;
  readonly dosage: string;
  readonly frequency: string;
  readonly duration: string;
  readonly timing: string;
  readonly route: string;
  readonly instructions?: string;
  /** Filled in by the detail endpoint when the medicine is stocked here. */
  readonly catalogue?: Medicine | null;
}

export interface Prescription {
  readonly id: string;
  readonly appointmentId: string;
  readonly consultationId: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly doctorId: string;
  readonly doctorName: string;
  readonly departmentName: string;
  readonly diagnosis: string;
  readonly medicines: readonly PrescribedMedicine[];
  readonly advice: string;
  readonly issuedAt: string;
  readonly followUpDate: string | null;
  readonly dispensed: boolean;
  readonly status: string;

  readonly patient?: Patient | null;
  readonly doctor?: Doctor | null;
}

export interface MedicalRecord {
  readonly id: string;
  readonly patientId: string;
  readonly appointmentId: string;
  readonly consultationId: string;
  readonly prescriptionId: string | null;
  readonly reportIds: readonly string[];
  readonly doctorId: string;
  readonly doctorName: string;
  readonly departmentName: string;
  readonly branchId: string;
  readonly visitDate: string;
  readonly visitType: string;
  readonly diagnosis: string;
  readonly symptoms: readonly string[];
  readonly treatment: string;
  readonly notes: string;
  readonly followUpDate: string | null;

  readonly consultation?: Consultation | null;
  readonly prescription?: Prescription | null;
  readonly reports?: readonly MedicalReport[];
  readonly branch?: HospitalBranch | null;
}

export type TestCategory = 'blood' | 'urine' | 'ecg' | 'x-ray' | 'mri' | 'ct' | 'ultrasound' | 'other';

export const TEST_CATEGORIES: readonly { id: TestCategory; label: string }[] = [
  { id: 'blood', label: 'Blood' },
  { id: 'urine', label: 'Urine' },
  { id: 'ecg', label: 'ECG' },
  { id: 'x-ray', label: 'X-Ray' },
  { id: 'mri', label: 'MRI' },
  { id: 'ct', label: 'CT Scan' },
  { id: 'ultrasound', label: 'Ultrasound' },
  { id: 'other', label: 'Other' },
];

export type TestStatus =
  | 'requested'
  | 'scheduled'
  | 'sample-collected'
  | 'processing'
  | 'completed'
  | 'report-available';

export interface TestRequest {
  readonly id: string;
  readonly appointmentId: string;
  readonly consultationId: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly doctorId: string;
  readonly doctorName: string;
  readonly testName: string;
  readonly category: TestCategory;
  readonly priority: 'routine' | 'urgent';
  readonly clinicalReason: string;
  readonly notes: string;
  readonly price: number;
  readonly status: TestStatus;
  readonly requestedAt: string;
}

export interface MedicalReport {
  readonly id: string;
  readonly testRequestId: string;
  readonly appointmentId: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly doctorId: string;
  readonly doctorName: string;
  readonly testName: string;
  readonly category: TestCategory;
  readonly lab: string;
  readonly collectedOn: string;
  readonly reportedOn: string;
  readonly result: string;
  readonly referenceRange: string;
  readonly status: 'normal' | 'attention';
  readonly labComments: string;
  readonly doctorComments: string;
  readonly price: number;

  readonly patient?: Patient | null;
  readonly doctor?: Doctor | null;
  readonly testRequest?: TestRequest | null;
}

/* -------------------------------------------------------------- pharmacy */

export interface MedicineCategory {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly count?: number;
}

export interface Medicine {
  readonly id: string;
  readonly name: string;
  readonly genericName: string;
  readonly brand: string;
  readonly manufacturer: string;
  readonly category: string;
  readonly categoryName: string;
  readonly strength: string;
  readonly form: string;
  readonly price: number;
  readonly mrp: number;
  readonly discount: number;
  readonly stock: number;
  readonly packSize: string;
  readonly expiryDate: string;
  readonly prescriptionRequired: boolean;
  readonly description: string;
  readonly rating: number;
  readonly ratingCount: number;
  readonly related?: readonly Medicine[];
}

/** A basket line before the server has priced it. */
export interface CartLine {
  readonly medicineId: string;
  readonly quantity: number;
}

/** A basket line after the server has priced it. */
export interface QuotedLine {
  readonly medicineId: string;
  readonly name: string;
  readonly strength: string;
  readonly form: string;
  readonly price: number;
  readonly mrp: number;
  readonly quantity: number;
  readonly lineTotal: number;
  readonly prescriptionRequired: boolean;
  readonly available?: number;
}

export interface OrderBill {
  readonly itemsTotal: number;
  readonly discount: number;
  readonly delivery: number;
  readonly tax: number;
  readonly total: number;
}

export interface Coupon {
  readonly code: string;
  readonly label: string;
  readonly percent?: number;
  readonly flat?: number;
  readonly maxDiscount?: number;
  readonly minOrder: number;
  readonly appliesTo: 'pharmacy' | 'consultation';
}

export interface BasketQuote {
  readonly lines: readonly QuotedLine[];
  /** Prescription-only lines the patient cannot buy yet. */
  readonly blocked: readonly QuotedLine[];
  readonly outOfStock: readonly QuotedLine[];
  readonly coupon: Coupon | null;
  readonly couponError: string | null;
  readonly prescriptionStatus: 'required' | 'verified' | 'not-required';
  readonly bill: OrderBill;
}

export type OrderStage =
  | 'placed'
  | 'confirmed'
  | 'preparing'
  | 'ready-for-pickup'
  | 'out-for-delivery'
  | 'delivered'
  | 'cancelled';

export const ORDER_STAGES: readonly OrderStage[] = [
  'placed',
  'confirmed',
  'preparing',
  'ready-for-pickup',
  'out-for-delivery',
  'delivered',
];

export interface MedicineOrder {
  readonly id: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly lines: readonly QuotedLine[];
  readonly bill: OrderBill;
  readonly address: Address;
  readonly prescriptionId: string | null;
  readonly prescriptionStatus: string;
  readonly paymentId: string;
  readonly paymentStatus: string;
  readonly stage: OrderStage;
  readonly timeline: readonly { stage: OrderStage; at: string }[];
  readonly deliverySlot: string;
  readonly placedAt: string;

  readonly payment?: Payment | null;
  readonly prescription?: Prescription | null;
}

/** What the "order my prescription" screen gets back. */
export interface PrescriptionBasket {
  readonly prescriptionId: string;
  readonly diagnosis: string;
  readonly doctorName: string;
  readonly issuedAt: string;
  readonly lines: readonly (QuotedLine & { stock: number; dosage: string })[];
  readonly unavailable: readonly { name: string; reason: string }[];
}

/* -------------------------------------------------------------- payments */

export type PaymentMethod =
  | 'upi'
  | 'credit-card'
  | 'debit-card'
  | 'net-banking'
  | 'wallet'
  | 'insurance';

export const PAYMENT_METHODS: readonly { id: PaymentMethod; label: string; hint: string }[] = [
  { id: 'upi', label: 'UPI', hint: 'GPay, PhonePe, Paytm or any UPI app' },
  { id: 'credit-card', label: 'Credit card', hint: 'Visa, Mastercard, Amex, RuPay' },
  { id: 'debit-card', label: 'Debit card', hint: 'All Indian bank debit cards' },
  { id: 'net-banking', label: 'Net banking', hint: '58 banks supported' },
  { id: 'wallet', label: 'Wallet', hint: 'Paytm, Amazon Pay, Mobikwik' },
  { id: 'insurance', label: 'Insurance', hint: 'Cashless, subject to approval' },
];

export type PaymentStatus = 'pending' | 'processing' | 'successful' | 'failed' | 'refunded';

export interface ConsultationBill {
  readonly fee: number;
  readonly serviceCharge: number;
  readonly discount: number;
  readonly tax: number;
  readonly insurance: number;
  readonly total: number;
}

export interface Payment {
  readonly id: string;
  readonly transactionId: string | null;
  readonly kind: 'consultation' | 'pharmacy';
  readonly referenceId: string;
  readonly patientId: string;
  readonly doctorId: string | null;
  readonly amount: number;
  readonly breakdown: ConsultationBill | OrderBill;
  readonly couponCode?: string | null;
  readonly method: PaymentMethod | null;
  readonly status: PaymentStatus;
  readonly paidAt: string | null;
  readonly refundedAt?: string;
  readonly failureReason?: string | null;
  readonly createdAt: string;

  readonly patient?: Patient | null;
  readonly doctor?: Doctor | null;
  readonly appointment?: Appointment | null;
  readonly order?: MedicineOrder | null;
}

export interface Receipt {
  readonly receiptNo: string;
  readonly issuedAt: string;
  readonly status: PaymentStatus;
  readonly transactionId: string | null;
  readonly method: PaymentMethod | null;
  readonly amount: number;
  readonly breakdown: ConsultationBill | OrderBill;
  readonly billedTo: { id: string; name: string; email: string; mobile: string } | null;
  readonly branch: HospitalBranch | null;
  readonly lines: readonly { label: string; detail: string; amount: number }[];
}

/* --------------------------------------------------------- notifications */

export type NotificationKind =
  | 'appointment'
  | 'prescription'
  | 'report'
  | 'payment'
  | 'order'
  | 'queue'
  | 'consultation'
  | 'test'
  | 'system';

export interface AppNotification {
  readonly id: string;
  readonly ownerId: string;
  readonly audience: 'patient' | 'doctor';
  readonly kind: NotificationKind;
  readonly title: string;
  readonly body: string;
  readonly link: string | null;
  readonly read: boolean;
  readonly createdAt: string;
}

/* ------------------------------------------------------------ dashboards */

export interface PatientSummary {
  readonly patient: Patient;
  readonly upcomingAppointment: Appointment | null;
  readonly lastAppointment: Appointment | null;
  readonly counts: {
    readonly appointments: number;
    readonly prescriptions: number;
    readonly reports: number;
    readonly records: number;
    readonly orders: number;
    readonly unreadNotifications: number;
  };
  readonly currentMedicines: readonly PrescribedMedicine[];
  readonly latestPrescription: Prescription | null;
  readonly recentReports: readonly MedicalReport[];
  readonly recentRecords: readonly MedicalRecord[];
  readonly pendingPayments: readonly Payment[];
  readonly totalSpent: number;
  readonly activeOrders: readonly MedicineOrder[];
  readonly familyMembers: readonly FamilyMember[];
}

export interface EmergencyCard {
  readonly patientId: string;
  readonly name: string;
  readonly age: number;
  readonly gender: Gender;
  readonly bloodGroup: BloodGroup;
  readonly allergies: readonly string[];
  readonly conditions: readonly string[];
  readonly currentMedicines: readonly string[];
  readonly emergencyContactName: string;
  readonly emergencyContact: string;
  readonly emergencyContactRelationship: string;
  readonly insuranceProvider?: string;
  readonly insuranceNumber?: string;
  readonly branch: HospitalBranch | null;
}

export interface ChartPoint {
  readonly label: string;
  readonly value: number;
  readonly date?: string;
}

export interface DoctorDashboard {
  readonly doctor: { id: string; name: string; departmentName: string };
  readonly today: {
    readonly total: number;
    readonly waiting: number;
    readonly inConsultation: number;
    readonly completed: number;
    readonly cancelled: number;
    readonly noShow: number;
  };
  readonly totals: {
    readonly patients: number;
    readonly newThisMonth: number;
    readonly consultations: number;
    readonly prescriptions: number;
    readonly followUps: number;
    readonly pendingReports: number;
  };
  readonly earnings: {
    readonly today: number;
    readonly week: number;
    readonly month: number;
    readonly lifetime: number;
    readonly pending: number;
    readonly paidCount: number;
    readonly pendingCount: number;
  };
  readonly charts: {
    readonly daily: readonly ChartPoint[];
    readonly monthly: readonly ChartPoint[];
    readonly revenue: readonly ChartPoint[];
    readonly status: readonly ChartPoint[];
  };
}

export interface PatientDashboard {
  readonly visits: number;
  readonly upcoming: number;
  readonly prescriptions: number;
  readonly reports: number;
  readonly spent: number;
  readonly charts: {
    readonly spendByMonth: readonly ChartPoint[];
    readonly visitsByDepartment: readonly ChartPoint[];
  };
}

export interface TimelineEntry {
  readonly kind: 'visit' | 'prescription' | 'report' | 'upcoming';
  readonly id: string;
  readonly date: string;
  readonly title: string;
  readonly subtitle: string;
  readonly link: string;
}

export interface Timeline {
  readonly years: readonly { year: string; entries: readonly TimelineEntry[] }[];
  readonly total: number;
}

/* ------------------------------------------------------------------- misc */

/** Every list endpoint answers in this envelope. */
export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly pages: number;
}

export interface QrResult {
  readonly kind: string;
  readonly code: string;
  readonly summary: { title: string; lines: readonly string[]; link: string };
  readonly record: Record<string, unknown>;
}

/** The shape the API uses for every failure. */
export interface ApiErrorBody {
  readonly error: {
    readonly status: number;
    readonly message: string;
    readonly details?: Record<string, string>;
  };
}
