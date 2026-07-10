import { relations } from 'drizzle-orm'
import { users, tutorProfiles, tutorAvailabilities } from './users'
import { students, studentReferrals } from './students'
import { packages, standardPackages, packageRecharges, payments } from './packages'
import { lessons, lessonStudents, timeSlots } from './lessons'
import { accountingEntries, tutorPayments, tutorReimbursements } from './accounting'
import { bookings, bookingSubjects } from './bookings'
import { studentNotes } from './notes'

export const usersRelations = relations(users, ({ one, many }) => ({
  tutorProfile:    one(tutorProfiles, { fields: [users.id], references: [tutorProfiles.userId] }),
  lessons:         many(lessons),
  tutorPayments:   many(tutorPayments),
  reimbursements:  many(tutorReimbursements),
  availabilities:  many(tutorAvailabilities),
  bookingSubjects: many(bookingSubjects),
  bookings:        many(bookings),
  linkedStudents:  many(students, { relationName: 'portalUser' }),
  ownStudent:      many(students, { relationName: 'studentUser' }),
  authoredNotes:   many(studentNotes),
}))

export const tutorProfilesRelations = relations(tutorProfiles, ({ one }) => ({
  user: one(users, { fields: [tutorProfiles.userId], references: [users.id] }),
}))

export const studentsRelations = relations(students, ({ one, many }) => ({
  packages:   many(packages),
  referredBy: many(studentReferrals, { relationName: 'referred' }),
  referrals:  many(studentReferrals, { relationName: 'referrer' }),
  portalUser:  one(users, { fields: [students.portalUserId], references: [users.id], relationName: 'portalUser' }),
  studentUser: one(users, { fields: [students.studentUserId], references: [users.id], relationName: 'studentUser' }),
  notes:       many(studentNotes),
}))

export const packagesRelations = relations(packages, ({ one, many }) => ({
  student:         one(students, { fields: [packages.studentId], references: [students.id] }),
  standardPackage: one(standardPackages, { fields: [packages.standardPackageId], references: [standardPackages.id] }),
  payments:        many(payments),
  lessonStudents:  many(lessonStudents),
  accountingEntries: many(accountingEntries),
  recharges:       many(packageRecharges),
}))

export const packageRechargesRelations = relations(packageRecharges, ({ one }) => ({
  package: one(packages, { fields: [packageRecharges.packageId], references: [packages.id] }),
  payment: one(payments, { fields: [packageRecharges.paymentId], references: [payments.id] }),
}))

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  tutor:          one(users, { fields: [lessons.tutorId], references: [users.id] }),
  timeSlot:       one(timeSlots, { fields: [lessons.timeSlotId], references: [timeSlots.id] }),
  lessonStudents: many(lessonStudents),
  notes:          many(studentNotes),
}))

export const lessonStudentsRelations = relations(lessonStudents, ({ one }) => ({
  lesson:  one(lessons, { fields: [lessonStudents.lessonId], references: [lessons.id] }),
  student: one(students, { fields: [lessonStudents.studentId], references: [students.id] }),
  package: one(packages, { fields: [lessonStudents.packageId], references: [packages.id] }),
}))

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  subjects: many(bookingSubjects),
  user:     one(users, { fields: [bookings.userId], references: [users.id] }),
  student:  one(students, { fields: [bookings.studentId], references: [students.id] }),
}))

export const studentNotesRelations = relations(studentNotes, ({ one }) => ({
  student: one(students, { fields: [studentNotes.studentId], references: [students.id] }),
  author:  one(users, { fields: [studentNotes.authorId], references: [users.id] }),
  lesson:  one(lessons, { fields: [studentNotes.lessonId], references: [lessons.id] }),
}))

export const bookingSubjectsRelations = relations(bookingSubjects, ({ one }) => ({
  booking:       one(bookings, { fields: [bookingSubjects.bookingId], references: [bookings.id] }),
  assignedTutor: one(users, { fields: [bookingSubjects.assignedTutorId], references: [users.id] }),
}))

export const tutorAvailabilitiesRelations = relations(tutorAvailabilities, ({ one }) => ({
  user: one(users, { fields: [tutorAvailabilities.userId], references: [users.id] }),
}))
