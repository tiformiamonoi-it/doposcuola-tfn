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
      <div class="flex items-center justify-between mb-4">
        <UButton to="/studenti" variant="ghost" icon="i-heroicons-arrow-left" size="sm">Torna alla lista</UButton>
        <div class="flex items-center gap-2">
          <UButton :to="`/stampe/studente-${id}`" icon="i-heroicons-printer" variant="ghost" size="sm">Stampa lezioni</UButton>
          <UButton icon="i-heroicons-pencil-square" variant="ghost" size="sm" @click="apriModalModifica">Modifica</UButton>
          <UButton v-if="studente.active" icon="i-heroicons-user-minus" variant="ghost" color="error" size="sm" :loading="disattivando" @click="disattivaStudente">Disattiva</UButton>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- SIDEBAR -->
        <div class="lg:col-span-4 space-y-6">
          <UCard :ui="{ body: 'p-6' }">
            <div class="flex flex-col items-center text-center mb-6">
              <UAvatar :alt="studente.firstName + ' ' + studente.lastName" size="3xl" class="mb-3 bg-primary-500 text-white font-bold" :ui="{ fallback: 'text-white' }" />
              <h2 class="text-2xl font-semibold text-slate-900">{{ studente.firstName }} {{ studente.lastName }}</h2>
              <p class="text-sm text-slate-500 mt-1">{{ studente.classe ?? '' }} <span v-if="studente.scuola">• {{ studente.scuola }}</span></p>
              
              <div class="flex items-center gap-2 mt-3">
                <UBadge :color="studente.active ? 'success' : 'neutral'" variant="subtle" size="sm">
                  {{ studente.active ? 'Attivo' : 'Inattivo' }}
                </UBadge>
                <UBadge v-if="studente.bisogniSpeciali" color="orange" variant="subtle" size="sm">BES / DSA</UBadge>
              </div>
            </div>

            <USeparator class="my-4" />

            <div class="space-y-3 text-sm">
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
          <UCard v-if="pacchettoPerRinnovo" class="bg-primary-600 text-white border-none shadow-lg" :ui="{ body: 'p-5', background: 'bg-primary-600' }">
            <div class="flex justify-between items-start mb-1">
              <div class="text-xs font-semibold tracking-wider text-primary-200 uppercase">Pacchetto Attivo</div>
              <UBadge color="white" variant="solid" size="xs" class="text-primary-700 font-bold">{{ pacchettoPerRinnovo.tipo }}</UBadge>
            </div>
            <h3 class="text-lg font-bold mb-1">{{ pacchettoPerRinnovo.nome }}</h3>
            <div class="text-xs text-primary-200 mb-4">
              {{ formatData(pacchettoPerRinnovo.dataInizio) }} — {{ pacchettoPerRinnovo.dataScadenza ? formatData(pacchettoPerRinnovo.dataScadenza) : 'Nessuna scadenza' }}
            </div>

            <div v-if="pacchettoPerRinnovo.tipo !== 'A_CONSUMO'" class="mb-4">
              <div class="flex justify-between text-xs font-medium mb-1.5">
                <span class="text-xl font-bold text-white">{{ pacchettoPerRinnovo.tipo === 'MENSILE' ? pacchettoPerRinnovo.giorniResiduo : parseFloat(pacchettoPerRinnovo.oreResiduo) }} <span class="text-sm font-normal text-primary-200">/ {{ pacchettoPerRinnovo.tipo === 'MENSILE' ? pacchettoPerRinnovo.giorniAcquistati : parseFloat(pacchettoPerRinnovo.oreAcquistate) }} {{ pacchettoPerRinnovo.tipo === 'MENSILE' ? 'giorni' : 'ore' }}</span></span>
              </div>
              <UMeter :value="pacchettoPerRinnovo.tipo === 'MENSILE' ? pacchettoPerRinnovo.giorniResiduo : parseFloat(pacchettoPerRinnovo.oreResiduo)" :max="pacchettoPerRinnovo.tipo === 'MENSILE' ? pacchettoPerRinnovo.giorniAcquistati : parseFloat(pacchettoPerRinnovo.oreAcquistate)" color="white" size="sm" />
            </div>
            <div v-else class="mb-4">
               <div class="text-xl font-bold text-white">{{ parseFloat(pacchettoPerRinnovo.oreResiduo) }} <span class="text-sm font-normal text-primary-200">ore (libretto)</span></div>
            </div>

            <div class="flex items-center justify-between mt-5 pt-4 border-t border-primary-500/50">
              <div>
                <div class="text-xs text-primary-200">Da saldare</div>
                <div class="text-lg font-bold">€ {{ parseFloat(pacchettoPerRinnovo.importoResiduo || 0).toFixed(2) }}</div>
              </div>
              <UButton 
                v-if="parseFloat(pacchettoPerRinnovo.importoResiduo || 0) > 0"
                color="white" 
                variant="solid" 
                size="sm" 
                class="text-primary-700 font-semibold"
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
        <div class="lg:col-span-8">
          <UTabs :items="tabItems" class="w-full">
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

                <!-- Note Interne -->
                <div class="bg-white rounded-xl shadow-sm ring-1 ring-slate-200">
                  <div class="p-4 border-b border-slate-100 flex items-center gap-2">
                    <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-tfn-500" />
                    <h3 class="font-medium text-slate-800">Note Interne</h3>
                  </div>
                  <div class="p-4 bg-yellow-50/30">
                    <p v-if="studente.note" class="text-sm text-slate-700 whitespace-pre-wrap">{{ studente.note }}</p>
                    <p v-else class="text-sm text-slate-400 italic">Nessuna nota inserita per questo studente.</p>
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
                        <th class="py-2.5 px-4 font-semibold">Materia</th>
                        <th class="py-2.5 px-4 font-semibold text-right">Ore</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="l in lezioniFiltrate" :key="l.lessonId" class="border-b border-slate-50 text-sm hover:bg-slate-50">
                        <td class="py-2.5 px-4 font-medium">{{ formatData(l.data) }}</td>
                        <td class="py-2.5 px-4">{{ l.tutorFirstName }} {{ l.tutorLastName }}</td>
                        <td class="py-2.5 px-4 text-slate-500">{{ l.materia }} <UBadge size="xs" variant="subtle" color="neutral" class="ml-1">{{ l.tipo }}</UBadge></td>
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
                <!-- Dati Genitore -->
                <UCard>
                  <template #header>
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <UIcon name="i-heroicons-users" class="w-5 h-5 text-tfn-500" />
                        <span class="font-medium text-slate-800">Dati Anagrafici Genitore</span>
                      </div>
                      <UButton icon="i-heroicons-pencil-square" variant="ghost" size="xs" @click="apriModalModifica">Modifica dati</UButton>
                    </div>
                  </template>
                  <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <InfoRow label="Nome Cognome" :value="studente.parentName" />
                    <InfoRow label="Email" :value="studente.parentEmail" />
                    <InfoRow label="Telefono" :value="studente.parentPhone" />
                    <InfoRow label="Indirizzo" :value="studente.parentIndirizzo" />
                    <InfoRow label="Città e CAP" :value="studente.parentCitta ? `${studente.parentCitta} ${studente.parentCap ?? ''}`.trim() : null" />
                    <InfoRow label="Codice Fiscale" :value="studente.parentCF" />
                    <InfoRow label="Partita IVA" :value="studente.parentPIva" />
                  </dl>
                </UCard>

                <!-- Portale Famiglie -->
                <UCard v-if="isAdmin">
                  <template #header>
                    <div class="flex items-center gap-2">
                      <UIcon name="i-heroicons-globe-alt" class="w-5 h-5 text-tfn-500" />
                      <span class="font-medium text-slate-800">Credenziali Portale Famiglie</span>
                    </div>
                  </template>

                  <div v-if="confermaCollegamento" class="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
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
                  <template v-else-if="!(portalAccess as any)?.portalUser">
                    <p class="text-sm text-slate-500 mb-4">Questo studente non ha ancora un account portale. Crea un accesso per il genitore per consentirgli di visualizzare note e richiedere lezioni.</p>
                    <UButton icon="i-heroicons-plus" @click="apriModalCreaAccesso">Crea accesso portale</UButton>
                  </template>
                  <template v-else>
                    <div class="bg-slate-50 border border-slate-100 rounded-lg p-4">
                      <dl class="space-y-3 text-sm">
                        <div class="flex justify-between items-center border-b border-slate-200 pb-2">
                          <span class="text-slate-500">Email di accesso</span>
                          <span class="font-medium text-slate-800">{{ (portalAccess as any).portalUser?.email }}</span>
                        </div>
                        <div class="flex items-center justify-between pt-1">
                          <span class="text-slate-500">Prenotazione online abilitata</span>
                          <USwitch :model-value="(portalAccess as any).abilitatoPrenotazioneOnline" :loading="togglando" @update:model-value="togglePrenotazione" />
                        </div>
                      </dl>
                    </div>

                    <UAlert v-if="resetPassword" color="warning" icon="i-heroicons-key" title="Nuova password temporanea" :description="`Comunica questa password al genitore: ${resetPassword} (mostrata una sola volta)${resetEmailInviata ? ' — inviata anche via email al genitore' : ''}`" class="mt-4" :close-button="{ icon: 'i-heroicons-x-mark' }" @close="resetPassword = null" />
                    <UAlert v-if="credenziali" color="info" icon="i-heroicons-key" title="Account creato — comunicare al genitore:" :description="`Email: ${credenziali.email} | Password: ${credenziali.tempPassword}${credenziali.emailInviata ? ' — credenziali inviate anche via email' : ''}`" class="mt-4" :close-button="{ icon: 'i-heroicons-x-mark' }" @close="credenziali = null" />

                    <div class="mt-4 flex gap-2">
                      <UButton variant="outline" size="sm" icon="i-heroicons-key" @click="reimpostaPassword">Genera nuova password</UButton>
                    </div>
                  </template>
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
                      <UCheckbox v-model="datiAccountStudente.consensoGenitore" label="Il genitore autorizza la creazione dell'account dello studente (obbligatorio per i minori di 14 anni)" />
                      <UButton icon="i-heroicons-plus" :loading="creandoAccountStudente" :disabled="!datiAccountStudente.email || !datiAccountStudente.consensoGenitore" @click="creaAccountStudente">
                        Crea account studente
                      </UButton>
                    </div>
                  </template>
                  <template v-else>
                    <div class="bg-slate-50 border border-slate-100 rounded-lg p-4">
                      <dl class="space-y-3 text-sm">
                        <div class="flex justify-between items-center border-b border-slate-200 pb-2">
                          <span class="text-slate-500">Email di accesso</span>
                          <span class="font-medium text-slate-800">{{ (studentAccount as any).studentUser?.email }}</span>
                        </div>
                        <div class="flex justify-between items-center border-b border-slate-200 pb-2">
                          <span class="text-slate-500">Consenso genitore registrato</span>
                          <span class="font-medium text-slate-800">{{ (studentAccount as any).studentUser?.consensoGenitoreAt ? formatData((studentAccount as any).studentUser.consensoGenitoreAt) : '—' }}</span>
                        </div>
                        <div class="flex items-center justify-between pt-1">
                          <span class="text-slate-500">Account attivo (può prenotare)</span>
                          <USwitch :model-value="(studentAccount as any).studentUser?.active" :loading="togglandoStudente" @update:model-value="toggleAccountStudente" />
                        </div>
                      </dl>
                    </div>

                    <UAlert v-if="credenzialiStudente" color="info" icon="i-heroicons-key" title="Credenziali account studente (mostrate una sola volta)" :description="`Email: ${credenzialiStudente.email} | Password: ${credenzialiStudente.tempPassword}${credenzialiStudente.emailInviata ? ' — inviate anche via email allo studente' : ' — email non configurata: comunicale a mano'}`" class="mt-4" :close-button="{ icon: 'i-heroicons-x-mark' }" @close="credenzialiStudente = null" />

                    <div class="mt-4 flex gap-2">
                      <UButton variant="outline" size="sm" icon="i-heroicons-key" @click="resetPasswordStudente">Genera nuova password</UButton>
                    </div>
                  </template>
                </UCard>
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
      @refresh="refreshPacchetti"
    />

    <ModalModificaPacchetto
      v-model:open="modalModificaPacchettoAperto"
      :pacchetto="pacchettoSelezionato"
      @refresh="refreshPacchetti"
    />

    <ModalRicaricaPacchetto
      v-model:open="modalRicaricaAperto"
      :pacchetto="pacchettoSelezionato"
      @refresh="refreshPacchetti"
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
      @refresh="refreshPacchetti"
    />

    <!-- ─── MODAL CREA ACCESSO PORTALE ─── -->
    <UModal v-model:open="mostraModalCreaAccesso" title="Crea accesso portale">
      <template #body>
        <div class="space-y-4 p-4">
          <p class="text-sm text-slate-500">
            Inserisci i dati del genitore. Verrà generata una password temporanea da comunicare manualmente.
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
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 px-4 pb-4">
          <UButton variant="ghost" @click="mostraModalCreaAccesso = false">Annulla</UButton>
          <UButton
            color="primary"
            :loading="creandoAccesso"
            :disabled="!datiCreaAccesso.email || !datiCreaAccesso.firstName || !datiCreaAccesso.lastName"
            @click="creaAccessoPortale"
          >
            Crea account
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
import { UpdateStudentSchema } from '#shared/schemas/student.schema'
import { normalizzaTelefono } from '~/utils/phone'
import { riassumiStati } from '~/utils/statiPacchetto'

definePageMeta({ middleware: ['admin-or-super'] })

const route = useRoute()
const toast = useToast()
const id = route.params.id as string

const tabItems = [
  { label: 'Panoramica', slot: 'panoramica' },
  { label: 'Pacchetti', slot: 'pacchetti' },
  { label: 'Lezioni', slot: 'lezioni' },
  { label: 'Prenotazioni', slot: 'prenotazioni' },
  { label: 'Famiglia', slot: 'famiglia' }
]

const filtroLezioni = reactive({ dataInizio: '', dataFine: '' })
const { data: dataLezioni, pending: pendingLezioni } = useLazyFetch('/api/lessons', { query: { studentId: id, limit: 1000 } })
const lezioni = computed(() => dataLezioni.value?.data ?? [])
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
    ['Data', 'Tutor', 'Materia', 'Tipo', 'Ore scalate'],
    ...lezioniFiltrate.value.map((l: any) => [formatData(l.data), `${l.tutorLastName} ${l.tutorFirstName}`, l.materia || '', l.tipo || '', parseFloat(l.oreScalate)]),
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

// ─── Fetch studente ───
const { data: studente, pending, refresh } = useLazyFetch(`/api/students/${id}`)

// ─── Fetch pacchetti dello studente ───
const { data: datiPacchetti, pending: pendingPacchetti, refresh: refreshPacchetti } = useLazyFetch('/api/packages', {
  query: { studentId: id, limit: 50 },
})
const pacchetti = computed(() => datiPacchetti.value?.data ?? [])

const pacchettoPerRinnovo = computed(() => {
  return (pacchetti.value as any[]).find(pkg => {
    const stati = (pkg.stati as string[]) ?? []
    return !stati.includes('CHIUSO')
  }) ?? null
})



// ─── Disattiva studente ───
const disattivando = ref(false)

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

// ─── Modal modifica ───
const modalModificaAperto  = ref(false)
const formModifica         = ref()
const salvando             = ref(false)
const altreScuolaModifica  = ref(false)

const datiModifica = reactive({
  firstName:       '',
  lastName:        '',
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
  bisogniSpeciali: '',
  note:            '',
})

function apriModalModifica() {
  if (!studente.value) return
  const s = studente.value as any
  Object.assign(datiModifica, {
    firstName:       s.firstName       ?? '',
    lastName:        s.lastName        ?? '',
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
    bisogniSpeciali: s.bisogniSpeciali ?? '',
    note:            s.note            ?? '',
  })
  // Se la scuola corrente non è nella lista, mostra input manuale
  altreScuolaModifica.value = !!s.scuola && !SCUOLE_TRAPANI.includes(s.scuola)
  modalModificaAperto.value = true
}

async function salvaModifica() {
  salvando.value = true
  try {
    await $fetch(`/api/students/${id}`, {
      method: 'PUT',
      body: {
        ...datiModifica,
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
        bisogniSpeciali: datiModifica.bisogniSpeciali || null,
        note:            datiModifica.note            || null,
      },
    })
    toast.add({ title: 'Modifiche salvate', color: 'success', icon: 'i-heroicons-check-circle' })
    modalModificaAperto.value = false
    refresh()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile salvare', color: 'error' })
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

const mostraModalCreaAccesso = ref(false)
const datiCreaAccesso = reactive({ email: '', firstName: '', lastName: '' })
const credenziali = ref<{ email: string; tempPassword: string; emailInviata?: boolean } | null>(null)
const creandoAccesso = ref(false)
const resetPassword = ref<string | null>(null)
const resetEmailInviata = ref(false)

// ─── Account Studente (solo prenotazioni) ───
const { data: studentAccount, refresh: refreshStudentAccount } = useLazyFetch(
  `/api/admin/students/${id}/student-account`,
  { lazy: true }
)
const datiAccountStudente = reactive({ email: '', firstName: '', lastName: '', consensoGenitore: false })
const creandoAccountStudente = ref(false)
const togglandoStudente = ref(false)
const credenzialiStudente = ref<{ email: string; tempPassword: string; emailInviata?: boolean } | null>(null)

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
    credenzialiStudente.value = { email: res.email, tempPassword: res.tempPassword, emailInviata: res.emailInviata === true }
    toast.add({ title: 'Account studente creato', color: 'success' })
    await refreshStudentAccount()
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
    credenzialiStudente.value = { email: acc.studentUser.email, tempPassword: res.tempPassword, emailInviata: res.emailInviata === true }
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
  datiCreaAccesso.email = s?.parentEmail ?? ''
  if (s?.parentName) {
    const parts = (s.parentName as string).trim().split(/\s+/)
    datiCreaAccesso.firstName = parts[0] ?? ''
    datiCreaAccesso.lastName  = parts.slice(1).join(' ')
  }
  confermaCollegamento.value = null
  mostraModalCreaAccesso.value = true
}

async function creaAccessoPortale(force = false) {
  creandoAccesso.value = true
  try {
    const body = force
      ? { email: datiCreaAccesso.email, force: true }
      : { ...datiCreaAccesso }
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
        title: 'Studente collegato',
        description: 'L\'account del genitore era già registrato — le credenziali non sono cambiate.',
        color: 'success',
      })
      confermaCollegamento.value = null
    } else {
      credenziali.value = { email: res.email, tempPassword: res.tempPassword, emailInviata: res.emailInviata === true }
      toast.add({ title: 'Account portale creato', color: 'success' })
    }
    mostraModalCreaAccesso.value = false
  } catch (e: any) {
    toast.add({
      title: 'Errore',
      description: e?.data?.statusMessage ?? 'Impossibile creare account',
      color: 'error',
    })
  } finally {
    creandoAccesso.value = false
  }
}

async function reimpostaPassword() {
  const acc = portalAccess.value as any
  if (!acc?.portalUser?.id) return
  try {
    const res = await $fetch(`/api/admin/students/${id}/portal-access`, {
      method: 'PUT',
      body: { action: 'reset-password', userId: acc.portalUser.id },
    }) as any
    resetPassword.value = res.tempPassword
    resetEmailInviata.value = res.emailInviata === true
  } catch (e: any) {
    toast.add({
      title: 'Errore',
      description: e?.data?.statusMessage ?? 'Impossibile reimpostare password',
      color: 'error',
    })
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

function formatDateBooking(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}
</script>
