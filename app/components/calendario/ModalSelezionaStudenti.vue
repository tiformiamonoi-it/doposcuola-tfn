<template>
  <UModal v-model:open="isOpen" class="max-w-xl">
    <template #header>
      <div class="flex items-center gap-3 w-full">
        <UIcon name="i-heroicons-users" class="w-5 h-5 text-primary-500" />
        <span class="font-semibold text-slate-800 text-base flex-1">Seleziona studenti</span>
        <UButton icon="i-heroicons-x-mark" size="xs" variant="ghost" color="neutral" @click="isOpen = false" />
      </div>
    </template>

    <template #body>
      <div class="space-y-4">
        <!-- Search bar -->
        <UInput
          v-model="query"
          placeholder="Cerca per nome o cognome..."
          icon="i-heroicons-magnifying-glass"
          class="w-full"
        />

        <!-- Caricamento -->
        <div v-if="pending" class="py-8 flex justify-center">
          <UIcon name="i-heroicons-arrow-path" class="w-7 h-7 animate-spin text-primary-500" />
        </div>

        <div v-else-if="visibleStudents.length === 0" class="py-6 text-center text-slate-400 text-sm">
          Nessuno studente trovato.
        </div>

        <div v-else class="max-h-96 overflow-y-auto space-y-1.5 pr-1">
          <div
            v-for="s in visibleStudents"
            :key="s.id"
            class="flex items-center gap-3 p-3 rounded-lg border transition-colors select-none"
            :class="blockedReason(s)
              ? 'border-slate-100 bg-slate-50 cursor-not-allowed opacity-70'
              : alreadySelectedIds?.includes(s.id)
                ? 'border-primary-200 bg-primary-50/40 cursor-pointer'
                : 'border-slate-200 bg-white cursor-pointer hover:bg-slate-50'"
            @click="!blockedReason(s) && toggleStudent(s.id)"
          >
            <!-- Checkbox -->
            <div
              class="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
              :class="blockedReason(s)
                ? 'border-slate-200 bg-slate-100'
                : selected.has(s.id)
                  ? 'bg-primary-500 border-primary-500'
                  : 'border-slate-300'"
            >
              <UIcon v-if="!blockedReason(s) && selected.has(s.id)" name="i-heroicons-check" class="w-3 h-3 text-white" />
              <UIcon v-else-if="blockedReason(s)" name="i-heroicons-lock-closed" class="w-2.5 h-2.5 text-slate-400" />
            </div>

            <!-- Nome -->
            <div class="flex-1 min-w-0">
              <span class="font-medium truncate block"
                    :class="blockedReason(s) ? 'text-slate-500' : 'text-slate-800'">
                {{ s.firstName }} {{ s.lastName }}
              </span>
            </div>

            <!-- Badge stato pacchetto (se bloccato) -->
            <UBadge v-if="blockedReason(s)" color="neutral" variant="subtle" size="sm">
              {{ blockedReason(s) }}
            </UBadge>

            <!-- Badge ore rimanenti (se attivo) -->
            <template v-else>
              <UBadge v-if="s.pkgTipo === 'ORE' && s.pkgOreResiduo !== null" :color="parseFloat(s.pkgOreResiduo) > 0 ? 'success' : 'error'" variant="subtle" size="sm">
                {{ parseFloat(s.pkgOreResiduo) }}h
              </UBadge>
              <UBadge v-else-if="s.pkgTipo === 'MENSILE'" color="info" variant="subtle" size="sm">Mensile</UBadge>
              <UBadge v-else-if="s.pkgTipo === 'A_CONSUMO'" color="secondary" variant="subtle" size="sm">A consumo</UBadge>
            </template>

            <!-- Badge "già aggiunto" -->
            <UBadge v-if="!blockedReason(s) && alreadySelectedIds?.includes(s.id)" color="success" variant="subtle" size="sm">
              già aggiunto
            </UBadge>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center justify-between w-full gap-3">
        <span class="text-sm text-slate-500">
          {{ selected.size }} selezionati
        </span>
        <div class="flex gap-3">
          <UButton variant="ghost" color="neutral" @click="isOpen = false">Annulla</UButton>
          <UButton color="primary" :disabled="selected.size === 0" @click="onConfirm">
            Aggiungi selezionati
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const props = defineProps<{
  open: boolean
  alreadySelectedIds?: string[]
  studentsPool?: { studentId: string; nome: string }[]
  // Data della lezione che si sta creando ('YYYY-MM-DD'): il server la usa per NON
  // bloccare i mensili a giorni finiti che hanno già una lezione in quella data
  lessonDate?: string
}>()

const emit = defineEmits<{
  'update:open': [val: boolean]
  'confirm': [students: Array<{ studentId: string; nome: string; oreResiduo: string | null; pkgTipo: string | null; pacchettiAttivi?: any[] }>]
}>()

const isOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

const selected = ref<Set<string>>(new Set())
const query = ref('')

const { data: studentsRes, pending } = useLazyFetch('/api/students', {
  query: computed(() => ({
    active: 'true',
    limit: 500,
    ...(props.lessonDate ? { lessonDate: props.lessonDate } : {}),
  })),
  immediate: !props.studentsPool,
})

type StudentRow = {
  id: string
  firstName: string
  lastName: string
  pkgOreResiduo: string | null
  pkgTipo: string | null
  globalStatus: string
  hasPacchetti: boolean
  blockLabel: string | null
  pacchettiAttivi?: any[]
}

const allStudents = computed<StudentRow[]>(() => {
  if (props.studentsPool) {
    return props.studentsPool.map(s => ({
      id: s.studentId,
      firstName: s.nome,
      lastName: '',
      pkgOreResiduo: null,
      pkgTipo: null,
      globalStatus: 'Attivo',
      hasPacchetti: true,
      blockLabel: null,
    }))
  }
  return ((studentsRes.value as any)?.data ?? []).map((s: any) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    pkgOreResiduo: s.pkgOreResiduo ?? null,
    pkgTipo: s.pkgTipo ?? null,
    globalStatus: s.globalStatus ?? 'Attivo',
    hasPacchetti: s.hasPacchetti ?? false,
    blockLabel: s.blockLabel ?? null,
    pacchettiAttivi: s.pacchettiAttivi ?? [],
  }))
})

// Motivo del blocco deciso dal server: si blocca SOLO se il pacchetto è
// esaurito (ore/giorni finiti) o scaduto. Il saldo "da pagare" non blocca.
function blockedReason(s: StudentRow): string | null {
  return s.blockLabel ?? null
}

// Nasconde: inattivi + studenti senza mai un pacchetto
function shouldHide(s: StudentRow): boolean {
  if (s.globalStatus === 'Inattivo') return true
  if (s.globalStatus === 'Nessun pacchetto' && !s.hasPacchetti) return true
  return false
}

const visibleStudents = computed<StudentRow[]>(() => {
  const q = query.value.toLowerCase().trim()
  let list = allStudents.value.filter(s => !shouldHide(s))
  if (q) {
    list = list.filter(s =>
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q)
    )
  }
  // Attivi prima, bloccati in fondo
  return [...list].sort((a, b) => {
    const aBlocked = blockedReason(a) ? 1 : 0
    const bBlocked = blockedReason(b) ? 1 : 0
    return aBlocked - bBlocked
  })
})

function toggleStudent(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function onConfirm() {
  // Filtra su TUTTI gli studenti, non solo quelli visibili: se l'utente ha usato
  // la ricerca per selezionarli uno alla volta, i selezionati fuori dal filtro
  // corrente NON devono essere persi (altrimenti arriva solo l'ultimo cercato).
  const picked = allStudents.value
    .filter(s => selected.value.has(s.id))
    .map(s => ({
      studentId: s.id,
      nome: props.studentsPool ? s.firstName : `${s.firstName} ${s.lastName}`.trim(),
      oreResiduo: s.pkgOreResiduo,
      pkgTipo: s.pkgTipo,
      // In modalità pool (area tutor) non abbiamo i pacchetti pronti → resta undefined
      // e la finestra lezione farà il fetch come prima. In modalità admin arrivano già.
      pacchettiAttivi: props.studentsPool ? undefined : s.pacchettiAttivi,
    }))
  emit('confirm', picked)
  isOpen.value = false
}

watch(isOpen, (open) => {
  if (open) {
    selected.value = new Set()
    query.value = ''
  }
})
</script>
