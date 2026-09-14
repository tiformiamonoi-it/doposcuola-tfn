<template>
  <div class="space-y-6">
    <h2 class="font-heading text-xl font-bold text-slate-900">Il mio account</h2>

    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-user-circle" class="w-4 h-4 text-tfn-500" />
          <span class="font-medium text-slate-800">Dati account</span>
        </div>
      </template>
      <dl class="space-y-2 text-sm">
        <div class="flex justify-between py-1 border-b border-slate-100">
          <span class="text-slate-500">Nome</span>
          <span class="font-medium text-slate-800">{{ [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '—' }}</span>
        </div>
        <div class="flex justify-between py-1">
          <span class="text-slate-500">Email</span>
          <span class="font-medium text-slate-800">{{ user?.email }}</span>
        </div>
      </dl>
    </UCard>

    <UCard v-if="!isStudente">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-academic-cap" class="w-4 h-4 text-tfn-500" />
          <span class="font-medium text-slate-800">Figli collegati</span>
        </div>
      </template>
      <template v-if="pendingStudents">
        <USkeleton class="h-8 w-full" />
      </template>
      <template v-else-if="students.length === 0">
        <p class="text-sm text-slate-500">Nessuno studente collegato.</p>
      </template>
      <ul v-else class="space-y-1">
        <li v-for="s in students" :key="s.id" class="flex items-center gap-2 text-sm py-1">
          <UIcon name="i-heroicons-user" class="w-4 h-4 text-slate-400" />
          <span class="text-slate-800">{{ s.firstName }} {{ s.lastName }}</span>
          <span v-if="s.classe" class="text-slate-400">— {{ s.classe }}</span>
        </li>
      </ul>
    </UCard>

    <!-- ─── CONSENSI (solo genitori) ───
         Qui stanno le scelte FACOLTATIVE: foto/video e comunicazioni promozionali.
         Non sono nella schermata d'ingresso apposta — un consenso raccolto in mezzo
         a quelli obbligatori non sarebbe libero, e quindi non varrebbe niente.
         La dichiarazione per i minori di 14 anni compare qui in sola lettura, con
         la possibilità di revocarla: è un diritto, e toglierla non chiude fuori
         nessuno dal portale. -->
    <UCard v-if="!isStudente">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-shield-check" class="w-4 h-4 text-tfn-500" />
          <span class="font-medium text-slate-800">Consensi privacy</span>
        </div>
      </template>

      <USkeleton v-if="pendingConsensi" class="h-24 w-full" />

      <div v-else class="space-y-5">
        <!-- Foto e video, uno per figlio -->
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-slate-800">Foto e video</p>
              <p class="text-xs text-slate-500">Facoltativo: se dici di no, il servizio resta identico in tutto.</p>
            </div>
          </div>

          <div v-for="f in figli" :key="f.studentId" class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 first:border-0 first:pt-0">
            <div class="min-w-0">
              <p class="text-sm text-slate-800">{{ f.nome }}</p>
              <p class="text-xs text-slate-500">{{ descriviVoce(f.immagini) }}</p>
            </div>
            <USwitch
              :model-value="f.immagini.valore === true"
              :loading="inCorso === `IMMAGINI:${f.studentId}`"
              :aria-label="`Consenso alle immagini per ${f.nome}`"
              @update:model-value="(v: boolean) => cambia('IMMAGINI', v, f.studentId, f.nome)"
            />
          </div>

          <UCollapsible v-model:open="testoImmaginiAperto">
            <button type="button" class="text-xs text-tfn-600 hover:underline">
              {{ testoImmaginiAperto ? 'Nascondi il testo' : 'Leggi il testo completo' }}
            </button>
            <template #content>
              <p class="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed mt-2 bg-slate-50 rounded-lg p-3">{{ CONSENSO_IMMAGINI_TESTO }}</p>
            </template>
          </UCollapsible>
        </div>

        <!-- Comunicazioni promozionali: è della persona, non del figlio -->
        <div class="space-y-2 border-t border-slate-100 pt-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-slate-800">Comunicazioni promozionali</p>
              <p class="text-xs text-slate-500">{{ descriviVoce(marketing) }}</p>
            </div>
            <USwitch
              :model-value="marketing.valore === true"
              :loading="inCorso === 'MARKETING:'"
              aria-label="Consenso alle comunicazioni promozionali"
              @update:model-value="(v: boolean) => cambia('MARKETING', v)"
            />
          </div>
          <UCollapsible v-model:open="testoMarketingAperto">
            <button type="button" class="text-xs text-tfn-600 hover:underline">
              {{ testoMarketingAperto ? 'Nascondi il testo' : 'Leggi il testo completo' }}
            </button>
            <template #content>
              <p class="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed mt-2 bg-slate-50 rounded-lg p-3">{{ CONSENSO_MARKETING_TESTO }}</p>
            </template>
          </UCollapsible>
        </div>

        <!-- Autorizzazione per i minori di 14 anni -->
        <div v-if="figliMinori.length > 0" class="space-y-2 border-t border-slate-100 pt-4">
          <p class="text-sm font-medium text-slate-800">Autorizzazione per i minori di 14 anni</p>
          <div v-for="f in figliMinori" :key="f.studentId" class="flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm text-slate-800">{{ f.nome }}</p>
              <p class="text-xs text-slate-500">{{ descriviVoce(f.minore14) }}</p>
            </div>
            <USwitch
              :model-value="f.minore14.valore === true"
              :loading="inCorso === `MINORE_14:${f.studentId}`"
              :aria-label="`Autorizzazione del genitore per ${f.nome}`"
              @update:model-value="(v: boolean) => cambia('MINORE_14', v, f.studentId, f.nome)"
            />
          </div>
          <p class="text-xs text-slate-500">
            Se la togli, il Centro viene avvisato e ti ricontatta: l'account di tuo figlio potrebbe
            essere disattivato, perché sotto i 14 anni serve la tua autorizzazione.
          </p>
        </div>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-lock-closed" class="w-4 h-4 text-tfn-500" />
          <span class="font-medium text-slate-800">Cambia password</span>
        </div>
      </template>
      <div class="space-y-3">
        <UFormField label="Password attuale">
          <UInput v-model="pwForm.currentPassword" type="password" class="w-full" />
        </UFormField>
        <UFormField label="Nuova password (minimo 8 caratteri)">
          <UInput v-model="pwForm.newPassword" type="password" class="w-full" />
        </UFormField>
        <UFormField label="Ripeti nuova password">
          <UInput v-model="pwForm.confirmPassword" type="password" class="w-full" />
        </UFormField>
        <p v-if="pwError" class="text-xs text-red-500">{{ pwError }}</p>
      </div>
      <template #footer>
        <UButton color="primary" :loading="savingPw" @click="cambiaPassword">
          Aggiorna password
        </UButton>
      </template>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-document-text" class="w-4 h-4 text-tfn-500" />
          <span class="font-medium text-slate-800">Documentazione e Privacy</span>
        </div>
      </template>
      <div class="space-y-2 text-sm">
        <NuxtLink :to="isStudente ? '/privacy-studente' : '/privacy'" class="flex items-center justify-between py-2 border-b border-slate-100 text-slate-600 hover:text-indigo-600 transition-colors">
          <span>Privacy Policy</span>
          <UIcon name="i-heroicons-chevron-right" class="w-4 h-4" />
        </NuxtLink>
        <NuxtLink v-if="!isStudente" to="/termini" class="flex items-center justify-between py-2 text-slate-600 hover:text-indigo-600 transition-colors">
          <span>Termini e Condizioni</span>
          <UIcon name="i-heroicons-chevron-right" class="w-4 h-4" />
        </NuxtLink>
      </div>
    </UCard>

    <UButton
      block
      variant="soft"
      icon="i-heroicons-play-circle"
      @click="() => { tutorialRiapri = true }"
    >
      Rivedi il tutorial di benvenuto
    </UButton>

    <UButton
      block
      variant="outline"
      color="error"
      icon="i-heroicons-arrow-right-on-rectangle"
      :loading="loggingOut"
      @click="esciDalPortale"
    >
      Esci dall'account
    </UButton>

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
definePageMeta({
  layout: 'portal',
  middleware: ['portal-only'],
})
useHead({ title: 'Profilo — Portale Famiglie' })

const toast = useToast()
const { user } = useUserSession()
const isStudente = computed(() => user.value?.role === 'STUDENTE')
const tutorialRiapri = useState('tutorial-riapri', () => false)

const { data: studentsData, pending: pendingStudents } = useLazyFetch('/api/portal/students')
const students = computed(() => (studentsData.value as any[]) ?? [])

// ─── Consensi privacy (solo genitori) ───
import { CONSENSO_IMMAGINI_TESTO, CONSENSO_MARKETING_TESTO } from '#shared/legal'

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
}>('/api/portal/consensi', { server: false })

const figli = computed(() => datiConsensi.value?.figli ?? [])
const marketing = computed<VoceConsenso>(() => datiConsensi.value?.marketing ?? { valore: null, quando: null, origine: null })
// L'autorizzazione si mostra solo per chi la riguarda davvero: sotto i 14 anni,
// oppure se una risposta c'è già (magari il ragazzo nel frattempo li ha compiuti)
const figliMinori = computed(() => figli.value.filter((f) => f.minoreDi14 === true || f.minore14.valore !== null))

const testoImmaginiAperto  = ref(false)
const testoMarketingAperto = ref(false)
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

