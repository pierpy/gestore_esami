export interface ParsedStudentRow {
  matricola: string | null
  cognome: string
  nome: string
  /** Voto letto dalla colonna "Esito" dell'export Esse3, se presente e valorizzata. */
  voto: { punteggio: number; lode: boolean } | null
  esitoRaw: string
}

const HEADER_COLUMNS = ['Matricola', 'Cognome', 'Nome']

function toTitleCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Interpreta la colonna "Esito" dell'export Esse3 (voto in trentesimi):
 * 31 = 30 e lode, ASS = assente, RIT = ritirato, 0 = insufficiente, numerico = voto.
 * Ritorna null quando non c'è un voto numerico da importare (assente/ritirato/vuoto).
 */
function parseEsito(raw: string): { punteggio: number; lode: boolean } | null {
  const value = raw.trim().toUpperCase()
  if (!value || value === 'ASS' || value === 'RIT') return null
  const num = Number(value.replace(',', '.'))
  if (Number.isNaN(num)) return null
  if (num >= 31) return { punteggio: 30, lode: true }
  return { punteggio: num, lode: false }
}

/** Legge un export "Elenco Studenti Iscritti all'Appello" di Esse3 (.xls/.xlsx). */
export async function parseEsse3Roster(file: File): Promise<ParsedStudentRow[]> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' })

  const headerRowIndex = rows.findIndex((row) =>
    HEADER_COLUMNS.every((col) => row.some((cell) => String(cell).trim() === col))
  )
  if (headerRowIndex === -1) {
    throw new Error(
      'Formato non riconosciuto: non trovo le colonne Matricola/Cognome/Nome. Verifica che sia un export "Elenco Studenti Iscritti all\'Appello" di Esse3.'
    )
  }

  const headerRow = rows[headerRowIndex].map((c) => String(c).trim())
  const colMatricola = headerRow.indexOf('Matricola')
  const colCognome = headerRow.indexOf('Cognome')
  const colNome = headerRow.indexOf('Nome')
  const colEsito = headerRow.indexOf('Esito')

  const result: ParsedStudentRow[] = []
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    const cognome = (row[colCognome] ?? '').toString().trim()
    const nome = (row[colNome] ?? '').toString().trim()
    if (!cognome || !nome) continue
    const matricolaRaw = (row[colMatricola] ?? '').toString().trim()
    const esitoRaw = colEsito >= 0 ? (row[colEsito] ?? '').toString() : ''
    result.push({
      matricola: matricolaRaw || null,
      cognome: toTitleCase(cognome),
      nome: toTitleCase(nome),
      voto: parseEsito(esitoRaw),
      esitoRaw: esitoRaw.trim(),
    })
  }
  return result
}
