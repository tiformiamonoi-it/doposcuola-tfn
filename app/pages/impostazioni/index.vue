<template>
  <div class="space-y-6">

    <!-- Intestazione -->
    <div>
      <h2 class="text-xl font-semibold text-slate-900">Impostazioni</h2>
      <p class="text-sm text-slate-500 mt-0.5">Configura il gestionale: pacchetti standard e parametri generali</p>
    </div>

    <!-- Da mobile i tab non entrano tutti: la lista scorre in orizzontale -->
    <UTabs
      :ui="{ list: 'overflow-x-auto', trigger: 'shrink-0' }"
      :items="[
      { label: 'Pacchetti Standard', slot: 'pacchetti' },
      { label: 'Slot Orari', slot: 'slot' },
      { label: 'Materie & Tariffe', slot: 'materie_tariffe' },
      { label: 'Categorie Contabili', slot: 'categorie' },
      { label: 'Spese Fisse', slot: 'spese' },
      { label: 'Chiusure', slot: 'chiusure' },
      { label: 'Sconti', slot: 'sconti' },
      { label: 'Email', slot: 'email' }
    ]">
      <template #pacchetti>
        <UCard class="mt-4">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4 text-tfn-500" />
            <span class="font-medium text-slate-800">Pacchetti Standard</span>
            <UBadge color="neutral" variant="subtle">{{ templates.length }}</UBadge>
          </div>
          <UButton icon="i-heroicons-plus" size="sm" @click="apriModalCrea">Aggiungi template</UButton>
        </div>
      </template>

      <div v-if="pendingTemplates" class="space-y-2 py-2">
        <USkeleton v-for="i in 3" :key="i" class="h-14 w-full" />
      </div>

      <div v-else-if="templates.length === 0" class="py-10 text-center text-slate-400 text-sm">
        <UIcon name="i-heroicons-squares-2x2" class="w-8 h-8 mx-auto mb-2 text-slate-300" />
        Nessun template configurato. Aggiungine uno per poterlo selezionare nella creazione pacchetti.
      </div>

      <div v-else class="divide-y divide-slate-100">
        <div
          v-for="t in templates"
          :key="t.id"
          class="flex items-center justify-between py-3 px-1 hover:bg-slate-50 rounded"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-medium text-sm text-slate-800">{{ t.nome }}</span>
              <UBadge color="neutral" variant="outline" size="xs">{{ t.tipo }}</UBadge>
              <UBadge color="info" variant="subtle" size="xs">{{ t.categoria }}</UBadge>
              <UBadge v-if="t.inUso > 0" color="success" variant="subtle" size="xs" title="Pacchetti creati partendo da questo template">
                usato da {{ t.inUso }} {{ t.inUso === 1 ? 'pacchetto' : 'pacchetti' }}
              </UBadge>
              <UBadge v-else color="neutral" variant="subtle" size="xs">mai usato</UBadge>
            </div>
            <p class="text-xs text-slate-500 mt-0.5">
              {{ t.oreIncluse }} ore
              <template v-if="t.tipo === 'MENSILE' && t.giorniInclusi"> · {{ t.giorniInclusi }} giorni · {{ t.orarioGiornaliero }}h/giorno</template>
              <template v-else-if="t.tipo === 'A_CONSUMO'"> · € {{ parseFloat(t.tariffaOraria || '0').toFixed(2) }}/h</template>
              · € {{ parseFloat(t.prezzoStandard).toFixed(2) }}
              <span v-if="t.descrizione" class="ml-2 text-slate-400">— {{ t.descrizione }}</span>
            </p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <!-- La matita la vede solo l'amministratore: il listino è una decisione economica.
                 Il server rifiuta comunque la modifica a chiunque altro (403), questo v-if serve
                 solo a non mostrare un bottone che porterebbe a un errore. -->
            <UButton
              v-if="isAdmin"
              icon="i-heroicons-pencil-square"
              variant="ghost"
              color="neutral"
              size="xs"
              :aria-label="`Modifica il modello ${t.nome}`"
              title="Modifica questo modello (i pacchetti già venduti non cambiano)"
              @click="apriModalModifica(t)"
            />
            <UButton
              icon="i-heroicons-trash"
              variant="ghost"
              color="error"
              size="xs"
              :loading="eliminando === t.id"
              :aria-label="`Archivia il modello ${t.nome}`"
              title="Archivia template (i pacchetti già creati non cambiano)"
              @click="eliminaTemplate(t)"
            />
          </div>
        </div>
      </div>

      <!-- ─── Template archiviati (ripristinabili) ─── -->
      <div v-if="templatesArchiviati.length > 0" class="mt-4 pt-3 border-t border-slate-100">
        <button
          type="button"
          class="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
          @click="mostraArchiviati = !mostraArchiviati"
        >
          <UIcon name="i-heroicons-chevron-right" class="w-3.5 h-3.5 transition-transform" :class="mostraArchiviati ? 'rotate-90' : ''" />
          <UIcon name="i-heroicons-archive-box" class="w-3.5 h-3.5" />
          Template archiviati ({{ templatesArchiviati.length }})
        </button>

        <div v-if="mostraArchiviati" class="mt-2 divide-y divide-slate-100">
          <div v-for="t in templatesArchiviati" :key="t.id" class="flex items-center justify-between py-2.5 px-1">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm text-slate-500 line-through">{{ t.nome }}</span>
                <UBadge color="neutral" variant="outline" size="xs">{{ t.tipo }}</UBadge>
                <UBadge v-if="t.inUso > 0" color="neutral" variant="subtle" size="xs">
                  usato da {{ t.inUso }} {{ t.inUso === 1 ? 'pacchetto' : 'pacchetti' }}
                </UBadge>
              </div>
              <p class="text-xs text-slate-400 mt-0.5">
                {{ t.oreIncluse }} ore · € {{ parseFloat(t.prezzoStandard).toFixed(2) }}
              </p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <!-- Anche un modello archiviato si può correggere: serve a sistemarlo PRIMA di
                   rimetterlo in elenco, invece di ripristinarlo con il prezzo sbagliato. -->
              <UButton
                v-if="isAdmin"
                icon="i-heroicons-pencil-square"
                variant="ghost"
                color="neutral"
                size="xs"
                :aria-label="`Modifica il modello archiviato ${t.nome}`"
                title="Modifica questo modello archiviato"
                @click="apriModalModifica(t)"
              />
              <UButton
                icon="i-heroicons-arrow-uturn-left"
                variant="ghost"
                color="primary"
                size="xs"
                :loading="ripristinando === t.id"
                title="Rimetti in elenco"
                @click="ripristinaTemplate(t)"
              >
                Ripristina
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </UCard>
      </template>

      <template #slot>
        <!-- ─── SEZIONE SLOT ORARI ─── -->
        <UCard class="mt-4">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-clock" class="w-4 h-4 text-tfn-500" />
            <span class="font-medium text-slate-800">Slot Orari</span>
            <UBadge color="neutral" variant="subtle">{{ timeslots.length }}</UBadge>
          </div>
          <UButton icon="i-heroicons-plus" size="sm" @click="apriModalCreaSlot">Aggiungi Slot</UButton>
        </div>
      </template>

      <div v-if="pendingSlots" class="space-y-2 py-2">
        <USkeleton v-for="i in 3" :key="i" class="h-10 w-full" />
      </div>
      <div v-else-if="timeslots.length === 0" class="py-10 text-center text-slate-400 text-sm">
        <UIcon name="i-heroicons-clock" class="w-8 h-8 mx-auto mb-2 text-slate-300" />
        Nessun orario configurato. Aggiungine uno per poterlo selezionare nel calendario lezioni.
      </div>
      <div v-else class="divide-y divide-slate-100">
        <div v-for="s in timeslots" :key="s.id" class="flex items-center justify-between py-3 px-1 hover:bg-slate-50 rounded">
          <div class="flex items-center gap-4">
            <span class="font-semibold text-slate-800">{{ s.oraInizio }} - {{ s.oraFine }}</span>
            <span v-if="s.descrizione" class="text-sm text-slate-500 hidden sm:inline-block">{{ s.descrizione }}</span>
          </div>
          <div class="flex items-center gap-3">
            <USwitch :model-value="s.active" @update:model-value="toggleSlot(s, $event)" />
            <UButton icon="i-heroicons-trash" variant="ghost" color="error" size="xs" :loading="eliminandoSlot === s.id" @click="eliminaSlot(s)" />
          </div>
        </div>
      </div>
        </UCard>
      </template>

      <template #materie_tariffe>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <!-- CARD MATERIE -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-book-open" class="w-4 h-4 text-tfn-500" />
                <span class="font-medium text-slate-800">Materie</span>
              </div>
            </template>
            <div class="space-y-3">
              <div class="flex gap-2">
                <UInput v-model="nuovaMateria" placeholder="Nuova materia..." class="flex-1" @keyup.enter="aggiungiMateria" />
                <UButton icon="i-heroicons-plus" aria-label="Aggiungi questa materia alla lista" @click="aggiungiMateria" />
              </div>
              <div class="flex flex-wrap gap-2">
                <UBadge
                  v-for="(m, idx) in materie"
                  :key="idx"
                  :color="materieSpeciali.includes(m) ? 'warning' : 'neutral'"
                  variant="subtle"
                  class="flex items-center gap-1"
                >
                  <UIcon
                    :name="materieSpeciali.includes(m) ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
                    class="w-3 h-3 cursor-pointer"
                    :class="materieSpeciali.includes(m) ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'"
                    :title="materieSpeciali.includes(m) ? 'Materia speciale — clicca per renderla standard' : 'Clicca per renderla speciale'"
                    @click="toggleSpeciale(m)"
                  />
                  {{ m }}
                  <UIcon name="i-heroicons-x-mark" class="w-3 h-3 cursor-pointer text-slate-400 hover:text-red-500" @click="rimuoviMateria(idx)" />
                </UBadge>
              </div>
              <p class="text-xs text-slate-400">
                ⭐ = materia <strong>speciale</strong>: si prenota nelle giornate del calendario qui accanto;
                fuori da quelle giornate scatta il supplemento di €{{ SUPPLEMENTO_SPECIALE }}.
              </p>

              <!--
                Il catalogo delle superiori in un colpo solo. Sta in fondo alla card e non
                in cima perché è una cosa che si fa una volta sola: chi apre questa scheda
                tutti i giorni deve trovarci per primo il campo "Nuova materia".
              -->
              <div class="pt-3 border-t border-slate-200 space-y-2">
                <UButton
                  icon="i-heroicons-squares-plus"
                  color="neutral"
                  variant="subtle"
                  block
                  :disabled="salvandoConfigs"
                  @click="aggiungiMaterieStandard"
                >
                  Aggiungi le materie standard
                </UButton>
                <p class="text-xs text-slate-400">
                  Carica in una volta sola le <strong>{{ MATERIE_SUPERIORI.length }} materie delle superiori</strong>
                  — tutti gli indirizzi, dal liceo al professionale.
                  <template v-if="materieMancanti.length">
                    Qui ne mancano <strong>{{ materieMancanti.length }}</strong>.
                  </template>
                  <template v-else>Ci sono già tutte.</template>
                  Aggiunge solo quelle che mancano: non crea doppioni e non toglie mai niente.
                  Salva da sé, poi togli con la ✕ quelle che non ti servono.
                </p>
              </div>
            </div>
            <template #footer>
              <UButton @click="salvaConfigs()" :loading="salvandoConfigs">Salva Modifiche</UButton>
            </template>
          </UCard>

          <!-- CARD GIORNATE SPECIALI (calendario unico) -->
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <UIcon name="i-heroicons-star" class="w-4 h-4 text-amber-500" />
                  <span class="font-medium text-slate-800">Giornate speciali</span>
                </div>
                <div class="flex items-center gap-1">
                  <UButton icon="i-heroicons-chevron-left" color="neutral" variant="ghost" size="xs" @click="cambiaMeseSpeciali(-1)" />
                  <span class="text-xs font-medium w-28 text-center capitalize">{{ nomeMeseSpeciali }}</span>
                  <UButton icon="i-heroicons-chevron-right" color="neutral" variant="ghost" size="xs" @click="cambiaMeseSpeciali(1)" />
                </div>
              </div>
            </template>

            <p v-if="materieSpeciali.length === 0" class="text-sm text-slate-400 py-6 text-center">
              Prima marca almeno una materia come ⭐ speciale nella card Materie.
            </p>
            <div v-else class="space-y-3">
              <UFormField label="Materia da assegnare (poi clicca i giorni)">
                <USelect v-model="materiaPennello" :items="materieSpeciali" class="w-full" />
              </UFormField>

              <div class="grid grid-cols-7 gap-1 text-center">
                <div v-for="g in ['Lun','Mar','Mer','Gio','Ven','Sab','Dom']" :key="g" class="text-[10px] font-medium text-slate-400 py-1">{{ g }}</div>
                <div v-for="blank in blankSpeciali" :key="'bs'+blank" />
                <button
                  v-for="day in giorniMeseSpeciali"
                  :key="day.dateStr"
                  type="button"
                  class="p-1 rounded-md border text-xs min-h-[48px] flex flex-col items-center justify-start gap-0.5 relative"
                  :class="day.domenica || chiusureSet.has(day.dateStr)
                    ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
                    : materieDelGiorno(day.dateStr).length
                      ? (materieDelGiorno(day.dateStr).includes(materiaPennello) ? 'bg-amber-100 border-amber-400 text-amber-800 font-semibold' : 'bg-amber-50 border-amber-300 text-amber-700 font-semibold')
                      : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'"
                  :title="materieDelGiorno(day.dateStr).join(', ')"
                  @click="toggleGiornoSpeciale(day.dateStr, day.domenica)"
                >
                  <span>{{ day.numero }}</span>
                  <span
                    v-for="m in materieDelGiorno(day.dateStr)"
                    :key="m"
                    class="text-[9px] leading-tight truncate max-w-full w-full px-0.5 rounded"
                    :class="m === materiaPennello ? 'bg-amber-200/70' : ''"
                  >{{ m }}</span>
                </button>
              </div>

              <p class="text-xs text-slate-400">
                Calendario unico: ogni giorno può avere <strong>più materie speciali</strong>.
                Scegli la materia col menù qui sopra, poi clicca i giorni per aggiungerla o toglierla
                (la materia selezionata è evidenziata). Le famiglie vedono queste date nel portale. Ricordati di salvare.
              </p>
            </div>

            <template #footer>
              <UButton @click="salvaConfigs()" :loading="salvandoConfigs">Salva Modifiche</UButton>
            </template>
          </UCard>

          <!-- CARD TARIFFE BASE -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-currency-euro" class="w-4 h-4 text-tfn-500" />
                <span class="font-medium text-slate-800">Tariffe Tutor Base (€/ora)</span>
              </div>
            </template>
            <div class="space-y-3">
              <UFormField label="Lezione Singola">
                <UInputNumber v-model="tariffe.SINGOLA" :min="0" :step="0.5" class="w-full" />
              </UFormField>
              <UFormField label="Lezione di Gruppo (2-4)">
                <UInputNumber v-model="tariffe.GRUPPO" :min="0" :step="0.5" class="w-full" />
              </UFormField>
              <UFormField label="Lezione Maxi (5+)">
                <UInputNumber v-model="tariffe.MAXI" :min="0" :step="0.5" class="w-full" />
              </UFormField>

              <p class="text-xs text-slate-400">
                Le nuove tariffe valgono per le lezioni inserite da ora in poi. Le lezioni già registrate
                mantengono il compenso calcolato quando sono state inserite (cambia solo se ne modifichi
                il tipo o la durata).
              </p>
            </div>
            <template #footer>
              <UButton @click="salvaConfigs()" :loading="salvandoConfigs">Salva Modifiche</UButton>
            </template>
          </UCard>

          <!-- CARD CONTATTI -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-device-phone-mobile" class="w-4 h-4 text-tfn-500" />
                <span class="font-medium text-slate-800">Contatti Portale</span>
              </div>
            </template>
            <div class="space-y-3">
              <UFormField label="Numero WhatsApp Segreteria">
                <UInput v-model="whatsappNumero" placeholder="Es. +39 320 123 4567" class="w-full" />
                <template #description>
                  <span class="text-xs text-slate-400">Visibile nel portale famiglie durante l'orario di segreteria (9:00–18:00).</span>
                </template>
              </UFormField>
            </div>
            <template #footer>
              <UButton @click="salvaConfigs()" :loading="salvandoConfigs">Salva Modifiche</UButton>
            </template>
          </UCard>

          <!-- CARD RIEPILOGO SERALE ALLE FAMIGLIE -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-envelope" class="w-4 h-4 text-tfn-500" />
                <span class="font-medium text-slate-800">Email della sera alle famiglie</span>
              </div>
            </template>
            <div class="space-y-3">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-slate-800">Avvisa le famiglie delle nuove comunicazioni</p>
                  <p class="text-xs text-slate-500 mt-0.5">
                    Ogni sera, se durante la giornata è stata approvata una comunicazione nuova, la famiglia
                    riceve un'email che dice solo «c'è qualcosa di nuovo nel portale». Il testo della
                    comunicazione non viene mai scritto nell'email.
                  </p>
                </div>
                <USwitch v-model="riepilogoSeraleAttivo" aria-label="Email della sera alle famiglie" />
              </div>

              <p v-if="!riepilogoSeraleAttivo" class="text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
                Al momento l'email della sera è spenta per tutti. Le comunicazioni continuano ad arrivare
                regolarmente nel portale e le famiglie le leggono entrando: semplicemente non ricevono più
                l'avviso via email. Finché questo interruttore resta giù, l'interruttore che trovi sulla
                scheda del singolo alunno non ha effetto.
              </p>
              <p v-else class="text-xs text-slate-400">
                Puoi spegnere l'avviso anche per un solo alunno: lo trovi nella sua scheda, nel riquadro
                «Accesso Portale».
              </p>
            </div>
            <template #footer>
              <UButton @click="salvaConfigs()" :loading="salvandoConfigs">Salva Modifiche</UButton>
            </template>
          </UCard>

          <!-- CARD ANNO SCOLASTICO -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-clipboard-document-check" class="w-4 h-4 text-tfn-500" />
                <span class="font-medium text-slate-800">Anno scolastico</span>
              </div>
            </template>
            <div class="space-y-3">
              <UFormField label="Anno">
                <UInput v-model="annoScolastico" placeholder="Es. 2026/2027" class="w-full" />
              </UFormField>
              <UFormField label="Primo giorno di lezione">
                <UInput v-model="inizioAnnoScolastico" type="date" class="w-full" />
              </UFormField>
              <p class="text-xs text-slate-400">
                Si usa nella sezione Rientri per sapere di quale anno stai segnando le conferme.
              </p>
            </div>
            <template #footer>
              <UButton @click="salvaConfigs()" :loading="salvandoConfigs">Salva Modifiche</UButton>
            </template>
          </UCard>
        </div>
      </template>

      <template #categorie>
        <UCard class="mt-4">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-tag" class="w-4 h-4 text-tfn-500" />
                <span class="font-medium text-slate-800">Categorie Contabili</span>
                <UBadge color="neutral" variant="subtle">{{ categorie.length }}</UBadge>
              </div>
              <UButton icon="i-heroicons-check" size="sm" :loading="salvandoCategorie" @click="salvaCategorie">Salva categorie</UButton>
            </div>
          </template>

          <p class="text-xs text-slate-500 mb-4">
            Rinomina le categorie, creane di nuove e marca come <strong>“neutra”</strong> quelle che non devono
            entrare nel calcolo del guadagno (es. <em>Giroconto</em>, <em>Saldo Iniziale</em>).
            Le categorie <UBadge color="info" variant="subtle" size="xs">automatiche</UBadge> sono gestite dal sistema e non si possono modificare.
          </p>

          <!-- Aggiungi nuova categoria -->
          <div class="flex items-end gap-3 mb-4 p-3 bg-slate-50 rounded-lg">
            <UFormField label="Nuova categoria" class="flex-1">
              <UInput v-model="nuovaCategoria.etichetta" placeholder="Es. Borse di studio" class="w-full" @keyup.enter="aggiungiCategoria" />
            </UFormField>
            <UFormField label="Neutra">
              <USwitch v-model="nuovaCategoria.neutra" />
            </UFormField>
            <UButton icon="i-heroicons-plus" @click="aggiungiCategoria">Aggiungi</UButton>
          </div>

          <div v-if="pendingCategorie" class="space-y-2 py-2">
            <USkeleton v-for="i in 4" :key="i" class="h-10 w-full" />
          </div>
          <div v-else class="divide-y divide-slate-100">
            <div v-for="(c, idx) in categorie" :key="c.chiave || idx" class="flex items-center gap-3 py-2.5 px-1">
              <UInput v-model="c.etichetta" :disabled="c.sistema" class="flex-1" />
              <UBadge v-if="c.sistema" color="info" variant="subtle" size="xs">automatica</UBadge>
              <label class="flex items-center gap-1.5 text-xs text-slate-500 select-none">
                <USwitch v-model="c.neutra" :disabled="c.sistema" size="sm" /> neutra
              </label>
              <UButton
                icon="i-heroicons-trash"
                variant="ghost" color="error" size="xs"
                :disabled="c.sistema"
                :title="c.sistema ? 'Categoria automatica: non eliminabile' : 'Elimina categoria'"
                @click="rimuoviCategoria(idx)"
              />
            </div>
          </div>
        </UCard>
      </template>

      <template #spese>
        <UCard class="mt-4">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-building-office" class="w-4 h-4 text-tfn-500" />
              <span class="font-medium text-slate-800">Spese Fisse Mensili</span>
            </div>
          </template>
          <div class="space-y-4">
            <p class="text-xs text-slate-500">
              Le spese fisse (affitto, utenze…) servono a calcolare il <strong>break-even</strong> in Contabilità.
              Le date <strong>Dal</strong> e <strong>Al</strong> sono facoltative: servono a non riscrivere il passato.
              Se smetti di pagare una spesa usa <strong>“Chiudi da oggi”</strong> — i mesi già passati restano come erano.
              Il cestino, invece, la cancella anche dallo storico.
            </p>
            <p class="text-xs text-slate-500">
              <strong>Categoria che sostituisce</strong>: se questa spesa la registri anche in contabilità,
              indica qui la sua categoria. Il break-even userà la cifra prevista al posto dei movimenti,
              invece di contarli tutti e due. Vale solo per i mesi indicati in <strong>Dal</strong> e <strong>Al</strong>.
            </p>

            <!-- Avviso ambra: finché una spesa resta scollegata, il doppio conteggio c'è ancora -->
            <div v-if="speseSenzaCategoria.length" class="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
              <p class="font-medium flex items-start gap-1">
                <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 shrink-0 mt-px text-amber-600" />
                <span>Non collegata a nessuna categoria: se la registri anche in contabilità, viene contata due volte.</span>
              </p>
              <p class="mt-1 pl-5">{{ speseSenzaCategoria.map((s) => s.nome || 'Spesa senza nome').join(' · ') }}</p>
            </div>

            <div class="flex flex-wrap items-end gap-3">
              <UFormField label="Descrizione spesa" class="flex-1 min-w-[12rem]">
                <UInput v-model="nuovaSpesa.nome" placeholder="Es. Affitto locale" class="w-full" />
              </UFormField>
              <UFormField label="Importo mensile (€)" class="w-40">
                <UInputNumber v-model="nuovaSpesa.importo" :min="0" :step="10" :step-snapping="false" />
              </UFormField>
              <UFormField label="Dal (opzionale)" class="w-44">
                <UInput v-model="nuovaSpesa.dal" type="date" class="w-full" />
              </UFormField>
              <UFormField label="Al (opzionale)" class="w-44">
                <UInput v-model="nuovaSpesa.al" type="date" class="w-full" />
              </UFormField>
              <UFormField label="Categoria che sostituisce" class="w-56" help="Lascia (nessuna) se non la registri in contabilità">
                <USelect v-model="nuovaSpesa.categoria" :items="opzioniCategoriaSpesa" class="w-full" />
              </UFormField>
              <UButton icon="i-heroicons-plus" @click="aggiungiSpesa">Aggiungi</UButton>
            </div>

            <UTable :data="speseFisse" :columns="[{ accessorKey: 'nome', header: 'Spesa' }, { accessorKey: 'importo', header: 'Importo (€)' }, { id: 'validita', header: 'Valida dal / al' }, { id: 'categoria', header: 'Categoria che sostituisce' }, { id: 'stato', header: 'Stato' }, { id: 'azioni', header: '' }]">
              <template #importo-cell="{ row }">
                <span class="font-medium">€ {{ row.original.importo.toFixed(2) }}</span>
              </template>
              <template #validita-cell="{ row }">
                <div class="flex items-center gap-2">
                  <UInput v-model="row.original.dal" type="date" size="xs" class="w-36" title="Da quando si paga (vuoto = da sempre)" />
                  <span class="text-slate-300">→</span>
                  <UInput v-model="row.original.al" type="date" size="xs" class="w-36" title="Fino a quando si è pagata (vuoto = ancora attiva)" />
                </div>
              </template>
              <template #categoria-cell="{ row }">
                <div class="flex items-center gap-1.5">
                  <USelect v-model="row.original.categoria" :items="opzioniCategoriaSpesa" size="xs" class="w-48"
                    title="La categoria contabile i cui movimenti vengono sostituiti da questa spesa prevista" />
                  <UIcon
                    v-if="!row.original.categoria"
                    name="i-heroicons-exclamation-triangle"
                    class="w-4 h-4 text-amber-500 shrink-0"
                    title="Non collegata a nessuna categoria: se la registri anche in contabilità, viene contata due volte."
                  />
                </div>
              </template>
              <template #stato-cell="{ row }">
                <UBadge :color="statoSpesa(row.original).color" variant="subtle" size="xs">{{ statoSpesa(row.original).label }}</UBadge>
              </template>
              <template #azioni-cell="{ row }">
                <div class="flex items-center justify-end gap-1">
                  <UButton
                    v-if="!row.original.al"
                    icon="i-heroicons-flag"
                    variant="ghost" color="neutral" size="xs"
                    title="Non la paghi più? Chiudila da oggi: lo storico resta intatto"
                    @click="chiudiSpesaOggi(row.index)"
                  >
                    Chiudi da oggi
                  </UButton>
                  <UButton
                    icon="i-heroicons-trash"
                    variant="ghost" color="error" size="xs"
                    title="Elimina dallo storico (cambia anche i conti dei mesi passati)"
                    @click="rimuoviSpesa(row.index)"
                  />
                </div>
              </template>
            </UTable>
          </div>
          <template #footer>
            <UButton @click="salvaConfigs()" :loading="salvandoConfigs">Salva Modifiche</UButton>
          </template>
        </UCard>
      </template>

      <template #chiusure>
        <UCard class="mt-4">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-calendar-days" class="w-4 h-4 text-tfn-500" />
              <span class="font-medium text-slate-800">Date di Chiusura</span>
            </div>
          </template>
          <div class="space-y-4">
            <p class="text-xs text-slate-500">
              Nei giorni di chiusura il centro non è prenotabile e i tutor a fisso mensile non risultano disponibili.
              Prima di chiudere o riaprire un giorno il gestionale ti dice che cosa c'è già in quella data.
            </p>
             <div class="flex items-end gap-3">
              <UFormField label="Data" class="w-40">
                <UInput v-model="nuovaChiusura.date" type="date" />
              </UFormField>
              <UFormField label="Motivo (opzionale)" class="flex-1">
                <UInput v-model="nuovaChiusura.description" placeholder="Es. Festa nazionale" />
              </UFormField>
              <UButton icon="i-heroicons-plus" @click="aggiungiChiusura">Aggiungi</UButton>
            </div>
            
            <div v-if="pendingClosures" class="py-2"><USkeleton class="h-10 w-full" /></div>
            <UTable v-else :data="closures" :columns="[{ accessorKey: 'date', header: 'Data' }, { accessorKey: 'description', header: 'Motivo' }, { id: 'azioni', header: '' }]">
              <template #date-cell="{ row }">
                <span class="font-medium">{{ row.original.date.split('-').reverse().join('/') }}</span>
              </template>
              <template #azioni-cell="{ row }">
                <UButton icon="i-heroicons-trash" variant="ghost" color="error" size="xs" title="Riapri il giorno" @click="eliminaChiusura(row.original)" />
              </template>
            </UTable>
          </div>
        </UCard>
      </template>

      <template #sconti>
        <UCard class="mt-4">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-tag" class="w-4 h-4 text-tfn-500" />
              <span class="font-medium text-slate-800">Sconti e convenzioni</span>
              <UBadge color="neutral" variant="subtle">{{ sconti.length }}</UBadge>
            </div>
          </template>

          <div class="space-y-4">
            <p class="text-xs text-slate-500">
              Le convenzioni con le attività partner (cartolibrerie, panifici, palestre…) mostrate alle famiglie
              nella sezione <strong>Sconti</strong> del portale: immagine + breve descrizione.
            </p>

            <!-- Nuova convenzione -->
            <div class="p-3 bg-slate-50 rounded-lg space-y-3">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <UFormField label="Nome attività" required>
                  <UInput v-model="nuovoSconto.nome" placeholder="Es. Cartolibreria Rossi" class="w-full" />
                </UFormField>
                <UFormField label="Immagine (logo o foto)">
                  <UFileUpload
                    v-model="fileSconto"
                    accept="image/*"
                    label="Trascina o clicca per scegliere"
                    description="JPG/PNG — viene ridimensionata automaticamente"
                    class="w-full min-h-24"
                  />
                </UFormField>
              </div>
              <UFormField label="Breve descrizione dello sconto" required>
                <UTextarea
                  v-model="nuovoSconto.descrizione"
                  :rows="2"
                  placeholder="Es. 10% di sconto su tutto il materiale scolastico mostrando la tessera."
                  class="w-full"
                />
              </UFormField>
              <div class="flex items-center gap-3">
                <img v-if="nuovoSconto.immagine" :src="nuovoSconto.immagine" class="h-12 w-12 rounded object-cover border border-slate-200" />
                <UButton icon="i-heroicons-plus" @click="aggiungiSconto">Aggiungi convenzione</UButton>
              </div>
            </div>

            <!-- Elenco convenzioni -->
            <div v-if="sconti.length === 0" class="py-8 text-center text-slate-400 text-sm">
              <UIcon name="i-heroicons-tag" class="w-8 h-8 mx-auto mb-2 text-slate-300" />
              Nessuna convenzione. Aggiungine una qui sopra: comparirà nel portale famiglie.
            </div>
            <div v-else class="divide-y divide-slate-100">
              <div v-for="(s, idx) in sconti" :key="idx" class="flex items-center gap-3 py-3 px-1">
                <img v-if="s.immagine" :src="s.immagine" class="h-12 w-12 rounded object-cover border border-slate-200 shrink-0" />
                <div v-else class="h-12 w-12 rounded bg-slate-100 flex items-center justify-center shrink-0">
                  <UIcon name="i-heroicons-building-storefront" class="w-5 h-5 text-slate-300" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-sm text-slate-800">{{ s.nome }}</div>
                  <p class="text-xs text-slate-500 truncate">{{ s.descrizione }}</p>
                </div>
                <UButton icon="i-heroicons-trash" variant="ghost" color="error" size="xs" @click="rimuoviSconto(idx)" />
              </div>
            </div>
          </div>

          <template #footer>
            <UButton @click="salvaConfigs()" :loading="salvandoConfigs">Salva Modifiche</UButton>
          </template>
        </UCard>
      </template>

      <template #email>
        <UCard class="mt-4">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-envelope" class="w-4 h-4 text-tfn-500" />
              <span class="font-medium text-slate-800">Invio email</span>
            </div>
          </template>

          <div class="space-y-4">
            <p class="text-sm text-slate-600">
              Il gestionale manda email da solo: il link per scegliere la password a tutor e famiglie,
              gli avvisi sui pacchetti in esaurimento. Se qualcuno dice «non mi è arrivato niente»,
              da qui controlli in dieci secondi se il problema è la posta.
            </p>
            <p class="text-sm text-slate-600">
              Il pulsante manda un messaggio di prova <strong>al tuo indirizzo</strong> ({{ emailAdmin || 'il tuo account' }}),
              non a tutor o famiglie: nessuno se ne accorge.
            </p>

            <div>
              <UButton
                icon="i-heroicons-paper-airplane"
                :loading="provaEmailInCorso"
                @click="provaInvioEmail"
              >
                Manda una email di prova a me stesso
              </UButton>
            </div>

            <!-- Esito: verde se è partita, rosso col motivo se no -->
            <div
              v-if="esitoProvaEmail"
              class="rounded-lg border p-3 text-sm"
              :class="esitoProvaEmail.sent
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'"
            >
              <p class="flex items-start gap-1.5 font-medium">
                <UIcon
                  :name="esitoProvaEmail.sent ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-triangle'"
                  class="w-4 h-4 mt-0.5 shrink-0"
                />
                <span v-if="esitoProvaEmail.sent">
                  Inviata a {{ esitoProvaEmail.destinatario }} — controlla la posta, anche nello spam
                </span>
                <span v-else>{{ testoMotivoProva }}</span>
              </p>
              <p v-if="!esitoProvaEmail.sent && esitoProvaEmail.dettaglio" class="mt-1.5 pl-6 text-xs">
                Dettaglio tecnico: {{ esitoProvaEmail.dettaglio }}
              </p>
              <p v-if="!esitoProvaEmail.sent" class="mt-1.5 pl-6 text-xs">
                Finché la posta non riparte, i link di primo accesso si possono comunque copiare a schermo
                dalla scheda del tutor o dell'alunno e mandare su WhatsApp.
              </p>
            </div>
          </div>
        </UCard>
      </template>

    </UTabs>

    <!-- ─── MODAL CREA / MODIFICA TEMPLATE ─── -->
    <!-- È una finestra sola per i due casi: così i campi, le etichette e le regole sono per
         forza identici fra "Aggiungi" e "Modifica", e non possono scivolare col tempo. -->
    <UModal v-model:open="modalCreaAperto" :title="inModifica ? 'Modifica modello di pacchetto' : 'Nuovo Template Pacchetto'">
      <template #body>
        <div class="space-y-4">

          <!-- L'avviso che il piano chiede: deve essere la prima cosa che si legge, perché
               spiega l'unica cosa che un non addetto potrebbe fraintendere — qui si cambia
               il listino di domani, non quello che le famiglie hanno già comprato. -->
          <UAlert
            v-if="inModifica"
            color="warning"
            variant="subtle"
            icon="i-heroicons-exclamation-triangle"
            title="Modificando questo modello cambi il listino da qui in avanti"
          >
            <template #description>
              <p>I pacchetti già venduti agli alunni <strong>NON cambiano</strong>.</p>
              <p v-if="usiDelTemplateInModifica > 0" class="mt-1">
                {{ usiDelTemplateInModifica }}
                {{ usiDelTemplateInModifica === 1 ? 'pacchetto già venduto' : 'pacchetti già venduti' }}
                con questo modello {{ usiDelTemplateInModifica === 1 ? 'resta come è' : 'restano come sono' }}.
              </p>
            </template>
          </UAlert>

          <UFormField label="Nome template" required>
            <UInput v-model="nuovo.nome" placeholder="Es: 10 ore Medie" class="w-full" />
          </UFormField>

          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Categoria" required>
              <USelectMenu
                v-model="nuovo.categoria"
                :items="categorieDisponibili"
                placeholder="Seleziona..."
                class="w-full"
              />
            </UFormField>
            <UFormField label="Tipo" required>
              <USelect
                v-model="nuovo.tipo"
                :items="[{ label: 'ORE', value: 'ORE' }, { label: 'MENSILE', value: 'MENSILE' }, { label: 'A CONSUMO', value: 'A_CONSUMO' }]"
                class="w-full"
              />
            </UFormField>
          </div>

          <!-- ORE: ore inserite direttamente -->
          <div v-if="nuovo.tipo === 'ORE'" class="grid grid-cols-2 gap-4">
            <UFormField label="Ore incluse" required>
              <UInputNumber v-model="nuovo.oreIncluse" :min="0.5" :step="0.5" class="w-full" />
            </UFormField>
            <UFormField label="Prezzo standard (€)" required>
              <UInputNumber v-model="nuovo.prezzoStandard" :min="0" :step="10" :step-snapping="false" class="w-full" />
            </UFormField>
          </div>

          <!-- A CONSUMO: tariffa oraria e prima ricarica (prezzo base) -->
          <div v-else-if="nuovo.tipo === 'A_CONSUMO'" class="grid grid-cols-2 gap-4">
            <UFormField label="Tariffa oraria (€/h)" required>
              <UInputNumber v-model="nuovo.tariffaOraria" :min="1" :step="0.5" class="w-full" />
            </UFormField>
            <UFormField label="Prima ricarica base (€)" required>
              <UInputNumber v-model="nuovo.prezzoStandard" :min="0" :step="10" :step-snapping="false" class="w-full" />
            </UFormField>
          </div>

          <!-- MENSILE: giorni × ore/giorno → ore totali calcolate automaticamente -->
          <template v-else>
            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Giorni inclusi" required>
                <UInputNumber v-model="nuovo.giorniInclusi" :min="1" :step="1" class="w-full" />
              </UFormField>
              <UFormField label="Ore al giorno (max)" required>
                <UInputNumber v-model="nuovo.orarioGiornaliero" :min="0.5" :step="0.5" class="w-full" />
              </UFormField>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Ore totali incluse">
                <UInputNumber :model-value="nuovo.oreIncluse" disabled class="w-full" />
                <template #description>
                  <span class="text-xs text-slate-400">{{ nuovo.giorniInclusi || 0 }} × {{ nuovo.orarioGiornaliero || 0 }} = <strong>{{ nuovo.oreIncluse }} ore</strong></span>
                </template>
              </UFormField>
              <UFormField label="Prezzo standard (€)" required>
                <UInputNumber v-model="nuovo.prezzoStandard" :min="0" :step="10" :step-snapping="false" class="w-full" />
              </UFormField>
            </div>
          </template>

          <UFormField label="Descrizione (opzionale)">
            <UInput v-model="nuovo.descrizione" placeholder="Note su questo template..." class="w-full" />
          </UFormField>

        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" @click="() => { modalCreaAperto = false }">Annulla</UButton>
          <UButton :loading="salvando" @click="salvaTemplate">{{ inModifica ? 'Salva modifiche' : 'Salva Template' }}</UButton>
        </div>
      </template>
    </UModal>

    <!-- ─── MODAL CREA SLOT ORARIO ─── -->
    <UModal v-model:open="modalCreaSlotAperto" title="Nuovo Slot Orario">
      <template #body>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Ora Inizio" required>
              <UInput v-model="nuovoSlot.oraInizio" type="time" class="w-full" />
            </UFormField>
            <UFormField label="Ora Fine" required>
              <UInput v-model="nuovoSlot.oraFine" type="time" class="w-full" />
            </UFormField>
          </div>
          <UFormField label="Descrizione (opzionale)">
            <UInput v-model="nuovoSlot.descrizione" placeholder="Es. Mattina, Pomeriggio..." class="w-full" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" @click="() => { modalCreaSlotAperto = false }">Annulla</UButton>
          <UButton :loading="salvandoSlot" @click="creaSlot">Salva Slot</UButton>
        </div>
      </template>
    </UModal>

  </div>

  <ConfirmDialog
    v-model:open="confirmOpen"
    :title="confirmTitle"
    :description="confirmDescription"
    :confirm-label="confirmLabel"
    :confirm-color="confirmColor"
    :loading="confirmLoading"
    @confirm="eseguiConferma"
  />
</template>

<script setup lang="ts">
import ConfirmDialog from '~/components/ConfirmDialog.vue'
import { SUPPLEMENTO_SPECIALE, TARIFFE_DEFAULT } from '#shared/tariffe'
import { MATERIE_SUPERIORI, materieDaAggiungere } from '#shared/materie'
import { annoScolasticoDa, inizioAnnoProposto } from '#shared/rientri'
import { addMonths, format, getDay, getDaysInMonth, setDate, startOfMonth } from 'date-fns'
import { it } from 'date-fns/locale'

definePageMeta({ middleware: ['admin-only'] })

const toast = useToast()

// ─── PROVA INVIO EMAIL ───
// PERCHE': l'utente non ha modo di sapere se la posta funziona finché qualcuno
// non si lamenta di non aver ricevuto il link. Questo pulsante gli dà una
// risposta immediata, e quando l'invio fallisce mostra il motivo vero invece di
// un errore generico (vedi il commento in server/utils/email.ts).
const { user: utenteLoggato } = useUserSession()
const emailAdmin = computed(() => utenteLoggato.value?.email ?? '')

// Chi sta guardando: la matita per correggere i modelli di pacchetto è roba da amministratore.
// (Oggi questa pagina è già riservata agli ADMIN dal middleware qui sopra, ma il controllo
// esplicito resta: se un domani le Impostazioni si aprissero al Super Tutor, il listino
// continuerebbe a non essere modificabile da lui.)
const isAdmin = computed(() => utenteLoggato.value?.role === 'ADMIN')

type EsitoProvaEmail = {
  ok: boolean
  destinatario: string
  sent: boolean
  motivo?: 'NON_CONFIGURATO' | 'RIFIUTATO' | 'RETE'
  dettaglio?: string
}

const provaEmailInCorso = ref(false)
const esitoProvaEmail = ref<EsitoProvaEmail | null>(null)

const testoMotivoProva = computed(() => {
  switch (esitoProvaEmail.value?.motivo) {
    case 'NON_CONFIGURATO':
      return 'Non partita: il servizio di posta non è configurato (mancano la chiave o l\'indirizzo mittente).'
    case 'RIFIUTATO':
      return 'Non partita: il servizio di posta ha rifiutato l\'invio.'
    case 'RETE':
      return 'Non partita: il gestionale non è riuscito a contattare il servizio di posta.'
    default:
      return 'Non partita: motivo sconosciuto.'
  }
})

async function provaInvioEmail() {
  provaEmailInCorso.value = true
  esitoProvaEmail.value = null
  try {
    esitoProvaEmail.value = await $fetch<EsitoProvaEmail>('/api/settings/test-email', { method: 'POST' })
  } catch (e: any) {
    // Qui ci finiscono solo gli errori veri (sessione scaduta, permessi): il
    // mancato invio non è un errore, arriva come risposta con sent = false.
    toast.add({
      title: 'Prova non riuscita',
      description: e?.data?.statusMessage ?? e?.statusMessage ?? 'Riprova fra qualche istante.',
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle',
    })
  } finally {
    provaEmailInCorso.value = false
  }
}

// ─── ConfirmDialog: stato e logica in app/composables/useConfirm.ts ───
const { confirmOpen, confirmTitle, confirmDescription, confirmLabel, confirmColor, confirmLoading, chiediConferma, eseguiConferma } = useConfirm()

// ─── Fetch templates ───
const { data: templatesData, pending: pendingTemplates, refresh } = useLazyFetch('/api/standard-packages')
const templates = computed(() => templatesData.value ?? [])

// Template archiviati (eliminati col cestino): restano recuperabili
const { data: archiviatiData, refresh: refreshArchiviati } = useLazyFetch('/api/standard-packages?archiviati=1')
const templatesArchiviati = computed(() => archiviatiData.value ?? [])
const mostraArchiviati = ref(false)

// ─── Modal crea / modifica ───
// Una finestra sola per i due casi: se `templateInModifica` è pieno stiamo correggendo un
// modello esistente, se è vuoto ne stiamo creando uno nuovo.
const modalCreaAperto     = ref(false)
const salvando            = ref(false)
const templateInModifica  = ref<any | null>(null)
const inModifica          = computed(() => templateInModifica.value !== null)
// Quanti pacchetti sono già stati venduti con questo modello: il numero arriva già pronto
// dalla lista (campo `inUso`) e serve a scriverlo nero su bianco dentro l'avviso.
const usiDelTemplateInModifica = computed(() => templateInModifica.value?.inUso ?? 0)

const nuovo = reactive({
  nome:              '',
  descrizione:       '',
  tipo:              'ORE' as 'ORE' | 'MENSILE' | 'A_CONSUMO',
  categoria:         '',
  oreIncluse:        10,
  giorniInclusi:     12,
  orarioGiornaliero: 3,
  prezzoStandard:    150,
  tariffaOraria:     10,
})

// Le categorie proposte nella tendina. Se il modello che stiamo modificando ne ha una vecchia,
// arrivata dai dati importati e non più in elenco, la aggiungiamo in testa: altrimenti aprendo
// la finestra la categoria sparirebbe dalla tendina e si rischierebbe di salvarla cambiata
// senza accorgersene.
const CATEGORIE_STANDARD = ['Elementari', 'Medie', 'Superiori', 'Università', 'Concorsi', 'Preparazione Esami', 'Altro']
const categorieDisponibili = computed(() =>
  nuovo.categoria && !CATEGORIE_STANDARD.includes(nuovo.categoria)
    ? [nuovo.categoria, ...CATEGORIE_STANDARD]
    : CATEGORIE_STANDARD,
)

// Per i template MENSILI le ore totali sono SEMPRE giorni × ore/giorno (read-only)
watch(
  () => [nuovo.tipo, nuovo.giorniInclusi, nuovo.orarioGiornaliero, nuovo.prezzoStandard, nuovo.tariffaOraria],
  () => {
    if (nuovo.tipo === 'MENSILE') {
      nuovo.oreIncluse = (nuovo.giorniInclusi || 0) * (nuovo.orarioGiornaliero || 0)
    } else if (nuovo.tipo === 'A_CONSUMO') {
      nuovo.oreIncluse = nuovo.tariffaOraria > 0 ? Number((nuovo.prezzoStandard / nuovo.tariffaOraria).toFixed(2)) : 0
    }
  },
)

function apriModalCrea() {
  templateInModifica.value = null
  Object.assign(nuovo, {
    nome: '', descrizione: '', tipo: 'ORE', categoria: '',
    oreIncluse: 10, giorniInclusi: 12, orarioGiornaliero: 3, prezzoStandard: 150, tariffaOraria: 10
  })
  modalCreaAperto.value = true
}

// Apre la STESSA finestra, già compilata con i valori del modello scelto.
function apriModalModifica(t: any) {
  templateInModifica.value = t
  Object.assign(nuovo, {
    nome:        t.nome ?? '',
    descrizione: t.descrizione ?? '',
    tipo:        t.tipo ?? 'ORE',
    categoria:   t.categoria ?? '',
    // I numeri arrivano dal database come testo ("150.00", per non perdere i centesimi):
    // vanno riportati a numero, altrimenti i campi con le frecciette non saprebbero che farne.
    // Dove il valore è vuoto rimettiamo il default della creazione: sono i campi che per
    // questo tipo di pacchetto non si vedono nemmeno, ma che devono avere un valore sensato
    // se l'amministratore cambia tipo mentre sta modificando.
    oreIncluse:        Number(t.oreIncluse ?? 0) || 0,
    giorniInclusi:     Number(t.giorniInclusi ?? 0) || 12,
    orarioGiornaliero: Number(t.orarioGiornaliero ?? 0) || 3,
    prezzoStandard:    Number(t.prezzoStandard ?? 0) || 0,
    tariffaOraria:     Number(t.tariffaOraria ?? 0) || 10,
  })
  modalCreaAperto.value = true
}

// Chiusa la finestra (Annulla, X o Esc) si torna sempre in modalità "creazione": senza questo,
// la volta dopo l'avviso arancione comparirebbe anche su un modello nuovo.
watch(modalCreaAperto, (aperto) => {
  if (!aperto) templateInModifica.value = null
})

// Il pacchetto di dati da spedire al server, costruito una volta sola per creazione e modifica:
// le due strade devono mandare gli stessi campi, altrimenti un modello corretto finirebbe per
// avere regole diverse da uno appena creato.
//
// L'unica differenza è il "vuoto esplicito": in modifica i campi che non c'entrano con il tipo
// scelto vengono azzerati (null). Serve a un caso concreto — un modello MENSILE trasformato in
// ORE altrimenti si terrebbe nel database i giorni e le ore/giorno di prima, numeri fantasma
// che nessuno vede più ma che restano lì.
function corpoDalForm(perModifica: boolean) {
  const body: any = {
    nome:           nuovo.nome,
    tipo:           nuovo.tipo,
    categoria:      nuovo.categoria,
    oreIncluse:     nuovo.oreIncluse,
    prezzoStandard: nuovo.prezzoStandard,
  }
  if (nuovo.descrizione) body.descrizione = nuovo.descrizione
  else if (perModifica)  body.descrizione = null

  if (nuovo.tipo === 'MENSILE') {
    if (nuovo.giorniInclusi > 0)     body.giorniInclusi     = nuovo.giorniInclusi
    if (nuovo.orarioGiornaliero > 0) body.orarioGiornaliero = nuovo.orarioGiornaliero
  } else if (perModifica) {
    body.giorniInclusi     = null
    body.orarioGiornaliero = null
  }

  if (nuovo.tipo === 'A_CONSUMO') {
    if (nuovo.tariffaOraria > 0)     body.tariffaOraria     = nuovo.tariffaOraria
  } else if (perModifica) {
    body.tariffaOraria = null
  }

  return body
}

// Il bottone del footer: decide da solo se sta creando o correggendo.
function salvaTemplate() {
  return inModifica.value ? modificaTemplate() : creaTemplate()
}

async function creaTemplate() {
  if (!nuovo.nome || !nuovo.categoria) {
    toast.add({ title: 'Compila nome e categoria', color: 'warning', icon: 'i-heroicons-exclamation-circle' })
    return
  }
  salvando.value = true
  try {
    await $fetch('/api/standard-packages', { method: 'POST', body: corpoDalForm(false) })
    toast.add({ title: 'Template creato', color: 'success', icon: 'i-heroicons-check-circle' })
    modalCreaAperto.value = false
    refresh()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile creare il template', color: 'error' })
  } finally {
    salvando.value = false
  }
}

// ─── Modifica template (solo ADMIN: il server rifiuta chiunque altro con un 403 parlante) ───
async function modificaTemplate() {
  const t = templateInModifica.value
  if (!t) return

  if (!nuovo.nome || !nuovo.categoria) {
    toast.add({ title: 'Compila nome e categoria', color: 'warning', icon: 'i-heroicons-exclamation-circle' })
    return
  }

  salvando.value = true
  try {
    await $fetch(`/api/standard-packages/${t.id}`, { method: 'PUT', body: corpoDalForm(true) })
    toast.add({
      title: 'Modello aggiornato',
      description: 'Vale per i pacchetti che venderai da adesso: quelli già venduti restano come sono.',
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })
    modalCreaAperto.value = false
    // Si ricaricano tutt'e due gli elenchi: la matita c'è anche sui modelli archiviati.
    refresh()
    refreshArchiviati()
  } catch (err: any) {
    // La finestra resta APERTA di proposito: l'utente legge il motivo, corregge il campo
    // sbagliato e riprova, senza dover riscrivere tutto da capo.
    toast.add({
      title: 'Modifica non salvata',
      description: err?.data?.statusMessage ?? err?.statusMessage ?? 'Impossibile modificare il modello',
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle',
    })
  } finally {
    salvando.value = false
  }
}

// ─── Elimina template ───
const eliminando = ref<string | null>(null)

async function eliminaTemplate(t: any) {
  const usi = t.inUso ?? 0
  const quantiUsi = usi === 0
    ? 'Non è mai stato usato per creare un pacchetto.'
    : `È servito a creare ${usi} ${usi === 1 ? 'pacchetto' : 'pacchetti'}, che NON verranno toccati.`

  chiediConferma(
    {
      title: `Archiviare "${t.nome}"?`,
      description: `${quantiUsi} Sparisce dalle tendine di creazione pacchetti, ma resta in "Template archiviati" e puoi ripristinarlo quando vuoi.`,
      confirmLabel: 'Archivia',
      confirmColor: 'error',
    },
    async () => {
      eliminando.value = t.id
      try {
        await $fetch(`/api/standard-packages/${t.id}`, { method: 'DELETE' })
        toast.add({ title: 'Template archiviato', description: 'Lo trovi in "Template archiviati".', color: 'success', icon: 'i-heroicons-check-circle' })
        refresh()
        refreshArchiviati()
      } catch (err: any) {
        toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile rimuovere', color: 'error' })
      } finally {
        eliminando.value = null
      }
    }
  )
}

// ─── Ripristina template archiviato ───
const ripristinando = ref<string | null>(null)

async function ripristinaTemplate(t: any) {
  ripristinando.value = t.id
  try {
    await $fetch(`/api/standard-packages/${t.id}/restore`, { method: 'POST' })
    toast.add({ title: 'Template ripristinato', description: 'Torna selezionabile nella creazione pacchetti.', color: 'success', icon: 'i-heroicons-check-circle' })
    refresh()
    refreshArchiviati()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile ripristinare', color: 'error' })
  } finally {
    ripristinando.value = null
  }
}

// ─── Fetch Slot Orari ───
const { data: slotsData, pending: pendingSlots, refresh: refreshSlots } = useLazyFetch('/api/settings/timeslots')
const timeslots = computed(() => slotsData.value ?? [])

// ─── Modal crea Slot ───
const modalCreaSlotAperto = ref(false)
const salvandoSlot        = ref(false)
const eliminandoSlot      = ref<string | null>(null)

const nuovoSlot = reactive({ oraInizio: '14:00', oraFine: '15:00', descrizione: '' })

function apriModalCreaSlot() {
  nuovoSlot.oraInizio = '14:00'
  nuovoSlot.oraFine = '15:00'
  nuovoSlot.descrizione = ''
  modalCreaSlotAperto.value = true
}

async function creaSlot() {
  if (!nuovoSlot.oraInizio || !nuovoSlot.oraFine) return
  salvandoSlot.value = true
  try {
    await $fetch('/api/settings/timeslots', { method: 'POST', body: nuovoSlot })
    toast.add({ title: 'Slot creato', color: 'success' })
    modalCreaSlotAperto.value = false
    refreshSlots()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile creare lo slot', color: 'error' })
  } finally {
    salvandoSlot.value = false
  }
}

async function toggleSlot(slot: any, val: boolean) {
  try {
    await $fetch(`/api/settings/timeslots/${slot.id}`, { method: 'PUT', body: { active: val } })
    refreshSlots()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile modificare', color: 'error' })
  }
}

async function eliminaSlot(slot: any) {
  chiediConferma(
    { title: `Eliminare lo slot ${slot.oraInizio}-${slot.oraFine}?`, description: 'Lo slot verrà rimosso definitivamente.', confirmLabel: 'Elimina', confirmColor: 'error' },
    async () => {
      eliminandoSlot.value = slot.id
      try {
        await $fetch(`/api/settings/timeslots/${slot.id}`, { method: 'DELETE' })
        toast.add({ title: 'Slot eliminato', color: 'success' })
        refreshSlots()
      } catch (err: any) {
        toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile eliminare', color: 'error' })
      } finally {
        eliminandoSlot.value = null
      }
    }
  )
}

// ─── Fetch Configs ───
const { data: configsData, refresh: refreshConfigs } = useLazyFetch('/api/settings/configs')
const configs = computed(() => configsData.value ?? {})

const materie = ref<string[]>([])
const tariffe = ref({ SINGOLA: 5, GRUPPO: 8, MAXI: 8.5 })
const speseFisse = ref<{ nome: string; importo: number; dal: string; al: string; categoria: string }[]>([])
const whatsappNumero = ref('')
// Interruttore generale dell'email serale alle famiglie (system_configs.riepilogo_serale_attivo).
// Si parte da ACCESO: è com'era il gestionale prima che l'interruttore esistesse, e una
// configurazione non ancora salvata non deve spegnere di nascosto un avviso che le
// famiglie si aspettano. Lo stesso criterio del server, in note-digest.service.ts.
const riepilogoSeraleAttivo = ref(true)
const sconti = ref<{ nome: string; descrizione: string; immagine: string }[]>([])
const materieSpeciali = ref<string[]>([])
const giornateSpeciali = ref<Record<string, string[]>>({})
// Anno scolastico dei Rientri: se non è mai stato salvato, la pagina propone
// l'anno di oggi e il lunedì della settimana del 15 settembre.
const annoScolastico       = ref('')
const inizioAnnoScolastico = ref('')

watchEffect(() => {
  try { materie.value = JSON.parse(configs.value.materie || '[]') } catch(e){}
  try { tariffe.value = JSON.parse(configs.value.tariffe_tutor || 'null') ?? { ...TARIFFE_DEFAULT } } catch(e){}
  try {
    // Le spese salvate prima di agosto 2026 non hanno le date: restano "sempre attive".
    // Allo stesso modo quelle salvate prima della "categoria che sostituisce" si leggono
    // come non collegate (''): nessun numero cambia finché non la scegli tu.
    const raw = JSON.parse(configs.value.spese_fisse || '[]')
    speseFisse.value = (Array.isArray(raw) ? raw : []).map((s: any) => ({
      nome:      String(s?.nome ?? ''),
      importo:   Number(s?.importo) || 0,
      dal:       typeof s?.dal === 'string' ? s.dal : '',
      al:        typeof s?.al  === 'string' ? s.al  : '',
      categoria: typeof s?.categoria === 'string' ? s.categoria : '',
    }))
  } catch(e){}
  try { sconti.value = JSON.parse(configs.value.sconti || '[]') } catch(e){}
  try { materieSpeciali.value = JSON.parse(configs.value.materie_speciali || '[]') } catch(e){}
  try {
    // Normalizza in array (tollera il vecchio formato "una materia per giorno")
    const raw = JSON.parse(configs.value.giornate_speciali || '{}')
    const out: Record<string, string[]> = {}
    for (const [d, m] of Object.entries(raw ?? {})) {
      out[d] = Array.isArray(m) ? (m as string[]) : (typeof m === 'string' && m ? [m] : [])
    }
    giornateSpeciali.value = out
  } catch(e){}
  whatsappNumero.value = configs.value.whatsapp_numero || ''
  // Spento SOLO se qualcuno ha salvato "false": riga assente o valore strano = acceso.
  riepilogoSeraleAttivo.value = (configs.value.riepilogo_serale_attivo ?? '').trim().toLowerCase() !== 'false'
  annoScolastico.value = configs.value.anno_scolastico_corrente || annoScolasticoDa(oggiISO())
  inizioAnnoScolastico.value = configs.value.anno_scolastico_inizio || inizioAnnoProposto(annoScolastico.value)
})

function materieDelGiorno(dateStr: string): string[] {
  return giornateSpeciali.value[dateStr] ?? []
}

// ─── Materie speciali + calendario unico delle giornate ───
function toggleSpeciale(m: string) {
  const i = materieSpeciali.value.indexOf(m)
  if (i === -1) {
    materieSpeciali.value.push(m)
  } else {
    materieSpeciali.value.splice(i, 1)
    // Togliendo la stella si libera la materia da tutte le giornate del calendario
    for (const [d, mats] of Object.entries(giornateSpeciali.value)) {
      const next = mats.filter((x) => x !== m)
      if (next.length) giornateSpeciali.value[d] = next
      else delete giornateSpeciali.value[d]
    }
  }
}

const meseSpeciali = ref(startOfMonth(new Date()))
const nomeMeseSpeciali = computed(() => format(meseSpeciali.value, 'MMMM yyyy', { locale: it }))
function cambiaMeseSpeciali(dir: number) { meseSpeciali.value = addMonths(meseSpeciali.value, dir) }

const blankSpeciali = computed(() => {
  const dow = getDay(meseSpeciali.value) // 0 = Dom
  return dow === 0 ? 6 : dow - 1
})

const giorniMeseSpeciali = computed(() => {
  const tot = getDaysInMonth(meseSpeciali.value)
  return Array.from({ length: tot }, (_, i) => {
    const d = setDate(meseSpeciali.value, i + 1)
    return { numero: i + 1, dateStr: format(d, 'yyyy-MM-dd'), domenica: getDay(d) === 0 }
  })
})

const materiaPennello = ref('')
watchEffect(() => {
  // Il "pennello" resta sempre su una materia speciale valida
  if (!materieSpeciali.value.includes(materiaPennello.value)) {
    materiaPennello.value = materieSpeciali.value[0] ?? ''
  }
})

const chiusureSet = computed(() =>
  // c.date è già 'YYYY-MM-DD'
  new Set((closures.value as any[]).map((c: any) => c.date))
)

function toggleGiornoSpeciale(dateStr: string, domenica: boolean) {
  if (domenica || chiusureSet.value.has(dateStr) || !materiaPennello.value) return
  const arr = giornateSpeciali.value[dateStr] ?? []
  if (arr.includes(materiaPennello.value)) {
    const next = arr.filter((x) => x !== materiaPennello.value)
    if (next.length) giornateSpeciali.value[dateStr] = next
    else delete giornateSpeciali.value[dateStr]
  } else {
    giornateSpeciali.value[dateStr] = [...arr, materiaPennello.value]
  }
}

// ─── Sconti e convenzioni (portale famiglie) ───
const nuovoSconto = reactive({ nome: '', descrizione: '', immagine: '' })
const fileSconto = ref<File | null>(null)

// L'immagine scelta viene rimpicciolita nel browser (max 800px, JPEG) prima di salvarla:
// così il database resta leggero e il portale carica in fretta.
watch(fileSconto, async (file) => {
  if (!file) return
  try {
    nuovoSconto.immagine = await ridimensionaImmagine(file)
  } catch {
    toast.add({ title: 'Immagine non valida', description: 'Scegli un file JPG o PNG.', color: 'error' })
    fileSconto.value = null
  }
})

function ridimensionaImmagine(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 800
      const scala = Math.min(1, MAX / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scala)
      canvas.height = Math.round(img.height * scala)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Immagine non leggibile')) }
    img.src = url
  })
}

function aggiungiSconto() {
  if (!nuovoSconto.nome.trim() || !nuovoSconto.descrizione.trim()) {
    toast.add({ title: 'Compila nome e descrizione', color: 'warning', icon: 'i-heroicons-exclamation-circle' })
    return
  }
  sconti.value.push({ nome: nuovoSconto.nome.trim(), descrizione: nuovoSconto.descrizione.trim(), immagine: nuovoSconto.immagine })
  Object.assign(nuovoSconto, { nome: '', descrizione: '', immagine: '' })
  fileSconto.value = null
  toast.add({ title: 'Convenzione aggiunta', description: 'Ricordati di premere "Salva Modifiche".', color: 'info' })
}
function rimuoviSconto(idx: number) {
  const s = sconti.value[idx]
  if (!s) return
  chiediConferma(
    {
      title: `Togliere la convenzione "${s.nome}"?`,
      description: 'Sparirà dalla sezione Sconti del portale famiglie, insieme alla sua immagine. Diventa definitivo quando premi "Salva Modifiche".',
      confirmLabel: 'Togli',
      confirmColor: 'error',
    },
    () => { sconti.value.splice(idx, 1) }
  )
}

const nuovaMateria = ref('')
function aggiungiMateria() {
  if (nuovaMateria.value && !materie.value.includes(nuovaMateria.value)) {
    materie.value.push(nuovaMateria.value)
    nuovaMateria.value = ''
  }
}
function rimuoviMateria(idx: number) {
  const materia = materie.value[idx]
  if (!materia) return

  const eraSpeciale = materieSpeciali.value.includes(materia)
  chiediConferma(
    {
      title: `Togliere la materia "${materia}"?`,
      description: `Non sarà più prenotabile dal portale né assegnabile ai tutor.${eraSpeciale ? ' Essendo speciale, perde la stella e tutte le giornate segnate nel calendario.' : ''} Le prenotazioni passate e i tutor che ce l'hanno già non vengono toccati. Diventa definitivo quando premi "Salva Modifiche".`,
      confirmLabel: 'Togli materia',
      confirmColor: 'error',
    },
    () => {
      const [rimossa] = materie.value.splice(idx, 1)
      // Se era speciale, togli anche stella e giornate in calendario
      if (rimossa && materieSpeciali.value.includes(rimossa)) toggleSpeciale(rimossa)
    }
  )
}

// ─── "Aggiungi le materie standard" ───
//
// PERCHE' un bottone e non una modifica fatta direttamente nel database: il
// database è quello vero, condiviso, con dentro le prenotazioni delle famiglie.
// Un bottone lo si preme quando si vuole, il risultato si vede subito e se non
// piace si tolgono le voci a mano. Rischio zero.
//
// Il bottone AGGIUNGE soltanto: non rinomina, non riordina e soprattutto non
// toglie mai niente. Se il Centro ha già "Storia dell'arte" scritta a modo suo,
// resta la sua — il confronto ignora maiuscole, accenti e spazi doppi, quindi
// non nasce il doppione "Storia dell'Arte" accanto a quella che c'era già.
const materieMancanti = computed(() => materieDaAggiungere(materie.value))

function aggiungiMaterieStandard() {
  const mancanti = materieMancanti.value

  // Niente da fare: si dice e si sta fermi. Aprire una finestra di conferma per
  // poi non scrivere niente lascerebbe il dubbio di aver combinato qualcosa.
  if (mancanti.length === 0) {
    toast.add({
      title: 'Ci sono già tutte',
      description: `Le ${MATERIE_SUPERIORI.length} materie standard sono tutte nella tua lista: non c'è niente da aggiungere.`,
      color: 'info',
      icon: 'i-heroicons-information-circle',
    })
    return
  }

  const gia = MATERIE_SUPERIORI.length - mancanti.length

  chiediConferma(
    {
      title: `Aggiungo ${mancanti.length} ${mancanti.length === 1 ? 'materia nuova' : 'materie nuove'}`,
      // L'elenco per intero, non "…e altre 30": è l'unico momento in cui si può
      // dire "no, questa non la voglio" prima che finisca nel portale.
      description:
        (gia === 0 ? 'Non tolgo niente da quello che c\'è già.\n\n'
        : gia === 1 ? '1 ce l\'hai già e non la tocco. Non tolgo niente.\n\n'
        : `${gia} ce le hai già e non le tocco. Non tolgo niente.\n\n`)
        + `Sto per aggiungere:\n${mancanti.join(' · ')}\n\n`
        + 'Dopo puoi togliere con la ✕ quelle che non ti servono.',
      confirmLabel: 'Aggiungi e salva',
      attendi: true,
    },
    async () => {
      const prima = [...materie.value]
      materie.value = [...materie.value, ...mancanti]

      // Stessa strada di sempre: si salva tutta la scheda con salvaConfigs().
      try {
        await salvaConfigs({ silenzioso: true, rilancia: true })
      } catch (e) {
        // Salvataggio fallito: si rimette la lista com'era, altrimenti la pagina
        // mostrerebbe materie che nel database non ci sono, e il secondo tentativo
        // dalla finestra rimasta aperta le aggiungerebbe una seconda volta.
        materie.value = prima
        throw e
      }

      toast.add({
        title: `${mancanti.length} ${mancanti.length === 1 ? 'materia aggiunta' : 'materie aggiunte'}`,
        description: `Ora la lista ne ha ${materie.value.length} in tutto. Le famiglie le vedono subito nel portale.`,
        color: 'success',
        icon: 'i-heroicons-check-circle',
      })
    }
  )
}

const nuovaSpesa = reactive({ nome: '', importo: 0, dal: '', al: '', categoria: '' })
function aggiungiSpesa() {
  if (nuovaSpesa.nome && nuovaSpesa.importo > 0) {
    speseFisse.value.push({
      nome: nuovaSpesa.nome, importo: nuovaSpesa.importo,
      dal: nuovaSpesa.dal, al: nuovaSpesa.al, categoria: nuovaSpesa.categoria,
    })
    nuovaSpesa.nome = ''
    nuovaSpesa.importo = 0
    nuovaSpesa.dal = ''
    nuovaSpesa.al = ''
    nuovaSpesa.categoria = ''
  }
}

// Modo CORRETTO di far sparire una spesa che non paghi più: la chiudi da oggi.
// I mesi passati restano com'erano, il break-even di quest'anno non cambia.
function chiudiSpesaOggi(idx: number) {
  const s = speseFisse.value[idx]
  if (!s) return
  chiediConferma(
    {
      title: `Chiudere "${s.nome}" da oggi?`,
      description: 'La spesa smette di pesare da oggi in poi, ma resta nei conti dei mesi passati. Diventa definitivo quando premi "Salva Modifiche".',
      confirmLabel: 'Chiudi da oggi',
    },
    () => {
      s.al = oggiISO()
      toast.add({ title: 'Spesa chiusa da oggi', description: 'Ricordati di premere "Salva Modifiche".', color: 'info' })
    }
  )
}

function rimuoviSpesa(idx: number) {
  const s = speseFisse.value[idx]
  if (!s) return
  chiediConferma(
    {
      title: `Eliminare "${s.nome}" dall'elenco?`,
      description: 'Attenzione: la spesa sparisce anche dai conti dei mesi passati (break-even ricalcolato). Se invece hai solo smesso di pagarla, usa "Chiudi da oggi". Diventa definitivo con "Salva Modifiche".',
      confirmLabel: 'Elimina',
      confirmColor: 'error',
    },
    () => { speseFisse.value.splice(idx, 1) }
  )
}

// Etichetta di stato di una spesa in base alle date di validità
function statoSpesa(s: { dal: string; al: string }): { label: string; color: 'success' | 'neutral' | 'info' } {
  const oggi = oggiISO()
  if (s.al  && s.al  < oggi) return { label: 'chiusa', color: 'neutral' }
  if (s.dal && s.dal > oggi) return { label: 'futura', color: 'info' }
  return { label: 'attiva', color: 'success' }
}

const salvandoConfigs = ref(false)

// L'UNICA strada per scrivere le configurazioni di questa pagina.
//
// `silenzioso` non salta niente del salvataggio: spegne solo il messaggio
// "Impostazioni salvate", perché chi chiama (il bottone "Aggiungi le materie
// standard") ha un messaggio suo più utile, col conteggio. Due messaggi verdi
// uno sull'altro si leggono peggio di uno solo.
//
// `rilancia` serve a chi deve poter rimettere le cose com'erano se il
// salvataggio fallisce: senza, l'errore resterebbe solo un messaggio rosso e il
// codice che ha chiamato crederebbe di aver salvato. I bottoni "Salva Modifiche"
// non lo usano: a loro il messaggio rosso basta.
async function salvaConfigs(opzioni?: { silenzioso?: boolean; rilancia?: boolean }): Promise<void> {
  salvandoConfigs.value = true
  try {
    await $fetch('/api/settings/configs', {
      method: 'PUT',
      body: {
        materie: JSON.stringify(materie.value),
        tariffe_tutor: JSON.stringify(tariffe.value),
        spese_fisse: JSON.stringify(speseFisse.value.map((s) => ({
          nome: s.nome,
          importo: s.importo,
          dal: s.dal || null,
          al:  s.al  || null,
          // '' (nessuna) si salva come null: è il modo in cui il server legge
          // "spesa non collegata a nessuna categoria contabile".
          categoria: s.categoria || null,
        }))),
        whatsapp_numero: whatsappNumero.value,
        // Le configurazioni si salvano sempre come testo: qui "true"/"false".
        riepilogo_serale_attivo: riepilogoSeraleAttivo.value ? 'true' : 'false',
        sconti: JSON.stringify(sconti.value),
        materie_speciali: JSON.stringify(materieSpeciali.value),
        giornate_speciali: JSON.stringify(giornateSpeciali.value),
        anno_scolastico_corrente: annoScolastico.value.trim(),
        anno_scolastico_inizio:   inizioAnnoScolastico.value.trim(),
      }
    })
    if (!opzioni?.silenzioso) toast.add({ title: 'Impostazioni salvate', color: 'success' })
    refreshConfigs()
  } catch(e: any) {
    toast.add({ title: 'Errore al salvataggio', color: 'error' })
    if (opzioni?.rilancia) throw e
  } finally {
    salvandoConfigs.value = false
  }
}

// ─── Categorie Contabili ───
const { data: categorieData, pending: pendingCategorie, refresh: refreshCategorie } = useLazyFetch('/api/accounting/categories')
const categorie = ref<{ chiave: string; etichetta: string; neutra: boolean; sistema: boolean }[]>([])
watchEffect(() => { categorie.value = (categorieData.value ?? []).map((c: any) => ({ ...c })) })

// Tendina "Categoria che sostituisce" delle spese fisse.
// Fuori le categorie di sistema (compensi, pacchetti, bolli...): quelle le scrive il
// gestionale da solo e non sono spese fisse. Fuori anche le categorie appena aggiunte
// e non ancora salvate, che non hanno ancora una chiave a cui agganciarsi.
const opzioniCategoriaSpesa = computed(() => [
  { label: '(nessuna)', value: '' },
  ...categorie.value
    .filter((c) => c.chiave && !c.sistema)
    .map((c) => ({ label: c.etichetta || c.chiave, value: c.chiave })),
])

// Quante spese previste sono ancora scollegate: se le registri anche in contabilità
// finiscono contate due volte nel break-even.
const speseSenzaCategoria = computed(() => speseFisse.value.filter((s) => !s.categoria))

const nuovaCategoria = reactive({ etichetta: '', neutra: false })
function aggiungiCategoria() {
  const nome = nuovaCategoria.etichetta.trim()
  if (!nome) return
  if (categorie.value.some((c) => c.etichetta.toLowerCase() === nome.toLowerCase())) {
    toast.add({ title: 'Categoria già presente', color: 'warning', icon: 'i-heroicons-exclamation-circle' })
    return
  }
  // chiave vuota: la genera il server allo salvataggio
  categorie.value.push({ chiave: '', etichetta: nome, neutra: nuovaCategoria.neutra, sistema: false })
  nuovaCategoria.etichetta = ''
  nuovaCategoria.neutra = false
}
function rimuoviCategoria(idx: number) {
  const c = categorie.value[idx]
  if (!c || c.sistema) return
  chiediConferma(
    {
      title: `Eliminare la categoria "${c.etichetta}"?`,
      description: 'Se ha già dei movimenti collegati il salvataggio verrà rifiutato: in quel caso rinominala invece di eliminarla. Diventa definitivo quando premi "Salva categorie".',
      confirmLabel: 'Elimina',
      confirmColor: 'error',
    },
    () => { categorie.value.splice(idx, 1) }
  )
}

const salvandoCategorie = ref(false)
async function salvaCategorie() {
  salvandoCategorie.value = true
  try {
    await $fetch('/api/accounting/categories', { method: 'PUT', body: { categorie: categorie.value } })
    toast.add({ title: 'Categorie salvate', color: 'success', icon: 'i-heroicons-check-circle' })
    refreshCategorie()
  } catch (err: any) {
    toast.add({ title: 'Impossibile salvare', description: err?.data?.statusMessage ?? 'Operazione non riuscita', color: 'error' })
  } finally {
    salvandoCategorie.value = false
  }
}

// ─── Fetch Chiusure ───
const { data: closuresData, pending: pendingClosures, refresh: refreshClosures } = useLazyFetch('/api/settings/closures')
const closures = computed(() => closuresData.value ?? [])

const nuovaChiusura = reactive({ date: '', description: '' })

// Che cosa c'è già in quella data (lezioni, prenotazioni, disponibilità tutor)
async function impattoChiusura(date: string) {
  try {
    return await $fetch<{ lezioni: number; prenotazioni: number; disponibilita: number }>(
      '/api/settings/closures/impact', { query: { date } }
    )
  } catch {
    return null
  }
}

function descriviImpatto(i: { lezioni: number; prenotazioni: number; disponibilita: number } | null): string {
  if (!i) return ''
  const pezzi: string[] = []
  if (i.lezioni)       pezzi.push(`${i.lezioni} ${i.lezioni === 1 ? 'lezione' : 'lezioni'}`)
  if (i.prenotazioni)  pezzi.push(`${i.prenotazioni} ${i.prenotazioni === 1 ? 'prenotazione' : 'prenotazioni'}`)
  if (i.disponibilita) pezzi.push(`${i.disponibilita} ${i.disponibilita === 1 ? 'disponibilità tutor' : 'disponibilità tutor'}`)
  return pezzi.join(', ')
}

async function aggiungiChiusura() {
  if (!nuovaChiusura.date) return

  const salva = async () => {
    try {
      await $fetch('/api/settings/closures', { method: 'POST', body: nuovaChiusura })
      toast.add({ title: 'Chiusura aggiunta', color: 'success' })
      nuovaChiusura.date = ''
      nuovaChiusura.description = ''
      refreshClosures()
    } catch(e: any) {
      toast.add({ title: 'Errore', color: 'error' })
    }
  }

  const impatto = await impattoChiusura(nuovaChiusura.date)
  const cosaCe = descriviImpatto(impatto)

  // Se quel giorno è già "vivo", meglio dirlo prima di chiuderlo
  if (cosaCe) {
    chiediConferma(
      {
        title: 'Quel giorno non è vuoto',
        description: `Il ${nuovaChiusura.date.split('-').reverse().join('/')} risulta già: ${cosaCe}. Chiudendo il centro il giorno non sarà più prenotabile, ma quello che c'è ora NON viene cancellato: controllalo a mano.`,
        confirmLabel: 'Chiudi comunque',
      },
      salva
    )
    return
  }

  await salva()
}
async function eliminaChiusura(c: any) {
  const giorno = String(c.date).split('-').reverse().join('/')
  const cosaCe = descriviImpatto(await impattoChiusura(c.date))

  chiediConferma(
    {
      title: `Riaprire il ${giorno}?`,
      description: cosaCe
        ? `Il giorno torna prenotabile per famiglie e tutor. In quella data risulta già: ${cosaCe} — controlla che sia coerente.`
        : 'Il giorno torna prenotabile per famiglie e tutor. Al momento in quella data non c\'è nulla: nessuna lezione, prenotazione o disponibilità.',
      confirmLabel: 'Riapri il giorno',
      confirmColor: 'error',
    },
    async () => {
      try {
        await $fetch(`/api/settings/closures/${c.id}`, { method: 'DELETE' })
        toast.add({ title: 'Chiusura rimossa', color: 'success' })
        refreshClosures()
      } catch(e: any) {
        toast.add({ title: 'Errore', color: 'error' })
      }
    }
  )
}
</script>

