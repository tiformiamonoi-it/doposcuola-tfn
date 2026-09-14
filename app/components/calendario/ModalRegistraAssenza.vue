<template>
  <UModal v-model:open="isOpen" title="Registra un'assenza" :ui="{ content: 'max-w-md' }">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-slate-500">
          È l'assenza che arriva al telefono: «la mamma ha chiamato, oggi Luca non viene».
          Finisce nello stesso elenco di quelle scritte dalle famiglie sul portale.
        </p>

        <div>
          <label for="assenza-alunno" class="block text-sm font-medium text-slate-700 mb-1">Alunno</label>
          <USelectMenu
            id="assenza-alunno"
            v-model="alunnoScelto"
            :items="opzioniAlunni"
            :loading="pendingStudenti"
            placeholder="Cerca per cognome…"
            searchable
            class="w-full"
          />
        </div>

        <div>
          <label for="assenza-data" class="block text-sm font-medium text-slate-700 mb-1">Giorno</label>
          <UInput id="assenza-data" v-model="giorno" type="date" :min="oggi" class="w-full" />
          <p v-if="giorno && giorno < oggi" class="text-xs text-error-500 mt-1">
            Non si registra un'assenza per un giorno già passato.
          </p>
        </div>

        <div>
          <label for="assenza-motivo-seg" class="block text-sm font-medium text-slate-700 mb-1">
            Motivo <span class="font-normal text-slate-400">(facoltativo)</span>
          </label>
          <UInput
            id="assenza-motivo-seg"
            v-model="motivo"
            maxlength="200"
            placeholder="Es. febbre, visita medica…"
            class="w-full"
          />
        </div>

        <!--
          Sta scritto a schermo e non solo nel codice perché è la domanda che
          arriva sempre: no, l'assenza non toglie niente alla famiglia (Q12).
        -->
        <div class="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-start gap-2">
          <UIcon name="i-heroicons-information-circle" class="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
          <span>
            L'assenza <strong>non scala</strong> ore, giorni o importi dal pacchetto: serve solo a
            sapere in anticipo chi non viene.
          </span>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3 w-full">
        <UButton color="neutral" variant="ghost" @click="chiudi">Annulla</UButton>
        <UButton
          color="primary"
          :loading="salvataggio"
          :disabled="!alunnoScelto || !giorno || giorno < oggi"
          @click="salva"
        >
          Registra
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// LA MAMMA CHE TELEFONA (voce G1 del piano).
// Il portale è la strada normale, ma metà delle famiglie chiamerà comunque: senza
// questa finestra quelle assenze resterebbero su un foglietto e il calendario
// della mattina direbbe una cosa diversa dalla realtà.
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  /** Il giorno da cui partire, 'AAAA-MM-GG' (di solito quello su cui si è cliccato) */
  date?: string | null
}>()

const emit = defineEmits<{ refresh: [] }>()
const isOpen = defineModel<boolean>('open', { default: false })

const toast = useToast()
const oggi = computed(() => oggiISO())

const giorno = ref(props.date || oggiISO())
const motivo = ref('')
// `undefined` e non `null`: è il valore che USelectMenu usa per "niente scelto".
const alunnoScelto = ref<{ label: string; value: string } | undefined>(undefined)
const salvataggio = ref(false)

// Riapertura: la finestra si riapre già impostata sul giorno su cui si è cliccato,
// ma senza trascinarsi dietro l'alunno e il motivo della volta prima.
watch(isOpen, (aperta) => {
  if (!aperta) return
  giorno.value = props.date || oggiISO()
  motivo.value = ''
  alunnoScelto.value = undefined
})

// `light=true`: solo l'anagrafica, niente pacchetti e badge di stato — qui serve
// un elenco di nomi da cercare, non la scheda di ciascuno.
const { data: studentiRes, pending: pendingStudenti } =
  useLazyFetch<{ data: Array<{ id: string; firstName: string; lastName: string; classe: string | null }> }>(
    '/api/students',
    { query: { active: 'true', limit: 1000, light: 'true' } },
  )

const opzioniAlunni = computed(() =>
  (studentiRes.value?.data ?? []).map((s) => ({
    // La classe nell'etichetta: in un doposcuola i fratelli con lo stesso cognome
    // sono la norma, e sbagliare ragazzo qui vuol dire aspettare quello sbagliato.
    label: `${s.lastName} ${s.firstName}${s.classe ? ` — ${s.classe}` : ''}`.trim(),
    value: s.id,
  })),
)

function chiudi() {
  isOpen.value = false
}

async function salva() {
  if (!alunnoScelto.value || !giorno.value) return

  salvataggio.value = true
  try {
    const res = await $fetch<{ segnalate: number; giaPresenti: number }>('/api/admin/assenze', {
      method: 'POST',
      body: {
        studentId: alunnoScelto.value.value,
        giorni:    [giorno.value],
        motivo:    motivo.value.trim() || undefined,
      },
    })

    toast.add({
      title: res.giaPresenti > 0 ? 'Assenza già presente: aggiornata' : 'Assenza registrata',
      description: res.giaPresenti > 0
        ? 'Quel giorno era già stato segnalato: è stato aggiornato il motivo.'
        : 'Comparirà nell\'elenco della giornata.',
      color: 'success',
    })

    isOpen.value = false
    emit('refresh')
  } catch (err: any) {
    toast.add({
      title: 'Non è stato possibile registrare l\'assenza',
      description: err?.data?.statusMessage ?? 'Riprova.',
      color: 'error',
    })
  } finally {
    salvataggio.value = false
  }
}
</script>
