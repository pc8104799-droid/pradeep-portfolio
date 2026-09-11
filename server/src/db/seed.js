import { hashPassword } from '../lib/password.js';
import { addDays, ymd } from '../lib/ids.js';
import { addMinutes, ageFrom, prettyDate } from '../lib/dates.js';
import { billFor, orderBill } from '../lib/billing.js';
import { config } from '../config.js';

/**
 * Builds the demo hospital.
 *
 * Two rules shape everything here. Records are cross-referenced by id rather
 * than duplicated, so a prescription points at the consultation that produced it
 * and the appointment that produced that. And every date is generated relative
 * to the day the file is created, so the seeded hospital always has appointments
 * this morning, history behind it and follow-ups ahead of it — a fixed snapshot
 * would look abandoned a week later.
 *
 * The generator is otherwise deterministic: the same names, fees and diagnoses
 * come out every time, which keeps screenshots and tests stable.
 */

/* ------------------------------------------------------------------ random */

/** mulberry32 — small, seeded, good enough for demo data. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = rng(360360);
const pick = (list) => list[Math.floor(random() * list.length)];
const pickSome = (list, count) => [...list].sort(() => random() - 0.5).slice(0, count);
const between = (min, max) => Math.floor(random() * (max - min + 1)) + min;
const chance = (probability) => random() < probability;

const TODAY = ymd();
const at = (date, time) => new Date(`${date}T${time}:00`).toISOString();

/* ------------------------------------------------------------- vocabulary */

const BRANCHES = [
  {
    id: 'BR-000001',
    name: 'MediCare360 Andheri',
    city: 'Mumbai',
    state: 'Maharashtra',
    address: 'Plot 22, Veera Desai Road, Andheri West, Mumbai 400053',
    phone: '+91 22 6120 3600',
    beds: 320,
    emergency: true,
    hours: '24x7',
    lat: 19.1364,
    lng: 72.8296,
  },
  {
    id: 'BR-000002',
    name: 'MediCare360 Whitefield',
    city: 'Bengaluru',
    state: 'Karnataka',
    address: 'ITPL Main Road, Whitefield, Bengaluru 560066',
    phone: '+91 80 4711 3600',
    beds: 240,
    emergency: true,
    hours: '24x7',
    lat: 12.9698,
    lng: 77.7499,
  },
  {
    id: 'BR-000003',
    name: 'MediCare360 Gomti Nagar',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    address: 'Vibhuti Khand, Gomti Nagar, Lucknow 226010',
    phone: '+91 522 405 3600',
    beds: 180,
    emergency: false,
    hours: '07:00 – 22:00',
    lat: 26.8571,
    lng: 80.9942,
  },
];

const DEPARTMENTS = [
  ['general-medicine', 'General Medicine', 'stethoscope', 'Everyday illness, fever, infections and long-term condition reviews.'],
  ['cardiology', 'Cardiology', 'heart', 'Heart rhythm, blood pressure, cholesterol and post-cardiac care.'],
  ['neurology', 'Neurology', 'brain', 'Headache, seizure, stroke follow-up and nerve disorders.'],
  ['orthopedics', 'Orthopedics', 'bone', 'Fractures, joint pain, sports injury and spine care.'],
  ['pediatrics', 'Pediatrics', 'child', 'Newborn to teenage care, growth, vaccines and childhood illness.'],
  ['dermatology', 'Dermatology', 'skin', 'Skin, hair and nail conditions, allergies and cosmetic concerns.'],
  ['gynecology', 'Gynecology', 'female', 'Women’s health, pregnancy care and menstrual disorders.'],
  ['ent', 'ENT', 'ear', 'Ear, nose, throat, sinus, hearing and voice problems.'],
  ['ophthalmology', 'Ophthalmology', 'eye', 'Vision testing, cataract, glaucoma and retina care.'],
  ['dentistry', 'Dentistry', 'tooth', 'Dental pain, cleaning, fillings, braces and oral surgery.'],
  ['psychiatry', 'Psychiatry', 'mind', 'Anxiety, depression, sleep and counselling support.'],
  ['urology', 'Urology', 'kidney', 'Kidney stones, urinary problems and prostate care.'],
  ['gastroenterology', 'Gastroenterology', 'stomach', 'Acidity, liver, gut and digestive disorders.'],
  ['pulmonology', 'Pulmonology', 'lungs', 'Asthma, breathlessness, COPD and sleep apnoea.'],
  ['oncology', 'Oncology', 'ribbon', 'Cancer screening, chemotherapy planning and survivorship care.'],
  ['radiology', 'Radiology', 'scan', 'X-ray, ultrasound, CT and MRI imaging and reporting.'],
  ['emergency-medicine', 'Emergency Medicine', 'siren', 'Round-the-clock casualty, trauma and urgent care.'],
];

const DOCTORS = [
  ['Anaya', 'Mehta', 'F', 'cardiology', 'Interventional Cardiology', 'MBBS, MD (Medicine), DM (Cardiology)', 18, 1200],
  ['Rohan', 'Iyer', 'M', 'cardiology', 'Heart Failure & Rhythm', 'MBBS, MD, DNB (Cardiology)', 12, 1000],
  ['Kavita', 'Deshpande', 'F', 'general-medicine', 'Internal Medicine & Diabetes', 'MBBS, MD (General Medicine)', 15, 700],
  ['Sameer', 'Khan', 'M', 'general-medicine', 'Infectious Disease', 'MBBS, MD, FIDP', 9, 600],
  ['Nikhil', 'Rao', 'M', 'neurology', 'Stroke & Epilepsy', 'MBBS, MD, DM (Neurology)', 14, 1400],
  ['Prerna', 'Joshi', 'F', 'neurology', 'Headache & Movement Disorders', 'MBBS, DM (Neurology)', 8, 1100],
  ['Arjun', 'Nair', 'M', 'orthopedics', 'Joint Replacement', 'MBBS, MS (Ortho), FRCS', 20, 900],
  ['Meera', 'Pillai', 'F', 'orthopedics', 'Sports Injury & Arthroscopy', 'MBBS, MS (Ortho), DNB', 10, 800],
  ['Shreya', 'Gupta', 'F', 'pediatrics', 'Neonatology', 'MBBS, MD (Pediatrics), Fellowship (Neonatology)', 13, 750],
  ['Aditya', 'Verma', 'M', 'pediatrics', 'Child Development', 'MBBS, DCH, DNB (Pediatrics)', 7, 650],
  ['Ritu', 'Malhotra', 'F', 'dermatology', 'Clinical & Cosmetic Dermatology', 'MBBS, MD (Dermatology)', 11, 850],
  ['Farhan', 'Ali', 'M', 'dermatology', 'Hair & Allergy Clinic', 'MBBS, DDVL', 6, 600],
  ['Sunita', 'Bhat', 'F', 'gynecology', 'High-Risk Pregnancy', 'MBBS, MS (OBGY), FMAS', 17, 950],
  ['Devika', 'Menon', 'F', 'gynecology', 'Fertility & Endoscopy', 'MBBS, DNB (OBGY)', 9, 900],
  ['Vikram', 'Sethi', 'M', 'ent', 'Sinus & Endoscopic Surgery', 'MBBS, MS (ENT)', 12, 700],
  ['Neha', 'Kulkarni', 'F', 'ophthalmology', 'Cataract & Retina', 'MBBS, MS (Ophthalmology)', 10, 750],
  ['Rahul', 'Bansal', 'M', 'dentistry', 'Endodontics & Implants', 'BDS, MDS (Conservative Dentistry)', 8, 500],
  ['Ishita', 'Roy', 'F', 'psychiatry', 'Anxiety, Mood & Sleep', 'MBBS, MD (Psychiatry)', 11, 1200],
  ['Manish', 'Tiwari', 'M', 'urology', 'Endourology & Stones', 'MBBS, MS, MCh (Urology)', 16, 1100],
  ['Pooja', 'Shetty', 'F', 'gastroenterology', 'Liver & Endoscopy', 'MBBS, MD, DM (Gastroenterology)', 13, 1250],
  ['Karthik', 'Reddy', 'M', 'pulmonology', 'Asthma & Sleep Medicine', 'MBBS, MD (Pulmonary Medicine)', 12, 900],
  ['Ananya', 'Das', 'F', 'oncology', 'Medical Oncology', 'MBBS, MD, DM (Medical Oncology)', 14, 1500],
  ['Imran', 'Sheikh', 'M', 'radiology', 'Cross-sectional Imaging', 'MBBS, MD (Radiodiagnosis)', 10, 600],
  ['Tara', 'Chandran', 'F', 'emergency-medicine', 'Trauma & Critical Care', 'MBBS, MEM, FCCS', 9, 800],
];

const LANGUAGES = ['English', 'Hindi', 'Marathi', 'Kannada', 'Tamil', 'Telugu', 'Malayalam', 'Bengali', 'Gujarati'];

const MEDICINES = [
  ['Dolo 650', 'Paracetamol', 'Micro Labs', 'pain-relief', '650 mg', 'Tablet', 31, 5, false, 'Brings down fever and eases mild to moderate pain.'],
  ['Combiflam', 'Ibuprofen + Paracetamol', 'Sanofi', 'pain-relief', '400/325 mg', 'Tablet', 44, 8, false, 'Anti-inflammatory relief for body ache, sprains and dental pain.'],
  ['Volini Gel', 'Diclofenac Diethylamine', 'Sun Pharma', 'pain-relief', '1.16% w/w', 'Gel', 145, 10, false, 'Topical relief for muscle and joint pain.'],
  ['Zerodol SP', 'Aceclofenac + Paracetamol + Serratiopeptidase', 'Ipca', 'pain-relief', '100/325/15 mg', 'Tablet', 118, 7, true, 'Short-course relief for post-operative and injury pain.'],
  ['Augmentin 625', 'Amoxicillin + Clavulanic Acid', 'GSK', 'antibiotics', '625 mg', 'Tablet', 214, 6, true, 'Broad-spectrum antibiotic for respiratory and skin infections.'],
  ['Azithral 500', 'Azithromycin', 'Alembic', 'antibiotics', '500 mg', 'Tablet', 132, 9, true, 'Three-day course for throat, chest and sinus infections.'],
  ['Ciplox 500', 'Ciprofloxacin', 'Cipla', 'antibiotics', '500 mg', 'Tablet', 78, 5, true, 'Used for urinary and gastrointestinal infections.'],
  ['Monocef 1g', 'Ceftriaxone', 'Aristo', 'antibiotics', '1 g', 'Injection', 92, 0, true, 'Hospital-administered injectable antibiotic.'],
  ['Shelcal 500', 'Calcium Carbonate + Vitamin D3', 'Torrent', 'vitamins', '500 mg / 250 IU', 'Tablet', 128, 12, false, 'Daily calcium support for bone strength.'],
  ['Neurobion Forte', 'Vitamin B Complex', 'Procter & Gamble', 'vitamins', 'B1/B6/B12', 'Tablet', 42, 6, false, 'Supports nerve health and reduces tingling.'],
  ['Limcee', 'Ascorbic Acid', 'Abbott', 'vitamins', '500 mg', 'Chewable Tablet', 28, 4, false, 'Vitamin C for immunity and recovery.'],
  ['Uprise D3 60K', 'Cholecalciferol', 'Alkem', 'vitamins', '60000 IU', 'Capsule', 88, 10, true, 'Weekly vitamin D correction for deficiency.'],
  ['Glycomet GP1', 'Metformin + Glimepiride', 'USV', 'diabetes', '500/1 mg', 'Tablet', 96, 8, true, 'Twice-daily control of type 2 diabetes.'],
  ['Januvia 50', 'Sitagliptin', 'MSD', 'diabetes', '50 mg', 'Tablet', 385, 5, true, 'Add-on therapy when metformin alone is not enough.'],
  ['Lantus SoloStar', 'Insulin Glargine', 'Sanofi', 'diabetes', '100 IU/mL', 'Pen Injector', 1240, 3, true, 'Long-acting basal insulin, once daily.'],
  ['Accu-Chek Active Strips', 'Glucose Test Strips', 'Roche', 'diabetes', '50 strips', 'Strips', 940, 12, false, 'Home blood-sugar monitoring strips.'],
  ['Telma 40', 'Telmisartan', 'Glenmark', 'blood-pressure', '40 mg', 'Tablet', 141, 7, true, 'Once-daily control of high blood pressure.'],
  ['Amlokind AT', 'Amlodipine + Atenolol', 'Mankind', 'blood-pressure', '5/50 mg', 'Tablet', 64, 6, true, 'Combination therapy for hypertension.'],
  ['Ecosprin 75', 'Aspirin', 'USV', 'blood-pressure', '75 mg', 'Tablet', 12, 3, true, 'Low-dose blood thinner for cardiac protection.'],
  ['Rosuvas 10', 'Rosuvastatin', 'Sun Pharma', 'blood-pressure', '10 mg', 'Tablet', 178, 9, true, 'Lowers LDL cholesterol; taken at night.'],
  ['Cheston Cold', 'Cetirizine + Paracetamol + Phenylephrine', 'Cipla', 'cold-flu', '5/325/10 mg', 'Tablet', 58, 6, false, 'Relief from blocked nose, sneezing and fever.'],
  ['Otrivin Nasal Spray', 'Xylometazoline', 'Haleon', 'cold-flu', '0.1%', 'Nasal Spray', 132, 5, false, 'Fast decongestion for a blocked nose.'],
  ['Benadryl Cough Syrup', 'Diphenhydramine + Ammonium Chloride', 'Johnson & Johnson', 'cold-flu', '100 mL', 'Syrup', 148, 8, false, 'Soothes a dry, irritating cough.'],
  ['Ascoril LS', 'Levosalbutamol + Ambroxol + Guaifenesin', 'Glenmark', 'cold-flu', '100 mL', 'Syrup', 136, 7, true, 'Loosens chest congestion in a wet cough.'],
  ['Pan 40', 'Pantoprazole', 'Alkem', 'gastro', '40 mg', 'Tablet', 138, 8, true, 'Reduces stomach acid; taken before breakfast.'],
  ['Digene Gel', 'Magnesium Hydroxide + Simethicone', 'Abbott', 'gastro', '200 mL', 'Suspension', 155, 6, false, 'Instant relief from acidity and gas.'],
  ['Econorm Sachet', 'Saccharomyces boulardii', 'Dr Reddy’s', 'gastro', '250 mg', 'Sachet', 38, 4, false, 'Probiotic support during and after diarrhoea.'],
  ['Cremaffin Plus', 'Liquid Paraffin + Milk of Magnesia', 'Abbott', 'gastro', '225 mL', 'Syrup', 198, 9, false, 'Gentle relief from constipation.'],
  ['Candid Cream', 'Clotrimazole', 'Glenmark', 'dermatology', '1% w/w', 'Cream', 92, 5, false, 'Antifungal cream for ringworm and athlete’s foot.'],
  ['Betnovate N', 'Betamethasone + Neomycin', 'GSK', 'dermatology', '20 g', 'Cream', 78, 4, true, 'Short-term treatment for inflamed, infected skin.'],
  ['Minoxidil 5% Solution', 'Minoxidil', 'Dr Reddy’s', 'dermatology', '5% w/v', 'Topical Solution', 685, 12, true, 'Twice-daily application for pattern hair loss.'],
  ['Cetaphil Moisturising Lotion', 'Emollient', 'Galderma', 'dermatology', '250 mL', 'Lotion', 545, 10, false, 'Daily moisturiser for dry and sensitive skin.'],
  ['Meftal P Suspension', 'Mefenamic Acid', 'Blue Cross', 'pediatrics', '100 mg/5 mL', 'Suspension', 76, 5, true, 'Paediatric fever and pain relief by weight.'],
  ['Zincovit Syrup', 'Multivitamin + Zinc', 'Apex', 'pediatrics', '200 mL', 'Syrup', 138, 7, false, 'Appetite and immunity support for children.'],
  ['ORS Orange Sachet', 'Oral Rehydration Salts', 'FDC', 'pediatrics', '21.8 g', 'Sachet', 22, 0, false, 'Replaces fluids lost in diarrhoea and vomiting.'],
  ['Sinarest Drops', 'Paracetamol + Phenylephrine + CPM', 'Centaur', 'pediatrics', '15 mL', 'Drops', 68, 4, true, 'Infant cold and fever drops.'],
  ['Dettol Antiseptic Liquid', 'Chloroxylenol', 'Reckitt', 'first-aid', '550 mL', 'Liquid', 235, 8, false, 'Wound cleaning and surface disinfection.'],
  ['Hansaplast Washproof', 'Adhesive Bandage', 'Beiersdorf', 'first-aid', '100 strips', 'Bandages', 245, 10, false, 'Waterproof dressing for small cuts.'],
  ['Soframycin Skin Cream', 'Framycetin', 'Sanofi', 'first-aid', '30 g', 'Cream', 64, 4, false, 'Antibacterial cream for cuts, burns and grazes.'],
  ['Cold Pack Instant', 'Instant Cold Compress', 'Romsons', 'first-aid', 'Single use', 'Compress', 95, 0, false, 'Immediate cold therapy for sprains.'],
  ['Nitrile Examination Gloves', 'Nitrile', 'Medline', 'surgical', 'Medium, 100 pcs', 'Gloves', 720, 6, false, 'Powder-free examination gloves.'],
  ['Surgical Face Mask 3-Ply', 'Non-woven', 'Medline', 'surgical', '50 pcs', 'Masks', 180, 5, false, 'Three-layer disposable masks.'],
  ['Digital Thermometer', 'Thermometer', 'Dr Trust', 'surgical', 'Flexible tip', 'Device', 349, 12, false, 'Fast, accurate digital temperature reading.'],
  ['Omron BP Monitor HEM-7156', 'Automatic BP Monitor', 'Omron', 'surgical', 'Upper arm', 'Device', 3290, 15, false, 'Clinically validated home blood-pressure monitor.'],
  ['Pulse Oximeter FPO-01', 'Fingertip Oximeter', 'Dr Trust', 'surgical', 'OLED display', 'Device', 1290, 18, false, 'Measures oxygen saturation and pulse rate.'],
  ['Nebulizer Compressor', 'Compressor Nebuliser', 'Philips', 'surgical', 'With mask kit', 'Device', 2450, 12, false, 'Delivers inhaled medication as a fine mist.'],
];

const MEDICINE_CATEGORIES = [
  ['pain-relief', 'Pain Relief', 'Fever, body ache, sprains and post-injury pain.'],
  ['antibiotics', 'Antibiotics', 'Prescription-only courses for bacterial infection.'],
  ['vitamins', 'Vitamins & Supplements', 'Daily nutrition, deficiency correction and recovery.'],
  ['diabetes', 'Diabetes Care', 'Oral medicines, insulin and home monitoring.'],
  ['blood-pressure', 'Heart & Blood Pressure', 'Hypertension, cholesterol and cardiac protection.'],
  ['cold-flu', 'Cold & Flu', 'Blocked nose, cough, sore throat and seasonal fever.'],
  ['gastro', 'Gastro & Digestive', 'Acidity, gas, constipation and gut health.'],
  ['dermatology', 'Skin & Hair', 'Creams, antifungals and everyday skin care.'],
  ['pediatrics', 'Child Care', 'Paediatric syrups, drops and rehydration.'],
  ['first-aid', 'First Aid', 'Antiseptics, dressings and home emergency supplies.'],
  ['surgical', 'Devices & Surgical', 'Monitors, masks, gloves and home medical devices.'],
];

const PATIENT_SEEDS = [
  ['Aarav', 'Rajesh', 'Sharma', '1991-04-18', 'male', 'B+', 'aarav.sharma@example.com', '+91 98200 41185', 'Mumbai', 'Maharashtra', '400053', 'Product Designer', 'married'],
  ['Isha', 'Kiran', 'Nair', '1996-11-02', 'female', 'O+', 'isha.nair@example.com', '+91 99860 20417', 'Bengaluru', 'Karnataka', '560066', 'Software Engineer', 'single'],
  ['Rehan', 'Imtiaz', 'Qureshi', '1984-07-25', 'male', 'A+', 'rehan.qureshi@example.com', '+91 98110 77342', 'Lucknow', 'Uttar Pradesh', '226010', 'School Principal', 'married'],
  ['Meghna', 'Suresh', 'Patil', '2001-02-14', 'female', 'AB+', 'meghna.patil@example.com', '+91 91670 55220', 'Mumbai', 'Maharashtra', '400062', 'Postgraduate Student', 'single'],
  ['Vivaan', 'Anil', 'Kulkarni', '2015-09-09', 'male', 'B-', 'vivaan.guardian@example.com', '+91 98333 66190', 'Mumbai', 'Maharashtra', '400053', 'Student', 'single'],
  ['Lakshmi', 'Gopal', 'Iyer', '1958-03-30', 'female', 'O-', 'lakshmi.iyer@example.com', '+91 90040 11288', 'Bengaluru', 'Karnataka', '560037', 'Retired Teacher', 'widowed'],
  ['Daniel', 'Joseph', 'Fernandes', '1978-12-08', 'male', 'A-', 'daniel.fernandes@example.com', '+91 98195 30021', 'Mumbai', 'Maharashtra', '400050', 'Logistics Manager', 'married'],
  ['Sana', 'Aftab', 'Merchant', '1989-06-21', 'female', 'B+', 'sana.merchant@example.com', '+91 99304 88011', 'Mumbai', 'Maharashtra', '400026', 'Chartered Accountant', 'married'],
];

const CONDITIONS = ['Type 2 Diabetes', 'Hypertension', 'Asthma', 'Hypothyroidism', 'Migraine', 'GERD', 'Anaemia', 'High Cholesterol'];
const ALLERGIES = ['Penicillin', 'Dust mites', 'Peanuts', 'Sulfa drugs', 'Pollen', 'Lactose', 'Shellfish'];
const INSURERS = ['Star Health', 'HDFC ERGO', 'Niva Bupa', 'ICICI Lombard', 'Care Health', 'Tata AIG'];

const COMPLAINTS = [
  ['Fever and body ache for three days', 'Viral fever', ['Fever 101°F', 'Generalised body ache', 'Loss of appetite']],
  ['Chest tightness on exertion', 'Stable angina — medical management', ['Chest tightness', 'Breathlessness on climbing stairs']],
  ['Recurrent headache with nausea', 'Migraine without aura', ['Throbbing headache', 'Nausea', 'Light sensitivity']],
  ['Knee pain after a fall', 'Grade I medial collateral ligament sprain', ['Knee pain', 'Swelling', 'Difficulty bending']],
  ['Routine diabetes review', 'Type 2 diabetes mellitus — controlled', ['Increased thirst', 'Fatigue in the evening']],
  ['Itchy rash on both forearms', 'Contact dermatitis', ['Itching', 'Red raised patches', 'Dryness']],
  ['Persistent dry cough at night', 'Post-viral cough with mild bronchospasm', ['Dry cough', 'Night-time wheeze']],
  ['Acidity and burning after meals', 'Gastro-oesophageal reflux disease', ['Heartburn', 'Sour belching', 'Bloating']],
  ['Blood pressure follow-up', 'Essential hypertension — well controlled', ['No symptoms', 'Occasional giddiness']],
  ['Blocked nose and facial pain', 'Acute maxillary sinusitis', ['Nasal blockage', 'Facial heaviness', 'Reduced smell']],
];

const TESTS = [
  ['Complete Blood Count', 'blood', 'Haemoglobin 13.8 g/dL, TLC 7,200 /µL, Platelets 2.4 lakh/µL', '13.0 – 17.0 g/dL', 450],
  ['HbA1c', 'blood', '6.9% — average glucose 151 mg/dL', 'Below 5.7%', 650],
  ['Lipid Profile', 'blood', 'Total 198, LDL 118, HDL 46, Triglycerides 162 mg/dL', 'LDL below 100 mg/dL', 800],
  ['Thyroid Profile (T3 T4 TSH)', 'blood', 'TSH 3.4 µIU/mL, T3 1.2 ng/mL, T4 8.1 µg/dL', 'TSH 0.4 – 4.0 µIU/mL', 700],
  ['Liver Function Test', 'blood', 'SGPT 38 U/L, SGOT 32 U/L, Bilirubin 0.9 mg/dL', 'SGPT below 45 U/L', 900],
  ['Urine Routine & Microscopy', 'urine', 'Clear, pH 6.0, no albumin, 2–3 pus cells/hpf', 'No albumin, below 5 pus cells/hpf', 300],
  ['Chest X-Ray PA View', 'x-ray', 'Clear lung fields, normal cardiac silhouette', 'Normal study', 550],
  ['ECG 12 Lead', 'ecg', 'Sinus rhythm, rate 78/min, no ST-T changes', 'Normal sinus rhythm', 400],
  ['2D Echocardiography', 'ultrasound', 'LVEF 58%, no regional wall motion abnormality', 'LVEF above 55%', 2400],
  ['Ultrasound Abdomen & Pelvis', 'ultrasound', 'Grade I fatty liver, no calculus', 'Normal echotexture', 1800],
  ['MRI Brain Plain', 'mri', 'No acute infarct, haemorrhage or space-occupying lesion', 'Normal study', 7500],
  ['CT Scan KUB Plain', 'ct', '4 mm calculus in the left lower ureter', 'No calculus', 4200],
];

const LABS = ['MediCare360 Central Lab', 'Metropolis Partner Lab', 'Thyrocare Collection Centre', 'MediCare360 Imaging Suite'];

/* ------------------------------------------------------------------- build */

export async function buildSeed() {
  const departments = DEPARTMENTS.map(([id, name, icon, summary], index) => ({
    id,
    code: `DEP-${String(index + 1).padStart(3, '0')}`,
    name,
    icon,
    summary,
    branchIds: BRANCHES.map((branch) => branch.id).slice(0, index % 3 === 2 ? 2 : 3),
  }));

  const doctors = [];
  const doctorAvailability = [];
  const doctorLeaves = [];

  DOCTORS.forEach((entry, index) => {
    const [firstName, lastName, gender, departmentId, specialization, qualification, experience, fee] = entry;
    const id = `DR-${String(index + 1).padStart(6, '0')}`;
    const department = departments.find((row) => row.id === departmentId);
    const branchIds = pickSome(BRANCHES, between(1, 2)).map((branch) => branch.id);

    doctors.push({
      id,
      firstName,
      lastName,
      name: `Dr ${firstName} ${lastName}`,
      gender: gender === 'F' ? 'female' : 'male',
      departmentId,
      departmentName: department.name,
      specialization,
      qualification,
      registrationNumber: `MCI/${2026 - experience}/${between(10000, 99999)}`,
      experience,
      consultationFee: fee,
      followUpFee: Math.round(fee * 0.4),
      languages: ['English', 'Hindi', ...pickSome(LANGUAGES.slice(2), between(1, 2))],
      branchIds,
      email: `dr.${lastName.toLowerCase()}@medicare360.in`,
      phone: `+91 ${between(70, 99)}${between(100, 999)} ${between(10000, 99999)}`,
      rating: Number((3.9 + random() * 1.05).toFixed(1)),
      ratingCount: between(48, 940),
      consultations: between(320, 6400),
      about: `${specialization} specialist at ${BRANCHES.find((branch) => branch.id === branchIds[0]).name}. ${experience} years of clinical practice with a focus on ${specialization.toLowerCase()}, evidence-based treatment and long-term follow-up.`,
      photoInitials: `${firstName[0]}${lastName[0]}`,
      acceptsOnline: chance(0.75),
      status: 'active',
    });

    // Availability is a weekly pattern; slots are generated from it on request
    // rather than stored, so a booked slot can never go stale in the file.
    const weekday = { start: '09:30', end: '13:30' };
    const evening = { start: '16:00', end: '20:00' };
    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    doctorAvailability.push({
      id: `AVL-${id}`,
      doctorId: id,
      slotMinutes: [15, 20, 30][index % 3],
      maxPerSlot: 1,
      breakStart: '13:30',
      breakEnd: '16:00',
      schedule: Object.fromEntries(
        days.map((day, dayIndex) => {
          const offDay = dayIndex === (index % 5) && dayIndex > 3;
          if (offDay) return [day, { working: false, windows: [] }];

          const windows = index % 2 === 0 ? [weekday, evening] : [{ start: '10:00', end: '14:00' }, { start: '17:00', end: '20:30' }];
          return [day, { working: true, windows: dayIndex === 5 ? [windows[0]] : windows }];
        }),
      ),
    });

    if (index % 7 === 3) {
      const from = addDays(TODAY, between(9, 24));
      doctorLeaves.push({
        id: `LV-${String(doctorLeaves.length + 1).padStart(6, '0')}`,
        doctorId: id,
        from,
        to: addDays(from, between(1, 4)),
        reason: pick(['Conference — annual scientific session', 'Personal leave', 'Surgical camp at partner hospital']),
        status: 'approved',
        createdAt: at(addDays(TODAY, -between(3, 20)), '10:00'),
      });
    }
  });

  const medicines = MEDICINES.map((entry, index) => {
    const [name, genericName, manufacturer, category, strength, form, price, discount, prescriptionRequired, description] = entry;
    const stock = index % 11 === 4 ? 0 : between(12, 480);

    return {
      id: `MED-${String(index + 1).padStart(6, '0')}`,
      name,
      genericName,
      brand: manufacturer,
      manufacturer,
      category,
      categoryName: MEDICINE_CATEGORIES.find((row) => row[0] === category)[1],
      strength,
      form,
      price,
      mrp: Math.round(price / (1 - discount / 100)),
      discount,
      stock,
      packSize: form === 'Tablet' || form === 'Capsule' ? `Strip of ${pick([10, 15, 20])}` : '1 unit',
      expiryDate: addDays(TODAY, between(180, 900)),
      prescriptionRequired,
      description,
      rating: Number((3.8 + random() * 1.1).toFixed(1)),
      ratingCount: between(24, 1800),
    };
  });

  /* ---------------------------------------------------------- people */

  const passwordHash = await hashPassword(config.demoPassword);
  const users = [];
  const patients = [];
  const familyMembers = [];
  const addresses = [];

  PATIENT_SEEDS.forEach((entry, index) => {
    const [firstName, middleName, lastName, dob, gender, bloodGroup, email, phone, city, state, pincode, occupation, maritalStatus] = entry;
    const id = `PT-${String(index + 1).padStart(6, '0')}`;
    const age = ageFrom(dob);
    const minor = age < 18;
    const branch = BRANCHES.find((row) => row.city === city) ?? BRANCHES[0];

    const patient = {
      id,
      firstName,
      middleName,
      lastName,
      name: `${firstName} ${lastName}`,
      dateOfBirth: dob,
      age,
      gender,
      bloodGroup,
      email,
      mobile: phone,
      address: `${between(101, 1204)}, ${pick(['Sunrise Residency', 'Green Meadows', 'Palm Court', 'Silver Oak Apartments'])}, ${pick(['Link Road', 'MG Road', 'Station Road', 'Hill View Lane'])}`,
      city,
      state,
      country: 'India',
      pincode,
      emergencyContact: `+91 ${between(70, 99)}${between(100, 999)} ${between(10000, 99999)}`,
      emergencyContactName: pick(['Rajesh Sharma', 'Kiran Nair', 'Fatima Qureshi', 'Suresh Patil', 'Anil Kulkarni', 'Gopal Iyer']),
      emergencyContactRelationship: pick(['Spouse', 'Father', 'Mother', 'Brother', 'Sister']),
      guardianName: minor ? 'Anil Kulkarni' : '',
      guardianMobile: minor ? '+91 98333 66190' : '',
      guardianRelationship: minor ? 'Father' : '',
      maritalStatus,
      occupation,
      conditions: minor ? [] : pickSome(CONDITIONS, between(0, 2)),
      allergies: pickSome(ALLERGIES, between(0, 2)),
      currentMedicines: [],
      previousHospital: chance(0.4) ? pick(['Lilavati Hospital', 'Fortis Hospital', 'Apollo Hospitals', 'Manipal Hospital']) : '',
      insuranceProvider: chance(0.7) ? pick(INSURERS) : '',
      insuranceNumber: '',
      preferredBranchId: branch.id,
      registeredAt: at(addDays(TODAY, -between(120, 900)), '11:20'),
      status: 'active',
    };

    if (patient.insuranceProvider) {
      patient.insuranceNumber = `${patient.insuranceProvider.split(' ')[0].toUpperCase()}-${between(100000, 999999)}`;
    }

    patients.push(patient);

    users.push({
      id: `USR-${String(users.length + 1).padStart(6, '0')}`,
      email,
      passwordHash,
      role: 'patient',
      name: patient.name,
      profileId: id,
      status: 'active',
      createdAt: patient.registeredAt,
    });

    addresses.push({
      id: `ADR-${String(addresses.length + 1).padStart(6, '0')}`,
      ownerId: id,
      label: 'Home',
      name: patient.name,
      phone: patient.mobile,
      line1: patient.address,
      city,
      state,
      pincode,
      landmark: pick(['Opposite the metro station', 'Near City Mall', 'Behind the post office']),
      isDefault: true,
    });
  });

  // The first patient is the demo account, so give them a full family.
  const primary = patients[0];
  [
    ['Diya', 'Sharma', 'Daughter', '2017-05-22', 'female', 'B+'],
    ['Ritika', 'Sharma', 'Spouse', '1993-08-30', 'female', 'O+'],
    ['Rajesh', 'Sharma', 'Father', '1962-01-17', 'male', 'A+'],
  ].forEach(([firstName, lastName, relationship, dob, gender, bloodGroup], index) => {
    const age = ageFrom(dob);

    familyMembers.push({
      id: `FM-${String(index + 1).padStart(6, '0')}`,
      patientId: primary.id,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      relationship,
      dateOfBirth: dob,
      age,
      gender,
      bloodGroup,
      mobile: age >= 18 ? `+91 ${between(70, 99)}${between(100, 999)} ${between(10000, 99999)}` : '',
      conditions: age > 60 ? ['Hypertension'] : [],
      allergies: index === 0 ? ['Dust mites'] : [],
      guardianName: age < 18 ? primary.name : '',
      guardianMobile: age < 18 ? primary.mobile : '',
      guardianRelationship: age < 18 ? 'Father' : '',
      createdAt: at(addDays(TODAY, -between(60, 400)), '09:00'),
    });
  });

  doctors.forEach((doctor, index) => {
    users.push({
      id: `USR-${String(users.length + 1).padStart(6, '0')}`,
      email: doctor.email,
      passwordHash,
      role: 'doctor',
      name: doctor.name,
      profileId: doctor.id,
      status: 'active',
      createdAt: at(addDays(TODAY, -between(200, 1200)), '08:00'),
    });
    void index;
  });

  users.push(
    {
      id: `USR-${String(users.length + 1).padStart(6, '0')}`,
      email: 'admin@medicare360.in',
      passwordHash,
      role: 'admin',
      name: 'Reception Desk — Andheri',
      profileId: 'BR-000001',
      status: 'active',
      createdAt: at(addDays(TODAY, -900), '08:00'),
    },
    {
      id: `USR-${String(users.length + 2).padStart(6, '0')}`,
      email: 'pharmacy@medicare360.in',
      passwordHash,
      role: 'pharmacy',
      name: 'MediCare360 Pharmacy',
      profileId: 'BR-000001',
      status: 'active',
      createdAt: at(addDays(TODAY, -900), '08:00'),
    },
  );

  /* ----------------------------------------------- clinical timeline */

  const appointments = [];
  const consultations = [];
  const prescriptions = [];
  const medicalRecords = [];
  const medicalReports = [];
  const testRequests = [];
  const payments = [];
  const notifications = [];

  let counters = { ap: 0, cn: 0, rx: 0, mr: 0, rp: 0, tr: 0, pay: 0, nt: 0 };
  const seq = (key, prefix, dated, date) =>
    dated
      ? `${prefix}-${date.replaceAll('-', '')}-${String((counters[key] += 1)).padStart(4, '0')}`
      : `${prefix}-${String((counters[key] += 1)).padStart(6, '0')}`;

  // Past visits, today's clinic and upcoming bookings, oldest first.
  const plan = [
    ...Array.from({ length: 26 }, () => -between(4, 150)),
    ...Array.from({ length: 9 }, () => 0),
    ...Array.from({ length: 14 }, () => between(1, 21)),
  ].sort((a, b) => a - b);

  plan.forEach((offset, index) => {
    const date = addDays(TODAY, offset);
    // The demo patient gets a third of the book so their history reads richly.
    const patient = index % 3 === 0 ? primary : patients[between(1, patients.length - 1)];

    // Today's clinic is loaded onto the demo doctor rather than spread thin
    // across two dozen of them, so the queue screen has a real queue in it.
    const doctor = offset === 0 && index % 4 !== 3 ? doctors[0] : doctors[index % doctors.length];
    const branchId = doctor.branchIds[0];
    const time = ['09:30', '10:00', '10:30', '11:15', '12:00', '16:30', '17:15', '18:00', '19:00'][index % 9];
    const [complaint, diagnosis, symptoms] = COMPLAINTS[index % COMPLAINTS.length];
    const consultationType = chance(0.28) ? 'online' : 'in-person';
    const followUp = offset < 0 && chance(0.35);
    const fee = followUp ? doctor.followUpFee : doctor.consultationFee;

    let status;
    if (offset < 0) status = chance(0.12) ? pick(['cancelled', 'no-show']) : 'completed';
    else if (offset === 0) status = ['in-consultation', 'checked-in', 'confirmed', 'confirmed', 'completed'][index % 5];
    else status = chance(0.15) ? 'pending' : 'confirmed';

    const appointmentId = seq('ap', 'AP', true, date);
    const charges = billFor(fee, patient.insuranceProvider);
    const paid = status !== 'pending' && status !== 'cancelled';

    const payment = {
      id: seq('pay', 'PAY', false),
      transactionId: `TXN${between(10, 99)}${Date.parse(`${date}T00:00:00`).toString().slice(-8)}${index}`,
      kind: 'consultation',
      referenceId: appointmentId,
      patientId: patient.id,
      doctorId: doctor.id,
      amount: charges.total,
      breakdown: charges,
      method: paid ? pick(['upi', 'credit-card', 'debit-card', 'net-banking', 'wallet', 'insurance']) : 'upi',
      status: status === 'cancelled' ? 'refunded' : paid ? 'successful' : 'pending',
      paidAt: paid ? at(date, time) : null,
      createdAt: at(date, '08:00'),
    };

    payments.push(payment);

    const appointment = {
      id: appointmentId,
      patientId: patient.id,
      patientName: patient.name,
      doctorId: doctor.id,
      doctorName: doctor.name,
      departmentId: doctor.departmentId,
      departmentName: doctor.departmentName,
      branchId,
      date,
      time,
      endTime: addMinutes(time, 20),
      consultationType,
      visitType: followUp ? 'follow-up' : 'new',
      reason: complaint,
      status,
      paymentId: payment.id,
      paymentStatus: payment.status,
      fee,
      token: offset === 0 ? index + 1 : null,
      queueStatus:
        offset === 0
          ? { confirmed: 'waiting', 'checked-in': 'waiting', 'in-consultation': 'in-consultation', completed: 'completed' }[status] ?? 'waiting'
          : null,
      checkedInAt: offset === 0 && status !== 'confirmed' ? at(date, addMinutes(time, -15)) : null,
      consultationId: null,
      createdAt: at(addDays(date, -between(1, 12)), '20:10'),
      updatedAt: at(date, time),
    };

    appointments.push(appointment);

    if (status !== 'completed') {
      notifications.push(
        notify(patient.id, 'patient', 'appointment', 'Appointment confirmed', `${doctor.name} on ${prettyDate(date)} at ${time}.`, `/patient/appointments/${appointmentId}`, offset <= 0, appointment.createdAt),
      );
      return;
    }

    /* A completed visit fans out into the rest of the record. */
    const consultationId = seq('cn', 'CN', false);
    const vitals = {
      heightCm: between(150, 184),
      weightKg: between(48, 92),
      temperatureF: Number((97.4 + random() * 3.2).toFixed(1)),
      pulse: between(64, 98),
      systolic: between(108, 146),
      diastolic: between(68, 94),
      spo2: between(95, 99),
      sugarMgDl: between(88, 168),
    };

    const medicineLines = pickSome(medicines.filter((row) => row.stock > 0), between(2, 4)).map((medicine) => ({
      medicineId: medicine.id,
      name: medicine.name,
      genericName: medicine.genericName,
      strength: medicine.strength,
      form: medicine.form,
      dosage: medicine.form === 'Syrup' ? '5 mL' : '1 ' + medicine.form.toLowerCase(),
      frequency: pick(['Once daily', 'Twice daily', 'Thrice daily', 'Every 8 hours', 'At bedtime']),
      duration: `${pick([3, 5, 7, 10, 14, 30])} days`,
      timing: pick(['After food', 'Before food', 'With food']),
      route: medicine.form === 'Injection' ? 'Intravenous' : medicine.form === 'Cream' || medicine.form === 'Gel' ? 'Topical' : 'Oral',
      instructions: pick(['Complete the full course.', 'Stop if a rash appears and call the clinic.', 'Take with a full glass of water.', 'Do not skip a dose.']),
    }));

    const prescriptionId = seq('rx', 'RX', false);
    const followUpDate = addDays(date, pick([7, 14, 21, 30]));

    prescriptions.push({
      id: prescriptionId,
      appointmentId,
      consultationId,
      patientId: patient.id,
      patientName: patient.name,
      doctorId: doctor.id,
      doctorName: doctor.name,
      departmentName: doctor.departmentName,
      diagnosis,
      medicines: medicineLines,
      advice: pick(['Drink 3 litres of water a day.', 'Avoid oily food for a week.', 'Thirty minutes of walking daily.', 'Return sooner if symptoms worsen.']),
      issuedAt: at(date, time),
      followUpDate,
      dispensed: chance(0.4),
      status: 'active',
    });

    const requestedTests = chance(0.55) ? pickSome(TESTS, between(1, 2)) : [];
    const reportIds = [];

    requestedTests.forEach((test) => {
      const [testName, category, result, referenceRange, price] = test;
      const testId = seq('tr', 'TR', false);
      const reportReady = chance(0.8);

      testRequests.push({
        id: testId,
        appointmentId,
        consultationId,
        patientId: patient.id,
        patientName: patient.name,
        doctorId: doctor.id,
        doctorName: doctor.name,
        testName,
        category,
        priority: chance(0.2) ? 'urgent' : 'routine',
        clinicalReason: `Evaluate ${diagnosis.toLowerCase()}`,
        notes: '',
        price,
        status: reportReady ? 'report-available' : pick(['requested', 'sample-collected', 'processing']),
        requestedAt: at(date, time),
      });

      if (!reportReady) return;

      const reportId = seq('rp', 'RP', false);
      reportIds.push(reportId);

      medicalReports.push({
        id: reportId,
        testRequestId: testId,
        appointmentId,
        patientId: patient.id,
        patientName: patient.name,
        doctorId: doctor.id,
        doctorName: doctor.name,
        testName,
        category,
        lab: pick(LABS),
        collectedOn: addDays(date, 1),
        reportedOn: addDays(date, 2),
        result,
        referenceRange,
        status: chance(0.75) ? 'normal' : 'attention',
        labComments: chance(0.5) ? 'Sample adequate. Correlate clinically.' : '',
        doctorComments: chance(0.6) ? 'Reviewed. Continue the current plan.' : '',
        price,
      });
    });

    consultations.push({
      id: consultationId,
      appointmentId,
      patientId: patient.id,
      doctorId: doctor.id,
      departmentId: doctor.departmentId,
      date,
      startedAt: at(date, time),
      completedAt: at(date, addMinutes(time, between(12, 28))),
      chiefComplaint: complaint,
      symptoms,
      examination: pick(['Chest clear, S1 S2 heard, no added sounds.', 'Throat congested, no exudate. Chest clear.', 'Abdomen soft, no tenderness or organomegaly.', 'Full range of movement, mild local tenderness.']),
      vitals,
      diagnosis,
      treatmentPlan: pick(['Symptomatic treatment with review in a week.', 'Continue current medication, recheck after tests.', 'Rest, physiotherapy and analgesia as prescribed.', 'Lifestyle change plus the prescription below.']),
      notes: pick(['Patient counselled about warning signs.', 'Discussed diet and activity in detail.', 'No red-flag symptoms at this visit.']),
      prescriptionId,
      testRequestIds: requestedTests.length ? testRequests.slice(-requestedTests.length).map((row) => row.id) : [],
      followUpDate,
      followUpReason: `Review of ${diagnosis.toLowerCase()}`,
      status: 'completed',
    });

    appointment.consultationId = consultationId;

    medicalRecords.push({
      id: seq('mr', 'MR', false),
      patientId: patient.id,
      appointmentId,
      consultationId,
      prescriptionId,
      reportIds,
      doctorId: doctor.id,
      doctorName: doctor.name,
      departmentName: doctor.departmentName,
      branchId,
      visitDate: date,
      visitType: appointment.visitType,
      diagnosis,
      symptoms,
      treatment: pick(['Oral medication', 'Medication with physiotherapy', 'Medication and lifestyle advice']),
      notes: `Seen at ${BRANCHES.find((row) => row.id === branchId).name}.`,
      followUpDate,
    });

    notifications.push(
      notify(patient.id, 'patient', 'prescription', 'Prescription ready', `${doctor.name} issued prescription ${prescriptionId}.`, `/patient/prescriptions/${prescriptionId}`, true, at(date, addMinutes(time, 25))),
    );

    if (reportIds.length) {
      notifications.push(
        notify(patient.id, 'patient', 'report', 'Report available', `${requestedTests[0][0]} results are ready to view.`, `/patient/reports/${reportIds[0]}`, chance(0.5), at(addDays(date, 2), '11:00')),
      );
    }
  });

  /* --------------------------------------------------- pharmacy orders */

  const medicineOrders = [];
  const orderStages = ['placed', 'confirmed', 'preparing', 'out-for-delivery', 'delivered'];

  for (let index = 0; index < 9; index += 1) {
    const patient = index % 2 === 0 ? primary : patients[between(1, patients.length - 1)];
    const placedOffset = -between(0, 40);
    const date = addDays(TODAY, placedOffset);
    const lines = pickSome(medicines.filter((row) => row.stock > 0), between(1, 4)).map((medicine) => ({
      medicineId: medicine.id,
      name: medicine.name,
      strength: medicine.strength,
      form: medicine.form,
      price: medicine.price,
      mrp: medicine.mrp,
      quantity: between(1, 3),
      prescriptionRequired: medicine.prescriptionRequired,
    }));

    const itemsTotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
    const bill = orderBill(itemsTotal);
    const stage = placedOffset < -3 ? 'delivered' : orderStages[Math.min(orderStages.length - 1, Math.abs(placedOffset))];
    const address = addresses.find((row) => row.ownerId === patient.id) ?? addresses[0];
    const needsRx = lines.some((line) => line.prescriptionRequired);
    const patientRx = prescriptions.find((row) => row.patientId === patient.id);
    const orderId = `ORD-${String(index + 1).padStart(6, '0')}`;

    const payment = {
      id: seq('pay', 'PAY', false),
      transactionId: `TXN${between(10, 99)}${Date.parse(`${date}T00:00:00`).toString().slice(-8)}P${index}`,
      kind: 'pharmacy',
      referenceId: orderId,
      patientId: patient.id,
      doctorId: null,
      amount: bill.total,
      breakdown: bill,
      method: pick(['upi', 'credit-card', 'wallet', 'net-banking']),
      status: 'successful',
      paidAt: at(date, '12:30'),
      createdAt: at(date, '12:28'),
    };

    payments.push(payment);

    medicineOrders.push({
      id: orderId,
      patientId: patient.id,
      patientName: patient.name,
      lines,
      bill,
      address,
      prescriptionId: needsRx ? (patientRx?.id ?? null) : null,
      prescriptionStatus: needsRx ? (patientRx ? 'verified' : 'pending') : 'not-required',
      paymentId: payment.id,
      paymentStatus: 'successful',
      stage,
      timeline: orderStages.slice(0, orderStages.indexOf(stage) + 1).map((step, stepIndex) => ({
        stage: step,
        at: at(date, addMinutes('12:35', stepIndex * 45)),
      })),
      deliverySlot: 'Today, 6 – 9 pm',
      placedAt: at(date, '12:35'),
    });

    notifications.push(
      notify(patient.id, 'patient', 'order', stage === 'delivered' ? 'Order delivered' : 'Order confirmed', `Order ${orderId} · ${lines.length} item${lines.length > 1 ? 's' : ''} · ₹${bill.total}.`, `/patient/pharmacy/orders/${orderId}`, stage === 'delivered', at(date, '12:36')),
    );
  }

  /* ---------------------------------------------------- notifications */

  doctors.slice(0, 6).forEach((doctor) => {
    const next = appointments.find((row) => row.doctorId === doctor.id && row.date >= TODAY);
    if (!next) return;

    notifications.push(
      notify(doctor.id, 'doctor', 'appointment', 'New appointment', `${next.patientName} · ${prettyDate(next.date)} at ${next.time}.`, `/doctor/appointments/${next.id}`, false, next.createdAt),
    );
  });

  notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      generatedFor: TODAY,
      version: 1,
      note: 'Demo data. Regenerate with `npm run seed` in the server folder.',
    },
    users,
    patients,
    familyMembers,
    addresses,
    hospitalBranches: BRANCHES,
    departments,
    doctors,
    doctorAvailability,
    doctorLeaves,
    appointments,
    consultations,
    prescriptions,
    medicines,
    medicineCategories: MEDICINE_CATEGORIES.map(([id, name, summary]) => ({ id, name, summary })),
    medicineOrders,
    medicalRecords,
    medicalReports,
    testRequests,
    payments,
    notifications,
    coupons: [
      { code: 'FIRSTCARE', label: '15% off your first pharmacy order', percent: 15, maxDiscount: 250, minOrder: 499, appliesTo: 'pharmacy' },
      { code: 'HEALTH100', label: 'Flat ₹100 off medicines above ₹899', flat: 100, minOrder: 899, appliesTo: 'pharmacy' },
      { code: 'CONSULT10', label: '10% off a consultation fee', percent: 10, maxDiscount: 200, minOrder: 0, appliesTo: 'consultation' },
    ],
  };
}

/* ---------------------------------------------------------------- helpers */

let notificationCounter = 0;

function notify(ownerId, audience, kind, title, body, link, read, createdAt) {
  notificationCounter += 1;

  return {
    id: `NT-${String(notificationCounter).padStart(6, '0')}`,
    ownerId,
    audience,
    kind,
    title,
    body,
    link,
    read,
    createdAt,
  };
}

/* Allow `node src/db/seed.js --force` to rewrite the file from the CLI. */
const { pathToFileURL } = await import('node:url');

// `pathToFileURL` rather than string concatenation: a Windows path produces
// `file:///D:/...`, which a hand-built `file://` prefix would never match.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { writeFile, mkdir } = await import('node:fs/promises');
  const { dirname } = await import('node:path');

  const db = await buildSeed();
  await mkdir(dirname(config.dbFile), { recursive: true });
  await writeFile(config.dbFile, JSON.stringify(db, null, 2), 'utf8');

  const counts = Object.entries(db)
    .filter(([, rows]) => Array.isArray(rows))
    .map(([name, rows]) => `${name}: ${rows.length}`)
    .join(', ');

  console.log(`Seeded ${config.dbFile}\n${counts}`);
}
