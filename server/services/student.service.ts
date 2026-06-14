import { db } from '../database/client'
import { students } from '../database/schema'
import { and, asc, count, desc, eq, ilike, or } from 'drizzle-orm'
import type { CreateStudentInput, StudentQuery, UpdateStudentInput } from '../../shared/schemas/student.schema'

// Mappa i valori sortBy (dalla query) alle colonne Drizzle
const SORT_COLUMNS = {
  lastName:  students.lastName,
  firstName: students.firstName,
  createdAt: students.createdAt,
} as const

// ─────────────────────────────────────────────
// LIST  — GET /api/students
// ─────────────────────────────────────────────

export async function listStudents(query: StudentQuery) {
  const where = and(
    query.active !== undefined
      ? eq(students.active, query.active === 'true')
      : undefined,
    query.classe
      ? eq(students.classe, query.classe)
      : undefined,
    query.search
      ? or(
          ilike(students.lastName,   `%${query.search}%`),
          ilike(students.firstName,  `%${query.search}%`),
          ilike(students.parentEmail, `%${query.search}%`),
        )
      : undefined,
  )

  const sortCol = SORT_COLUMNS[query.sortBy as keyof typeof SORT_COLUMNS] ?? students.lastName
  const orderBy = query.sortDir === 'desc' ? desc(sortCol) : asc(sortCol)

  const [rows, [countRow]] = await Promise.all([
    db.select().from(students)
      .where(where)
      .orderBy(orderBy)
      .limit(query.limit)
      .offset((query.page - 1) * query.limit),
    db.select({ total: count() }).from(students).where(where),
  ])

  return {
    data: rows,
    meta: {
      page:       query.page,
      limit:      query.limit,
      total:      countRow!.total,
      totalPages: Math.ceil(countRow!.total / query.limit),
    },
  }
}

// ─────────────────────────────────────────────
// GET ONE  — GET /api/students/:id
// ─────────────────────────────────────────────

export async function getStudentById(id: string) {
  const [student] = await db.select().from(students).where(eq(students.id, id)).limit(1)
  return student ?? null
}

// ─────────────────────────────────────────────
// CREATE  — POST /api/students
// ─────────────────────────────────────────────

export async function createStudent(data: CreateStudentInput) {
  const [created] = await db.insert(students).values({
    firstName:       data.firstName,
    lastName:        data.lastName,
    classe:          data.classe          ?? null,
    scuola:          data.scuola          ?? null,
    studentPhone:    data.studentPhone    ?? null,
    studentEmail:    data.studentEmail    ?? null,
    parentName:      data.parentName      ?? null,
    parentEmail:     data.parentEmail     ?? null,
    parentPhone:     data.parentPhone     ?? null,
    parentIndirizzo: data.parentIndirizzo ?? null,
    parentCitta:     data.parentCitta     ?? null,
    parentCap:       data.parentCap       ?? null,
    parentCF:        data.parentCF        ?? null,
    parentPIva:      data.parentPIva      ?? null,
    note:            data.note            ?? null,
    bisogniSpeciali: data.bisogniSpeciali ?? null,
    active:          data.active          ?? true,
  }).returning()

  return created
}

// ─────────────────────────────────────────────
// UPDATE  — PUT /api/students/:id
// Solo i campi presenti (non undefined) vengono aggiornati
// ─────────────────────────────────────────────

export async function updateStudent(id: string, data: UpdateStudentInput) {
  const changes: Record<string, unknown> = { updatedAt: new Date() }

  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) changes[key] = val
  }

  const [updated] = await db.update(students)
    .set(changes as Partial<typeof students.$inferInsert>)
    .where(eq(students.id, id))
    .returning()

  return updated ?? null
}

// ─────────────────────────────────────────────
// DEACTIVATE  — DELETE /api/students/:id
// Soft-delete: imposta active = false, non elimina fisicamente
// ─────────────────────────────────────────────

export async function deactivateStudent(id: string) {
  const [updated] = await db.update(students)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(students.id, id))
    .returning()

  return updated ?? null
}
