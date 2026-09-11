<template>
  <!-- Modulo "Nuovo Tutor" -->
  <UModal v-model:open="isOpen" title="Nuovo Tutor">
    <template #body>
      <UForm :state="nuovoTutor" class="space-y-4" @submit="creaTutor">
        <!-- Da telefono una colonna sola: due campi affiancati sarebbero troppo stretti -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField name="firstName" label="Nome" required>
            <UInput v-model="nuovoTutor.firstName" placeholder="Marco" class="w-full" />
          </UFormField>
          <UFormField name="lastName" label="Cognome" required>
            <UInput v-model="nuovoTutor.lastName" placeholder="Rossi" class="w-full" />
          </UFormField>
        </div>
        <UFormField name="email" label="Email (per il login)" required>
          <UInput v-model="nuovoTutor.email" type="email" placeholder="marco@email.it" class="w-full" />
        </UFormField>
        <UFormField name="password" label="Password iniziale" required hint="Visibile solo ora: comunicala al tutor">
          <div class="flex gap-2">
            <UInput v-model="nuovoTutor.password" type="text" placeholder="min. 8 caratteri" class="flex-1" />
            <UButton icon="i-heroicons-arrow-path" variant="soft" color="neutral" @click="() => { nuovoTutor.password = generaPasswordCasuale() }">
              Genera
            </UButton>
          </div>
        </UFormField>
        <UFormField name="phone" label="Telefono">
          <UInput v-model="nuovoTutor.phone" placeholder="+39 333 1234567" class="w-full" />
        </UFormField>
        <!-- Facoltativa: serve al campanellino dei compleanni -->
        <UFormField name="dataNascita" label="Data di nascita" hint="Facoltativa">
          <UInput v-model="nuovoTutor.dataNascita" type="date" class="w-full" />
        </UFormField>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField name="role" label="Ruolo">
            <USelect
              v-model="nuovoTutor.role"
              :items="[
                { label: 'Tutor', value: 'TUTOR' },
                { label: 'Admin', value: 'ADMIN' },
                { label: 'Super Tutor', value: 'SUPER_TUTOR' },
              ]"
              class="w-full"
            />
          </UFormField>
          <UFormField name="modalitaPagamento" label="Modalità compenso">
            <USelect
              v-model="nuovoTutor.modalitaPagamento"
              :items="[{ label: 'A ore (tariffa oraria)', value: 'ORE' }, { label: 'Forfait mensile', value: 'FORFAIT' }]"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField v-if="nuovoTutor.modalitaPagamento === 'FORFAIT'" name="importoForfait" label="Importo forfait (€)">
          <UInput v-model="nuovoTutor.importoForfait" type="number" placeholder="500" class="w-full" />
        </UFormField>

        <!-- Solo se si arriva da un contatto: le materie che ha detto di insegnare
             non sono un campo del modulo, finiscono sul profilo subito dopo la creazione -->
        <p
          v-if="materieDalContatto.length > 0"
          class="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 flex items-start gap-1.5"
        >
          <UIcon name="i-heroicons-book-open" class="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
          <span>
            Materie dal contatto: <strong>{{ materieDalContatto.join(', ') }}</strong>
            — verranno salvate sul profilo del tutor
          </span>
        </p>

        <div class="flex justify-end gap-3 pt-2">
          <UButton variant="ghost" @click="() => { isOpen = false }">Annulla</UButton>
          <UButton type="submit" :loading="salvando">Crea Tutor</UButton>
        </div>
      </UForm>
    </template>
  </UModal>

  <!-- Tutor creato: link "scegli la tua password" da mandare al tutor -->
  <UModal v-model:open="modalLinkAperto" title="Tutor creato">
    <template #body>
      <LinkPrimoAccesso
        v-if="linkNuovoTutor"
        :link="linkNuovoTutor.link"
        :email="linkNuovoTutor.email"
        :nome="linkNuovoTutor.nome"
        :email-inviata="linkNuovoTutor.emailInviata"
        :motivo-email="linkNuovoTutor.motivoEmail"
        :dettaglio-email="linkNuovoTutor.dettaglioEmail"
      />
    </template>
    <template #footer>
      <div class="flex justify-end">
        <UButton variant="ghost" @click="() => { modalLinkAperto = false }">Chiudi</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// IL MODULO "NUOVO TUTOR" (e la finestra "Tutor creato" che lo segue).
// È nato dentro la pagina Tutor; vive qui da solo perché ora serve anche alla
// scheda di un contatto: un candidato tutor diventa tutor con "Crea tutor", e il
// modulo si apre già compilato coi suoi dati. Senza `prefill` si comporta
// esattamente come prima: stessi campi, stessi controlli, stessi messaggi.
import type { EsitoInvitoEmail } from '#shared/email'

// Dati già noti, presi dalla scheda contatto. Nome, cognome, email e telefono
// finiscono nei campi e restano tutti modificabili.
interface PrefillTutor {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  /** Le materie che insegna: si salvano sul profilo del tutor dopo la creazione */
  materie?: string[]
}

const props = defineProps<{ prefill?: PrefillTutor | null }>()
const emit = defineEmits<{
  /** Il tutor esiste: id del suo account e "Nome Cognome" (serve a chi ha aperto il modulo, per collegarlo) */
  created: [dati: { userId: string; nome: string }]
}>()
const isOpen = defineModel<boolean>('open', { default: false })

const toast = useToast()

// Link "scegli la tua password" del tutor appena creato: resta a schermo finché
// la segreteria non lo chiude, così può copiarlo e mandarlo su WhatsApp.
const modalLinkAperto = ref(false)
const linkNuovoTutor = ref<({ link: string; email: string; nome: string } & EsitoInvitoEmail) | null>(null)
const salvando = ref(false)
const nuovoTutor = reactive({
  firstName:         '',
  lastName:          '',
  email:             '',
  password:          '',
  phone:             '',
  dataNascita:       '',
  role:              'TUTOR',
  modalitaPagamento: 'ORE',
  importoForfait:    '',
})

// ─── Precompilazione (solo se arriva `prefill`) ───
// A ogni apertura si riscrivono i dati del contatto, così si vede subito cosa è
// già compilato e lo si corregge. L'email può mancare (c'è chi ha lasciato solo
// il telefono o un profilo social): il campo resta vuoto e obbligatorio.
// Senza `prefill` non succede niente e il modulo tiene quello che era stato
// scritto prima di "Annulla", come ha sempre fatto nella pagina Tutor.
watch(isOpen, (apertoAdesso) => {
  const p = props.prefill
  if (!apertoAdesso || !p) return
  Object.assign(nuovoTutor, {
    firstName: p.firstName ?? '',
    lastName:  p.lastName ?? '',
    email:     p.email ?? '',
    phone:     p.phone ?? '',
  })
}, { immediate: true })

const materieDalContatto = computed(() => props.prefill?.materie ?? [])

async function creaTutor() {
  if (!nuovoTutor.firstName || !nuovoTutor.lastName || !nuovoTutor.email || !nuovoTutor.password) {
    toast.add({ title: 'Campi obbligatori mancanti', color: 'error' })
    return
  }
  // Le materie si fotografano adesso: appena il tutor esiste la scheda del
  // contatto si ricarica, e il salvataggio qui sotto non deve dipendere da quello.
  const materie = [...materieDalContatto.value]
  salvando.value = true
  try {
    const res = await $fetch('/api/tutors', {
      method: 'POST',
      body: {
        ...nuovoTutor,
        phone:          nuovoTutor.phone || null,
        // Campo vuoto = "non lo so": a database ci va NULL, non una stringa vuota
        dataNascita:    nuovoTutor.dataNascita || null,
        importoForfait: nuovoTutor.importoForfait || null,
      },
    }) as any
    toast.add({ title: 'Tutor creato con successo', color: 'success' })
    // Preso prima di svuotare il modulo, per chi ci ha aperto
    const nome = `${nuovoTutor.firstName} ${nuovoTutor.lastName}`.trim()
    linkNuovoTutor.value = {
      link:         res?.linkPassword ?? '',
      email:        res?.user?.email ?? nuovoTutor.email,
      nome:         nuovoTutor.firstName,
      emailInviata: res?.emailInviata === true,
      motivoEmail:    res?.motivoEmail,
      dettaglioEmail: res?.dettaglioEmail,
    }
    modalLinkAperto.value = Boolean(linkNuovoTutor.value.link)
    isOpen.value = false
    Object.assign(nuovoTutor, {
      firstName: '', lastName: '', email: '', password: '',
      phone: '', dataNascita: '', role: 'TUTOR', modalitaPagamento: 'ORE', importoForfait: '',
    })

    const userId: string | undefined = res?.user?.id
    if (userId) {
      // Il tutor esiste: lo diciamo subito a chi ha aperto il modulo (la pagina
      // Tutor aggiorna l'elenco, la scheda contatto lo collega e lo segna Convertito).
      emit('created', { userId, nome })

      // Le materie sono un secondo passo, a parte: se va storto il tutor NON si
      // annulla (è già creato e il link è già partito), si avvisa soltanto.
      if (materie.length > 0) {
        try {
          // Indirizzo tenuto come testo semplice: scritto "a stampo" TypeScript lo
          // confonde con /api/tutors/today-pool (solo lettura) e rifiuterebbe il PUT.
          const indirizzoTutor: string = `/api/tutors/${userId}`
          await $fetch(indirizzoTutor, { method: 'PUT', body: { materie } })
        } catch {
          toast.add({
            title: 'Tutor creato, ma le materie non sono state salvate: aggiungile dalla sua scheda',
            color: 'warning',
          })
        }
      }
    }
  } catch (err: any) {
    const msg = err.data?.statusMessage ?? 'Errore nella creazione'
    const errors = err.data?.data?.errors
    const fieldNames: Record<string, string> = {
      firstName: 'Nome', lastName: 'Cognome', email: 'Email',
      password: 'Password', phone: 'Telefono', dataNascita: 'Data di nascita', role: 'Ruolo',
      modalitaPagamento: 'Modalità compenso', importoForfait: 'Importo forfait',
    }
    let desc = ''
    if (errors) {
      desc = Object.entries(errors).map(([k, v]) => `${fieldNames[k] ?? k}: ${v}`).join(' | ')
    }
    toast.add({ title: msg, description: desc, color: 'error' })
  } finally {
    salvando.value = false
  }
}
</script>
