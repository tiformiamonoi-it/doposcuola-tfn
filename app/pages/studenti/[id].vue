<template>
  <div class="space-y-6">
    <!-- Skeleton caricamento -->
    <template v-if="pending">
      <div class="space-y-4">
        <USkeleton class="h-8 w-64" />
        <USkeleton class="h-40 w-full" />
        <USkeleton class="h-60 w-full" />
      </div>
    </template>

    <!-- Studente non trovato -->
    <template v-else-if="!studente">
      <UAlert icon="i-heroicons-exclamation-circle" color="error" title="Studente non trovato" description="Questo studente non esiste o è stato rimosso." />
      <UButton to="/studenti" variant="ghost" icon="i-heroicons-arrow-left">Torna alla lista</UButton>
    </template>

    <!-- Contenuto principale -->
    <template v-else>
      <!--
        Barra azioni. Da tablet in su (sm e oltre) resta com'era: tutti i bottoni in riga.
        Da telefono cinque bottoni in fila non ci stanno e le ultime azioni finivano
        fuori dallo schermo: restano in barra solo la freccia "indietro" e "Modifica",
        il resto si rifugia nel menù a tre puntini (che è anche più sicuro, perché
        "Disattiva" e "Anonimizza" non stanno più a un pollice da "Modifica").
      -->
      <div class="flex items-center justify-between mb-4">
        <!-- Su telefono l'etichetta sparisce e resta la sola freccia: `sr-only` la
             tiene comunque a disposizione dei lettori di schermo. -->
        <UButton to="/studenti" variant="ghost" icon="i-heroicons-arrow-left" size="sm" aria-label="Torna alla lista">
          <span class="sr-only sm:not-sr-only">Torna alla lista</span>
        </UButton>
        <div class="flex items-center gap-2">
          <UButton :to="`/stampe/studente-${id}`" icon="i-heroicons-printer" variant="ghost" size="sm" class="hidden sm:inline-flex">Stampa lezioni</UButton>
          <UButton v-if="isAdmin" :to="`/api/students/${id}/export`" external target="_blank" icon="i-heroicons-arrow-down-tray" variant="ghost" size="sm" class="hidden sm:inline-flex">Esporta dati</UButton>
          <UButton v-if="isAdmin" icon="i-heroicons-pencil-square" variant="ghost" size="sm" @click="apriModalModifica">Modifica</UButton>
          <UButton v-if="studente.active" icon="i-heroicons-user-minus" variant="ghost" color="error" size="sm" :loading="disattivando" class="hidden sm:inline-flex" @click="disattivaStudente">Disattiva</UButton>
          <UButton v-if="isSoloAdmin" icon="i-heroicons-shield-exclamation" variant="ghost" color="error" size="sm" class="hidden sm:inline-flex" @click="anonimizzaAperto = true">Anonimizza</UButton>
          <!-- Se per il ruolo di chi guarda non resta nessuna azione da nascondere,
               il bottone a tre puntini non compare affatto. -->
          <UDropdownMenu v-if="azioniTelefono.length > 0" :items="azioniTelefono">
            <UButton icon="i-heroicons-ellipsis-vertical" variant="ghost" color="neutral" size="sm" class="sm:hidden" aria-label="Altre azioni su questo studente" />
          </UDropdownMenu>
        </div>
      </div>

      <!-- Anonimizzazione GDPR (art. 17): conferma esplicita, operazione irreversibile -->
      <UModal v-model:open="anonimizzaAperto" title="Anonimizza studente (GDPR)">
        <template #body>
          <div class="space-y-3 text-sm text-slate-600">
            <p>Da usare per le richieste di <strong>cancellazione dati</strong> (art. 17 GDPR). L'operazione è <strong>irreversibile</strong>:</p>
            <ul class="list-disc pl-5 space-y-1">
              <li>nome, contatti, scuola e tutti i dati del genitore vengono cancellati per sempre;</li>
              <li>le note didattiche vengono eliminate;</li>
              <li>le prenotazioni perdono nome, telefono e note;</li>
              <li>gli account portale collegati vengono disattivati (quello del genitore solo se non ha altri figli);</li>
              <li>pacchetti, pagamenti e contabilità restano per obbligo fiscale, ma senza dati identificativi.</li>
            </ul>
            <UCheckbox v-model="anonimizzaConferma" label="Ho capito: l'operazione non si può annullare" />
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-3">
            <UButton variant="ghost" @click="anonimizzaAperto = false">Annulla</UButton>
            <UButton color="error" :disabled="!anonimizzaConferma" :loading="anonimizzando" @click="anonimizzaStudente">Anonimizza definitivamente</UButton>
          </div>
        </template>
      </UModal>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- SIDEBAR -->
        <div class="lg:col-span-4 space-y-6">
          <UCard :ui="{ body: 'p-6' }">
            <div class="flex flex-col items-center text-center mb-6">
              <UAvatar :alt="studente.firstName + ' ' + studente.lastName" size="3xl" class="mb-3 bg-primary-500 text-white font-bold" :ui="{ fallback: 'text-white' }" />
              <h2 class="text-2xl font-semibold text-slate-900">{{ studente.firstName }} {{ studente.lastName }}</h2>
              <p class="text-sm text-slate-500 mt-1">{{ studente.classe ?? '' }} <span v-if="studente.scuola">• {{ studente.scuola }}</span></p>
              <!-- Il livello NON è un campo del database: si ricava dalla classe
                   (vedi shared/livello-scolastico.ts). "—" quando la classe è vuota
                   o non si capisce: meglio dire "non lo so" che tirare a indovinare. -->
              <p class="text-xs text-slate-400 mt-0.5">Livello: {{ etichettaLivelloStudente }}</p>

              <div class="flex items-center gap-2 mt-3">
                <UBadge :color="studente.active ? 'success' : 'neutral'" variant="subtle" size="sm">
                  {{ studente.active ? 'Attivo' : 'Inattivo' }}
                </UBadge>
                <UBadge v-if="studente.bisogniSpeciali" color="orange" variant="subtle" size="sm">BES / DSA</UBadge>
              </div>
            </div>

            <USeparator class="my-4" />

            <div class="space-y-3 text-sm">
              <div class="flex items-center gap-3" v-if="dataNascitaStudente">
                <UIcon name="i-heroicons-cake" class="w-4 h-4 text-slate-400" />
                <div>
                  <div class="text-xs text-slate-500">Data di nascita</div>
                  <div class="font-medium text-slate-700">{{ formatData(dataNascitaStudente) }}</div>
                </div>
              </div>
              <div class="flex items-center gap-3" v-if="studente.studentPhone">
                <UIcon name="i-heroicons-phone" class="w-4 h-4 text-slate-400" />
                <div>
                  <div class="text-xs text-slate-500">Telefono studente</div>
                  <div class="font-medium text-slate-700">{{ studente.studentPhone }}</div>
                </div>
              </div>
              <div class="flex items-center gap-3" v-if="studente.parentEmail">
                <UIcon name="i-heroicons-envelope" class="w-4 h-4 text-slate-400" />
                <div>
                  <div class="text-xs text-slate-500">Email genitore</div>
                  <div class="font-medium text-slate-700">{{ studente.parentEmail }}</div>
                </div>
              </div>
              <div class="flex items-center gap-3" v-if="studente.parentName">
                <UIcon name="i-heroicons-user" class="w-4 h-4 text-slate-400" />
                <div>
                  <div class="text-xs text-slate-500">Genitore</div>
                  <div class="font-medium text-slate-700">{{ studente.parentName }}</div>
                </div>
              </div>
            </div>
          </UCard>

          <!-- PACCHETTO ATTIVO WIDGET -->
          <!--
            Leggibilità: la card è blu pieno (bg-primary-600 = #00558a). Tutto il testo
            sopra dev'essere bianco. "white" NON è un colore valido in Nuxt UI v4
            (validi: primary/secondary/success/info/warning/error/neutral + indigo/pink
            dichiarati in nuxt.config): usarlo faceva ricadere badge, barra e bottone sul
            blu di default → blu su blu, illeggibile. Il bianco pieno si ottiene con un
            colore valido + classi Tailwind (che vincono via tailwind-merge).
            Contrasto verificato su #00558a: bianco 7,88:1 (AA richiede 4,5:1).
          -->
          <UCard v-if="pacchettoPerRinnovo" class="bg-primary-600 text-white border-none shadow-lg" :ui="{ body: 'p-5' }">
            <div class="flex justify-between items-start mb-1">
              <div class="text-xs font-semibold tracking-wider text-white uppercase">Pacchetto Attivo</div>
              <UBadge color="neutral" variant="solid" size="xs" class="bg-white text-primary-700 font-bold">{{ pacchettoPerRinnovo.tipo }}</UBadge>
            </div>
            <h3 class="text-lg font-bold mb-1">{{ pacchettoPerRinnovo.nome }}</h3>
            <div class="text-xs text-white mb-4">
              {{ formatData(pacchettoPerRinnovo.dataInizio) }} — {{ pacchettoPerRinnovo.dataScadenza ? formatData(pacchettoPerRinnovo.dataScadenza) : 'Nessuna scadenza' }}
            </div>

            <div v-if="pacchettoPerRinnovo.tipo !== 'A_CONSUMO'" class="mb-4">
              <div class="flex justify-between text-xs font-medium mb-1.5">
                <span class="text-xl font-bold text-white">{{ pacchettoPerRinnovo.tipo === 'MENSILE' ? pacchettoPerRinnovo.giorniResiduo : parseFloat(pacchettoPerRinnovo.oreResiduo) }} <span class="text-sm font-normal text-white">/ {{ pacchettoPerRinnovo.tipo === 'MENSILE' ? pacchettoPerRinnovo.giorniAcquistati : parseFloat(pacchettoPerRinnovo.oreAcquistate) }} {{ pacchettoPerRinnovo.tipo === 'MENSILE' ? 'giorni' : 'ore' }}</span></span>
              </div>
              <!--
                UMeter non esiste in @nuxt/ui v4 (era la v2): la barra qui non veniva
                proprio disegnata. L'equivalente v4 è UProgress, che vuole v-model
                (modelValue) al posto di :value. Barra bianca su binario bianco al 25%:
                contrasto pieno/vuoto 4,34:1 (per gli elementi grafici AA chiede 3:1).
              -->
              <UProgress :model-value="pacchettoPerRinnovo.tipo === 'MENSILE' ? pacchettoPerRinnovo.giorniResiduo : parseFloat(pacchettoPerRinnovo.oreResiduo)" :max="pacchettoPerRinnovo.tipo === 'MENSILE' ? pacchettoPerRinnovo.giorniAcquistati : parseFloat(pacchettoPerRinnovo.oreAcquistate)" size="sm" :ui="{ base: 'bg-white/25', indicator: 'bg-white' }" />
            </div>
            <div v-else class="mb-4">
               <div class="text-xl font-bold text-white">{{ parseFloat(pacchettoPerRinnovo.oreResiduo) }} <span class="text-sm font-normal text-white">ore (libretto)</span></div>
            </div>

            <div class="flex items-center justify-between mt-5 pt-4 border-t border-white/30">
              <div>
                <div class="text-xs text-white">Da saldare</div>
                <div class="text-lg font-bold">€ {{ parseFloat(pacchettoPerRinnovo.importoResiduo || 0).toFixed(2) }}</div>
              </div>
              <!-- Bottone bianco pieno con testo blu scuro: 9,88:1 (primary-700 su bianco). -->
              <UButton
                v-if="parseFloat(pacchettoPerRinnovo.importoResiduo || 0) > 0"
                color="neutral"
                variant="solid"
                size="sm"
                class="bg-white text-primary-700 font-semibold hover:bg-primary-50 active:bg-primary-100 focus-visible:outline-white"
                icon="i-heroicons-banknotes"
                @click="aprirePagamento(pacchettoPerRinnovo)"
              >
                Salda
              </UButton>
            </div>
          </UCard>
          <div v-else class="flex gap-2">
            <UButton icon="i-heroicons-plus" color="primary" block @click="apriModalCreaPacchetto">Nuovo pacchetto</UButton>
          </div>

        </div>

        <!-- TABS AREA -->
        <div ref="contenitoreTabs" class="lg:col-span-8">
          <!--
            Su telefono le linguette non ci stanno tutte in riga: il tema di Nuxt UI
            le stringeva fino a tagliare le parole ("Pan… Pa… L… Pre…"). Con questi
            ritocchi la striscia scorre di lato (`overflow-x-auto`), ogni linguetta
            tiene la sua larghezza (`shrink-0`) e l'etichetta non viene più tagliata
            (`text-clip` sostituisce il `truncate` del tema, `whitespace-nowrap` la
            tiene su una riga sola). Dove ci stanno tutte, l'aspetto non cambia.
          -->
          <UTabs
            :items="tabItems"
            class="w-full"
            :ui="{ list: 'overflow-x-auto scrollbar-nascosta', trigger: 'shrink-0', label: 'text-clip whitespace-nowrap' }"
            @update:model-value="portaInVistaLinguetta"
          >
            <template #panoramica>
              <div class="space-y-6 mt-4">
                <!-- KPI Cards -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <UCard>
                    <div class="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Ultima Lezione</div>
                    <div v-if="ultimaLezione" class="flex flex-col">
                      <span class="text-lg font-bold text-slate-800">{{ formatDateBooking(ultimaLezione.data) }}</span>
                      <span class="text-sm text-slate-500">con {{ ultimaLezione.tutorFirstName }} {{ ultimaLezione.tutorLastName }}</span>
                    </div>
                    <div v-else class="text-slate-400 text-sm italic">Nessuna lezione registrata</div>
                  </UCard>
                  
                  <UCard>
                    <div class="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Lezioni Svolte</div>
                    <div class="flex items-baseline gap-2">
                      <span class="text-3xl font-bold text-slate-800">{{ lezioniSvolteMeseCorrente }}</span>
                      <span class="text-sm text-slate-500">questo mese</span>
                    </div>
                  </UCard>
                </div>

                <!-- Ultime note: campo interno della scheda + ultima nota interna e famiglia dal diario -->
                <div class="bg-white rounded-xl shadow-sm ring-1 ring-slate-200">
                  <div class="p-4 border-b border-slate-100 flex items-center gap-2">
                    <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-tfn-500" />
                    <h3 class="font-medium text-slate-800">Ultime note</h3>
                  </div>
                  <div class="p-4 bg-yellow-50/30 space-y-3">
                    <!-- Note semplici della scheda: sempre visibili -->
                    <div class="text-sm">
                      <div class="flex items-center gap-2 mb-0.5">
                        <UBadge color="neutral" variant="subtle" size="xs">Scheda</UBadge>
                      </div>
                      <p v-if="studente.note" class="text-slate-700 whitespace-pre-wrap">{{ studente.note }}</p>
                      <p v-else class="text-slate-400 italic">Nessuna nota nella scheda.</p>
                    </div>
                    <!-- Bisogni speciali: sempre visibili -->
                    <div class="text-sm">
                      <div class="flex items-center gap-2 mb-0.5">
                        <UBadge color="orange" variant="subtle" size="xs">BES / DSA</UBadge>
                      </div>
                      <p v-if="studente.bisogniSpeciali" class="text-slate-700 whitespace-pre-wrap">{{ studente.bisogniSpeciali }}</p>
                      <p v-else class="text-slate-400 italic">Nessun bisogno speciale segnalato.</p>
                    </div>
                    <div v-for="nota in ultimeNote" :key="nota.id" class="text-sm">
                      <div class="flex items-center gap-2 mb-0.5">
                        <UBadge :color="nota.visibilita === 'FAMIGLIA' ? 'success' : 'warning'" variant="subtle" size="xs">
                          {{ nota.visibilita === 'FAMIGLIA' ? 'Famiglia' : 'Interna' }}
                        </UBadge>
                        <UBadge v-if="nota.visibilita === 'FAMIGLIA' && !nota.approvataAt" color="warning" variant="solid" size="xs">Da approvare</UBadge>
                        <span class="text-xs text-slate-400">{{ formatData(nota.createdAt) }} — {{ nota.author?.firstName }} {{ nota.author?.lastName }}</span>
                      </div>
                      <p class="text-slate-700 whitespace-pre-wrap line-clamp-3">{{ nota.contenuto }}</p>
                    </div>
                  </div>
                </div>


              </div>
            </template>

            <template #pacchetti>
              <div class="mt-4 space-y-4">
                <div class="flex justify-end gap-2">
                   <UButton v-if="pacchettoPerRinnovo" icon="i-heroicons-arrow-path-rounded-square" size="sm" variant="outline" color="primary" @click="avviaRinnovo(pacchettoPerRinnovo)">Rinnova</UButton>
                   <UButton icon="i-heroicons-plus" size="sm" color="primary" @click="apriModalCreaPacchetto">Nuovo</UButton>
                </div>
                <div v-if="pendingPacchetti" class="space-y-2 py-2"><USkeleton v-for="i in 2" :key="i" class="h-16 w-full" /></div>
                <div v-else-if="pacchetti.length === 0" class="py-8 text-center text-slate-400 text-sm">Nessun pacchetto per questo studente.</div>
                <div v-else class="space-y-2">
                  <div v-for="pkg in pacchetti" :key="pkg.id" class="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 bg-white">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-medium text-sm text-slate-800">{{ pkg.nome }}</span>
                        <UBadge color="neutral" variant="outline" size="xs">{{ pkg.tipo }}</UBadge>
                        <StatoBadge v-for="s in riassumiStati(pkg.stati)" :key="s" :stato="s" :pacchetto="pkg" />
                      </div>
                      <div class="text-sm mt-1">
                        <div class="font-medium text-slate-600">
                          <template v-if="pkg.tipo === 'ORE'">{{ parseFloat(pkg.oreResiduo) }} / {{ parseFloat(pkg.oreAcquistate) }} ore</template>
                          <template v-else-if="pkg.tipo === 'MENSILE'">{{ pkg.giorniResiduo ?? 0 }} / {{ pkg.giorniAcquistati ?? 0 }} giorni</template>
                          <template v-else-if="pkg.tipo === 'A_CONSUMO'">{{ parseFloat(pkg.oreResiduo) }} ore (libretto)</template>
                        </div>
                        <span v-if="pkg.importoResiduo && parseFloat(pkg.importoResiduo) > 0" class="text-orange-500 font-medium text-xs">Residuo € {{ parseFloat(pkg.importoResiduo).toFixed(2) }}</span>
                      </div>
                    </div>
                    <div class="flex items-center gap-4 ml-4 shrink-0">
                      <div class="text-xs text-slate-400 text-right">
                        <div>Inizio: {{ formatData(pkg.dataInizio) }}</div>
                        <div v-if="pkg.dataScadenza">Scade: {{ formatData(pkg.dataScadenza) }}</div>
                      </div>
                      <UDropdownMenu v-if="azioniPacchetto(pkg).length > 0" :items="[azioniPacchetto(pkg)]">
                        <UButton icon="i-heroicons-ellipsis-vertical" variant="ghost" size="xs" color="neutral" />
                      </UDropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <template #lezioni>
              <div class="mt-4 space-y-6">
                <!-- Storico Lezioni -->
                <UCard :ui="{ body: 'p-0' }">
                  <template #header>
                    <div class="flex items-center justify-between">
                      <h3 class="font-semibold text-slate-800 flex items-center gap-2"><UIcon name="i-heroicons-academic-cap" /> Storico Lezioni</h3>
                      <UButton v-if="lezioni.length > 0" size="xs" variant="soft" icon="i-heroicons-arrow-down-tray" @click="esportaCsvLezioni">Esporta CSV</UButton>
                    </div>
                  </template>
                  
                  <!-- Filtri Lezioni -->
                  <div class="p-3 border-b border-slate-100 bg-slate-50 flex gap-2 flex-wrap">
                    <UInput v-model="filtroLezioni.dataInizio" type="date" size="sm" placeholder="Dal..." />
                    <UInput v-model="filtroLezioni.dataFine" type="date" size="sm" placeholder="Al..." />
                    <UButton size="sm" color="neutral" variant="ghost" @click="filtroLezioni.dataInizio = ''; filtroLezioni.dataFine = ''" v-if="filtroLezioni.dataInizio || filtroLezioni.dataFine">Reset</UButton>
                  </div>

                  <div v-if="pendingLezioni" class="p-8 flex justify-center"><UIcon name="i-heroicons-arrow-path" class="animate-spin w-6 h-6 text-slate-300" /></div>
                  <div v-else-if="lezioniFiltrate.length === 0" class="p-8 text-center text-slate-400 text-sm">Nessuna lezione trovata.</div>
                  <table v-else class="w-full text-left">
                    <thead>
                      <tr class="bg-white text-xs text-slate-500 uppercase border-b border-slate-100">
                        <th class="py-2.5 px-4 font-semibold">Data</th>
                        <th class="py-2.5 px-4 font-semibold">Tutor</th>
                        <th class="py-2.5 px-4 font-semibold">Tipo</th>
                        <th class="py-2.5 px-4 font-semibold text-right">Ore</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="l in lezioniFiltrate" :key="l.lessonId" class="border-b border-slate-50 text-sm hover:bg-slate-50">
                        <td class="py-2.5 px-4 font-medium">{{ formatData(l.data) }}</td>
                        <td class="py-2.5 px-4">{{ l.tutorFirstName }} {{ l.tutorLastName }}</td>
                        <td class="py-2.5 px-4 text-slate-500"><UBadge size="xs" variant="subtle" color="neutral">{{ l.tipo }}</UBadge></td>
                        <td class="py-2.5 px-4 text-right font-medium">{{ parseFloat(l.oreScalate) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </UCard>

              </div>
            </template>

            <template #prenotazioni>
              <div class="mt-4">
                <UCard :ui="{ body: 'p-0' }">
                  <template #header>
                    <div class="flex items-center justify-between">
                      <h3 class="font-semibold text-slate-800 flex items-center gap-2"><UIcon name="i-heroicons-calendar-days" /> Storico Prenotazioni</h3>
                      <UButton v-if="allBookings.length > 0" size="xs" variant="soft" icon="i-heroicons-arrow-down-tray" @click="esportaCsvPrenotazioni">Esporta CSV</UButton>
                    </div>
                  </template>

                  <div v-if="pendingBookings" class="p-8 flex justify-center"><UIcon name="i-heroicons-arrow-path" class="animate-spin w-6 h-6 text-slate-300" /></div>
                  <div v-else-if="allBookings.length === 0" class="p-8 text-center text-slate-400 text-sm">Nessuna prenotazione trovata.</div>
                  <div v-else class="divide-y divide-slate-100">
                    <div v-for="b in allBookings" :key="b.id" class="p-3 flex items-center justify-between text-sm hover:bg-slate-50">
                      <div>
                        <div class="font-medium text-slate-800">{{ formatDateBooking(b.requestedDate) }}</div>
                        <div class="text-slate-500 text-xs">{{ b.subjects?.map((s: any) => s.name).join(', ') }}</div>
                        <div v-if="b.notes" class="text-slate-400 text-xs mt-0.5 italic">"{{ b.notes }}"</div>
                      </div>
                      <div class="flex items-center gap-3">
                        <!-- Le prenotazioni nascono già confermate: niente accetta/rifiuta.
                             La presenza si gestisce inserendo lo studente nella lezione. -->
                        <UBadge v-if="b.status === 'CANCELLED'" color="neutral" variant="subtle" size="xs">Annullata</UBadge>
                        <UBadge v-else color="success" variant="subtle" size="xs">Confermata</UBadge>
                      </div>
                    </div>
                  </div>
                </UCard>
              </div>
            </template>

            <template #famiglia>
              <div class="mt-4 space-y-6">
                <!-- Dati Genitore (il primo: è quello a cui si intestano le fatture) -->
                <UCard>
                  <template #header>
                    <!-- flex-wrap: da telefono i due bottoni vanno a capo sotto il titolo -->
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <div class="flex items-center gap-2">
                        <UIcon name="i-heroicons-users" class="w-5 h-5 text-tfn-500" />
                        <span class="font-medium text-slate-800">Dati Anagrafici Genitore</span>
                        <StatHelp text="Sono i dati usati per le fatture. Se ci sono due genitori, questo resta l'intestatario predefinito." />
                      </div>
                      <div class="flex flex-wrap gap-1">
                        <!-- C5: copia il genitore dalla scheda di un fratello. Funziona anche
                             per un alunno creato senza nessun genitore. -->
                        <UButton icon="i-heroicons-magnifying-glass" variant="ghost" size="xs" @click="apriCollegaGenitore">Collega genitore già registrato</UButton>
                        <UButton icon="i-heroicons-pencil-square" variant="ghost" size="xs" @click="apriModalModifica">Modifica dati</UButton>
                      </div>
                    </div>
                  </template>
                  <p v-if="!haPrimoGenitore" class="text-sm text-slate-500 mb-2">
                    Nessun genitore registrato. Se un fratello o una sorella è già iscritto, usa
                    <strong>Collega genitore già registrato</strong>: i dati si copiano dalla sua scheda.
                  </p>
                  <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <InfoRow label="Nome Cognome" :value="studente.parentName" />
                    <InfoRow label="Parentela" :value="genitori.relazione1" />
                    <InfoRow label="Email" :value="studente.parentEmail" />
                    <InfoRow label="Telefono" :value="studente.parentPhone" />
                    <InfoRow label="Indirizzo" :value="studente.parentIndirizzo" />
                    <InfoRow label="Città e CAP" :value="studente.parentCitta ? `${studente.parentCitta} ${studente.parentCap ?? ''}`.trim() : null" />
                    <InfoRow label="Codice Fiscale" :value="studente.parentCF" />
                    <InfoRow label="Partita IVA" :value="studente.parentPIva" />
                  </dl>
                </UCard>

                <!-- SECONDO GENITORE / TUTORE.
                     Il riquadro esiste solo se il secondo genitore c'è davvero:
                     una scheda piena di caselle vuote fa solo scorrere di più. -->
                <UCard v-if="haSecondoGenitore">
                  <template #header>
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <UIcon name="i-heroicons-user-plus" class="w-5 h-5 text-tfn-500" />
                        <span class="font-medium text-slate-800">Secondo Genitore o Tutore</span>
                      </div>
                      <UButton icon="i-heroicons-pencil-square" variant="ghost" size="xs" @click="apriModalModifica">Modifica dati</UButton>
                    </div>
                  </template>
                  <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <InfoRow label="Nome Cognome" :value="genitori.nome2" />
                    <InfoRow label="Parentela" :value="genitori.relazione2" />
                    <InfoRow label="Email" :value="genitori.email2" />
                    <InfoRow label="Telefono" :value="genitori.telefono2" />
                    <InfoRow label="Data di nascita" :value="genitori.dataNascita2" />
                    <InfoRow label="Indirizzo" :value="genitori.indirizzo2" />
                    <InfoRow label="Città e CAP" :value="genitori.cittaCap2" />
                    <InfoRow label="Codice Fiscale" :value="genitori.cf2" />
                    <InfoRow label="Partita IVA" :value="genitori.piva2" />
                  </dl>
                </UCard>

                <!-- Non c'è: una riga sola con il modo per aggiungerlo -->
                <div v-else-if="isAdmin" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200 px-4 py-3">
                  <p class="text-sm text-slate-500">
                    Nessun secondo genitore o tutore registrato.
                  </p>
                  <div class="flex flex-wrap gap-2">
                    <UButton icon="i-heroicons-magnifying-glass" variant="soft" size="xs" @click="apriCollegaGenitore">
                      Collega genitore già registrato
                    </UButton>
                    <UButton icon="i-heroicons-plus" variant="soft" size="xs" @click="apriModalSecondoGenitore">
                      Aggiungi un secondo genitore
                    </UButton>
                  </div>
                </div>

                <!-- FRATELLI E SORELLE (C5): niente da inserire a mano, il gestionale li
                     riconosce dal genitore in comune. Se non ce ne sono, la sezione non c'è. -->
                <UCard v-if="fratelli.length > 0">
                  <template #header>
                    <div class="flex items-center gap-2">
                      <UIcon name="i-heroicons-user-group" class="w-5 h-5 text-tfn-500" />
                      <span class="font-medium text-slate-800">Fratelli e sorelle</span>
                      <StatHelp text="Il gestionale li riconosce da solo dal genitore in comune: stesso account del portale, oppure stesso codice fiscale, email o telefono. Non si inseriscono a mano." />
                    </div>
                  </template>
                  <ul class="space-y-2">
                    <li v-for="f in fratelli" :key="f.id" class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <NuxtLink :to="`/studenti/${f.id}`" class="font-medium text-tfn-600 hover:underline">
                        {{ f.nome }}<template v-if="f.classe"> ({{ f.classe }})</template>
                      </NuxtLink>
                      <UBadge v-if="!f.attivo" color="neutral" variant="subtle" size="xs">Ex alunno</UBadge>
                      <span class="text-xs text-slate-500">{{ comeRiconosciuto(f) }}</span>
                    </li>
                  </ul>
                </UCard>

                <!-- Portale Famiglie — un alunno può avere PIÙ genitori collegati -->
                <UCard v-if="isAdmin">
                  <template #header>
                    <div class="flex items-center justify-between gap-2">
                      <div class="flex items-center gap-2">
                        <UIcon name="i-heroicons-globe-alt" class="w-5 h-5 text-tfn-500" />
                        <span class="font-medium text-slate-800">Credenziali Portale Famiglie</span>
                        <StatHelp text="Ogni genitore ha un proprio account (email e password) per accedere al portale famiglie. Puoi collegarne quanti ne servono: rimuovendone uno, gli altri continuano a funzionare." />
                      </div>
                      <UButton icon="i-heroicons-plus" size="xs" variant="soft" @click="apriModalCreaAccesso">Aggiungi genitore</UButton>
                    </div>
                  </template>

                  <!-- L'email inserita appartiene già a un account genitore esistente -->
                  <div v-if="confermaCollegamento" class="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3 mb-4">
                    <div class="flex items-start gap-3">
                      <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p class="text-sm font-medium text-slate-800">Genitore già registrato</p>
                        <p class="text-sm text-slate-600 mt-1">L'email <strong>{{ confermaCollegamento.email }}</strong> appartiene già all'account di <strong>{{ confermaCollegamento.firstName }} {{ confermaCollegamento.lastName }}</strong>.</p>
                        <p class="text-sm text-slate-600">Vuoi collegare anche questo studente al loro account esistente? La password non verrà modificata.</p>
                      </div>
                    </div>
                    <div class="flex gap-2 justify-end">
                      <UButton size="sm" variant="ghost" @click="confermaCollegamento = null">Annulla</UButton>
                      <UButton size="sm" color="primary" :loading="creandoAccesso" @click="creaAccessoPortale(true)">Sì, collega studente</UButton>
                    </div>
                  </div>

                  <!-- Elenco genitori collegati -->
                  <p v-if="genitoriPortale.length === 0" class="text-sm text-slate-500">
                    Nessun genitore è ancora collegato al portale. Usa <strong>Aggiungi genitore</strong> per creare un accesso e consentirgli di vedere le note e richiedere lezioni.
                  </p>
                  <div v-else class="space-y-2">
                    <div
                      v-for="g in genitoriPortale"
                      :key="g.id"
                      class="bg-slate-50 border border-slate-100 rounded-lg p-3 flex flex-wrap items-start justify-between gap-3"
                    >
                      <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="font-medium text-slate-800">{{ g.firstName }} {{ g.lastName }}</span>
                          <UBadge v-if="g.relazione" color="primary" variant="subtle" size="xs">{{ g.relazione }}</UBadge>
                          <UBadge v-if="!g.active" color="neutral" variant="subtle" size="xs">Account disattivato</UBadge>
                        </div>
                        <div class="text-sm text-slate-500 mt-0.5 break-all">{{ g.email }}</div>
                      </div>
                      <!-- flex-wrap: da telefono tre bottoni in fila non ci stanno, vanno a capo -->
                      <div class="flex flex-wrap gap-2">
                        <UButton variant="outline" size="xs" icon="i-heroicons-key" :loading="resettandoId === g.id" @click="reimpostaPassword(g.id, g.email, g.firstName)">Invia link password</UButton>
                        <UButton variant="outline" size="xs" icon="i-heroicons-pencil-square" :aria-label="`Correggi email di ${g.firstName} ${g.lastName}`" @click="apriCorreggiEmailGenitore(g)">Correggi email</UButton>
                        <UButton variant="outline" color="error" size="xs" icon="i-heroicons-trash" :loading="rimuovendoId === g.id" @click="eliminaAccessoPortale(g.id, g.email)">Rimuovi</UButton>
                      </div>
                    </div>
                  </div>

                  <div v-if="resetPassword" class="mt-4">
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">Link password per {{ resetPassword.email }}</span>
                      <UButton size="xs" variant="ghost" icon="i-heroicons-x-mark" aria-label="Chiudi" @click="() => { resetPassword = null }" />
                    </div>
                    <LinkPrimoAccesso :link="resetPassword.linkPassword" :email="resetPassword.email" :nome="resetPassword.nome" :email-inviata="resetPassword.emailInviata" :motivo-email="resetPassword.motivoEmail" :dettaglio-email="resetPassword.dettaglioEmail" />
                  </div>
                  <div v-if="credenziali" class="mt-4">
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">Account genitore creato</span>
                      <UButton size="xs" variant="ghost" icon="i-heroicons-x-mark" aria-label="Chiudi" @click="() => { credenziali = null }" />
                    </div>
                    <LinkPrimoAccesso :link="credenziali.linkPassword" :email="credenziali.email" :nome="credenziali.nome" :email-inviata="credenziali.emailInviata" :motivo-email="credenziali.motivoEmail" :dettaglio-email="credenziali.dettaglioEmail" />
                  </div>

                  <!-- Impostazione dell'ALUNNO, valida per tutti i genitori collegati -->
                  <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                    <span class="text-slate-500">Prenotazione online abilitata</span>
                    <USwitch :model-value="(portalAccess as any)?.abilitatoPrenotazioneOnline ?? false" :loading="togglando" @update:model-value="togglePrenotazione" />
                  </div>
                </UCard>

                <!-- ─── CONSENSI PRIVACY ───
                     Tre interruttori SEPARATI, non uno generale: si può dire di sì
                     alle foto e di no alle promozioni. Ogni cambiamento scrive una
                     riga nuova nello storico, non cancella quella di prima: alla
                     domanda "in che data ha revocato?" c'è sempre una risposta.
                     Il marketing ha un interruttore PER OGNI GENITORE, perché è
                     della persona e non del figlio. -->
                <UCard v-if="isAdmin">
                  <template #header>
                    <div class="flex items-center gap-2">
                      <UIcon name="i-heroicons-shield-check" class="w-5 h-5 text-tfn-500" />
                      <span class="font-medium text-slate-800">Consensi</span>
                      <StatHelp text="Le tre autorizzazioni della privacy, separate: l'autorizzazione del genitore per chi ha meno di 14 anni, le foto e video, le comunicazioni promozionali. Ogni cambiamento resta nello storico con data, ora e nome di chi l'ha fatto." />
                    </div>
                  </template>

                  <p v-if="pendingConsensi" class="text-sm text-slate-500">Caricamento dei consensi…</p>

                  <div v-else class="space-y-3">

                    <!-- 1. AUTORIZZAZIONE DEL GENITORE (minore di 14 anni) -->
                    <div class="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-2">
                      <div class="flex flex-wrap items-start justify-between gap-3">
                        <div class="min-w-0">
                          <p class="text-sm font-medium text-slate-800">Autorizzazione del genitore per il minore di 14 anni</p>
                          <p class="text-xs text-slate-500 mt-0.5">{{ dettaglioVoce(consensi?.minore14) }}</p>
                        </div>
                        <USwitch
                          :model-value="consensi?.minore14?.valore === true"
                          :loading="salvandoConsenso === 'MINORE_14'"
                          :disabled="salvandoConsenso !== null"
                          aria-label="Autorizzazione del genitore per il minore di 14 anni"
                          @update:model-value="(v: boolean) => chiediCambioConsenso('MINORE_14', v)"
                        />
                      </div>

                      <!-- La riga storica: l'autorizzazione raccolta quando è stato
                           creato l'account personale dello studente. Nata prima di
                           questo registro, resta dov'è e si mostra qui accanto. -->
                      <p v-if="consensi?.autorizzazioneAccount" class="text-xs text-slate-500">
                        Raccolta in segreteria il {{ formatDataOra(consensi.autorizzazioneAccount.quando) }}<template v-if="consensi.autorizzazioneAccount.chi"> da {{ consensi.autorizzazioneAccount.chi }}</template>, alla creazione dell'account dello studente.
                      </p>

                      <!-- Ha meno di 14 anni e nessuno ha autorizzato: è la sola
                           situazione in cui questo consenso è obbligatorio. -->
                      <UAlert
                        v-if="serveAutorizzazione"
                        color="warning"
                        variant="subtle"
                        icon="i-heroicons-exclamation-triangle"
                        title="Manca l'autorizzazione del genitore"
                        description="Questo alunno ha meno di 14 anni: senza l'autorizzazione di un genitore non può avere un account del portale."
                      />

                      <!-- Senza data di nascita non si chiede niente e non si blocca
                           niente: si dice solo che non lo sappiamo (decisione Q17). -->
                      <p v-else-if="consensi && consensi.minoreDi14 === null" class="text-xs text-slate-500 flex flex-wrap items-center gap-1">
                        <UIcon name="i-heroicons-information-circle" class="w-4 h-4 text-slate-400 shrink-0" />
                        Manca la data di nascita: non posso sapere se serve.
                        <UButton variant="link" size="xs" class="px-0" @click="apriModalModifica">Modifica dati</UButton>
                      </p>
                    </div>

                    <!-- 2. IMMAGINI (foto e video) — facoltativo sul serio -->
                    <div class="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div class="flex flex-wrap items-start justify-between gap-3">
                        <div class="min-w-0">
                          <p class="text-sm font-medium text-slate-800">Immagini (foto e video)</p>
                          <p class="text-xs text-slate-500 mt-0.5">{{ dettaglioVoce(consensi?.immagini) }}</p>
                          <p class="text-xs text-slate-400 mt-0.5">Facoltativo: si può dire di no e il doposcuola funziona identico.</p>
                        </div>
                        <USwitch
                          :model-value="consensi?.immagini?.valore === true"
                          :loading="salvandoConsenso === 'IMMAGINI'"
                          :disabled="salvandoConsenso !== null"
                          aria-label="Consenso alle immagini (foto e video)"
                          @update:model-value="(v: boolean) => chiediCambioConsenso('IMMAGINI', v)"
                        />
                      </div>
                    </div>

                    <!-- 3. MARKETING — uno per ogni genitore con account -->
                    <div class="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-3">
                      <div>
                        <p class="text-sm font-medium text-slate-800">Comunicazioni promozionali (marketing)</p>
                        <p class="text-xs text-slate-400 mt-0.5">È della persona, non del figlio: vale per tutti i figli di quel genitore.</p>
                      </div>

                      <p v-if="(consensi?.marketing?.length ?? 0) === 0" class="text-xs text-slate-500">
                        Nessun genitore ha un account del portale. Il consenso alle promozioni appartiene alla persona:
                        per registrarlo serve prima un accesso, si crea qui sopra con <strong>Aggiungi genitore</strong>.
                      </p>

                      <div v-for="g in (consensi?.marketing ?? [])" :key="g.userId" class="flex flex-wrap items-start justify-between gap-3 border-t border-slate-200 pt-2 first:border-0 first:pt-0">
                        <div class="min-w-0">
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-sm font-medium text-slate-800">{{ g.nome }}</span>
                            <UBadge v-if="g.relazione" color="primary" variant="subtle" size="xs">{{ g.relazione }}</UBadge>
                          </div>
                          <p class="text-xs text-slate-500 mt-0.5">{{ dettaglioVoce(g) }}</p>
                        </div>
                        <USwitch
                          :model-value="g.valore === true"
                          :loading="salvandoConsenso === `MARKETING:${g.userId}`"
                          :disabled="salvandoConsenso !== null"
                          :aria-label="`Consenso alle comunicazioni promozionali di ${g.nome}`"
                          @update:model-value="(v: boolean) => chiediCambioConsenso('MARKETING', v, g)"
                        />
                      </div>
                    </div>

                    <!-- STORICO: si apre solo se serve, ma c'è sempre -->
                    <UCollapsible v-model:open="storicoConsensiAperto">
                      <button type="button" class="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors">
                        <UIcon name="i-heroicons-chevron-right" class="w-3.5 h-3.5 transition-transform" :class="storicoConsensiAperto ? 'rotate-90' : ''" />
                        Storico dei consensi ({{ storicoConsensi.length }})
                      </button>
                      <template #content>
                        <p v-if="storicoConsensi.length === 0" class="text-sm text-slate-500 mt-2">
                          Nessun cambiamento registrato: qui compariranno tutti, uno per riga, senza mai cancellare i precedenti.
                        </p>
                        <ul v-else class="mt-2 space-y-2">
                          <li v-for="r in storicoConsensi" :key="r.id" class="text-xs text-slate-600 border-l-2 pl-3" :class="r.valore ? 'border-emerald-200' : 'border-rose-200'">
                            <div class="font-medium text-slate-800">
                              {{ ETICHETTE_CONSENSO[r.tipo] ?? r.tipo }} — {{ r.valore ? 'dato' : 'revocato' }}
                              <template v-if="r.tipo === 'MARKETING' && r.persona"> ({{ r.persona }})</template>
                            </div>
                            <div>
                              {{ formatDataOra(r.quando) }} · {{ r.origine === 'PORTALE' ? 'dal portale famiglie' : 'in segreteria' }}<template v-if="r.chi"> · {{ r.chi }}</template><template v-if="r.versione"> · testo {{ r.versione }}</template>
                            </div>
                            <div v-if="r.note" class="text-slate-500 italic">{{ r.note }}</div>
                          </li>
                        </ul>
                      </template>
                    </UCollapsible>

                  </div>
                </UCard>

                <!-- Account Studente (solo prenotazioni) -->
                <UCard v-if="isAdmin">
                  <template #header>
                    <div class="flex items-center gap-2">
                      <UIcon name="i-heroicons-user-circle" class="w-5 h-5 text-tfn-500" />
                      <span class="font-medium text-slate-800">Account Studente (solo prenotazioni)</span>
                      <StatHelp text="Account personale dello studente: può solo prenotare le lezioni, non vede note né pagamenti. Le sue prenotazioni restano visibili anche alla famiglia. Attivo di default; puoi disattivarlo in ogni momento." />
                    </div>
                  </template>

                  <template v-if="!(studentAccount as any)?.studentUser">
                    <div class="space-y-3">
                      <p class="text-sm text-slate-500">
                        Crea un accesso personale per lo studente: potrà solo prenotare le lezioni. Serve un'email personale dello studente (diversa da quella del genitore).
                      </p>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <UFormField label="Email studente">
                          <UInput v-model="datiAccountStudente.email" type="email" class="w-full" placeholder="studente@email.it" />
                        </UFormField>
                        <div class="grid grid-cols-2 gap-3">
                          <UFormField label="Nome">
                            <UInput v-model="datiAccountStudente.firstName" class="w-full" />
                          </UFormField>
                          <UFormField label="Cognome">
                            <UInput v-model="datiAccountStudente.lastName" class="w-full" />
                          </UFormField>
                        </div>
                      </div>
                      <!-- L'AUTORIZZAZIONE DEL GENITORE NON SERVE SEMPRE (Q16).
                           L'etichetta cambia con l'età e il bottone si blocca solo
                           quando l'autorizzazione è davvero dovuta: sotto i 14 anni.
                           Da 14 in su decide il ragazzo; se la data di nascita
                           manca non si chiede niente (Q17). -->
                      <UCheckbox v-model="datiAccountStudente.consensoGenitore" :label="etichettaConsensoAccount" />
                      <p v-if="minoreDi14Studente === null" class="text-xs text-slate-500 flex flex-wrap items-center gap-1">
                        <UIcon name="i-heroicons-information-circle" class="w-4 h-4 text-slate-400 shrink-0" />
                        Senza la data di nascita non posso sapere se l'autorizzazione serve.
                        <UButton variant="link" size="xs" class="px-0" @click="apriModalModifica">Completa i dati</UButton>
                      </p>
                      <UButton icon="i-heroicons-plus" :loading="creandoAccountStudente" :disabled="!datiAccountStudente.email || (minoreDi14Studente === true && !datiAccountStudente.consensoGenitore)" @click="creaAccountStudente">
                        Crea account studente
                      </UButton>
                    </div>
                  </template>
                  <template v-else>
                    <div class="bg-slate-50 border border-slate-100 rounded-lg p-4">
                      <dl class="space-y-3 text-sm">
                        <div class="flex flex-wrap justify-between items-center gap-2 border-b border-slate-200 pb-2">
                          <span class="text-slate-500">Email di accesso</span>
                          <div class="flex flex-wrap items-center justify-end gap-2 min-w-0">
                            <span class="font-medium text-slate-800 break-all">{{ (studentAccount as any).studentUser?.email }}</span>
                            <UButton variant="outline" size="xs" icon="i-heroicons-pencil-square" @click="apriCorreggiEmailStudente">Correggi email</UButton>
                          </div>
                        </div>
                        <!-- L'informativa privacy promette "data E ORA" del consenso,
                             e una data senza il nome di chi l'ha raccolta non è
                             dimostrabile a nessuno: qui si mostrano tutti e tre. -->
                        <div class="flex justify-between items-start gap-3 border-b border-slate-200 pb-2">
                          <span class="text-slate-500 shrink-0">Consenso genitore registrato</span>
                          <span class="font-medium text-slate-800 text-right">{{ consensoGenitoreTesto }}</span>
                        </div>
                        <div class="flex items-center justify-between pt-1">
                          <span class="text-slate-500">Account attivo (può prenotare)</span>
                          <USwitch :model-value="(studentAccount as any).studentUser?.active" :loading="togglandoStudente" @update:model-value="toggleAccountStudente" />
                        </div>
                      </dl>
                    </div>

                    <div v-if="credenzialiStudente" class="mt-4">
                      <div class="flex items-center justify-between mb-1">
                        <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">Link password per lo studente</span>
                        <UButton size="xs" variant="ghost" icon="i-heroicons-x-mark" aria-label="Chiudi" @click="() => { credenzialiStudente = null }" />
                      </div>
                      <LinkPrimoAccesso :link="credenzialiStudente.linkPassword" :email="credenzialiStudente.email" :nome="credenzialiStudente.nome" :email-inviata="credenzialiStudente.emailInviata" :motivo-email="credenzialiStudente.motivoEmail" :dettaglio-email="credenzialiStudente.dettaglioEmail" />
                    </div>

                    <div class="mt-4 flex gap-2">
                      <UButton variant="outline" size="sm" icon="i-heroicons-key" @click="resetPasswordStudente">Invia link password</UButton>
                    </div>
                  </template>
                </UCard>
              </div>
            </template>

            <!-- ─── TAB NOTE (diario note interne/famiglia) ─── -->
            <template #note>
              <div class="mt-4">
                <StudentNoteFeed :student-id="id" />
              </div>
            </template>

          </UTabs>
        </div>
      </div>

    </template>

    <!-- ─── MODAL PAGAMENTO, RICARICA E LIBRETTO ─── -->
    <ModalPagamentoPacchetto
      v-model:open="modalPagamentoAperto"
      :pacchetto="pacchettoSelezionato"
      @refresh="ricaricaDopoPacchetto"
    />

    <ModalModificaPacchetto
      v-model:open="modalModificaPacchettoAperto"
      :pacchetto="pacchettoSelezionato"
      @refresh="ricaricaDopoPacchetto"
    />

    <ModalRicaricaPacchetto
      v-model:open="modalRicaricaAperto"
      :pacchetto="pacchettoSelezionato"
      @refresh="ricaricaDopoPacchetto"
    />

    <ModalLibrettoRicariche
      v-model:open="modalLibrettoAperto"
      :pacchetto="pacchettoSelezionato"
    />

    <!-- ─── MODAL CREA PACCHETTO ─── -->
    <ModalCreaPacchetto
      v-model:open="modalCreaAperto"
      :student-id="id"
      :student-name="studente?.lastName + ' ' + studente?.firstName"
      :rinnovo-da="pacchettoDaRinnovare"
      @refresh="ricaricaDopoPacchetto"
    />

    <!-- ─── MODAL AGGIUNGI GENITORE AL PORTALE ─── -->
    <UModal v-model:open="mostraModalCreaAccesso" title="Aggiungi genitore al portale">
      <template #body>
        <div class="space-y-4 p-4">
          <p class="text-sm text-slate-500">
            Inserisci i dati del genitore. Verrà generata una password temporanea da comunicare manualmente.
            Se l'email è già registrata come genitore (per esempio di un fratello), verrà chiesta una conferma prima di collegare l'account.
          </p>
          <UFormField label="Email genitore">
            <UInput v-model="datiCreaAccesso.email" type="email" class="w-full" placeholder="genitore@email.it" />
          </UFormField>
          <UFormField label="Nome">
            <UInput v-model="datiCreaAccesso.firstName" class="w-full" placeholder="Mario" />
          </UFormField>
          <UFormField label="Cognome">
            <UInput v-model="datiCreaAccesso.lastName" class="w-full" placeholder="Rossi" />
          </UFormField>
          <UFormField label="Ruolo (facoltativo)" help="Serve solo alla segreteria per capire chi è chi.">
            <div class="flex gap-2">
              <USelect
                v-model="datiCreaAccesso.relazione"
                :items="RELAZIONI_ITEMS"
                placeholder="Nessuna etichetta"
                class="w-full"
              />
              <UInput
                v-if="datiCreaAccesso.relazione === 'ALTRO'"
                v-model="datiCreaAccesso.relazioneAltro"
                class="flex-1"
                placeholder="Es. Zia, Affidatario…"
                :maxlength="50"
              />
            </div>
            <button
              v-if="datiCreaAccesso.relazione"
              type="button"
              class="text-xs text-tfn-500 hover:underline mt-1 block"
              @click="datiCreaAccesso.relazione = ''; datiCreaAccesso.relazioneAltro = ''"
            >
              Togli etichetta
            </button>
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 px-4 pb-4">
          <UButton variant="ghost" @click="mostraModalCreaAccesso = false">Annulla</UButton>
          <UButton
            color="primary"
            :loading="creandoAccesso"
            :disabled="!datiCreaAccesso.email || !datiCreaAccesso.firstName || !datiCreaAccesso.lastName"
            @click="creaAccessoPortale()"
          >
            Aggiungi genitore
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- ─── MODAL MODIFICA STUDENTE ─── -->
    <UModal v-model:open="modalModificaAperto" title="Modifica Studente" :ui="{ width: 'max-w-2xl' }">
      <template #body>
        <UForm ref="formModifica" :schema="UpdateStudentSchema" :state="datiModifica" @submit="salvaModifica" class="space-y-4">

          <div class="grid grid-cols-2 gap-4">
            <UFormField name="firstName" label="Nome" required>
              <UInput v-model="datiModifica.firstName" class="w-full" />
            </UFormField>
            <UFormField name="lastName" label="Cognome" required>
              <UInput v-model="datiModifica.lastName" class="w-full" />
            </UFormField>
          </div>

          <!-- Facoltativa: serve al campanellino dei compleanni, non blocca nulla -->
          <UFormField name="dataNascita" label="Data di nascita" hint="Facoltativa">
            <UInput v-model="datiModifica.dataNascita" type="date" class="w-full" />
          </UFormField>

          <div class="grid grid-cols-2 gap-4">
            <UFormField name="classe" label="Classe">
              <USelectMenu
                v-model="datiModifica.classe"
                :items="CLASSI_LISTA"
                searchable
                placeholder="Seleziona classe..."
                class="w-full"
              />
            </UFormField>
            <UFormField name="scuola" label="Scuola">
              <template v-if="!altreScuolaModifica">
                <USelectMenu
                  v-model="datiModifica.scuola"
                  :items="SCUOLE_TRAPANI"
                  searchable
                  placeholder="Cerca scuola..."
                  class="w-full"
                />
                <button
                  type="button"
                  class="text-xs text-tfn-500 hover:underline mt-1 block"
                  @click="altreScuolaModifica = true"
                >
                  Non trovi la scuola? Inserisci manualmente
                </button>
              </template>
              <template v-else>
                <div class="flex gap-2">
                  <UInput v-model="datiModifica.scuola" placeholder="Nome scuola" class="flex-1" />
                  <UButton variant="ghost" size="xs" @click="altreScuolaModifica = false">← Lista</UButton>
                </div>
              </template>
            </UFormField>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <UFormField name="studentPhone" label="Tel. Studente">
              <UInput
                v-model="datiModifica.studentPhone"
                class="w-full"
                @blur="datiModifica.studentPhone = normalizzaTelefono(datiModifica.studentPhone)"
              />
            </UFormField>
            <UFormField name="studentEmail" label="Email Studente">
              <UInput v-model="datiModifica.studentEmail" type="email" class="w-full" />
            </UFormField>
          </div>

          <USeparator label="Dati Genitore" />

          <div class="grid grid-cols-2 gap-4">
            <UFormField name="parentName" label="Nome Genitore">
              <UInput v-model="datiModifica.parentName" class="w-full" />
            </UFormField>
            <UFormField name="parentPhone" label="Tel. Genitore">
              <UInput
                v-model="datiModifica.parentPhone"
                class="w-full"
                @blur="datiModifica.parentPhone = normalizzaTelefono(datiModifica.parentPhone)"
              />
            </UFormField>
          </div>

          <UFormField name="parentEmail" label="Email genitore">
            <UInput v-model="datiModifica.parentEmail" type="email" class="w-full" />
          </UFormField>

          <div class="grid grid-cols-3 gap-4">
            <UFormField name="parentIndirizzo" label="Indirizzo" class="col-span-2">
              <UInput v-model="datiModifica.parentIndirizzo" class="w-full" />
            </UFormField>
            <UFormField name="parentCap" label="CAP">
              <UInput v-model="datiModifica.parentCap" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <UFormField name="parentCitta" label="Città">
              <UInput v-model="datiModifica.parentCitta" class="w-full" />
            </UFormField>
            <UFormField name="parentCF" label="Codice Fiscale">
              <UInput v-model="datiModifica.parentCF" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <UFormField name="parentPIva" label="Partita IVA">
              <UInput v-model="datiModifica.parentPIva" class="w-full" />
            </UFormField>
            <UFormField label="Che parentela ha con l'alunno?">
              <USelect v-model="datiModifica.parentRelazione" :items="RELAZIONI_ANAGRAFICA" placeholder="Scegli..." class="w-full" />
              <UInput v-if="datiModifica.parentRelazione === 'Altro'" v-model="datiModifica.parentRelazioneAltro"
                placeholder="Es. Nonna, Zio…" class="w-full mt-2" :maxlength="50" />
            </UFormField>
          </div>

          <!-- ─── SECONDO GENITORE / TUTORE ───
               Sotto una spunta e non sempre aperto: chi ha un solo genitore non
               deve scorrere dieci caselle vuote per arrivare alle note. -->
          <USeparator label="Secondo genitore o tutore" />

          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-medium text-slate-800">C'è un secondo genitore o tutore</p>
              <p class="text-xs text-slate-500">Es. genitori separati, o entrambi da tenere aggiornati.</p>
            </div>
            <UCheckbox v-model="mostraSecondoGenitore" aria-label="C'è un secondo genitore o tutore" />
          </div>

          <!-- Togliere la spunta cancella i suoi dati: va detto PRIMA di salvare -->
          <UAlert
            v-if="!mostraSecondoGenitore && haSecondoGenitore"
            color="warning"
            variant="subtle"
            icon="i-heroicons-exclamation-triangle"
            title="Il secondo genitore verrà rimosso"
            description="Salvando, nome, recapiti e dati fiscali del secondo genitore vengono cancellati dalla scheda. L'eventuale suo accesso al portale resta attivo e va tolto dalla sezione Credenziali Portale Famiglie."
          />

          <div v-if="mostraSecondoGenitore" class="space-y-4 border border-slate-100 rounded-lg p-4 bg-slate-50/50">
            <div class="grid grid-cols-2 gap-4">
              <UFormField name="parent2Name" label="Nome Genitore">
                <UInput v-model="datiModifica.parent2Name" class="w-full" />
              </UFormField>
              <UFormField name="parent2Phone" label="Tel. Genitore">
                <UInput
                  v-model="datiModifica.parent2Phone"
                  class="w-full"
                  @blur="datiModifica.parent2Phone = normalizzaTelefono(datiModifica.parent2Phone)"
                />
              </UFormField>
            </div>

            <UFormField name="parent2Email" label="Email genitore">
              <UInput v-model="datiModifica.parent2Email" type="email" class="w-full" />
            </UFormField>

            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Che parentela ha con l'alunno?">
                <USelect v-model="datiModifica.parent2Relazione" :items="RELAZIONI_ANAGRAFICA" placeholder="Scegli..." class="w-full" />
                <UInput v-if="datiModifica.parent2Relazione === 'Altro'" v-model="datiModifica.parent2RelazioneAltro"
                  placeholder="Es. Nonna, Zio…" class="w-full mt-2" :maxlength="50" />
              </UFormField>
              <UFormField name="parent2DataNascita" label="Data di nascita" hint="Facoltativa">
                <UInput v-model="datiModifica.parent2DataNascita" type="date" class="w-full" />
              </UFormField>
            </div>

            <div class="grid grid-cols-3 gap-4">
              <UFormField name="parent2Indirizzo" label="Indirizzo" class="col-span-2">
                <UInput v-model="datiModifica.parent2Indirizzo" class="w-full" />
              </UFormField>
              <UFormField name="parent2Cap" label="CAP">
                <UInput v-model="datiModifica.parent2Cap" class="w-full" />
              </UFormField>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <UFormField name="parent2Citta" label="Città">
                <UInput v-model="datiModifica.parent2Citta" class="w-full" />
              </UFormField>
              <UFormField name="parent2CF" label="Codice Fiscale">
                <UInput v-model="datiModifica.parent2CF" class="w-full" />
              </UFormField>
            </div>

            <UFormField name="parent2PIva" label="Partita IVA">
              <UInput v-model="datiModifica.parent2PIva" class="w-full" />
            </UFormField>
          </div>

          <USeparator />

          <UFormField name="bisogniSpeciali" label="Bisogni speciali">
            <UTextarea v-model="datiModifica.bisogniSpeciali" :rows="2" class="w-full" />
          </UFormField>

          <UFormField name="note" label="Note interne">
            <UTextarea v-model="datiModifica.note" :rows="2" class="w-full" />
          </UFormField>

        </UForm>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" @click="modalModificaAperto = false">Annulla</UButton>
          <UButton :loading="salvando" @click="formModifica?.submit()">Salva Modifiche</UButton>
        </div>
      </template>
    </UModal>

    <!-- ─── MODAL CORREGGI L'EMAIL DI ACCESSO (alunno o genitore) ─── -->
    <ModalCorreggiEmail
      v-model:open="correggiEmailAperto"
      :account="accountDaCorreggere"
      :salvando="correggendoEmail"
      @salva="salvaCorrezioneEmail"
    />

    <!-- ─── COLLEGA UN GENITORE GIÀ REGISTRATO (C5) ─── -->
    <ModalCollegaGenitore
      v-model:open="collegaGenitoreAperto"
      :student-id="id"
      :nome-alunno="nomeAlunno"
      :scheda="(studente as any) ?? null"
      :account-collegati="genitoriPortale.map((g) => g.id)"
      @collegato="dopoCollegaGenitore"
    />

    <!-- ─── PRIMA DI SALVARE: cosa cambia in più salvando la Modifica ─── -->
    <ModalPrimaDiSalvare
      v-model:open="primaDiSalvareAperto"
      :voci="vociConseguenze"
      :salvando="salvando || eseguendoConseguenze"
      @conferma="confermaPrimaDiSalvare"
    />

    <!-- ─── I LINK PARTITI DOPO LA MODIFICA ───
         La Modifica si apre da qualsiasi linguetta: i link non possono stare solo
         dentro "Famiglia", dove magari nessuno li vedrebbe. Qui compaiono tutti
         insieme, con il solito "copia il link" per mandarli su WhatsApp. -->
    <UModal v-model:open="linkDopoModificaAperto" title="Link per scegliere la password">
      <template #body>
        <div class="space-y-4">
          <div v-for="esito in linkDopoModifica" :key="esito.chiave" class="space-y-1">
            <p class="text-xs font-medium text-slate-500 uppercase tracking-wide">{{ esito.titolo }}</p>
            <LinkPrimoAccesso :link="esito.linkPassword" :email="esito.email" :nome="esito.nome" :email-inviata="esito.emailInviata" :motivo-email="esito.motivoEmail" :dettaglio-email="esito.dettaglioEmail" />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end w-full">
          <UButton @click="() => { linkDopoModificaAperto = false }">Chiudi</UButton>
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
import type { EsitoInvitoEmail } from '#shared/email'
import ConfirmDialog from '~/components/ConfirmDialog.vue'
import { UpdateStudentSchema } from '#shared/schemas/student.schema'
import { normalizzaTelefono } from '~/utils/phone'
import { riassumiStati } from '~/utils/statiPacchetto'
import { ETICHETTE_CAMPO, haDatiGenitore, leggiSerie, nomeConfrontabile, parolaParentela, scriviSerie } from '#shared/genitori'
import type { CampoGenitore, Fratello, Slot } from '#shared/genitori'
import { eMinoreDi14 } from '#shared/eta'

definePageMeta({ middleware: ['admin-or-super'] })

const route = useRoute()
const toast = useToast()
const id = route.params.id as string

const tabItems = computed(() => [
  { label: 'Panoramica', slot: 'panoramica' },
  { label: 'Pacchetti', slot: 'pacchetti' },
  { label: 'Lezioni', slot: 'lezioni' },
  { label: 'Prenotazioni', slot: 'prenotazioni' },
  // Diario note (interne + famiglia, con approvazione)
  { label: 'Note', slot: 'note' },
  // Dati e credenziali della famiglia: riservati alla segreteria
  // (il server non manda comunque i recapiti dei genitori ai TUTOR)
  ...(isAdmin.value ? [{ label: 'Famiglia', slot: 'famiglia' }] : []),
])

// Su telefono la striscia delle linguette scorre di lato: cambiando scheda la
// linguetta scelta può restare fuori dalla parte visibile. Qui la riportiamo
// sotto gli occhi. "nearest" fa scorrere il minimo indispensabile, così la
// pagina non salta su e giù mentre si cambia scheda.
const contenitoreTabs = ref<HTMLElement | null>(null)
async function portaInVistaLinguetta() {
  await nextTick()
  contenitoreTabs.value
    ?.querySelector<HTMLElement>('[data-slot="trigger"][data-state="active"]')
    ?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
}

const filtroLezioni = reactive({ dataInizio: '', dataFine: '' })
const { data: dataLezioni, pending: pendingLezioni } = useLazyFetch('/api/lessons', { query: { studentId: id, limit: 1000 } })
// L'API restituisce tutor e ore scalate in forma annidata (l.tutor, l.lessonStudents):
// qui li appiattiamo nei campi che la pagina usa (tutorFirstName, oreScalate, ...)
const lezioni = computed(() => ((dataLezioni.value?.data ?? []) as any[]).map((l: any) => ({
  lessonId:       l.id,
  data:           l.data,
  tipo:           l.tipo,
  tutorFirstName: l.tutor?.firstName ?? '',
  tutorLastName:  l.tutor?.lastName ?? '',
  oreScalate:     l.lessonStudents?.find((ls: any) => ls.studentId === id)?.oreScalate ?? '0',
})))
const lezioniFiltrate = computed(() => {
  let list = lezioni.value as any[]
  if (filtroLezioni.dataInizio) list = list.filter(l => new Date(l.data) >= new Date(filtroLezioni.dataInizio))
  if (filtroLezioni.dataFine) list = list.filter(l => new Date(l.data) <= new Date(filtroLezioni.dataFine))
  return list
})

const ultimaLezione = computed(() => {
  if (lezioni.value.length === 0) return null
  return lezioni.value[0]
})

// Casella "Ultime note" in panoramica: la nota più recente per ciascuna visibilità
// (l'API le restituisce già ordinate dalla più recente)
const { data: noteDiario } = useLazyFetch<any[]>(`/api/students/${id}/notes`)
const ultimeNote = computed(() => {
  const list = (noteDiario.value ?? []) as any[]
  return [
    list.find(n => n.visibilita === 'INTERNA'),
    list.find(n => n.visibilita === 'FAMIGLIA'),
  ].filter(Boolean)
})

const lezioniSvolteMeseCorrente = computed(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  return (lezioni.value as any[]).filter(l => {
    const d = new Date(l.data)
    return d.getFullYear() === year && d.getMonth() === month
  }).length
})

function esportaCsvLezioni() {
  const righe = [
    ['Data', 'Tutor', 'Tipo', 'Ore scalate'],
    ...lezioniFiltrate.value.map((l: any) => [formatData(l.data), `${l.tutorLastName} ${l.tutorFirstName}`, l.tipo || '', parseFloat(l.oreScalate)]),
  ]
  const csv = righe.map(r => r.join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `lezioni-${studente.value?.lastName ?? id}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

import { SCUOLE_TRAPANI, CLASSI_LISTA } from '~/utils/schools'
import { formatData } from '~/utils/format'
import { livelloDaClasse, etichettaLivello } from '#shared/livello-scolastico'

// ─── Fetch studente ───
const { data: studente, pending, refresh } = useLazyFetch(`/api/students/${id}`)

// Il tipo che useLazyFetch assegna a `studente` è un'unione (scheda alunno | altre
// risposte dell'API): TypeScript non sa quale ramo sia e rifiuta l'accesso a
// QUALSIASI campo — succede già a classe, scuola, bisogniSpeciali e agli altri.
// Qui la lettura passa da un solo punto tipizzato a mano.
const dataNascitaStudente = computed<string | null>(() => (studente.value as any)?.dataNascita ?? null)

// IL LIVELLO SCOLASTICO NON È SALVATO DA NESSUNA PARTE: si deduce dalla classe.
// Se la classe è vuota o scritta in un modo che non riconosciamo, qui esce "—"
// e non un livello inventato: chi legge deve poter capire che il dato manca.
const etichettaLivelloStudente = computed(() => {
  const l = livelloDaClasse((studente.value as any)?.classe)
  return l ? etichettaLivello(l) : '—'
})

// ─── Fetch pacchetti dello studente ───
const { data: datiPacchetti, pending: pendingPacchetti, refresh: refreshPacchetti } = useLazyFetch('/api/packages', {
  query: { studentId: id, limit: 50 },
})
const pacchetti = computed(() => datiPacchetti.value?.data ?? [])

// Dopo pagamenti/ricariche/modifiche di un pacchetto va ricaricata anche la scheda
// dello studente (totali e riepilogo economico), non solo l'elenco dei pacchetti.
function ricaricaDopoPacchetto() {
  refreshPacchetti()
  refresh()
}

const pacchettoPerRinnovo = computed(() => {
  return (pacchetti.value as any[]).find(pkg => {
    const stati = (pkg.stati as string[]) ?? []
    return !stati.includes('CHIUSO')
  }) ?? null
})



// ─── Disattiva studente ───
const disattivando = ref(false)

// ─── ConfirmDialog: stato e logica in app/composables/useConfirm.ts ───
const { confirmOpen, confirmTitle, confirmDescription, confirmLabel, confirmColor, chiediConferma, eseguiConferma } = useConfirm()

async function disattivaStudente() {
  chiediConferma(
    { title: 'Disattivare questo studente?', description: 'Lo studente verrà contrassegnato come inattivo.', confirmLabel: 'Disattiva', confirmColor: 'error' },
    async () => {
      disattivando.value = true
      try {
        await $fetch(`/api/students/${id}`, { method: 'DELETE' })
        toast.add({ title: 'Studente disattivato', color: 'success', icon: 'i-heroicons-check-circle' })
        refresh()
      } catch (err: any) {
        toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile disattivare', color: 'error' })
      } finally {
        disattivando.value = false
      }
    }
  )
}

// ─── Anonimizzazione GDPR (art. 17) — solo ADMIN ───
const isSoloAdmin = computed(() => sessionUser.value?.role === 'ADMIN')
const anonimizzaAperto = ref(false)
const anonimizzaConferma = ref(false)
const anonimizzando = ref(false)

async function anonimizzaStudente() {
  anonimizzando.value = true
  try {
    await $fetch(`/api/students/${id}/anonymize`, { method: 'POST' })
    toast.add({ title: 'Studente anonimizzato', description: 'Dati personali rimossi; contabilità conservata.', color: 'success', icon: 'i-heroicons-check-circle' })
    anonimizzaAperto.value = false
    anonimizzaConferma.value = false
    refresh()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile anonimizzare', color: 'error' })
  } finally {
    anonimizzando.value = false
  }
}

// ─── Azioni della barra in alto quando lo schermo è stretto ───
// Su telefono i bottoni "Stampa lezioni", "Esporta dati", "Disattiva" e
// "Anonimizza" sono nascosti dalla barra e vivono in questo menù.
// Le condizioni sono le STESSE dei bottoni (isAdmin / active / isSoloAdmin):
// chi non vede un'azione in barra non deve trovarla nemmeno nel menù.
// Le due azioni pericolose stanno in un gruppo a parte, in fondo e in rosso,
// così non si toccano per sbaglio scorrendo con il pollice.
const azioniTelefono = computed(() => {
  const ordinarie: Record<string, unknown>[] = [
    { label: 'Stampa lezioni', icon: 'i-heroicons-printer', to: `/stampe/studente-${id}` },
  ]
  if (isAdmin.value) {
    ordinarie.push({ label: 'Esporta dati', icon: 'i-heroicons-arrow-down-tray', to: `/api/students/${id}/export`, external: true, target: '_blank' })
  }

  const pericolose: Record<string, unknown>[] = []
  // `as any` come nel resto della pagina: il tipo che useLazyFetch assegna a
  // `studente` è un'unione e TypeScript non sa quale ramo sia (vedi riga 897).
  if ((studente.value as any)?.active) {
    pericolose.push({ label: 'Disattiva', icon: 'i-heroicons-user-minus', color: 'error', onSelect: () => disattivaStudente() })
  }
  if (isSoloAdmin.value) {
    pericolose.push({ label: 'Anonimizza', icon: 'i-heroicons-shield-exclamation', color: 'error', onSelect: () => { anonimizzaAperto.value = true } })
  }

  // I gruppi vuoti vanno tolti, altrimenti Nuxt UI disegna una riga di separazione
  // che non separa niente.
  return [ordinarie, pericolose].filter(gruppo => gruppo.length > 0)
})

// ─── Modal modifica ───
const modalModificaAperto  = ref(false)
const formModifica         = ref()
const salvando             = ref(false)
const altreScuolaModifica  = ref(false)

// Parentele proposte nell'anagrafica. Una lista invece del testo libero per non
// ritrovarsi "madre", "Madre" e "MAMMA" come tre cose diverse; "Altro" lascia
// comunque scrivere quello che serve (nonna, zio, affidatario…).
const RELAZIONI_ANAGRAFICA = ['Madre', 'Padre', 'Tutore legale', 'Nonno/a', 'Altro']

// Dal valore salvato (testo libero) alla coppia menu + casella "Altro"
function scomponiRelazione(valore?: string | null) {
  const v = (valore ?? '').trim()
  if (!v) return { scelta: '', altro: '' }
  return RELAZIONI_ANAGRAFICA.includes(v) && v !== 'Altro'
    ? { scelta: v, altro: '' }
    : { scelta: 'Altro', altro: v }
}

// …e ritorno: quello che finisce davvero a database (null = nessuna parentela)
function componiRelazione(scelta: string, altro: string): string | null {
  if (!scelta) return null
  if (scelta === 'Altro') return altro.trim().slice(0, 50) || null
  return scelta
}

// I campi dei genitori, già pronti per essere mostrati.
// /api/students/:id risponde con due forme diverse (completa per la segreteria,
// ridotta per i tutor, senza i recapiti dei genitori): per TypeScript è un'unione
// e leggerli uno per uno dal template costerebbe un errore di tipo per riga.
// Si leggono una volta sola qui, e il riquadro in scheda usa questi valori.
const genitori = computed(() => {
  const s = studente.value as any
  const cittaCap = (citta?: string | null, cap?: string | null) =>
    citta ? `${citta} ${cap ?? ''}`.trim() : null
  return {
    relazione1: (s?.parentRelazione as string | null) ?? null,
    nome2:        (s?.parent2Name as string | null) ?? null,
    relazione2:   (s?.parent2Relazione as string | null) ?? null,
    email2:       (s?.parent2Email as string | null) ?? null,
    telefono2:    (s?.parent2Phone as string | null) ?? null,
    dataNascita2: s?.parent2DataNascita ? formatData(s.parent2DataNascita) : null,
    indirizzo2:   (s?.parent2Indirizzo as string | null) ?? null,
    cittaCap2:    cittaCap(s?.parent2Citta, s?.parent2Cap),
    cf2:          (s?.parent2CF as string | null) ?? null,
    piva2:        (s?.parent2PIva as string | null) ?? null,
  }
})

// Il primo genitore c'è se ha almeno un dato suo. Serve alla riga "Nessun
// genitore registrato" per l'alunno creato senza genitore (C5).
const haPrimoGenitore = computed(() => haDatiGenitore(leggiSerie(studente.value as any, 1)))

// Il secondo genitore c'è se ha almeno un dato suo: così il riquadro in scheda
// compare solo quando serve davvero.
const haSecondoGenitore = computed(() => {
  const g = genitori.value
  return Boolean(
    g.nome2 || g.email2 || g.telefono2 || g.cf2 || g.piva2
    || g.indirizzo2 || g.cittaCap2 || g.dataNascita2 || g.relazione2,
  )
})

// Spunta "C'è un secondo genitore" dentro la finestra di modifica
const mostraSecondoGenitore = ref(false)

const datiModifica = reactive({
  firstName:       '',
  lastName:        '',
  dataNascita:     '',
  classe:          '',
  scuola:          '',
  studentPhone:    '',
  studentEmail:    '',
  parentName:      '',
  parentPhone:     '',
  parentEmail:     '',
  parentIndirizzo: '',
  parentCitta:     '',
  parentCap:       '',
  parentCF:        '',
  parentPIva:      '',
  // Menu + casella libera: a database va una stringa sola (parentRelazione)
  parentRelazione:      '',
  parentRelazioneAltro: '',
  // Secondo genitore/tutore: stessi campi del primo
  parent2Name:           '',
  parent2Phone:          '',
  parent2Email:          '',
  parent2Indirizzo:      '',
  parent2Citta:          '',
  parent2Cap:            '',
  parent2CF:             '',
  parent2PIva:           '',
  parent2DataNascita:    '',
  parent2Relazione:      '',
  parent2RelazioneAltro: '',
  bisogniSpeciali: '',
  note:            '',
})

function apriModalModifica() {
  if (!studente.value) return
  const s = studente.value as any
  const rel1 = scomponiRelazione(s.parentRelazione)
  const rel2 = scomponiRelazione(s.parent2Relazione)
  Object.assign(datiModifica, {
    firstName:       s.firstName       ?? '',
    lastName:        s.lastName        ?? '',
    dataNascita:     s.dataNascita     ?? '',
    classe:          s.classe          ?? '',
    scuola:          s.scuola          ?? '',
    studentPhone:    s.studentPhone    ?? '',
    studentEmail:    s.studentEmail    ?? '',
    parentName:      s.parentName      ?? '',
    parentPhone:     s.parentPhone     ?? '',
    parentEmail:     s.parentEmail     ?? '',
    parentIndirizzo: s.parentIndirizzo ?? '',
    parentCitta:     s.parentCitta     ?? '',
    parentCap:       s.parentCap       ?? '',
    parentCF:        s.parentCF        ?? '',
    parentPIva:      s.parentPIva      ?? '',
    parentRelazione:      rel1.scelta,
    parentRelazioneAltro: rel1.altro,
    parent2Name:           s.parent2Name        ?? '',
    parent2Phone:          s.parent2Phone       ?? '',
    parent2Email:          s.parent2Email       ?? '',
    parent2Indirizzo:      s.parent2Indirizzo   ?? '',
    parent2Citta:          s.parent2Citta       ?? '',
    parent2Cap:            s.parent2Cap         ?? '',
    parent2CF:             s.parent2CF          ?? '',
    parent2PIva:           s.parent2PIva        ?? '',
    parent2DataNascita:    s.parent2DataNascita ?? '',
    parent2Relazione:      rel2.scelta,
    parent2RelazioneAltro: rel2.altro,
    bisogniSpeciali: s.bisogniSpeciali ?? '',
    note:            s.note            ?? '',
  })
  // La sezione del secondo genitore parte aperta solo se c'è qualcuno da mostrare
  mostraSecondoGenitore.value = haSecondoGenitore.value
  // Se la scuola corrente non è nella lista, mostra input manuale
  altreScuolaModifica.value = !!s.scuola && !SCUOLE_TRAPANI.includes(s.scuola)
  modalModificaAperto.value = true
}

// Stessa finestra, ma con la sezione del secondo genitore già aperta: è il
// bottone "Aggiungi un secondo genitore" della scheda.
function apriModalSecondoGenitore() {
  apriModalModifica()
  mostraSecondoGenitore.value = true
}

// ─── "Prima di salvare": cosa cambia in più salvando la Modifica ───
// Una lista semplice di voci con la spunta, ognuna con la sua azione da eseguire
// DOPO il salvataggio dell'anagrafica. Oggi le voci sono le email di accesso
// (correggi l'email in scheda → cambia anche quella con cui si entra) e i
// fratelli (cambi il telefono della mamma → aggiorna anche sulla scheda di Luca);
// altre conseguenze si aggiungono qui come voci nuove, senza toccare la finestra.
type VoceConseguenza = {
  id: string
  etichetta: string
  dettaglio?: string
  attiva: boolean
  esegui: () => Promise<void>
}
const vociConseguenze      = ref<VoceConseguenza[]>([])
const primaDiSalvareAperto = ref(false)
const eseguendoConseguenze = ref(false)

// Le email si confrontano come le leggerebbe una persona: maiuscole e spazi non contano
function stessaEmail(a?: string | null, b?: string | null) {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
}

// Guarda cosa sta per cambiare e costruisce le voci del riepilogo.
// Si propone di cambiare un'email di accesso SOLO se, prima della modifica,
// scheda e account andavano d'accordo: se erano già diverse non sappiamo quale
// delle due sia quella giusta, e allora meglio non proporre niente.
function conseguenzeDellaModifica(): VoceConseguenza[] {
  const s = studente.value as any
  if (!s) return []
  const voci: VoceConseguenza[] = []
  const accStudente = (studentAccount.value as any)?.studentUser ?? null

  // Le email con cui si entra già oggi, di chiunque sia collegato a questo alunno.
  // Se la "nuova" email è una di queste non è una correzione ma uno scambio (es.
  // primo e secondo genitore invertiti): non si propone nulla, il server comunque
  // la rifiuterebbe perché è già usata da un altro account.
  const emailDiAccesso: string[] = [
    ...genitoriPortale.value.map((g: any) => g.email as string),
    ...(accStudente?.email ? [accStudente.email as string] : []),
  ]
  const giaDiUnAccesso = (email: string) => emailDiAccesso.some((e) => stessaEmail(e, email))

  // 1. L'email dello studente
  const nuovaStudente = (datiModifica.studentEmail ?? '').trim()
  if (
    accStudente?.id
    && s.studentEmail && nuovaStudente
    && !stessaEmail(s.studentEmail, nuovaStudente)
    && stessaEmail(accStudente.email, s.studentEmail)
    && !giaDiUnAccesso(nuovaStudente)
  ) {
    const acc = accountStudenteDaCorreggere(accStudente)
    voci.push({
      id: `email-accesso-${acc.userId}`,
      etichetta: `Cambia anche l'email con cui ${acc.primoNome || acc.nome} entra (${acc.email} → ${nuovaStudente.toLowerCase()})`,
      attiva: true,
      esegui: () => correggiEmailDaModifica(acc, nuovaStudente),
    })
  }

  // 2. Le email del primo e del secondo genitore
  const genitoriScheda = [
    { vecchia: s.parentEmail as string | null, nuova: datiModifica.parentEmail },
    // Spunta del secondo genitore tolta = i suoi dati spariscono: nessuna email nuova
    { vecchia: s.parent2Email as string | null, nuova: mostraSecondoGenitore.value ? datiModifica.parent2Email : '' },
  ]
  const giaProposti = new Set<string>()
  for (const { vecchia, nuova } of genitoriScheda) {
    const n = (nuova ?? '').trim()
    if (!vecchia || !n || stessaEmail(vecchia, n) || giaDiUnAccesso(n)) continue
    const g = genitoriPortale.value.find((p: any) => stessaEmail(p.email, vecchia))
    // Stesso account su tutti e due i riquadri (caso raro): una voce sola
    if (!g || giaProposti.has(g.id)) continue
    giaProposti.add(g.id)
    const acc = accountGenitoreDaCorreggere(g)
    voci.push({
      id: `email-accesso-${acc.userId}`,
      etichetta: `Cambia anche l'email con cui ${acc.nome} entra nel portale (${acc.email} → ${n.toLowerCase()})`,
      dettaglio: (acc.numeroFigli ?? 1) > 1
        ? `Vale per tutti i suoi ${acc.numeroFigli} figli: l'email si aggiorna anche sulle loro schede.`
        : undefined,
      attiva: true,
      esegui: () => correggiEmailDaModifica(acc, n),
    })
  }

  // 3. Lo stesso genitore sulla scheda di un fratello (C5, decisione Q15)
  voci.push(...vociPerIFratelli(s))

  return voci
}

// ─── Q15: "Maria Bianchi è anche mamma di Luca: aggiorno anche lì?" ───
// Con la fotocopia (C5) lo stesso genitore sta scritto su due schede: se la mamma
// cambia numero, va cambiato su tutte e due. Decisione Q15 = (a): il gestionale
// CHIEDE, sempre, con la finestra "Prima di salvare". Mai da solo: i fratelli si
// riconoscono anche dal solo telefono, e se una nonna ha dato lo stesso numero
// per due famiglie, un aggiornamento automatico cambierebbe la famiglia sbagliata.

// I dati della persona che si propone di riportare sul fratello. La parentela
// no: è il legame con QUESTO alunno (può essere "Madre" di uno e "Tutore legale"
// dell'altro), non un dato della persona.
const CAMPI_DA_RIPORTARE: CampoGenitore[] = ['nome', 'telefono', 'email', 'cf', 'piva', 'indirizzo', 'citta', 'cap', 'dataNascita']

// Due valori si confrontano come li leggerebbe una persona: il telefono
// "333 1234567" e "+393331234567" è lo stesso numero (la casella lo riscrive da
// sola uscendo dal campo), e l'email o il codice fiscale non cambiano per una maiuscola.
function valoreConfrontabile(campo: CampoGenitore, v?: string | null): string {
  const t = (v ?? '').trim()
  if (campo === 'telefono') return normalizzaTelefono(t)
  if (campo === 'email') return t.toLowerCase()
  if (campo === 'cf') return t.toUpperCase()
  if (campo === 'nome') return nomeConfrontabile(t)
  return t.replace(/\s+/g, ' ')
}

// Il legame con cui riportare i dati di QUEL genitore sulla scheda del fratello:
// serve sapere in quale posto sta là (suoSlot), altrimenti non si sa dove scrivere.
// "Forte" se c'è almeno un documento sicuro (account, codice fiscale, email);
// il solo telefono è debole.
function legamePerGenitore(f: Fratello, mioSlot: Slot): { suoSlot: Slot; forte: boolean } | null {
  const utili = f.legami.filter((l) => l.mioSlot === mioSlot && l.suoSlot !== null)
  const forte = utili.find((l) => l.motivo !== 'telefono')
  const scelto = forte ?? utili[0]
  if (!scelto?.suoSlot) return null
  return { suoSlot: scelto.suoSlot, forte: Boolean(forte) }
}

function vociPerIFratelli(s: any): VoceConseguenza[] {
  // Dati dei fratelli non arrivati (o nessun fratello): nessuna domanda, e il
  // salvataggio va avanti come sempre
  if (fratelli.value.length === 0) return []
  const voci: VoceConseguenza[] = []

  for (const slot of [1, 2] as Slot[]) {
    // Spunta del secondo genitore tolta = lo si toglie da QUESTA scheda, non dal
    // fratello: là resta com'è.
    if (slot === 2 && !mostraSecondoGenitore.value) continue

    const prima = leggiSerie(s, slot)
    // datiModifica usa gli stessi nomi di colonna della scheda: si legge allo stesso modo
    const dopo = leggiSerie(datiModifica, slot)
    // Si riporta solo ciò che ha un valore NUOVO. Un campo svuotato qui non si
    // svuota sul fratello: cancellare un dato altrove è più rischioso che lasciarlo.
    const cambiati = CAMPI_DA_RIPORTARE.filter((campo) =>
      dopo[campo] && valoreConfrontabile(campo, dopo[campo]) !== valoreConfrontabile(campo, prima[campo]))
    if (cambiati.length === 0) continue

    const chi = prima.nome || dopo.nome || (slot === 1 ? 'Il primo genitore' : 'Il secondo genitore')
    const parentela = parolaParentela(prima.relazione)

    for (const f of fratelli.value) {
      const legame = legamePerGenitore(f, slot)
      if (!legame) continue
      // La data di nascita ha una colonna solo nel posto del secondo genitore
      const campi = cambiati.filter((campo) => campo !== 'dataNascita' || legame.suoSlot === 2)
      if (campi.length === 0) continue

      const avvisi: string[] = []
      if (!legame.forte) avvisi.push('Riconosciuto solo dal numero di telefono: controlla che sia davvero la stessa persona.')
      // Cambiare il nome può voler dire aver messo un'altra persona al suo posto:
      // in quel caso sul fratello va lasciato il genitore di prima.
      if (campi.includes('nome') && prima.nome) {
        avvisi.push(`Cambia anche il nome (${prima.nome} → ${dopo.nome}): se al suo posto hai messo un'altra persona, togli la spunta.`)
      }

      const valori = scriviSerie(dopo, legame.suoSlot, campi)
      voci.push({
        id: `fratello-${f.id}-${slot}`,
        etichetta: `${chi} è anche ${parentela} di ${f.nome}: aggiorna anche lì (${campi.map((c) => ETICHETTE_CAMPO[c]).join(', ')})`,
        dettaglio: avvisi.length > 0 ? avvisi.join(' ') : undefined,
        // Q15: attiva se il legame è sicuro, spenta se c'è solo il telefono
        attiva: legame.forte,
        esegui: () => aggiornaFratello(f, valori),
      })
    }
  }
  return voci
}

// Azione di una voce "aggiorna anche su Luca": solo i campi cambiati, già
// rimappati sul posto giusto della scheda del fratello. Come le altre voci, dice
// da sé se è andata a buon fine e non ferma quelle dopo.
async function aggiornaFratello(f: Fratello, valori: Record<string, string | null>) {
  try {
    // Indirizzo tenuto come testo semplice: scritto "a stampo" TypeScript lo
    // confonde con /api/students/stats (solo lettura) e rifiuterebbe il PUT.
    const indirizzoFratello: string = `/api/students/${f.id}`
    await $fetch(indirizzoFratello, { method: 'PUT', body: valori })
    toast.add({ title: `Aggiornato anche su ${f.nome}`, color: 'success', icon: 'i-heroicons-check-circle' })
  } catch (e: any) {
    toast.add({
      title: `Scheda di ${f.nome} non aggiornata`,
      description: e?.data?.statusMessage ?? 'Impossibile aggiornare la scheda del fratello: fallo dalla sua scheda.',
      color: 'error',
    })
  }
}

// Il bottone "Salva Modifiche". Se il salvataggio non si porta dietro altro,
// salva subito come sempre; altrimenti prima mostra il riepilogo.
async function salvaModifica() {
  const voci = conseguenzeDellaModifica()
  if (voci.length > 0) {
    vociConseguenze.value = voci
    primaDiSalvareAperto.value = true
    return
  }
  await salvaAnagrafica()
}

// "Salva" nella finestra "Prima di salvare": prima l'anagrafica, poi le voci
// rimaste spuntate, una alla volta. Ogni voce dice da sé se è andata a buon fine.
async function confermaPrimaDiSalvare(idAttive: string[]) {
  const daEseguire = vociConseguenze.value.filter((v) => idAttive.includes(v.id))
  const salvato = await salvaAnagrafica()
  if (!salvato) {
    // L'errore l'ha già detto il toast: si torna alla Modifica, che resta aperta
    primaDiSalvareAperto.value = false
    return
  }
  if (daEseguire.length > 0) {
    eseguendoConseguenze.value = true
    linkDopoModifica.value = []
    try {
      for (const voce of daEseguire) await voce.esegui()
      await ricaricaDopoCorrezione()
    } finally {
      eseguendoConseguenze.value = false
    }
  }
  primaDiSalvareAperto.value = false
  if (linkDopoModifica.value.length > 0) linkDopoModificaAperto.value = true
}

// Il salvataggio dell'anagrafica vero e proprio (è quello di sempre).
// Restituisce true se è andato a buon fine.
async function salvaAnagrafica(): Promise<boolean> {
  salvando.value = true
  try {
    await $fetch(`/api/students/${id}`, {
      method: 'PUT',
      body: {
        ...datiModifica,
        // Campo vuoto = "non lo so", quindi NULL a database (mai stringa vuota)
        dataNascita:     datiModifica.dataNascita     || null,
        classe:          datiModifica.classe          || null,
        scuola:          datiModifica.scuola          || null,
        studentPhone:    datiModifica.studentPhone    || null,
        studentEmail:    datiModifica.studentEmail    || null,
        parentName:      datiModifica.parentName      || null,
        parentPhone:     datiModifica.parentPhone     || null,
        parentEmail:     datiModifica.parentEmail     || null,
        parentIndirizzo: datiModifica.parentIndirizzo || null,
        parentCitta:     datiModifica.parentCitta     || null,
        parentCap:       datiModifica.parentCap       || null,
        parentCF:        datiModifica.parentCF        || null,
        parentPIva:      datiModifica.parentPIva      || null,
        parentRelazione: componiRelazione(datiModifica.parentRelazione, datiModifica.parentRelazioneAltro),
        // Secondo genitore: se la spunta è tolta si azzera tutto, altrimenti si
        // salva quello che è stato scritto (casella vuota = NULL, mai "").
        ...(mostraSecondoGenitore.value
          ? {
              parent2Name:        datiModifica.parent2Name        || null,
              parent2Phone:       datiModifica.parent2Phone       || null,
              parent2Email:       datiModifica.parent2Email       || null,
              parent2Indirizzo:   datiModifica.parent2Indirizzo   || null,
              parent2Citta:       datiModifica.parent2Citta       || null,
              parent2Cap:         datiModifica.parent2Cap         || null,
              parent2CF:          datiModifica.parent2CF          || null,
              parent2PIva:        datiModifica.parent2PIva        || null,
              parent2DataNascita: datiModifica.parent2DataNascita || null,
              parent2Relazione:   componiRelazione(datiModifica.parent2Relazione, datiModifica.parent2RelazioneAltro),
            }
          : {
              parent2Name: null, parent2Phone: null, parent2Email: null,
              parent2Indirizzo: null, parent2Citta: null, parent2Cap: null,
              parent2CF: null, parent2PIva: null, parent2DataNascita: null,
              parent2Relazione: null,
            }),
        bisogniSpeciali: datiModifica.bisogniSpeciali || null,
        note:            datiModifica.note            || null,
      },
    })
    toast.add({ title: 'Modifiche salvate', color: 'success', icon: 'i-heroicons-check-circle' })
    modalModificaAperto.value = false
    refresh()
    // Un telefono o un'email cambiati possono fare (o disfare) un fratello
    refreshFratelli()
    return true
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile salvare', color: 'error' })
    return false
  } finally {
    salvando.value = false
  }
}

// ─── Azioni pacchetto ───
function azioniPacchetto(pkg: any) {
  const azioni = [
    { label: 'Dettagli pacchetto', icon: 'i-heroicons-document-magnifying-glass', onSelect: () => navigateTo(`/pacchetti/${pkg.id}`) },
    { label: 'Registra pagamento', icon: 'i-heroicons-banknotes', onSelect: () => aprirePagamento(pkg) },
    { label: 'Modifica', icon: 'i-heroicons-pencil-square', onSelect: () => apriModificaPacchetto(pkg) },
  ]
  if (pkg.tipo === 'A_CONSUMO') {
    azioni.push({ label: 'Ricarica', icon: 'i-heroicons-plus-circle', onSelect: () => apriModalRicarica(pkg) })
    azioni.push({ label: 'Libretto', icon: 'i-heroicons-list-bullet', onSelect: () => apriLibretto(pkg) })
  }
  return azioni
}

// ─── Gestione Modals Pacchetto ───
const pacchettoSelezionato = ref<any>(null)
const modalPagamentoAperto = ref(false)
const modalRicaricaAperto = ref(false)
const modalLibrettoAperto = ref(false)
const modalCreaAperto = ref(false)
const pacchettoDaRinnovare = ref<any>(null)
const modalModificaPacchettoAperto = ref(false)

function aprirePagamento(pkg: any) {
  pacchettoSelezionato.value = pkg
  modalPagamentoAperto.value = true
}

function apriModalRicarica(pkg: any) {
  pacchettoSelezionato.value = pkg
  modalRicaricaAperto.value = true
}

function apriLibretto(pkg: any) {
  pacchettoSelezionato.value = pkg
  modalLibrettoAperto.value = true
}

function apriModalCreaPacchetto() {
  pacchettoDaRinnovare.value = null
  modalCreaAperto.value = true
}

function avviaRinnovo(pkg: any) {
  pacchettoDaRinnovare.value = pkg
  pacchettoSelezionato.value = pkg
  modalCreaAperto.value = true
}

function apriModificaPacchetto(pkg: any) {
  pacchettoSelezionato.value = pkg
  modalModificaPacchettoAperto.value = true
}

// ─── Portale Famiglie ───
const { user: sessionUser } = useUserSession()
const isAdmin = computed(() =>
  ['ADMIN', 'SUPER_TUTOR'].includes(sessionUser.value?.role ?? '')
)

const { data: portalAccess, refresh: refreshPortal } = useLazyFetch(
  `/api/admin/students/${id}/portal-access`,
  { lazy: true }
)

// ⚠️ pendingBookings è lo stato di caricamento, NON i dati: prima erano invertiti
// e lo spinner girava all'infinito appena arrivava la risposta.
const { data: bookingsData, pending: pendingBookings, refresh: refreshBookings } = useLazyFetch(
  `/api/admin/bookings?studentId=${id}`,
  { lazy: true }
)
const allBookings = computed(() => (bookingsData.value as any[]) ?? [])

function statoBookingLabel(b: any): string {
  return b.status === 'CANCELLED' ? 'Annullata' : 'Confermata'
}

function esportaCsvPrenotazioni() {
  const righe = [
    ['Data richiesta', 'Materie', 'Stato', 'Note'],
    ...allBookings.value.map((b: any) => [
      formatDateBooking(b.requestedDate),
      (b.subjects ?? []).map((s: any) => s.name).join(', '),
      statoBookingLabel(b),
      b.notes ?? '',
    ]),
  ]
  const csv = righe.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `prenotazioni-${(studente.value as any)?.lastName ?? id}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Elenco dei genitori collegati a questo alunno (possono essere più di uno)
const genitoriPortale = computed<any[]>(() => ((portalAccess.value as any)?.parents ?? []) as any[])

// ─── Fratelli e sorelle (C5) ───
// Dedotti dal server (genitore in comune), mai scritti a mano. Servono a due cose:
// la sezione "Fratelli e sorelle" della linguetta Famiglia e la domanda
// "aggiorno anche su Luca?" della Modifica (Q15). Se la chiamata non riesce la
// lista resta vuota: sparisce la sezione e non si fanno domande, ma il
// salvataggio della scheda non si blocca mai per questo.
const { data: datiFratelli, refresh: refreshFratelli } = useLazyFetch<{ fratelli: Fratello[] }>(
  `/api/admin/students/${id}/fratelli`,
  { lazy: true },
)
const fratelli = computed<Fratello[]>(() => datiFratelli.value?.fratelli ?? [])

// "stesso account del portale, stessa email" — il perché, detto in chiaro
const PAROLE_MOTIVO: Record<Fratello['legami'][number]['motivo'], string> = {
  account: 'stesso account del portale',
  cf: 'stesso codice fiscale',
  email: 'stessa email',
  telefono: 'stesso telefono',
}
function comeRiconosciuto(f: Fratello): string {
  const motivi = [...new Set(f.legami.map((l) => l.motivo))]
  if (motivi.length === 1 && motivi[0] === 'telefono') return 'Riconosciuto solo dal numero di telefono di un genitore.'
  return `Genitore in comune: ${motivi.map((m) => PAROLE_MOTIVO[m]).join(', ')}.`
}

// ─── Collega un genitore già registrato (C5) ───
const collegaGenitoreAperto = ref(false)
const nomeAlunno = computed(() => {
  const s = studente.value as any
  return s ? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() : ''
})
function apriCollegaGenitore() {
  collegaGenitoreAperto.value = true
}
// Dopo il collegamento cambiano la scheda, gli accessi al portale e (magari) i fratelli
async function dopoCollegaGenitore() {
  await Promise.all([refresh(), refreshPortal(), refreshFratelli()])
}

// Etichette di ruolo proposte; "ALTRO" apre un campo di testo libero accanto al menu
const RELAZIONI_ITEMS = [
  { label: 'Padre',           value: 'Padre' },
  { label: 'Madre',           value: 'Madre' },
  { label: 'Tutore legale',   value: 'Tutore legale' },
  { label: 'Nonno/a',         value: 'Nonno/a' },
  { label: 'Altro (specifica)', value: 'ALTRO' },
]

const mostraModalCreaAccesso = ref(false)
const datiCreaAccesso = reactive({ email: '', firstName: '', lastName: '', relazione: '', relazioneAltro: '' })
// Etichetta effettiva da inviare all'API: vuota = nessuna etichetta (campo omesso dal body)
const relazioneScelta = computed(() => {
  if (!datiCreaAccesso.relazione) return ''
  if (datiCreaAccesso.relazione === 'ALTRO') return datiCreaAccesso.relazioneAltro.trim().slice(0, 50)
  return datiCreaAccesso.relazione
})
const credenziali = ref<({ email: string; nome: string; linkPassword: string } & EsitoInvitoEmail) | null>(null)
const creandoAccesso = ref(false)
const resetPassword = ref<({ email: string; nome: string; linkPassword: string } & EsitoInvitoEmail) | null>(null)
const resettandoId = ref<string | null>(null)
const rimuovendoId = ref<string | null>(null)

// ─── CONSENSI PRIVACY ───
//
// I tipi sono scritti a mano invece di lasciarli dedurre dalla risposta: in questa
// pagina useLazyFetch restituisce quasi sempre un'unione che TypeScript non sa
// restringere (lo si vede su `studente`, dove ogni campo va letto con `as any`).
// Dichiarandoli qui, gli interruttori e lo storico restano controllati davvero.
type TipoConsenso = 'MINORE_14' | 'IMMAGINI' | 'MARKETING'

interface VoceConsensoUI {
  tipo: TipoConsenso
  /** null = non ha mai risposto (che è diverso da "ha detto no") */
  valore: boolean | null
  quando: string | null
  origine: 'PORTALE' | 'GESTIONALE' | null
  chi: string | null
  versione: string | null
  note: string | null
}

interface GenitoreMarketing extends VoceConsensoUI {
  userId: string
  nome: string
  email: string
  relazione: string | null
  active: boolean
}

interface StatoConsensiUI {
  studentId: string
  nomeAlunno: string
  dataNascita: string | null
  /** null = manca la data di nascita: "non lo so" non è "no" (decisione Q17) */
  minoreDi14: boolean | null
  minore14: VoceConsensoUI
  immagini: VoceConsensoUI
  marketing: GenitoreMarketing[]
  /** La riga storica raccolta alla creazione dell'account dello studente */
  autorizzazioneAccount: { quando: string; chi: string | null } | null
}

interface RigaStoricoUI {
  id: string
  tipo: TipoConsenso
  valore: boolean
  quando: string
  origine: 'PORTALE' | 'GESTIONALE'
  chi: string | null
  persona: string | null
  versione: string | null
  note: string | null
}

const ETICHETTE_CONSENSO: Record<TipoConsenso, string> = {
  MINORE_14: 'Autorizzazione del genitore',
  IMMAGINI:  'Immagini (foto e video)',
  MARKETING: 'Comunicazioni promozionali',
}

const { data: datiConsensi, pending: pendingConsensi, refresh: refreshConsensi } = useLazyFetch<{
  stato: StatoConsensiUI
  storico: RigaStoricoUI[]
}>(`/api/admin/students/${id}/consensi`, { lazy: true })

const consensi = computed<StatoConsensiUI | null>(() => datiConsensi.value?.stato ?? null)
const storicoConsensi = computed<RigaStoricoUI[]>(() => datiConsensi.value?.storico ?? [])
const storicoConsensiAperto = ref(false)
// Quale interruttore sta salvando: 'IMMAGINI', 'MINORE_14' o 'MARKETING:<idGenitore>'.
// Uno alla volta: due consensi cambiati insieme con una sola conferma a schermo
// sarebbero due righe di storico che nessuno ha confermato davvero.
const salvandoConsenso = ref<string | null>(null)

// "Revocato il 12/09/2026 alle 15:42 dal portale famiglie da Maria Bianchi."
// Chi, quando e DA DOVE, perché su un consenso privacy la provenienza conta
// quanto la data: una cosa è che l'abbia fatto la famiglia, un'altra la segreteria.
function dettaglioVoce(v?: VoceConsensoUI | null): string {
  if (!v || v.valore === null) return 'Mai risposto.'
  const dove     = v.origine === 'PORTALE' ? 'dal portale famiglie' : 'in segreteria'
  const chi      = v.chi ? ` da ${v.chi}` : ''
  const versione = v.versione ? ` (testo ${v.versione})` : ''
  return `${v.valore ? 'Dato' : 'Revocato'} il ${formatDataOra(v.quando)} ${dove}${chi}${versione}.`
}

// L'avviso arancione compare SOLO quando l'autorizzazione è davvero dovuta:
// alunno sotto i 14 anni e nessuno che abbia autorizzato. Con la data di nascita
// mancante non compare niente (Q17): non si chiede a sproposito.
const serveAutorizzazione = computed(() => {
  const c = consensi.value
  if (!c || c.minoreDi14 !== true) return false
  if (c.minore14.valore === true) return false
  // Revocata esplicitamente: l'avviso serve eccome, anche se in passato c'era
  if (c.minore14.valore === false) return true
  // Mai risposto nel registro: vale ancora quella raccolta alla creazione dell'account
  return !c.autorizzazioneAccount
})

// Ogni cambiamento passa da una finestra di conferma: qui si tocca un consenso
// privacy, e resta scritto nello storico con il nome di chi l'ha fatto. Mai
// confirm() del browser — non si può leggere da telefono e non si può tradurre.
function chiediCambioConsenso(tipo: TipoConsenso, valore: boolean, genitore?: GenitoreMarketing) {
  const chiave = tipo === 'MARKETING' && genitore ? `MARKETING:${genitore.userId}` : tipo
  const diChi  = tipo === 'MARKETING' && genitore ? ` di ${genitore.nome}` : ''

  chiediConferma(
    {
      title: valore
        ? `Registrare il consenso${diChi}?`
        : `Revocare il consenso${diChi}?`,
      description: `${ETICHETTE_CONSENSO[tipo]}${diChi}: stai registrando che la famiglia ha ${valore ? 'dato' : 'revocato'} questo consenso.\n\nResta scritto nello storico con il tuo nome, la data e l'ora, e non si cancella. Fallo solo se la famiglia te l'ha detto davvero.`,
      confirmLabel: valore ? 'Sì, registra' : 'Sì, revoca',
      confirmColor: valore ? 'primary' : 'warning',
    },
    async () => {
      salvandoConsenso.value = chiave
      try {
        await $fetch(`/api/admin/students/${id}/consensi`, {
          method: 'POST',
          // L'operatore NON si manda da qui: lo legge il server dalla sessione
          body: { tipo, valore, ...(genitore ? { userId: genitore.userId } : {}) },
        })
        await refreshConsensi()
        toast.add({ title: valore ? 'Consenso registrato' : 'Consenso revocato', color: 'success' })
      } catch (e: any) {
        toast.add({ title: 'Errore', description: e?.data?.statusMessage ?? 'Non sono riuscito a registrare il consenso', color: 'error' })
      } finally {
        salvandoConsenso.value = null
      }
    }
  )
}

// ─── Account Studente (solo prenotazioni) ───
const { data: studentAccount, refresh: refreshStudentAccount } = useLazyFetch(
  `/api/admin/students/${id}/student-account`,
  { lazy: true }
)

// Ha meno di 14 anni? null = non lo sappiamo, perché manca la data di nascita.
// Da questa risposta dipendono l'etichetta della spunta e il blocco del bottone:
// sotto i 14 anni l'autorizzazione del genitore è obbligatoria, da 14 in su no
// (decisione Q16), e senza data non si chiede niente (Q17).
const minoreDi14Studente = computed(() => eMinoreDi14(dataNascitaStudente.value))

const etichettaConsensoAccount = computed(() => {
  const base = 'Il genitore autorizza la creazione dell\'account dello studente'
  if (minoreDi14Studente.value === true)  return `${base} — obbligatoria: ha meno di 14 anni`
  if (minoreDi14Studente.value === false) return `${base} — facoltativa: a 14 anni compiuti decide il ragazzo`
  return `${base} — facoltativa: non so quanti anni ha`
})
const datiAccountStudente = reactive({ email: '', firstName: '', lastName: '', consensoGenitore: false })
const creandoAccountStudente = ref(false)

// "12/09/2026 alle 15:42 — registrato da Maria Rossi".
// L'ora c'è perché l'informativa privacy parla di "data e ora"; il nome perché un
// consenso senza un testimone è una riga che nessuno può confermare. Gli account
// creati PRIMA di questa modifica non hanno l'operatore: si mostra data e ora e
// basta, senza inventare un nome.
const consensoGenitoreTesto = computed(() => {
  const acc = studentAccount.value as any
  const quando = acc?.studentUser?.consensoGenitoreAt
  if (!quando) return '—'
  const d = new Date(quando)
  const data = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Rome' })
  const ora  = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })
  const chi  = acc?.consensoRegistratoDa
  const nome = chi ? `${chi.firstName ?? ''} ${chi.lastName ?? ''}`.trim() : ''
  return nome ? `${data} alle ${ora} — registrato da ${nome}` : `${data} alle ${ora}`
})
const togglandoStudente = ref(false)
const credenzialiStudente = ref<({ email: string; nome: string; linkPassword: string } & EsitoInvitoEmail) | null>(null)

// Precompila dai dati dello studente appena disponibili
watch(studentAccount, (acc: any) => {
  if (!acc || acc.studentUser) return
  if (!datiAccountStudente.email) datiAccountStudente.email = acc.studentEmail ?? ''
  if (!datiAccountStudente.firstName) datiAccountStudente.firstName = acc.firstName ?? ''
  if (!datiAccountStudente.lastName) datiAccountStudente.lastName = acc.lastName ?? ''
}, { immediate: true })

async function creaAccountStudente() {
  creandoAccountStudente.value = true
  try {
    const res = await $fetch(`/api/admin/students/${id}/student-account`, {
      method: 'POST',
      body: { ...datiAccountStudente },
    }) as any
    credenzialiStudente.value = { email: res.email, nome: datiAccountStudente.firstName, linkPassword: res.linkPassword, emailInviata: res.emailInviata === true, motivoEmail: res.motivoEmail, dettaglioEmail: res.dettaglioEmail }
    toast.add({ title: 'Account studente creato', color: 'success' })
    // Anche i consensi cambiano: se la spunta c'era, nella card "Consensi" compare
    // la riga "raccolta in segreteria il … alla creazione dell'account".
    await Promise.all([refreshStudentAccount(), refreshConsensi()])
  } catch (e: any) {
    toast.add({ title: 'Errore', description: e?.data?.statusMessage ?? 'Impossibile creare l\'account studente', color: 'error' })
  } finally {
    creandoAccountStudente.value = false
  }
}

async function toggleAccountStudente(value: boolean) {
  const acc = studentAccount.value as any
  if (!acc?.studentUser?.id) return
  togglandoStudente.value = true
  try {
    await $fetch(`/api/admin/students/${id}/student-account`, {
      method: 'PUT',
      body: { action: 'toggle-active', userId: acc.studentUser.id, active: value },
    })
    await refreshStudentAccount()
    toast.add({ title: value ? 'Account studente attivato' : 'Account studente disattivato', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Errore', description: e?.data?.statusMessage ?? 'Operazione non riuscita', color: 'error' })
  } finally {
    togglandoStudente.value = false
  }
}

async function resetPasswordStudente() {
  const acc = studentAccount.value as any
  if (!acc?.studentUser?.id) return
  try {
    const res = await $fetch(`/api/admin/students/${id}/student-account`, {
      method: 'PUT',
      body: { action: 'reset-password', userId: acc.studentUser.id },
    }) as any
    credenzialiStudente.value = { email: acc.studentUser.email, nome: acc.studentUser.firstName ?? '', linkPassword: res.linkPassword, emailInviata: res.emailInviata === true, motivoEmail: res.motivoEmail, dettaglioEmail: res.dettaglioEmail }
  } catch (e: any) {
    toast.add({ title: 'Errore', description: e?.data?.statusMessage ?? 'Impossibile reimpostare la password', color: 'error' })
  }
}
const togglando = ref(false)
const confermaCollegamento = ref<{
  email: string
  firstName: string
  lastName: string
} | null>(null)

function apriModalCreaAccesso() {
  const s = studente.value as any
  // Il primo genitore si precompila con i dati anagrafici della scheda; dal secondo
  // in poi si parte da campi vuoti (altrimenti si riproporrebbe il genitore già collegato).
  const primoGenitore = genitoriPortale.value.length === 0
  datiCreaAccesso.email     = primoGenitore ? (s?.parentEmail ?? '') : ''
  datiCreaAccesso.firstName = ''
  datiCreaAccesso.lastName  = ''
  if (primoGenitore && s?.parentName) {
    const parts = (s.parentName as string).trim().split(/\s+/)
    datiCreaAccesso.firstName = parts[0] ?? ''
    datiCreaAccesso.lastName  = parts.slice(1).join(' ')
  }
  datiCreaAccesso.relazione      = ''
  datiCreaAccesso.relazioneAltro = ''
  confermaCollegamento.value = null
  mostraModalCreaAccesso.value = true
}

async function creaAccessoPortale(force = false) {
  creandoAccesso.value = true
  try {
    const relazione = relazioneScelta.value
    const body = force
      ? { email: datiCreaAccesso.email, force: true, ...(relazione ? { relazione } : {}) }
      : {
          studentId: id,
          email:     datiCreaAccesso.email,
          firstName: datiCreaAccesso.firstName,
          lastName:  datiCreaAccesso.lastName,
          ...(relazione ? { relazione } : {}),
        }
    const res = await $fetch(`/api/admin/students/${id}/portal-access`, {
      method: 'POST',
      body,
    }) as any

    if (res.requiresConfirmation) {
      // Genitore già esiste: chiede conferma prima di collegare
      confermaCollegamento.value = {
        email:     res.existingUser.email,
        firstName: res.existingUser.firstName,
        lastName:  res.existingUser.lastName,
      }
      mostraModalCreaAccesso.value = false
      return
    }

    await refreshPortal()

    if (res.alreadyExisted) {
      toast.add({
        title: 'Genitore collegato',
        description: 'L\'account del genitore era già registrato — le credenziali non sono cambiate.',
        color: 'success',
      })
      confermaCollegamento.value = null
    } else {
      credenziali.value = { email: res.email, nome: datiCreaAccesso.firstName, linkPassword: res.linkPassword, emailInviata: res.emailInviata === true, motivoEmail: res.motivoEmail, dettaglioEmail: res.dettaglioEmail }
      toast.add({ title: 'Genitore aggiunto al portale', color: 'success' })
    }
    mostraModalCreaAccesso.value = false
  } catch (e: any) {
    toast.add({
      title: 'Errore',
      description: e?.data?.statusMessage ?? 'Impossibile aggiungere il genitore',
      color: 'error',
    })
  } finally {
    creandoAccesso.value = false
  }
}

// Scollega UN genitore da QUESTO alunno. Se non ha altri figli collegati il backend
// elimina anche l'account; se ne ha altri, l'account resta attivo per loro.
function eliminaAccessoPortale(parentUserId: string, email = '') {
  if (!parentUserId) return
  chiediConferma(
    {
      title: 'Rimuovere il genitore dall\'alunno?',
      description: `${email} non potrà più vedere questo alunno nel portale. Se non ha altri figli collegati, l'account viene eliminato; gli altri genitori di questo alunno restano collegati.`,
      confirmLabel: 'Rimuovi',
      confirmColor: 'error',
    },
    async () => {
      rimuovendoId.value = parentUserId
      try {
        const res = await $fetch(`/api/admin/students/${id}/portal-access/${parentUserId}`, { method: 'DELETE' }) as any
        toast.add({
          title: res?.accountEliminato ? 'Genitore rimosso e account eliminato' : 'Genitore scollegato',
          description: res?.accountEliminato
            ? `${email} non aveva altri alunni collegati: l'account è stato eliminato.`
            : `${email} non vede più questo alunno, ma il suo account resta attivo per gli altri figli collegati.`,
          color: 'success',
          icon: 'i-heroicons-check-circle',
        })
        credenziali.value = null
        resetPassword.value = null
        await refreshPortal()
      } catch (e: any) {
        toast.add({ title: 'Errore', description: e?.data?.statusMessage ?? 'Impossibile rimuovere il genitore', color: 'error' })
      } finally {
        rimuovendoId.value = null
      }
    }
  )
}

// Manda a UN genitore specifico dell'elenco un nuovo link "scegli la tua password".
// La password attuale NON cambia: se il genitore non apre il link continua a entrare come prima.
async function reimpostaPassword(parentUserId: string, email = '', nome = '') {
  if (!parentUserId) return
  resettandoId.value = parentUserId
  try {
    const res = await $fetch(`/api/admin/students/${id}/portal-access/${parentUserId}`, {
      method: 'PUT',
      body: { action: 'reset-password' },
    }) as any
    resetPassword.value = { email, nome, linkPassword: res.linkPassword, emailInviata: res.emailInviata === true, motivoEmail: res.motivoEmail, dettaglioEmail: res.dettaglioEmail }
  } catch (e: any) {
    toast.add({
      title: 'Errore',
      description: e?.data?.statusMessage ?? 'Impossibile reimpostare password',
      color: 'error',
    })
  } finally {
    resettandoId.value = null
  }
}

async function togglePrenotazione(value: boolean) {
  togglando.value = true
  try {
    await $fetch(`/api/admin/students/${id}/portal-access`, {
      method: 'PUT',
      body: { action: 'toggle-prenotazione', abilitato: value },
    })
    await refreshPortal()
  } catch (e: any) {
    toast.add({
      title: 'Errore',
      description: e?.data?.statusMessage ?? 'Impossibile aggiornare',
      color: 'error',
    })
  } finally {
    togglando.value = false
  }
}

// ─── Correggi l'email di accesso (studente o genitore) ───
// L'email con cui si entra sta sull'account; la stessa email sta anche sulla
// scheda. Il server le corregge insieme, annulla i link partiti verso il vecchio
// indirizzo e, se richiesto, ne manda uno nuovo (vedi correggiEmailAccount).
type AccountDaCorreggere = {
  tipo: 'STUDENTE' | 'GENITORE'
  userId: string
  /** Nome e cognome, per le frasi delle finestre */
  nome: string
  /** Solo il nome di battesimo, per la riga del link ("Manda questo link a Giulia") */
  primoNome: string
  /** Email di accesso attuale */
  email: string
  /** Solo genitori: quanti alunni vede nel portale, questo compreso */
  numeroFigli?: number
}

const accountDaCorreggere = ref<AccountDaCorreggere | null>(null)
const correggiEmailAperto = ref(false)
const correggendoEmail    = ref(false)
// Link partiti dalla finestra "Prima di salvare" della Modifica: si mostrano alla fine
const linkDopoModifica = ref<({ chiave: string; titolo: string; email: string; nome: string; linkPassword: string } & EsitoInvitoEmail)[]>([])
const linkDopoModificaAperto = ref(false)

function accountStudenteDaCorreggere(u: any): AccountDaCorreggere {
  return {
    tipo: 'STUDENTE',
    userId: u.id,
    nome: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
    primoNome: u.firstName ?? '',
    email: u.email,
  }
}

function accountGenitoreDaCorreggere(g: any): AccountDaCorreggere {
  return {
    tipo: 'GENITORE',
    userId: g.id,
    nome: `${g.firstName ?? ''} ${g.lastName ?? ''}`.trim(),
    primoNome: g.firstName ?? '',
    email: g.email,
    numeroFigli: g.numeroFigli,
  }
}

function apriCorreggiEmailStudente() {
  const u = (studentAccount.value as any)?.studentUser
  if (!u?.id) return
  accountDaCorreggere.value = accountStudenteDaCorreggere(u)
  correggiEmailAperto.value = true
}

function apriCorreggiEmailGenitore(g: any) {
  if (!g?.id) return
  accountDaCorreggere.value = accountGenitoreDaCorreggere(g)
  correggiEmailAperto.value = true
}

// Una sola funzione per i due tipi di account: cambia solo la porta a cui si bussa.
// La usano sia la finestra "Correggi email" sia il riepilogo "Prima di salvare",
// così le due strade fanno esattamente la stessa cosa.
async function chiamaCorreggiEmail(acc: AccountDaCorreggere, email: string, inviaLink: boolean): Promise<any> {
  if (acc.tipo === 'STUDENTE') {
    return await $fetch(`/api/admin/students/${id}/student-account`, {
      method: 'PUT',
      body: { action: 'change-email', userId: acc.userId, email, inviaLink },
    })
  }
  return await $fetch(`/api/admin/students/${id}/portal-access/${acc.userId}`, {
    method: 'PUT',
    body: { action: 'change-email', email, inviaLink },
  })
}

// I link a schermo che puntavano al vecchio indirizzo ormai sono annullati:
// lasciarli lì farebbe copiare su WhatsApp un link che non funziona più.
function togliLinkVecchi(acc: AccountDaCorreggere, vecchiaEmail: string) {
  if (acc.tipo === 'STUDENTE') {
    credenzialiStudente.value = null
    return
  }
  if (stessaEmail(credenziali.value?.email, vecchiaEmail)) credenziali.value = null
  if (stessaEmail(resetPassword.value?.email, vecchiaEmail)) resetPassword.value = null
}

function esitoLink(acc: AccountDaCorreggere, res: any) {
  return {
    email: res.email as string,
    nome: acc.primoNome,
    linkPassword: res.linkPassword as string,
    emailInviata: res.emailInviata === true,
    motivoEmail: res.motivoEmail,
    dettaglioEmail: res.dettaglioEmail,
  }
}

function descrizioneCorrezione(acc: AccountDaCorreggere, res: any): string {
  const frasi = [`Ora ${acc.primoNome || acc.nome} entra con ${res.email}.`]
  // Per un genitore l'anagrafica si corregge su tutti i figli collegati: dire
  // quante schede sono cambiate evita di doverle andare a controllare una per una
  const schede = Number(res.schedeAllineate ?? 0)
  if (acc.tipo === 'GENITORE' && schede > 0) {
    frasi.push(`Email corretta anche in anagrafica: ${schede} ${schede === 1 ? 'scheda' : 'schede'}.`)
  }
  frasi.push('Il link mandato al vecchio indirizzo non funziona più.')
  return frasi.join(' ')
}

// Dopo una correzione cambiano l'account, l'elenco dei genitori e la scheda
// (e, se si è aggiornato anche un fratello, i legami con lui)
async function ricaricaDopoCorrezione() {
  await Promise.all([refreshPortal(), refreshStudentAccount(), refresh(), refreshFratelli()])
}

// "Salva" nella finestra "Correggi l'email di accesso"
async function salvaCorrezioneEmail(dati: { email: string; inviaLink: boolean }) {
  const acc = accountDaCorreggere.value
  if (!acc) return
  correggendoEmail.value = true
  try {
    const res = await chiamaCorreggiEmail(acc, dati.email, dati.inviaLink)
    togliLinkVecchi(acc, res.vecchiaEmail)
    // Il link nuovo compare nello stesso riquadro, come per "Invia link password"
    if (res.linkPassword) {
      if (acc.tipo === 'STUDENTE') credenzialiStudente.value = esitoLink(acc, res)
      else resetPassword.value = esitoLink(acc, res)
    }
    correggiEmailAperto.value = false
    toast.add({ title: 'Email di accesso corretta', description: descrizioneCorrezione(acc, res), color: 'success', icon: 'i-heroicons-check-circle' })
    await ricaricaDopoCorrezione()
  } catch (e: any) {
    // La finestra resta aperta: si può correggere l'email e riprovare
    toast.add({ title: 'Email non cambiata', description: e?.data?.statusMessage ?? 'Impossibile correggere l\'email', color: 'error' })
  } finally {
    correggendoEmail.value = false
  }
}

// Azione di una voce del riepilogo "Prima di salvare": dalla Modifica il link
// parte sempre (la spunta "manda un link" qui non c'è) e si mette da parte, per
// mostrarli tutti insieme alla fine.
async function correggiEmailDaModifica(acc: AccountDaCorreggere, nuovaEmail: string) {
  try {
    const res = await chiamaCorreggiEmail(acc, nuovaEmail, true)
    togliLinkVecchi(acc, res.vecchiaEmail)
    if (res.linkPassword) {
      linkDopoModifica.value.push({ chiave: acc.userId, titolo: `Link password per ${acc.nome}`, ...esitoLink(acc, res) })
    }
    toast.add({ title: 'Email di accesso corretta', description: descrizioneCorrezione(acc, res), color: 'success', icon: 'i-heroicons-check-circle' })
  } catch (e: any) {
    toast.add({
      title: `Email di accesso di ${acc.nome} non cambiata`,
      description: e?.data?.statusMessage ?? 'Impossibile correggere l\'email',
      color: 'error',
    })
  }
}

function formatDateBooking(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}
</script>
