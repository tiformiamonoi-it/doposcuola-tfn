<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-currency-euro" class="w-4 h-4 text-tfn-500" />
          <h3 class="font-medium text-slate-800">Tariffe speciali</h3>
          <UBadge color="neutral" variant="subtle">{{ regole.length }}</UBadge>
        </div>
        <UButton icon="i-heroicons-plus" size="sm" @click="apriNuova">Nuova regola</UButton>
      </div>
    </template>

    <p class="text-xs text-slate-500 mb-3">
      Ogni regola dice quanto prende il tutor all'ora in una certa situazione. Vince la regola più precisa
      (l'alunno conta più del tutor, il tutor più della fascia oraria); senza regole vale il listino.
      Creare, cambiare o cancellare una regola <strong>non cambia le lezioni già salvate</strong>.
    </p>

    <div v-if="pending && regole.length === 0" class="space-y-2 py-2">
      <USkeleton v-for="i in 3" :key="i" class="h-14 w-full" />
    </div>

    <div v-else-if="regole.length === 0" class="py-8 text-center text-slate-400 text-sm">
      <UIcon name="i-heroicons-currency-euro" class="w-8 h-8 mx-auto mb-2 text-slate-300" />
      Nessuna tariffa speciale: vale il listino per tutte le lezioni.
    </div>

    <ul v-else class="divide-y divide-slate-100">
      <li v-for="r in regole" :key="r.id" class="flex items-start justify-between gap-3 py-3 px-1">
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-slate-900">€ {{ formatImporto(r.tariffaOraria) }} all'ora</p>
          <div class="flex flex-wrap gap-1.5 mt-1">
            <UBadge :color="r.tutorId ? 'primary' : 'neutral'" variant="subtle" size="sm">
              {{ r.tutorNome ?? (r.tutorId ? 'Tutor non trovato' : 'Qualsiasi tutor') }}
            </UBadge>
            <UBadge :color="r.studentId ? 'info' : 'neutral'" variant="subtle" size="sm">
              {{ r.studenteNome ?? (r.studentId ? 'Alunno non trovato' : 'Qualsiasi alunno') }}
            </UBadge>
            <UBadge :color="r.timeSlotIds.length ? 'warning' : 'neutral'" variant="subtle" size="sm">
              {{ r.timeSlotIds.length ? (r.fasce ?? 'Fasce cancellate') : 'Tutte le fasce' }}
            </UBadge>
          </div>
          <p class="text-xs text-slate-500 mt-1">
            Valida dal {{ formatData(r.validaDal) }}<template v-if="r.nota"> · {{ r.nota }}</template>
          </p>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <UButton
            icon="i-heroicons-pencil-square" variant="ghost" color="neutral" class="size-11 justify-center"
            :aria-label="`Modifica la regola da ${formatImporto(r.tariffaOraria)} euro all'ora`"
            @click="apriModifica(r)"
          />
          <UButton
            icon="i-heroicons-trash" variant="ghost" color="error" class="size-11 justify-center"
            :aria-label="`Elimina la regola da ${formatImporto(r.tariffaOraria)} euro all'ora`"
            @click="chiediEliminazione(r)"
          />
        </div>
      </li>
    </ul>

    <!-- ─── Finestra crea / modifica ─── -->
    <UModal v-model:open="modaleAperta" :title="inModifica ? 'Modifica tariffa speciale' : 'Nuova tariffa speciale'">
      <template #body>
        <form id="form-tariffa-speciale" class="space-y-4" @submit.prevent="salva">
          <UFormField label="Tutor" help="Lascia «Qualsiasi tutor» se la regola vale per tutti">
            <USelectMenu
              v-model="form.tutorId" :items="opzioniTutor" value-key="value" class="w-full"
              :disabled="!!props.tutorId" aria-label="Tutor"
            />
          </UFormField>

          <UFormField label="Alunno" help="Lascia «Qualsiasi alunno» se la regola vale per tutti">
            <USelectMenu
              v-model="form.studentId" :items="opzioniAlunni" value-key="value" class="w-full"
              :disabled="!!props.studentId" aria-label="Alunno"
            />
          </UFormField>

          <fieldset>
            <legend class="text-sm font-medium text-slate-700">Fasce orarie</legend>
            <p class="text-xs text-slate-500 mb-2">Nessuna spunta = vale in tutte le fasce.</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <UCheckbox
                v-for="s in slots" :key="s.id"
                :model-value="form.timeSlotIds.includes(s.id)"
                :label="`${s.oraInizio.substring(0, 5)} – ${s.oraFine.substring(0, 5)}${s.active ? '' : ' (spenta)'}`"
                @update:model-value="spuntaFascia(s.id, $event === true)"
              />
            </div>
          </fieldset>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Euro all'ora" required>
              <UInputNumber v-model="form.tariffaOraria" :min="0.5" :step="0.5" class="w-full" aria-label="Euro all'ora" />
            </UFormField>
            <UFormField label="Valida dal" required help="Vale per le lezioni da questo giorno in poi">
              <UInput v-model="form.validaDal" type="date" class="w-full" aria-label="Valida dal" />
            </UFormField>
          </div>

          <UFormField label="Nota (facoltativa)">
            <UInput v-model="form.nota" maxlength="300" placeholder="Es: paga il pacchetto premium" class="w-full" aria-label="Nota" />
          </UFormField>

          <p v-if="erroreForm" class="text-sm text-error-600" role="alert">{{ erroreForm }}</p>
        </form>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3 w-full">
          <UButton variant="ghost" color="neutral" @click="() => { modaleAperta = false }">Annulla</UButton>
          <UButton type="submit" form="form-tariffa-speciale" :loading="salvando">Salva</UButton>
        </div>
      </template>
    </UModal>

    <ConfirmDialog
      v-model:open="confirmOpen"
      :title="confirmTitle"
      :description="confirmDescription"
      :confirm-label="confirmLabel"
      :confirm-color="confirmColor"
      :loading="confirmLoading"
      @confirm="eseguiConferma"
    />
  </UCard>
</template>

<script setup lang="ts">
import ConfirmDialog from '~/components/ConfirmDialog.vue'

// Il quaderno delle tariffe speciali. Lo stesso componente sta in Impostazioni (tutte
// le regole), nella scheda del tutor (solo le sue, `tutorId`) e nella scheda
// dell'alunno (solo le sue, `studentId`). Solo ADMIN e SUPER_TUTOR: il server
// risponde 403 a chiunque altro.
const props = defineProps<{ tutorId?: string, studentId?: string }>()

/** Una riga di GET /api/tariffe-speciali */
interface Regola {
  id: string
  tutorId: string | null
  studentId: string | null
  timeSlotIds: string[]
  tariffaOraria: string
  validaDal: string
  nota: string | null
  tutorNome: string | null
  studenteNome: string | null
  fasce: string | null
}
interface Persona { id: string, firstName: string, lastName: string }
interface Fascia { id: string, oraInizio: string, oraFine: string, active: boolean }

// Valore "nessuno" delle due tendine: USelectMenu non accetta bene un valore vuoto
const TUTTI = 'TUTTI'

const toast = useToast()

const { data: regoleRes, pending, refresh } = useFetch<{ data: Regola[] }>('/api/tariffe-speciali', {
  query: { tutorId: props.tutorId, studentId: props.studentId },
  lazy: true,
})
const regole = computed(() => regoleRes.value?.data ?? [])

// Le tendine si caricano solo la prima volta che si apre la finestra
const { data: tutorRes, execute: caricaTutor } = useFetch<{ data: Persona[] }>('/api/tutors?active=true', { lazy: true, immediate: false })
const { data: alunniRes, execute: caricaAlunni } = useFetch<{ data: Persona[] }>('/api/students?active=true&limit=1000&light=true', { lazy: true, immediate: false })
const { data: slotsRes, execute: caricaSlots } = useFetch<Fascia[]>('/api/settings/timeslots', { lazy: true, immediate: false })

const opzioniTutor = computed(() => [
  { label: 'Qualsiasi tutor', value: TUTTI },
  ...(tutorRes.value?.data ?? []).map(t => ({ label: `${t.firstName} ${t.lastName}`, value: t.id })),
  // La regola che si sta modificando può parlare di un tutor non più attivo: senza questa
  // voce la tendina resterebbe vuota
  ...(regolaInModifica.value?.tutorId && !(tutorRes.value?.data ?? []).some(t => t.id === regolaInModifica.value?.tutorId)
    ? [{ label: regolaInModifica.value.tutorNome ?? 'Tutor', value: regolaInModifica.value.tutorId }] : []),
])
const opzioniAlunni = computed(() => [
  { label: 'Qualsiasi alunno', value: TUTTI },
  ...(alunniRes.value?.data ?? []).map(s => ({ label: `${s.firstName} ${s.lastName}`, value: s.id })),
  ...(regolaInModifica.value?.studentId && !(alunniRes.value?.data ?? []).some(s => s.id === regolaInModifica.value?.studentId)
    ? [{ label: regolaInModifica.value.studenteNome ?? 'Alunno', value: regolaInModifica.value.studentId }] : []),
])
const slots = computed(() => slotsRes.value ?? [])

// ─── Finestra crea / modifica ───
const modaleAperta = ref(false)
const salvando = ref(false)
const erroreForm = ref('')
const regolaInModifica = ref<Regola | null>(null)
const inModifica = computed(() => regolaInModifica.value !== null)

const form = reactive({
  tutorId: TUTTI,
  studentId: TUTTI,
  timeSlotIds: [] as string[],
  tariffaOraria: 10 as number | null,
  validaDal: oggiISO(),
  nota: '',
})

function caricaTendine() {
  if (!tutorRes.value) caricaTutor()
  if (!alunniRes.value) caricaAlunni()
  if (!slotsRes.value) caricaSlots()
}

function apriNuova() {
  regolaInModifica.value = null
  Object.assign(form, {
    tutorId: props.tutorId ?? TUTTI,
    studentId: props.studentId ?? TUTTI,
    timeSlotIds: [],
    tariffaOraria: 10,
    validaDal: oggiISO(),
    nota: '',
  })
  erroreForm.value = ''
  caricaTendine()
  modaleAperta.value = true
}

function apriModifica(r: Regola) {
  regolaInModifica.value = r
  Object.assign(form, {
    tutorId: r.tutorId ?? TUTTI,
    studentId: r.studentId ?? TUTTI,
    timeSlotIds: [...r.timeSlotIds],
    tariffaOraria: Number(r.tariffaOraria),
    validaDal: r.validaDal,
    nota: r.nota ?? '',
  })
  erroreForm.value = ''
  caricaTendine()
  modaleAperta.value = true
}

function spuntaFascia(id: string, spuntata: boolean) {
  form.timeSlotIds = spuntata ? [...form.timeSlotIds, id] : form.timeSlotIds.filter(x => x !== id)
}

async function salva() {
  erroreForm.value = ''
  if (form.tutorId === TUTTI && form.studentId === TUTTI && form.timeSlotIds.length === 0) {
    erroreForm.value = 'Indica almeno un tutor, un alunno o una fascia oraria (altrimenti è il listino).'
    return
  }
  if (!form.tariffaOraria || form.tariffaOraria <= 0) {
    erroreForm.value = 'Scrivi quanti euro all\'ora prende il tutor.'
    return
  }
  salvando.value = true
  try {
    const body = {
      tutorId: form.tutorId === TUTTI ? null : form.tutorId,
      studentId: form.studentId === TUTTI ? null : form.studentId,
      timeSlotIds: form.timeSlotIds,
      tariffaOraria: form.tariffaOraria,
      validaDal: form.validaDal,
      nota: form.nota.trim() || null,
    }
    if (regolaInModifica.value) {
      await $fetch(`/api/tariffe-speciali/${regolaInModifica.value.id}`, { method: 'PUT', body })
    } else {
      await $fetch('/api/tariffe-speciali', { method: 'POST', body })
    }
    toast.add({ title: 'Tariffa speciale salvata', description: 'Vale per le lezioni salvate da adesso.', color: 'success' })
    modaleAperta.value = false
    await refresh()
  } catch (err: unknown) {
    const e = err as { data?: { statusMessage?: string, data?: { errors?: Record<string, string[]> } } }
    const primoErrore = Object.values(e.data?.data?.errors ?? {})[0]?.[0]
    erroreForm.value = primoErrore ?? e.data?.statusMessage ?? 'Salvataggio non riuscito'
  } finally {
    salvando.value = false
  }
}

// ─── Eliminazione (ConfirmDialog, mai confirm()) ───
const {
  confirmOpen, confirmTitle, confirmDescription, confirmLabel, confirmColor, confirmLoading,
  chiediConferma, eseguiConferma,
} = useConfirm()

function chiediEliminazione(r: Regola) {
  chiediConferma(
    {
      title: 'Eliminare questa tariffa speciale?',
      description: `€ ${formatImporto(r.tariffaOraria)} all'ora. Le lezioni già salvate restano come sono.`,
      confirmLabel: 'Elimina',
      confirmColor: 'error',
      attendi: true,
    },
    async () => {
      try {
        await $fetch(`/api/tariffe-speciali/${r.id}`, { method: 'DELETE' })
      } catch (err) {
        toast.add({ title: 'Eliminazione non riuscita', color: 'error' })
        throw err // la finestra resta aperta per riprovare
      }
      toast.add({ title: 'Tariffa speciale eliminata', color: 'success' })
      await refresh()
    },
  )
}
</script>
