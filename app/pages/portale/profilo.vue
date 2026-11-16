<template>
  <div>
    <PortaleTestata>
      <div class="flex items-center gap-3.5">
        <span class="size-16 shrink-0 rounded-full bg-white text-pf-blu flex items-center justify-center font-heading font-bold text-[22px]" aria-hidden="true">
          {{ inizialiDa(user?.firstName, user?.lastName) }}
        </span>
        <div class="min-w-0">
          <h1 class="font-heading font-bold text-[22px] truncate">{{ [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Il mio profilo' }}</h1>
          <p class="text-sm text-pf-su-blu truncate">{{ user?.email }}</p>
        </div>
      </div>
    </PortaleTestata>

    <div class="px-5 pt-[22px] flex flex-col gap-[22px]">
      <!-- ─── I tuoi ragazzi (genitore) ─── -->
      <section v-if="!isStudente" aria-labelledby="t-ragazzi">
        <h2 id="t-ragazzi" class="mb-2 ml-1 text-[13px] font-bold text-pf-grigio uppercase tracking-wide">I tuoi ragazzi</h2>
        <div class="bg-white rounded-[22px] px-4 py-1.5 pf-ombra divide-y divide-pf-fondo">
          <USkeleton v-if="pendingStudents" class="h-12 w-full my-2" />
          <p v-else-if="students.length === 0" class="py-3 text-sm text-pf-grigio">Nessun ragazzo collegato.</p>
          <template v-else>
            <PortaleSchedaAlunno v-for="(s, i) in students" :key="s.id" :alunno="s" :indice="i" riga />
          </template>
        </div>
      </section>

      <!-- ─── CONSENSI (solo genitori) ───
           Qui stanno le scelte FACOLTATIVE: foto/video e comunicazioni promozionali.
           Non sono nella schermata d'ingresso apposta — un consenso raccolto in mezzo
           a quelli obbligatori non sarebbe libero, e quindi non varrebbe niente.
           La dichiarazione per i minori di 14 anni compare qui con la possibilità di
           revocarla: è un diritto, e toglierla non chiude fuori nessuno dal portale. -->
      <section v-if="!isStudente" aria-labelledby="t-privacy">
        <h2 id="t-privacy" class="mb-2 ml-1 text-[13px] font-bold text-pf-grigio uppercase tracking-wide">Privacy e consensi</h2>
        <div class="bg-white rounded-[22px] px-4 py-1.5 pf-ombra">
          <USkeleton v-if="pendingConsensi" class="h-24 w-full my-2" />
          <div v-else class="divide-y divide-pf-fondo">
            <div class="pt-3 pb-1">
              <p class="font-semibold text-[15px]">Foto e video</p>
              <p class="text-[13px] text-pf-grigio">Facoltativo: se dici di no, il servizio resta identico in tutto.</p>
            </div>
            <div v-for="f in figli" :key="f.studentId" class="flex items-center gap-3 py-3">
              <div class="flex-1 min-w-0">
                <p class="text-[15px]">{{ f.nome }}</p>
                <p class="text-xs text-pf-grigio">{{ descriviVoce(f.immagini) }}</p>
              </div>
              <USwitch
                :model-value="f.immagini.valore === true"
                :loading="inCorso === `IMMAGINI:${f.studentId}`"
                :aria-label="`Foto e video di ${f.nome}`"
                size="xl"
                @update:model-value="(v: boolean) => cambia('IMMAGINI', v, f.studentId, f.nome)"
              />
            </div>

            <!-- Comunicazioni promozionali: è della persona, non del figlio -->
            <div class="flex items-center gap-3 py-3">
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-[15px]">Offerte e novità</p>
                <p class="text-xs text-pf-grigio">{{ descriviVoce(marketing) }}</p>
              </div>
              <USwitch
                :model-value="marketing.valore === true"
                :loading="inCorso === 'MARKETING:'"
                aria-label="Comunicazioni promozionali"
                size="xl"
                @update:model-value="(v: boolean) => cambia('MARKETING', v)"
              />
            </div>

            <!-- Autorizzazione per i minori di 14 anni -->
            <template v-if="figliMinori.length > 0">
              <div class="pt-3 pb-1">
                <p class="font-semibold text-[15px]">Autorizzazione per i minori di 14 anni</p>
                <p class="text-[13px] text-pf-grigio">
                  Se la togli, il Centro viene avvisato e ti ricontatta: l'account di tuo figlio potrebbe essere
                  disattivato, perché sotto i 14 anni serve la tua autorizzazione.
                </p>
              </div>
              <div v-for="f in figliMinori" :key="`m-${f.studentId}`" class="flex items-center gap-3 py-3">
                <div class="flex-1 min-w-0">
                  <p class="text-[15px]">{{ f.nome }}</p>
                  <p class="text-xs text-pf-grigio">{{ descriviVoce(f.minore14) }}</p>
                </div>
                <USwitch
                  :model-value="f.minore14.valore === true"
                  :loading="inCorso === `MINORE_14:${f.studentId}`"
                  :aria-label="`Autorizzazione del genitore per ${f.nome}`"
                  size="xl"
                  @update:model-value="(v: boolean) => cambia('MINORE_14', v, f.studentId, f.nome)"
                />
              </div>
            </template>

            <div class="py-1">
              <button type="button" class="min-h-11 text-sm font-semibold text-pf-blu hover:text-pf-blu-scuro" :aria-expanded="testiAperti" @click="() => { testiAperti = !testiAperti }">
                {{ testiAperti ? 'Nascondi i testi completi' : 'Leggi i testi completi' }}
              </button>
              <div v-if="testiAperti" class="pb-3 flex flex-col gap-3 text-xs text-pf-grigio-scuro leading-relaxed">
                <p class="whitespace-pre-wrap bg-pf-fondo rounded-xl p-3">{{ CONSENSO_IMMAGINI_TESTO }}</p>
                <p class="whitespace-pre-wrap bg-pf-fondo rounded-xl p-3">{{ CONSENSO_MARKETING_TESTO }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ─── Account: cambia password, si apre sul posto ─── -->
      <section aria-labelledby="t-account">
        <h2 id="t-account" class="mb-2 ml-1 text-[13px] font-bold text-pf-grigio uppercase tracking-wide">Account</h2>
        <div class="bg-white rounded-[22px] px-4 py-1.5 pf-ombra">
          <button type="button" class="w-full min-h-12 flex items-center gap-3 text-left text-[15px]" :aria-expanded="passwordAperta" aria-controls="form-password" @click="() => { passwordAperta = !passwordAperta }">
            <span class="flex-1">Cambia password</span>
            <UIcon :name="passwordAperta ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="size-5 text-pf-grigio" aria-hidden="true" />
          </button>
          <form v-if="passwordAperta" id="form-password" class="pb-4 flex flex-col gap-3" @submit.prevent="cambiaPassword">
            <UFormField label="Password attuale">
              <UInput v-model="pwForm.currentPassword" type="password" autocomplete="current-password" size="xl" class="w-full" />
            </UFormField>
            <UFormField label="Nuova password (minimo 8 caratteri)">
              <UInput v-model="pwForm.newPassword" type="password" autocomplete="new-password" size="xl" class="w-full" />
            </UFormField>
            <UFormField label="Ripeti la nuova password">
              <UInput v-model="pwForm.confirmPassword" type="password" autocomplete="new-password" size="xl" class="w-full" />
            </UFormField>
            <p v-if="pwError" role="alert" class="text-sm text-pf-rosso">{{ pwError }}</p>
            <PortaleBottone type="submit" variante="blu" :loading="savingPw">Aggiorna password</PortaleBottone>
          </form>
        </div>
      </section>

      <!-- ─── Documenti ─── -->
      <section aria-labelledby="t-doc">
        <h2 id="t-doc" class="mb-2 ml-1 text-[13px] font-bold text-pf-grigio uppercase tracking-wide">Documenti</h2>
        <div class="bg-white rounded-[22px] px-4 py-1.5 pf-ombra divide-y divide-pf-fondo">
          <NuxtLink :to="isStudente ? '/privacy-studente' : '/privacy'" class="min-h-12 flex items-center gap-3 text-[15px] hover:text-pf-blu">
            <span class="flex-1">Informativa privacy</span>
            <UIcon name="i-heroicons-chevron-right" class="size-5 text-pf-grigio" aria-hidden="true" />
          </NuxtLink>
          <NuxtLink v-if="!isStudente" to="/termini" class="min-h-12 flex items-center gap-3 text-[15px] hover:text-pf-blu">
            <span class="flex-1">Termini e condizioni</span>
            <UIcon name="i-heroicons-chevron-right" class="size-5 text-pf-grigio" aria-hidden="true" />
          </NuxtLink>
          <NuxtLink to="/regolamento-card" class="min-h-12 flex items-center gap-3 text-[15px] hover:text-pf-blu">
            <span class="flex-1">Regolamento della card studente</span>
            <UIcon name="i-heroicons-chevron-right" class="size-5 text-pf-grigio" aria-hidden="true" />
          </NuxtLink>
        </div>
      </section>

      <!-- ─── Aiuto. Niente "Notifiche sul telefono": rinviate (piano, sezione F) ─── -->
      <section aria-labelledby="t-aiuto">
        <h2 id="t-aiuto" class="mb-2 ml-1 text-[13px] font-bold text-pf-grigio uppercase tracking-wide">Aiuto</h2>
        <div class="bg-white rounded-[22px] px-4 py-1.5 pf-ombra divide-y divide-pf-fondo">
          <a v-if="whatsapp" :href="whatsappSegreteria(whatsapp)" target="_blank" rel="noopener noreferrer" class="min-h-12 flex items-center gap-3 text-[15px] hover:text-pf-blu">
            <span class="flex-1">Scrivi alla segreteria su WhatsApp<span class="sr-only"> (si apre in un'altra finestra)</span></span>
            <span class="text-xs text-pf-grigio">9:00–18:00</span>
          </a>
          <button type="button" class="w-full min-h-12 flex items-center gap-3 text-left text-[15px] hover:text-pf-blu" @click="() => { tutorialRiapri = true }">
            <span class="flex-1">Rivedi il tutorial di benvenuto</span>
            <UIcon name="i-heroicons-chevron-right" class="size-5 text-pf-grigio" aria-hidden="true" />
          </button>
        </div>
      </section>

      <PortaleBottone variante="bordo" blocco :loading="loggingOut" @click="esciDalPortale">Esci dall'account</PortaleBottone>
    </div>

    <!-- Togliere un consenso si chiede sempre: un tocco per sbaglio sullo
         schermo del telefono non deve revocare niente. Darlo invece no: è una
         scelta che si fa apposta e si può disfare subito. -->
    <ConfirmDialog
      v-model:open="confermaAperta"
      :title="daRevocare?.titolo ?? ''"
      :description="daRevocare?.descrizione ?? ''"
      confirm-label="Sì, togli il consenso"
      confirm-color="error"
      :loading="Boolean(inCorso)"
      @confirm="confermaRevoca"
    />
  </div>
</template>

<script setup lang="ts">
import { CONSENSO_IMMAGINI_TESTO, CONSENSO_MARKETING_TESTO } from '#shared/legal'

definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Profilo — Portale Famiglie' })

const toast = useToast()
const { user } = useUserSession()
const isStudente = computed(() => user.value?.role === 'STUDENTE')
const tutorialRiapri = useState('tutorial-riapri', () => false)

const { data: studentsData, pending: pendingStudents } = useLazyFetch<{ id: string; firstName: string; lastName: string; classe: string | null; scuola: string | null; packages: { stati: string[] }[] }[]>('/api/portal/students')
const students = computed(() => studentsData.value ?? [])

const { data: portalConfigs } = useLazyFetch<{ whatsapp_numero?: string }>('/api/portal/configs')
const whatsapp = computed(() => portalConfigs.value?.whatsapp_numero ?? '')

// ─── Consensi privacy (solo genitori) ───
type TipoConsenso = 'MINORE_14' | 'IMMAGINI' | 'MARKETING'
/** `valore: null` = non ha mai risposto (diverso da "ha detto no") */
interface VoceConsenso {
  valore: boolean | null
  quando: string | null
  origine: 'PORTALE' | 'GESTIONALE' | null
}
interface FiglioConsensi {
  studentId: string
  nome: string
  minoreDi14: boolean | null
  minore14: VoceConsenso
  immagini: VoceConsenso
}

const { data: datiConsensi, pending: pendingConsensi, refresh: refreshConsensi } = useLazyFetch<{
  figli: FiglioConsensi[]
  marketing: VoceConsenso
}>('/api/portal/consensi', { server: false, immediate: !isStudente.value })

const figli = computed(() => datiConsensi.value?.figli ?? [])
const marketing = computed<VoceConsenso>(() => datiConsensi.value?.marketing ?? { valore: null, quando: null, origine: null })
// L'autorizzazione si mostra solo per chi la riguarda davvero: sotto i 14 anni,
// oppure se una risposta c'è già (magari il ragazzo nel frattempo li ha compiuti)
const figliMinori = computed(() => figli.value.filter((f) => f.minoreDi14 === true || f.minore14.valore !== null))

const testiAperti = ref(false)
const passwordAperta = ref(false)
// Chiave "TIPO:studentId" dell'interruttore che sta salvando in questo momento
const inCorso = ref<string | null>(null)

function descriviVoce(v: VoceConsenso): string {
  if (v.valore === null) return 'Non hai ancora risposto'
  const quando = v.quando
    ? new Date(v.quando).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const dove = v.origine === 'GESTIONALE' ? ' (registrato in segreteria)' : ''
  return `${v.valore ? 'Sì, dato' : 'No, non dato'}${quando ? ` il ${quando}` : ''}${dove}`
}

// Revoca in attesa di conferma
const confermaAperta = ref(false)
const daRevocare = ref<{ tipo: TipoConsenso; studentId?: string; titolo: string; descrizione: string } | null>(null)

function cambia(tipo: TipoConsenso, valore: boolean, studentId?: string, nome?: string) {
  if (valore) return salva(tipo, true, studentId)

  const chi = nome ?? 'te'
  const testi: Record<TipoConsenso, { titolo: string; descrizione: string }> = {
    IMMAGINI: {
      titolo: 'Togliere il consenso alle foto?',
      descrizione: `Da adesso non useremo più foto e video di ${chi}, e toglieremo dai nostri canali quelle già pubblicate appena possibile. Il servizio non cambia in nulla.`,
    },
    MARKETING: {
      titolo: 'Non ricevere più le promozioni?',
      descrizione: 'Continuerai a ricevere tutte le comunicazioni che riguardano il servizio: lezioni, pagamenti e avvisi. Smetterai di ricevere solo le novità e le promozioni.',
    },
    MINORE_14: {
      titolo: `Togliere l'autorizzazione per ${chi}?`,
      descrizione: `Il Centro verrà avvisato e ti ricontatterà. Sotto i 14 anni l'autorizzazione di un genitore è necessaria, quindi l'account di ${chi} potrebbe essere disattivato.`,
    },
  }

  daRevocare.value = { tipo, studentId, ...testi[tipo] }
  confermaAperta.value = true
}

async function confermaRevoca() {
  const r = daRevocare.value
  if (!r) return
  await salva(r.tipo, false, r.studentId)
  confermaAperta.value = false
  daRevocare.value = null
}

async function salva(tipo: TipoConsenso, valore: boolean, studentId?: string) {
  inCorso.value = `${tipo}:${studentId ?? ''}`
  try {
    await $fetch('/api/portal/consensi', { method: 'POST', body: { tipo, valore, studentId } })
    await refreshConsensi()
    toast.add({ title: valore ? 'Consenso registrato' : 'Consenso tolto', color: 'success' })
  } catch (e: any) {
    toast.add({
      title: 'Non è stato possibile salvare',
      description: e?.data?.statusMessage ?? 'Riprova fra poco.',
      color: 'error',
    })
  } finally {
    inCorso.value = null
  }
}

// ─── Password ───
const pwForm = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const pwError = ref('')
const savingPw = ref(false)
const loggingOut = ref(false)

async function cambiaPassword() {
  pwError.value = ''
  if (pwForm.newPassword.length < 8) {
    pwError.value = 'La nuova password deve essere di almeno 8 caratteri'
    return
  }
  if (pwForm.newPassword !== pwForm.confirmPassword) {
    pwError.value = 'Le password non coincidono'
    return
  }
  savingPw.value = true
  try {
    // Lo STUDENTE usa l'endpoint condiviso (profile.put è riservato ai genitori)
    if (isStudente.value) {
      await $fetch('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword },
      })
    } else {
      await $fetch('/api/portal/profile', {
        method: 'PUT',
        body: { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword },
      })
    }
    toast.add({ title: 'Password aggiornata', color: 'success' })
    pwForm.currentPassword = ''
    pwForm.newPassword = ''
    pwForm.confirmPassword = ''
    passwordAperta.value = false
  } catch (e: any) {
    pwError.value = e?.data?.statusMessage ?? 'Errore durante il cambio password'
  } finally {
    savingPw.value = false
  }
}

async function esciDalPortale() {
  loggingOut.value = true
  try {
    const { clear } = useUserSession()
    await clear()
    await navigateTo('/login', { external: true })
  } catch {
    loggingOut.value = false
  }
}
</script>
