<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-queue-list" class="w-4 h-4 text-tfn-500" />
        <span class="font-medium text-slate-800">Registro email inviate</span>
      </div>
    </template>

    <div class="space-y-4">
      <p class="text-sm text-slate-600">
        Ogni email che il gestionale prova a mandare finisce qui, anche quelle che non sono partite.
        Se una famiglia dice «non mi è arrivato niente», cerca il suo indirizzo.
      </p>

      <!-- Filtri -->
      <div class="flex flex-col sm:flex-row gap-2">
        <USelect v-model="filtroTipo" :items="TIPI_ITEMS" class="w-full sm:w-60" aria-label="Filtra per tipo di email" />
        <USelect v-model="filtroEsito" :items="ESITI_ITEMS" class="w-full sm:w-48" aria-label="Filtra per esito" />
        <UInput
          v-model="ricerca"
          icon="i-heroicons-magnifying-glass"
          placeholder="Cerca nome o email"
          class="w-full sm:flex-1"
          aria-label="Cerca per nome o indirizzo del destinatario"
        />
      </div>

      <!-- Arrivati dal link di una notifica: si guarda un solo invio di massa -->
      <div v-if="invioFiltrato" class="flex flex-wrap items-center gap-2 text-sm bg-tfn-50 border border-tfn-100 rounded-lg p-2">
        <UIcon name="i-heroicons-funnel" class="w-4 h-4 text-tfn-500" />
        <span class="text-slate-700">Stai guardando le email di un solo invio.</span>
        <UButton size="xs" variant="link" @click="invioFiltrato = undefined">Mostra tutte</UButton>
      </div>

      <div v-if="pending && righe.length === 0" class="py-8 text-center text-sm text-slate-400">Caricamento…</div>
      <div v-else-if="error" class="py-8 text-center text-sm text-red-600">Non è stato possibile caricare il registro.</div>
      <div v-else-if="righe.length === 0" class="py-8 text-center text-sm text-slate-400">Nessuna email trovata.</div>

      <UTable v-else :data="righe" :columns="COLONNE">
        <template #createdAt-cell="{ row }">
          <span class="whitespace-nowrap text-slate-600">{{ dataOraItaliana(row.original.createdAt) }}</span>
        </template>
        <template #tipo-cell="{ row }">
          {{ ETICHETTA_TIPO_EMAIL[row.original.tipo] ?? row.original.tipo }}
        </template>
        <template #destinatario-cell="{ row }">
          <p v-if="row.original.nomeDestinatario" class="text-slate-800">{{ row.original.nomeDestinatario }}</p>
          <p class="text-xs text-slate-500 break-all">{{ row.original.destinatario }}</p>
        </template>
        <template #oggetto-cell="{ row }">
          <span class="text-slate-700">{{ row.original.oggetto }}</span>
        </template>
        <template #esito-cell="{ row }">
          <UBadge :color="ESITI[row.original.esito].colore" variant="subtle" size="sm">
            {{ ESITI[row.original.esito].etichetta }}
          </UBadge>
          <p v-if="row.original.motivo && row.original.esito !== 'DISATTIVATA'" class="text-xs text-slate-500 mt-1">
            {{ TESTO_MOTIVO_EMAIL[row.original.motivo] ?? row.original.motivo }}
          </p>
          <p v-if="row.original.dettaglio" class="text-xs text-slate-400 mt-0.5">{{ row.original.dettaglio }}</p>
        </template>
      </UTable>

      <div v-if="pagina > 1 || altrePagine" class="flex items-center justify-between gap-2">
        <UButton
          size="sm"
          variant="outline"
          color="neutral"
          icon="i-heroicons-chevron-left"
          :disabled="pagina === 1"
          @click="cambiaPagina(-1)"
        >
          Più recenti
        </UButton>
        <span class="text-xs text-slate-500">Pagina {{ pagina }}</span>
        <UButton
          size="sm"
          variant="outline"
          color="neutral"
          trailing-icon="i-heroicons-chevron-right"
          :disabled="!altrePagine"
          @click="cambiaPagina(1)"
        >
          Più vecchie
        </UButton>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
// IL REGISTRO DELLE EMAIL (Impostazioni → Email). Sta in un componente a parte
// perché la pagina Impostazioni è già lunghissima. Legge GET /api/email-log, che
// risponde solo all'ADMIN. Il corpo delle email non c'è mai, solo l'oggetto:
// inviti e recupero password contengono il link d'accesso.
import {
  ETICHETTA_TIPO_EMAIL, TESTO_MOTIVO_EMAIL,
  type EsitoRegistroEmail, type MotivoEmail, type TipoEmail,
} from '#shared/email'

const props = defineProps<{
  /** Id di un invio di massa (dal link della notifica): mostra solo quelle email */
  invio?: string
}>()

type RigaRegistro = {
  id: string
  createdAt: string
  tipo: TipoEmail
  destinatario: string
  nomeDestinatario: string | null
  oggetto: string
  esito: EsitoRegistroEmail
  motivo: MotivoEmail | null
  dettaglio: string | null
}

// Le tendine di Nuxt UI non accettano il valore vuoto: "tutti" ha un valore suo
const TUTTI = 'TUTTI'
const TIPI_ITEMS = [
  { label: 'Tutti i tipi', value: TUTTI },
  ...Object.entries(ETICHETTA_TIPO_EMAIL).map(([value, label]) => ({ label, value })),
]
const ESITI: Record<EsitoRegistroEmail, { etichetta: string; colore: 'success' | 'error' | 'neutral' }> = {
  INVIATA:     { etichetta: 'Inviata',     colore: 'success' },
  NON_PARTITA: { etichetta: 'Non partita', colore: 'error' },
  DISATTIVATA: { etichetta: 'Spenta nelle Impostazioni', colore: 'neutral' },
}
const ESITI_ITEMS = [
  { label: 'Tutti gli esiti', value: TUTTI },
  ...Object.entries(ESITI).map(([value, e]) => ({ label: e.etichetta, value })),
]
const COLONNE = [
  { accessorKey: 'createdAt', header: 'Quando' },
  { accessorKey: 'tipo', header: 'Tipo' },
  { accessorKey: 'destinatario', header: 'A chi' },
  { accessorKey: 'oggetto', header: 'Oggetto' },
  { accessorKey: 'esito', header: 'Esito' },
]

const filtroTipo = ref<string>(TUTTI)
const filtroEsito = ref<string>(TUTTI)
const ricerca = ref('')
const ricercaApplicata = ref('')
const pagina = ref(1)
const invioFiltrato = ref<string | undefined>(props.invio)
// Si clicca un'altra notifica restando sulla pagina: cambia solo la prop
watch(() => props.invio, (id) => { invioFiltrato.value = id })

// La ricerca parte 300 ms dopo l'ultimo tasto: niente chiamata a ogni lettera
let timerRicerca: ReturnType<typeof setTimeout> | null = null
watch(ricerca, (testo) => {
  if (timerRicerca) clearTimeout(timerRicerca)
  timerRicerca = setTimeout(() => { ricercaApplicata.value = testo.trim() }, 300)
})
onBeforeUnmount(() => { if (timerRicerca) clearTimeout(timerRicerca) })

// Cambiando un filtro si riparte dalla pagina 1
watch([filtroTipo, filtroEsito, ricercaApplicata, invioFiltrato], () => { pagina.value = 1 })

const { data, pending, error } = useLazyFetch<{ righe: RigaRegistro[]; altrePagine: boolean }>('/api/email-log', {
  server: false,
  query: computed(() => ({
    tipo:   filtroTipo.value !== TUTTI ? filtroTipo.value : undefined,
    esito:  filtroEsito.value !== TUTTI ? filtroEsito.value : undefined,
    cerca:  ricercaApplicata.value || undefined,
    invio:  invioFiltrato.value,
    pagina: pagina.value,
  })),
})
const righe = computed(() => data.value?.righe ?? [])
const altrePagine = computed(() => data.value?.altrePagine ?? false)
function cambiaPagina(di: number) { pagina.value += di }

// Sempre in ora italiana, anche se il computer di chi guarda è su un altro fuso
function dataOraItaliana(d: string): string {
  return new Date(d).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Rome' })
}
</script>
