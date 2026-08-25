<template>
  <UModal v-model:open="aperto" title="Annota chiamata / messaggio" :ui="{ content: 'max-w-xl' }">
    <template #body>
      <form class="space-y-4" @submit.prevent="salva">

        <p class="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
          Contatto: <span class="font-semibold">{{ nomeContatto(contatto) }}</span>
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Tipo" name="tipo">
            <USelect v-model="form.tipo" :items="TIPI_INTERAZIONE_ITEMS" class="w-full" />
          </UFormField>
          <UFormField label="Chi ha contattato chi" name="direzione">
            <USelect v-model="form.direzione" :items="DIREZIONI_ITEMS" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Canale" name="canale">
            <USelect v-model="form.canale" :items="CANALI_ITEMS" class="w-full" />
          </UFormField>
          <UFormField label="Com'è andata" name="esito" hint="Facoltativo">
            <USelect v-model="form.esito" :items="ESITI_OPZIONALI_ITEMS" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Data e ora" name="data">
          <UInput v-model="form.data" type="datetime-local" class="w-full" />
        </UFormField>

        <UFormField label="Cosa vi siete detti" name="note">
          <UTextarea v-model="form.note" :rows="3" class="w-full" placeholder="Interessata, vuole una prova a settembre…" />
        </UFormField>

        <!-- Con lo stesso salvataggio si aggiorna anche la scheda del contatto -->
        <div class="rounded-xl border border-slate-200 p-3 space-y-3">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Aggiorna il contatto</p>

          <UFormField
            label="Prossimo ricontatto" name="prossimoRicontatto"
            hint="Lascia vuoto per togliere il promemoria"
          >
            <div class="space-y-2">
              <UInput v-model="form.prossimoRicontatto" type="date" class="w-full" />
              <div class="flex flex-wrap gap-2">
                <UButton size="xs" variant="soft" color="neutral" @click="impostaRicontatto(1)">Domani</UButton>
                <UButton size="xs" variant="soft" color="neutral" @click="impostaRicontatto(3)">Tra 3 giorni</UButton>
                <UButton size="xs" variant="soft" color="neutral" @click="impostaRicontatto(7)">Tra una settimana</UButton>
                <UButton size="xs" variant="ghost" color="neutral" @click="impostaRicontatto(null)">Nessuno</UButton>
              </div>
            </div>
          </UFormField>

          <UFormField label="Nuovo stato" name="nuovoStato" hint="Si salva solo se lo cambi">
            <USelect v-model="form.stato" :items="STATI_ITEMS" class="w-full" />
          </UFormField>
        </div>

        <p v-if="erroreGenerale" class="text-sm text-red-600">{{ erroreGenerale }}</p>
      </form>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3 w-full">
        <UButton variant="ghost" :disabled="salvando" @click="() => { aperto = false }">Annulla</UButton>
        <UButton :loading="salvando" @click="salva">Salva annotazione</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// Mini-modulo del diario: una riga di "cosa è successo" e, con lo stesso
// salvataggio, il nuovo promemoria e il nuovo stato del contatto.
import {
  TIPI_INTERAZIONE_ITEMS, DIREZIONI_ITEMS, CANALI_ITEMS, ESITI_OPZIONALI_ITEMS, STATI_ITEMS,
  NON_SPECIFICATO, giornoPiu, adessoPerInput, inputInIso, nomeContatto,
} from '~/utils/contatti'
import type { Contatto } from '~/utils/contatti'

const props = defineProps<{ contatto: Contatto }>()
const emit = defineEmits<{ saved: [] }>()
const aperto = defineModel<boolean>('open', { default: false })

const toast = useToast()

const form = reactive({
  tipo:               'CHIAMATA',
  direzione:          'EFFETTUATA',
  canale:             'TELEFONO',
  esito:              NON_SPECIFICATO,
  data:               adessoPerInput(),
  note:               '',
  prossimoRicontatto: '',
  stato:              'NUOVO',
})

// A ogni apertura si riparte dai valori più probabili: adesso, canale = fonte
// del contatto, stato attuale già selezionato.
watch(aperto, (adessoAperto) => {
  if (!adessoAperto) return
  erroreGenerale.value = ''
  Object.assign(form, {
    tipo:               'CHIAMATA',
    direzione:          'EFFETTUATA',
    canale:             props.contatto.canaleOrigine ?? 'TELEFONO',
    esito:              NON_SPECIFICATO,
    data:               adessoPerInput(),
    note:               '',
    prossimoRicontatto: props.contatto.prossimoRicontatto ?? '',
    stato:              props.contatto.stato,
  })
})

const salvando = ref(false)
const erroreGenerale = ref('')

// Scorciatoie del promemoria: null = "Nessuno" (toglie la data)
function impostaRicontatto(giorni: number | null) {
  form.prossimoRicontatto = giorni === null ? '' : giornoPiu(giorni)
}

async function salva() {
  erroreGenerale.value = ''
  salvando.value = true
  try {
    await $fetch(`/api/contacts/${props.contatto.id}/interactions`, {
      method: 'POST',
      body: {
        tipo:      form.tipo,
        direzione: form.direzione,
        canale:    form.canale,
        esito:     form.esito === NON_SPECIFICATO ? null : form.esito,
        note:      form.note.trim() === '' ? null : form.note.trim(),
        data:      inputInIso(form.data),
        // Il promemoria si invia sempre (vuoto = toglilo); lo stato solo se cambiato
        prossimoRicontatto: form.prossimoRicontatto,
        nuovoStato: form.stato !== props.contatto.stato ? form.stato : undefined,
      },
    })

    toast.add({ title: 'Annotazione salvata', color: 'success' })
    aperto.value = false
    emit('saved')
  } catch (err: any) {
    const messaggio = err?.data?.statusMessage ?? 'Non è stato possibile salvare l’annotazione'
    const campi = err?.data?.data?.errors as Record<string, string[]> | undefined
    const primo = campi ? Object.values(campi)[0]?.[0] : undefined
    erroreGenerale.value = primo ?? messaggio
    toast.add({ title: messaggio, description: primo, color: 'error' })
  } finally {
    salvando.value = false
  }
}
</script>
