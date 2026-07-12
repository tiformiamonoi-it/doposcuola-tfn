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
      { label: 'Sconti', slot: 'sconti' }
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
            </div>
            <p class="text-xs text-slate-500 mt-0.5">
              {{ t.oreIncluse }} ore
              <template v-if="t.tipo === 'MENSILE' && t.giorniInclusi"> · {{ t.giorniInclusi }} giorni · {{ t.orarioGiornaliero }}h/giorno</template>
              <template v-else-if="t.tipo === 'A_CONSUMO'"> · € {{ parseFloat(t.tariffaOraria || 0).toFixed(2) }}/h</template>
              · € {{ parseFloat(t.prezzoStandard).toFixed(2) }}
              <span v-if="t.descrizione" class="ml-2 text-slate-400">— {{ t.descrizione }}</span>
            </p>
          </div>
          <UButton
            icon="i-heroicons-trash"
            variant="ghost"
            color="error"
            size="xs"
            :loading="eliminando === t.id"
            @click="eliminaTemplate(t.id)"
          />
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
                <UButton icon="i-heroicons-plus" @click="aggiungiMateria" />
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
                fuori da quelle giornate scatta il supplemento di €10.
              </p>
            </div>
            <template #footer>
              <UButton @click="salvaConfigs" :loading="salvandoConfigs">Salva Modifiche</UButton>
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
              <UButton @click="salvaConfigs" :loading="salvandoConfigs">Salva Modifiche</UButton>
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
            </div>
            <template #footer>
              <UButton @click="salvaConfigs" :loading="salvandoConfigs">Salva Modifiche</UButton>
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
              <UButton @click="salvaConfigs" :loading="salvandoConfigs">Salva Modifiche</UButton>
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
            <div class="flex items-end gap-3">
              <UFormField label="Descrizione spesa" class="flex-1">
                <UInput v-model="nuovaSpesa.nome" placeholder="Es. Affitto locale" />
              </UFormField>
              <UFormField label="Importo mensile (€)" class="w-40">
                <UInputNumber v-model="nuovaSpesa.importo" :min="0" :step="10" />
              </UFormField>
              <UButton icon="i-heroicons-plus" @click="aggiungiSpesa">Aggiungi</UButton>
            </div>

            <UTable :data="speseFisse" :columns="[{ accessorKey: 'nome', header: 'Spesa' }, { accessorKey: 'importo', header: 'Importo (€)' }, { id: 'azioni', header: '' }]">
              <template #importo-cell="{ row }">
                <span class="font-medium">€ {{ parseFloat(row.original.importo).toFixed(2) }}</span>
              </template>
              <template #azioni-cell="{ row }">
                <UButton icon="i-heroicons-trash" variant="ghost" color="error" size="xs" @click="rimuoviSpesa(row.index)" />
              </template>
            </UTable>
          </div>
          <template #footer>
            <UButton @click="salvaConfigs" :loading="salvandoConfigs">Salva Modifiche</UButton>
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
                <span class="font-medium">{{ new Date(row.original.date).toLocaleDateString('it-IT') }}</span>
              </template>
              <template #azioni-cell="{ row }">
                <UButton icon="i-heroicons-trash" variant="ghost" color="error" size="xs" @click="eliminaChiusura(row.original.id)" />
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
            <UButton @click="salvaConfigs" :loading="salvandoConfigs">Salva Modifiche</UButton>
          </template>
        </UCard>
      </template>

    </UTabs>

    <!-- ─── MODAL CREA TEMPLATE ─── -->
    <UModal v-model:open="modalCreaAperto" title="Nuovo Template Pacchetto">
      <template #body>
        <div class="space-y-4">

          <UFormField label="Nome template" required>
            <UInput v-model="nuovo.nome" placeholder="Es: 10 ore Medie" class="w-full" />
          </UFormField>

          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Categoria" required>
              <USelectMenu
                v-model="nuovo.categoria"
                :items="['Elementari', 'Medie', 'Superiori', 'Università', 'Concorsi', 'Preparazione Esami', 'Altro']"
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
              <UInputNumber v-model="nuovo.prezzoStandard" :min="0" :step="10" class="w-full" />
            </UFormField>
          </div>

          <!-- A CONSUMO: tariffa oraria e prima ricarica (prezzo base) -->
          <div v-else-if="nuovo.tipo === 'A_CONSUMO'" class="grid grid-cols-2 gap-4">
            <UFormField label="Tariffa oraria (€/h)" required>
              <UInputNumber v-model="nuovo.tariffaOraria" :min="1" :step="0.5" class="w-full" />
            </UFormField>
            <UFormField label="Prima ricarica base (€)" required>
              <UInputNumber v-model="nuovo.prezzoStandard" :min="0" :step="10" class="w-full" />
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
                <UInputNumber v-model="nuovo.prezzoStandard" :min="0" :step="10" class="w-full" />
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
          <UButton variant="ghost" @click="modalCreaAperto = false">Annulla</UButton>
          <UButton :loading="salvando" @click="creaTemplate">Salva Template</UButton>
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
          <UButton variant="ghost" @click="modalCreaSlotAperto = false">Annulla</UButton>
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
    @confirm="eseguiConferma"
  />
</template>

<script setup lang="ts">
import ConfirmDialog from '~/components/ConfirmDialog.vue'
import { addMonths, format, getDay, getDaysInMonth, setDate, startOfMonth } from 'date-fns'
import { it } from 'date-fns/locale'

definePageMeta({ middleware: ['admin-only'] })

const toast = useToast()

// ─── ConfirmDialog shared state ───
const confirmOpen = ref(false)
const confirmTitle = ref('')
const confirmDescription = ref('')
const confirmLabel = ref('Conferma')
const confirmColor = ref<'primary' | 'error'>('primary')
const pendingAction = ref<(() => void) | null>(null)

function chiediConferma(config: { title: string; description: string; confirmLabel?: string; confirmColor?: 'primary' | 'error' }, action: () => void) {
  confirmTitle.value = config.title
  confirmDescription.value = config.description
  confirmLabel.value = config.confirmLabel ?? 'Conferma'
  confirmColor.value = config.confirmColor ?? 'primary'
  pendingAction.value = action
  confirmOpen.value = true
}

function eseguiConferma() {
  confirmOpen.value = false
  pendingAction.value?.()
  pendingAction.value = null
}

// ─── Fetch templates ───
const { data: templatesData, pending: pendingTemplates, refresh } = useLazyFetch('/api/standard-packages')
const templates = computed(() => templatesData.value ?? [])

// ─── Modal crea ───
const modalCreaAperto = ref(false)
const salvando        = ref(false)

const nuovo = reactive({
  nome:              '',
  descrizione:       '',
  tipo:              'ORE' as 'ORE' | 'MENSILE',
  categoria:         '',
  oreIncluse:        10,
  giorniInclusi:     12,
  orarioGiornaliero: 3,
  prezzoStandard:    150,
  tariffaOraria:     10,
})

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
  Object.assign(nuovo, {
    nome: '', descrizione: '', tipo: 'ORE', categoria: '',
    oreIncluse: 10, giorniInclusi: 12, orarioGiornaliero: 3, prezzoStandard: 150, tariffaOraria: 10
  })
  modalCreaAperto.value = true
}

async function creaTemplate() {
  if (!nuovo.nome || !nuovo.categoria) {
    toast.add({ title: 'Compila nome e categoria', color: 'warning', icon: 'i-heroicons-exclamation-circle' })
    return
  }
  salvando.value = true
  try {
    const body: any = {
      nome:           nuovo.nome,
      tipo:           nuovo.tipo,
      categoria:      nuovo.categoria,
      oreIncluse:     nuovo.oreIncluse,
      prezzoStandard: nuovo.prezzoStandard,
    }
    if (nuovo.descrizione) body.descrizione = nuovo.descrizione
    if (nuovo.tipo === 'MENSILE') {
      if (nuovo.giorniInclusi > 0)     body.giorniInclusi     = nuovo.giorniInclusi
      if (nuovo.orarioGiornaliero > 0) body.orarioGiornaliero = nuovo.orarioGiornaliero
    } else if (nuovo.tipo === 'A_CONSUMO') {
      if (nuovo.tariffaOraria > 0)     body.tariffaOraria     = nuovo.tariffaOraria
    }

    await $fetch('/api/standard-packages', { method: 'POST', body })
    toast.add({ title: 'Template creato', color: 'success', icon: 'i-heroicons-check-circle' })
    modalCreaAperto.value = false
    refresh()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile creare il template', color: 'error' })
  } finally {
    salvando.value = false
  }
}

// ─── Elimina template ───
const eliminando = ref<string | null>(null)

async function eliminaTemplate(id: string) {
  chiediConferma(
    { title: 'Rimuovere questo template?', description: 'Non influenzerà i pacchetti già creati.', confirmLabel: 'Elimina', confirmColor: 'error' },
    async () => {
      eliminando.value = id
      try {
        await $fetch(`/api/standard-packages/${id}`, { method: 'DELETE' })
        toast.add({ title: 'Template rimosso', color: 'success', icon: 'i-heroicons-check-circle' })
        refresh()
      } catch (err: any) {
        toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile rimuovere', color: 'error' })
      } finally {
        eliminando.value = null
      }
    }
  )
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
const speseFisse = ref<{nome: string, importo: number}[]>([])
const whatsappNumero = ref('')
const sconti = ref<{ nome: string; descrizione: string; immagine: string }[]>([])
const materieSpeciali = ref<string[]>([])
const giornateSpeciali = ref<Record<string, string[]>>({})

watchEffect(() => {
  try { materie.value = JSON.parse(configs.value.materie || '[]') } catch(e){}
  try { tariffe.value = JSON.parse(configs.value.tariffe_tutor || '{"SINGOLA":5,"GRUPPO":8,"MAXI":8.5}') } catch(e){}
  try { speseFisse.value = JSON.parse(configs.value.spese_fisse || '[]') } catch(e){}
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
  new Set((closures.value as any[]).map((c: any) => format(new Date(c.date), 'yyyy-MM-dd')))
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
function rimuoviSconto(idx: number) { sconti.value.splice(idx, 1) }

const nuovaMateria = ref('')
function aggiungiMateria() {
  if (nuovaMateria.value && !materie.value.includes(nuovaMateria.value)) {
    materie.value.push(nuovaMateria.value)
    nuovaMateria.value = ''
  }
}
function rimuoviMateria(idx: number) {
  const [rimossa] = materie.value.splice(idx, 1)
  // Se era speciale, togli anche stella e giornate in calendario
  if (rimossa && materieSpeciali.value.includes(rimossa)) toggleSpeciale(rimossa)
}

const nuovaSpesa = reactive({ nome: '', importo: 0 })
function aggiungiSpesa() {
  if (nuovaSpesa.nome && nuovaSpesa.importo > 0) {
    speseFisse.value.push({ nome: nuovaSpesa.nome, importo: nuovaSpesa.importo })
    nuovaSpesa.nome = ''
    nuovaSpesa.importo = 0
  }
}
function rimuoviSpesa(idx: number) { speseFisse.value.splice(idx, 1) }

const salvandoConfigs = ref(false)
async function salvaConfigs() {
  salvandoConfigs.value = true
  try {
    await $fetch('/api/settings/configs', {
      method: 'PUT',
      body: {
        materie: JSON.stringify(materie.value),
        tariffe_tutor: JSON.stringify(tariffe.value),
        spese_fisse: JSON.stringify(speseFisse.value),
        whatsapp_numero: whatsappNumero.value,
        sconti: JSON.stringify(sconti.value),
        materie_speciali: JSON.stringify(materieSpeciali.value),
        giornate_speciali: JSON.stringify(giornateSpeciali.value),
      }
    })
    toast.add({ title: 'Impostazioni salvate', color: 'success' })
    refreshConfigs()
  } catch(e: any) {
    toast.add({ title: 'Errore al salvataggio', color: 'error' })
  } finally {
    salvandoConfigs.value = false
  }
}

// ─── Categorie Contabili ───
const { data: categorieData, pending: pendingCategorie, refresh: refreshCategorie } = useLazyFetch('/api/accounting/categories')
const categorie = ref<{ chiave: string; etichetta: string; neutra: boolean; sistema: boolean }[]>([])
watchEffect(() => { categorie.value = (categorieData.value ?? []).map((c: any) => ({ ...c })) })

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
  if (categorie.value[idx]?.sistema) return
  categorie.value.splice(idx, 1)
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
async function aggiungiChiusura() {
  if (!nuovaChiusura.date) return
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
async function eliminaChiusura(id: string) {
  chiediConferma(
    { title: 'Eliminare questa data di chiusura?', description: 'La data verrà rimossa dal calendario.', confirmLabel: 'Elimina', confirmColor: 'error' },
    async () => {
      try {
        await $fetch(`/api/settings/closures/${id}`, { method: 'DELETE' })
        toast.add({ title: 'Chiusura rimossa', color: 'success' })
        refreshClosures()
      } catch(e: any) {
        toast.add({ title: 'Errore', color: 'error' })
      }
    }
  )
}
</script>

