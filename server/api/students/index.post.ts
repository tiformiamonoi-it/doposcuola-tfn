import { z } from 'zod'
import { CreateStudentSchema } from '#shared/schemas/student.schema'
import { doppioneMoltoProbabile } from '#shared/doppioni'
import { createStudent } from '../../services/student.service'
import { cercaAlunniSimili } from '../../services/doppioni.service'

// Rete di sicurezza sui doppioni (D3). Il controllo vero lo fa il wizard prima di
// arrivare qui, con una finestra che spiega e lascia scegliere; ma quella finestra
// si può saltare (pagina riaperta, chiamata diretta, e domani magari un altro modo
// di creare alunni), e un alunno nato due volte costa mesi di lezioni e pagamenti
// finiti su due schede. Quindi: se chi chiama NON ha già confermato e il caso è
// molto probabile (stesso nome e cognome PIÙ un recapito uguale), si risponde 409
// con l'elenco dei sospetti invece di creare. Con `confermaDoppione: true` si crea
// e basta — perché due omonimi veri esistono, e la decisione resta di chi sa.
const ConfermaSchema = z.object({
  confermaDoppione: z.boolean().optional().default(false),
})

// POST /api/students
// Crea un nuovo studente dopo validazione Zod
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role === 'TUTOR') {
    throw createError({ statusCode: 403, statusMessage: 'I Tutor non possono creare nuovi studenti' })
  }

  const body = await readBody(event)
  const parsed = CreateStudentSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati studente non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  // Letto a parte dall'anagrafica: `confermaDoppione` è una risposta a una
  // domanda, non un dato dell'alunno, e sulla sua scheda non deve finire.
  // Se arriva scritto in un modo che non si capisce vale "non confermato": nel
  // dubbio si controlla, non si crea.
  const conferma = ConfermaSchema.safeParse(body)
  const confermaDoppione = conferma.success && conferma.data.confermaDoppione

  if (!confermaDoppione) {
    const d = parsed.data
    const { alunni } = await cercaAlunniSimili({
      firstName: d.firstName,
      lastName:  d.lastName,
      telefoni:  [d.parentPhone, d.parent2Phone, d.studentPhone],
      emails:    [d.parentEmail, d.parent2Email, d.studentEmail],
    })
    const sospetti = alunni.filter(doppioneMoltoProbabile)

    if (sospetti.length > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Esiste già un alunno che somiglia a questo',
        data: { doppioni: sospetti },
      })
    }
  }

  const student = await createStudent(parsed.data)

  setResponseStatus(event, 201)
  return { data: student }
})
