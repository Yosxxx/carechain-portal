export type Rec = {
  seq: number;
  pda: string;
  cidEnc: string;
  metaCid: string;
  hospital: string;
  sizeBytes: number;
  createdAt: string;
  hospital_name: string;
  doctor_name: string;
  diagnosis: string;
  keywords: string;
  description: string;
  txSignature?: string;
};

export type MedicalRecordIntake = {
  patient_pubkey: string;
  hospital_pubkey: string | null;
  hospital_name: string | null;
  doctor_name: string;
  diagnosis: string;
  keywords: string;
  description: string;
};

export type HospitalData = {
  name: string;
  authority_pubkey: string;
};
