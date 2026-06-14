/**
 * Parser del formato testo "COPY ... FROM stdin" di PostgreSQL (pg_dump).
 * Trasforma il dump in blocchi tabella → righe (oggetti colonna→valore).
 * Nessuna dipendenza dal database: è pura manipolazione di stringhe.
 */

export interface CopyBlock {
  table: string
  columns: string[]
  rows: Array<Record<string, string | null>>
}

/** Estrae i nomi colonna dall'intestazione COPY: (id, "studentId", tipo) → ['id','studentId','tipo'] */
function parseColumns(header: string): string[] {
  const inside = header.slice(header.indexOf('(') + 1, header.lastIndexOf(')'))
  return inside.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
}

/** Decodifica le sequenze di escape del formato COPY in un singolo campo. \N resta gestito a monte. */
function unescapeField(raw: string): string {
  let out = ''
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === '\\' && i + 1 < raw.length) {
      const next = raw[++i]
      switch (next) {
        case 'n': out += '\n'; break
        case 't': out += '\t'; break
        case 'r': out += '\r'; break
        case 'b': out += '\b'; break
        case 'f': out += '\f'; break
        case 'v': out += '\v'; break
        case '\\': out += '\\'; break
        default: out += next
      }
    } else {
      out += ch
    }
  }
  return out
}

/** Legge tutto il dump e restituisce una mappa nome-tabella → blocco COPY. */
export function parseDump(sql: string): Map<string, CopyBlock> {
  const lines = sql.split('\n')
  const blocks = new Map<string, CopyBlock>()

  let current: CopyBlock | null = null
  for (const line of lines) {
    if (current === null) {
      if (line.startsWith('COPY public.')) {
        const table = line.slice('COPY public.'.length).split(/[\s(]/)[0]
        current = { table, columns: parseColumns(line), rows: [] }
      }
      continue
    }
    // Dentro un blocco COPY: la riga "\." chiude il blocco.
    if (line === '\\.') {
      blocks.set(current.table, current)
      current = null
      continue
    }
    const fields = line.split('\t')
    const row: Record<string, string | null> = {}
    current.columns.forEach((col, idx) => {
      const f = fields[idx]
      row[col] = f === '\\N' || f === undefined ? null : unescapeField(f)
    })
    current.rows.push(row)
  }
  return blocks
}
