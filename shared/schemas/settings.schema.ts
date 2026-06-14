import { z } from 'zod'

export const UpdateConfigsSchema = z.record(z.string())

export const SaveMatchingSchema = z.object({
  matching: z.array(z.any()).default([])
})

export type UpdateConfigsInput = z.infer<typeof UpdateConfigsSchema>
export type SaveMatchingInput = z.infer<typeof SaveMatchingSchema>
