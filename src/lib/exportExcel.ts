import { computeMedia } from './grades'
import type { Appello, Course, Grade, Student } from '../types'

function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31)
  return cleaned || 'Foglio1'
}

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, ' ').trim()
}

/** Esporta i voti di un appello (uno studente per riga, con media calcolata) in un file .xlsx. */
export async function exportAppelloToExcel(
  course: Course,
  appello: Appello,
  students: Student[],
  gradeByStudent: Map<string, Grade>
) {
  const XLSX = await import('xlsx')

  const rows = students.map((s) => {
    const g = gradeByStudent.get(s.id)
    const scritto = g?.voto_scritto ?? null
    const orale = g?.voto_orale ?? null
    const media = computeMedia(scritto, orale)
    return {
      Matricola: s.matricola ?? '',
      Cognome: s.cognome,
      Nome: s.nome,
      'Voto scritto': scritto ?? '',
      Lode: g?.lode ? 'X' : '',
      'Voto orale': orale ?? '',
      Media: media ?? '',
    }
  })

  const sheet = XLSX.utils.json_to_sheet(rows)
  sheet['!cols'] = [
    { wch: 12 },
    { wch: 20 },
    { wch: 20 },
    { wch: 12 },
    { wch: 7 },
    { wch: 12 },
    { wch: 9 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, sanitizeSheetName(appello.nome))

  const filename = `${sanitizeFileName(course.nome)} - ${sanitizeFileName(appello.nome)}.xlsx`
  XLSX.writeFile(workbook, filename)
}
