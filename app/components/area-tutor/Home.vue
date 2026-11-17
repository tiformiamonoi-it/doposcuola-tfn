<template>
  <div>
    <!-- ═══ TESTATA: data e saluto, come nella Home delle famiglie ═══ -->
    <PortaleTestata sovrapposta :campanella="false">
      <div class="flex flex-col gap-1">
        <p class="text-sm text-pf-su-blu first-letter:uppercase">{{ oggiInParole }}</p>
        <h1 class="font-heading text-[28px] leading-9 font-medium">
          {{ saluto }}<template v-if="user?.firstName">, <span class="font-bold">{{ user.firstName }}</span></template>
        </h1>
      </div>
    </PortaleTestata>

    <!-- ═══ LE LEZIONI DI OGGI: quante e fino a quando si registrano ═══ -->
    <NuxtLink
      to="/tutor-calendario"
      class="relative -mt-11 mx-5 bg-white rounded-3xl p-4 flex items-center gap-3.5 pf-ombra-alta hover:bg-pf-fondo transition-colors text-pf-testo"
    >
      <img src="/portale/calendario.webp" alt="" class="size-[60px] shrink-0 object-contain" />
      <span class="flex-1 min-w-0 flex flex-col gap-0.5">
        <span class="text-xs font-bold text-pf-blu uppercase tracking-wide">Le tue lezioni di oggi</span>
        <USkeleton v-if="pendingLezioni" class="h-6 w-40" />
        <span v-else class="font-heading font-bold text-lg">{{ riassuntoOggi }}</span>
        <span class="text-[13px]" :class="entroOrario ? 'text-pf-grigio' : 'text-pf-rosso'">
          {{ entroOrario ? 'Registrale entro le 20:00' : 'Sono passate le 20:00: per oggi non si registra più' }}
        </span>
      </span>
      <UIcon name="i-heroicons-chevron-right" class="size-5 shrink-0 text-pf-grigio" aria-hidden="true" />
    </NuxtLink>

    <!-- ═══ AZIONI RAPIDE ═══ -->
    <section aria-labelledby="t-azioni" class="mx-5 mt-7 flex flex-col gap-3">
      <h2 id="t-azioni" class="font-heading font-bold text-lg">Azioni rapide</h2>
      <div class="grid grid-cols-3 gap-2.5">
        <NuxtLink v-for="a in AZIONI" :key="a.to" :to="a.to" class="flex flex-col items-center gap-2 text-pf-testo rounded-2xl group">
          <span class="size-[72px] rounded-[22px] bg-white shadow-[0_6px_16px_rgb(15_27_45/0.07)] flex items-center justify-center group-hover:bg-pf-celeste transition-colors">
            <img :src="a.img" alt="" class="size-[52px] object-contain" />
          </span>
          <span class="text-xs font-semibold text-center leading-[15px]">{{ a.etichetta }}</span>
        </NuxtLink>
      </div>
    </section>

    <!-- ═══ PROMEMORIA: il mese dopo è ancora vuoto ═══
         Non per chi è a fisso mensile o sempre disponibile: per loro lun-ven c'è già. -->
    <section v-if="meseDopoVuoto" aria-labelledby="t-dispo" class="mx-5 mt-6 p-4 rounded-[22px] bg-pf-crema flex gap-3 items-start">
      <UIcon name="i-heroicons-calendar-days" class="size-6 shrink-0 text-pf-crema-testo" aria-hidden="true" />
      <div class="flex-1 flex flex-col gap-1">
        <h2 id="t-dispo" class="font-semibold text-[15px] text-pf-giallo-testo first-letter:uppercase">{{ nomeMeseDopo }} è ancora vuoto</h2>
        <p class="text-[13px] leading-[18px] text-pf-crema-testo">Segna i giorni in cui ci sei: la segreteria organizza le lezioni da lì.</p>
        <PortaleBottone variante="blu" piccolo to="/area-tutor/disponibilita" class="self-start mt-2">Segna la disponibilità</PortaleBottone>
      </div>
    </section>

    <!-- ═══ LA CARD TUTOR IN BREVE ═══ -->
    <section
      v-if="card"
      aria-labelledby="t-card"
      class="relative mx-5 mt-6 rounded-3xl text-white p-[18px] flex flex-col gap-3.5 overflow-hidden"
      :class="card.attiva ? 'bg-pf-notte' : 'bg-pf-spenta'"
    >
      <span aria-hidden="true" class="absolute -right-[50px] -top-[60px] size-[180px] rounded-full border-[26px]" :class="card.attiva ? 'border-pf-notte-anello' : 'border-white/10'" />
      <div class="relative flex items-center justify-between">
        <h2 id="t-card" class="font-heading font-bold text-[17px]">La tua card tutor</h2>
        <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-white" :class="card.attiva ? 'text-pf-verde' : 'text-pf-rosso'">
          {{ card.attiva ? 'Attiva' : 'Non attiva' }}
        </span>
      </div>
      <p class="relative text-sm leading-5" :class="card.attiva ? 'text-pf-su-blu' : 'text-white'">
        {{ card.attiva ? 'Sconti nei negozi convenzionati, finché collabori con noi.' : TESTO_CARD_TUTOR_SPENTA }}
      </p>
      <PortaleBottone to="/area-tutor/card" class="relative self-start">Mostra la card</PortaleBottone>
    </section>
  </div>
</template>

<script setup lang="ts">
import { format, addMonths, endOfMonth } from 'date-fns'
import { it } from 'date-fns/locale'

// LA HOME DEL TUTOR (bozza Main). Tutto da letture che esistono già:
// le lezioni dal calendario, le disponibilità, la card tutor.
const { user } = useUserSession()

const ora = adessoItalia()
const saluto = salutoDellOra(ora.minuti)
const oggiInParole = giornoInParole(ora.giorno)

// Le 20:00 di Roma, come in /tutor-calendario (solo per la scritta: decide il server)
const entroOrario = ora.minuti < 20 * 60

const AZIONI = [
  { to: '/area-tutor/disponibilita',   etichetta: 'Disponibilità',     img: '/portale/calendario.webp' },
  { to: '/area-tutor/note',            etichetta: 'Scrivi una nota',   img: '/portale/libri.webp' },
  { to: '/area-tutor/note?tab=alunni', etichetta: 'Note sugli alunni', img: '/portale/zaino.webp' },
]

// ─── Le lezioni di oggi: la stessa lettura del calendario, ristretta a oggi ───
// (il server dà al TUTOR solo le sue lezioni)
const { data: lezioniRes, pending: pendingLezioni } = useLazyFetch<{ data: any[] }>('/api/lessons', {
  // tutorId per il SUPER_TUTOR nell'app (D2), che altrimenti leggerebbe le lezioni di tutti
  query: { dataInizio: ora.giorno, dataFine: ora.giorno, limit: 500, tutorId: user.value?.id },
})
const riassuntoOggi = computed(() => {
  const lezioni = (lezioniRes.value?.data ?? []).filter((l) => String(l.data).startsWith(ora.giorno))
  if (lezioni.length === 0) return 'Nessuna ancora registrata'
  const alunni = new Set<string>()
  lezioni.forEach((l) => l.lessonStudents?.forEach((ls: any) => alunni.add(ls.studentId)))
  const fasce = new Set(lezioni.map((l) => l.timeSlotId)).size
  return `${alunni.size} ${alunni.size === 1 ? 'alunno' : 'alunni'} in ${fasce} ${fasce === 1 ? 'fascia' : 'fasce'}`
})

// ─── Promemoria disponibilità del mese dopo ───
// Mezzogiorno del primo del mese: nessun fuso orario sposta la data
const meseDopo = addMonths(new Date(`${ora.giorno.slice(0, 7)}-01T12:00:00`), 1)
const nomeMeseDopo = format(meseDopo, 'MMMM', { locale: it })
const { data: dispoMeseDopo } = useLazyFetch<{ disponibilita: unknown[], forfait: boolean, sempreDisponibile: boolean }>('/api/tutors/availabilities/me', {
  query: { from: format(meseDopo, 'yyyy-MM-dd'), to: format(endOfMonth(meseDopo), 'yyyy-MM-dd') },
  server: false,
})
const meseDopoVuoto = computed(() => {
  const d = dispoMeseDopo.value
  return !!d && !d.forfait && !d.sempreDisponibile && d.disponibilita.length === 0
})

// ─── La card tutor (/api/tutor/card, null se non c'è) ───
type CardTutor = { tipo: 'TUTOR', id: string, firstName: string, lastName: string, codiceCard: string, attiva: boolean }
const { data: card } = useLazyFetch<CardTutor | null>('/api/tutor/card', { server: false })
</script>
