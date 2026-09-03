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

export interface ExamQrPayload {
  app: 'gestore-esami'
  v: 1
  courseId: string
  appelloId: string
}
