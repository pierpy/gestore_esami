export interface Course {
  id: string
  user_id: string
  nome: string
  anno_accademico: string
  created_at: string
}

export interface Appello {
  id: string
  course_id: string
  nome: string
  data: string
  mcq_num_domande: number | null
  mcq_num_opzioni: number
  created_at: string
}

export interface Student {
  id: string
  course_id: string
  matricola: string | null
  cognome: string
  nome: string
  created_at: string
}

export interface Grade {
  id: string
  appello_id: string
  student_id: string
  voto_scritto: number | null
  lode: boolean
  voto_orale: number | null
  note: string | null
  scansionato: boolean
  created_at: string
  updated_at: string
}

export interface GradeWithStudent extends Grade {
  student: Student
}

// QR "appello": identifica corso+appello, usato sul template generico
// (fallback per studenti senza ancora un'etichetta personale).
export interface AppelloQrPayload {
  app: 'gestore-esami'
  v: 2
  kind: 'appello'
  courseId: string
  appelloId: string
}

// QR "studente": identifica corso+studente in modo permanente, riutilizzabile
// per tutti gli appelli del corso — nessuna scrittura a mano da leggere.
export interface StudentQrPayload {
  app: 'gestore-esami'
  v: 2
  kind: 'studente'
  courseId: string
  studentId: string
}

export type ExamQrPayload = AppelloQrPayload | StudentQrPayload

// Compat: i QR stampati prima dell'introduzione di "kind" (v1) avevano solo
// courseId+appelloId senza il campo kind.
export interface LegacyAppelloQrPayload {
  app: 'gestore-esami'
  v: 1
  courseId: string
  appelloId: string
}
