export interface DoctorEmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface DoctorPatient {
  _id: string;
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth?: string;
  room?: string;
  primaryDiagnosis?: string;
  secondaryDiagnoses?: string[];
  allergies?: string[];
  medications?: string[];
  emergencyContact?: DoctorEmergencyContact;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface DoctorAnswerItem {
  question: string;
  answer: string;
}

export interface CallSessionClassification {
  type: string;
  short_followup: string;
  reason: string;
}

export interface CallSessionHistoryEntry {
  question: string;
  transcript: string;
  classification: CallSessionClassification;
}

export interface CallSessionConfig {
  questions: string[];
  greeting: string;
}

export interface DoctorCallSession {
  _id: string;
  patient_id?: string;
  resident_id?: string;
  trigger_type?: string;
  status: string;
  call_status?: string;
  raw_transcript?: string;
  call_config?: CallSessionConfig;
  transcript_lines?: string[];
  questions_asked: string[];
  answers: DoctorAnswerItem[];
  history?: CallSessionHistoryEntry[];
  greeting_used?: string;
  greeting_notes?: string;
  call_sid?: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
  ended_at?: string;
}

export interface CreateDoctorPatientInput {
  firstName: string;
  lastName: string;
  phone: string;
}

export interface StartDoctorCallInput {
  patient_id: string;
  questions: string[];
}

export interface StartDoctorCallResponse {
  message: string;
  call_sid: string;
  session_id: string;
}
