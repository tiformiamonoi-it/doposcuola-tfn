<template>
  <div class="space-y-6">

    <!-- Loading stato -->
    <div v-if="pendingTutor" class="py-20 text-center">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-slate-300 mx-auto animate-spin" />
    </div>

    <template v-else-if="tutor">

      <!-- Header profilo -->
      <div>
        <div class="flex items-start justify-between">
          <div>
            <NuxtLink to="/tutor" class="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-1">
              <UIcon name="i-heroicons-arrow-left" class="w-3 h-3" /> Tutor
            </NuxtLink>
            <h2 class="text-xl font-semibold text-slate-900">
              {{ tutor.lastName }} {{ tutor.firstName }}
            </h2>
            <div class="flex items-center gap-4 mt-1 text-sm text-slate-500">
              <span v-if="tutor.email">{{ tutor.email }}</span>
              <span v-if="tutor.phone">{{ tutor.phone }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <UBadge :color="tutor.active ? 'success' : 'neutral'" variant="subtle">
              {{ tutor.active ? 'Attivo' : 'Inattivo' }}
            </UBadge>
            <UButton size="sm" variant="outline" icon="i-heroicons-pencil" @click="modalModificaAperto = true">
              Modifica
            </UButton>
            <UButton size="sm" icon="i-heroicons-banknotes" @click="apriLiquidaDettaglio">
              Liquida
            </UButton>
            <UDropdownMenu :items="menuAzioni">
              <UButton icon="i-heroicons-ellipsis-vertical" variant="ghost" size="sm" />
            </UDropdownMenu>
          </div>
        </div>

        <!-- Alert arretrati -->
        <UAlert
          v-if="arretratiTotali > 0.01"
          color="error"
          variant="soft"
          icon="i-heroicons-exclamation-triangle"
          class="mt-3"
        >
          <template #title>{{ mesiArretrati }} mes{{ mesiArretrati === 1 ? 'e' : 'i' }} non pagat{{ mesiArretrati === 1 ? 'o' : 'i' }} — € {{ arretratiTotali.toFixed(2) }} da liquidare</template>
        </UAlert>
      </div>

      <!-- Tab -->
      <UTabs :items="tabs" class="w-full">

        <!-- ─── Tab ANAGRAFICA ─── -->
        <template #anagrafica>
          <div class="space-y-6 pt-4">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UCard>
                <div class="text-xs text-slate-400 mb-3 font-medium uppercase tracking-wide">Dati personali</div>
                <dl class="space-y-2 text-sm">
                  <div class="flex gap-2"><dt class="text-slate-400 w-32 shrink-0">Nome</dt><dd>{{ tutor.firstName }}</dd></div>
                  <div class="flex gap-2"><dt class="text-slate-400 w-32 shrink-0">Cognome</dt><dd>{{ tutor.lastName }}</dd></div>
                  <div class="flex gap-2"><dt class="text-slate-400 w-32 shrink-0">Email</dt><dd>{{ tutor.email }}</dd></div>
                  <div class="flex gap-2"><dt class="text-slate-400 w-32 shrink-0">Telefono</dt><dd>{{ tutor.phone ?? '—' }}</dd></div>
                  <div class="flex gap-2"><dt class="text-slate-400 w-32 shrink-0">Cod. Fiscale</dt><dd>{{ tutor.codiceFiscale ?? '—' }}</dd></div>
                  <div class="flex gap-2"><dt class="text-slate-400 w-32 shrink-0">P.IVA</dt><dd>{{ tutor.partitaIva ?? '—' }}</dd></div>
                  <div class="flex gap-2"><dt class="text-slate-400 w-32 shrink-0">Indirizzo</dt><dd>{{ [tutor.indirizzo, tutor.citta, tutor.cap].filter(Boolean).join(', ') || '—' }}</dd></div>
                </dl>
              </UCard>
              <UCard>
                <div class="text-xs text-slate-400 mb-3 font-medium uppercase tracking-wide">Compenso</div>
                <dl class="space-y-2 text-sm">
                  <div class="flex gap-2">
                    <dt class="text-slate-400 w-32 shrink-0">Modalità</dt>
                    <dd>{{ tutor.modalitaPagamento === 'ORE' ? 'A ore' : 'Forfait mensile' }}</dd>
                  </div>
                  <div v-if="tutor.modalitaPagamento === 'FORFAIT'" class="flex gap-2">
                    <dt class="text-slate-400 w-32 shrink-0">Importo</dt>
                    <dd>€ {{ tutor.importoForfait }}</dd>
                  </div>
                </dl>
                <div v-if="tutor.noteInterne" class="mt-4">
                  <div class="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">Note interne</div>
                  <p class="text-sm text-slate-600 whitespace-pre-wrap">{{ tutor.noteInterne }}</p>
                </div>
              </UCard>
            </div>

            <!-- Materie -->
            <UCard>
              <div class="flex items-center justify-between mb-3">
                <div class="text-xs text-slate-400 font-medium uppercase tracking-wide">Materie insegnate</div>
                <UButton size="xs" variant="ghost" icon="i-heroicons-pencil" @click="modalMaterieAperto = true">
                  Gestisci
                </UButton>
              </div>
              <div v-if="tutor.materie && tutor.materie.length > 0" class="flex flex-wrap gap-2">
                <UBadge v-for="m in tutor.materie" :key="m" variant="subtle" color="primary">{{ m }}</UBadge>
              </div>
              <p v-else class="text-sm text-slate-400">Nessuna materia registrata</p>
            </UCard>
          </div>
        </template>

        <!-- ─── Tab COMPENSI ─── -->
        <template #compensi>
          <div class="space-y-4 pt-4">
            <div v-if="pendingComp" class="py-8 text-center">
              <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-slate-300 mx-auto animate-spin" />
            </div>
            <template v-else>
              <!-- Cards riepilogo -->
              <div class="grid grid-cols-3 gap-4">
                <UCard>
                  <div class="text-xl font-bold text-slate-900">€ {{ totaleCompensoPagato.toFixed(2) }}</div>
                  <div class="text-xs text-slate-500 mt-0.5">Totale liquidato</div>
                </UCard>
                <UCard>
                  <div class="text-xl font-bold" :class="compensoMeseCorrente > 0 ? 'text-warning-600' : 'text-slate-900'">
                    € {{ compensoMeseCorrente.toFixed(2) }}
                  </div>
                  <div class="text-xs text-slate-500 mt-0.5">Da liquidare (mese)</div>
                </UCard>
                <UCard>
                  <div class="text-xl font-bold" :class="mesiArretrati > 0 ? 'text-error-600' : 'text-slate-900'">
                    {{ mesiArretrati }}
                  </div>
                  <div class="text-xs text-slate-500 mt-0.5">Mesi con arretrati</div>
                </UCard>
              </div>

              <!-- Tabella mesi -->
              <UCard :ui="{ body: 'p-0' }">
                <UTable :data="compensation" :columns="colonneComp">
                  <template #meseLabel-cell="{ row }">
                    <span class="font-medium text-slate-700 capitalize">{{ row.original.meseLabel }}</span>
                    <UBadge v-if="row.original.isMeseCorrente" size="xs" variant="subtle" color="info" class="ml-2">mese corrente</UBadge>
                  </template>
                  <template #compensoCalcolato-cell="{ row }">
                    <div class="text-sm">
                      <div class="font-medium">€ {{ row.original.compensoCalcolato }}</div>
                      <div v-if="tutor.modalitaPagamento === 'FORFAIT'" class="text-tfn-500 font-medium text-xs mt-0.5">Quota Forfait</div>
                      <div class="text-slate-400 text-xs">ore: € {{ row.original.compensoGrezzo.toFixed(2) }}</div>
                    </div>
                  </template>
                  <template #pagato-cell="{ row }">
                    <span>€ {{ row.original.pagato.toFixed(2) }}</span>
                  </template>
                  <template #residuo-cell="{ row }">
                    <span :class="row.original.residuo > 0.01 ? 'text-error-600 font-medium' : 'text-slate-400'">
                      € {{ row.original.residuo.toFixed(2) }}
                    </span>
                  </template>
                  <template #stato-cell="{ row }">
                    <UBadge :color="coloreStatoPagamento(row.original.stato)" variant="subtle" size="xs">
                      {{ row.original.stato }}
                    </UBadge>
                  </template>
                  <template #azioni-cell="{ row }">
                    <UButton
                      v-if="row.original.residuo > 0.01 || row.original.isMeseCorrente"
                      size="xs"
                      variant="ghost"
                      @click="apriLiquidaMese(row.original)"
                    >
                      Liquida
                    </UButton>
                  </template>
                </UTable>
              </UCard>

              <!-- Singoli compensi pagati (eliminabili) -->
              <UCard v-if="(tutorPayments ?? []).length" :ui="{ body: 'p-0' }">
                <template #header>
                  <span class="text-sm font-medium text-slate-700">Compensi pagati</span>
                </template>
                <div class="divide-y divide-slate-100">
                  <div
                    v-for="p in tutorPayments"
                    :key="p.id"
                    class="flex items-center justify-between px-4 py-2 text-sm"
                  >
                    <div>
                      <span class="font-medium text-slate-800">€ {{ parseFloat(p.importo).toFixed(2) }}</span>
                      <span class="text-slate-400 ml-2 capitalize">{{ new Date(p.mese).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }) }}</span>
                      <span class="text-slate-400 ml-2">{{ p.metodo }}</span>
                      <UBadge v-if="p.status === 'PRO_BONO'" size="xs" variant="subtle" color="neutral" class="ml-2">PRO BONO</UBadge>
                    </div>
                    <UButton
                      icon="i-heroicons-trash"
                      size="xs" color="error" variant="ghost"
                      title="Elimina compenso"
                      :loading="eliminandoCompenso === p.id"
                      @click="eliminaCompenso(p)"
                    />
                  </div>
                </div>
              </UCard>
            </template>
          </div>
        </template>

        <!-- ─── Tab RIMBORSI ─── -->
        <template #rimborsi>
          <div class="space-y-4 pt-4">
            <div class="flex justify-end">
              <UButton size="sm" icon="i-heroicons-plus" @click="modalNuovoRimborsoAperto = true">
                Nuovo rimborso
              </UButton>
            </div>
            <div v-if="pendingReimb" class="py-8 text-center">
              <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-slate-300 mx-auto animate-spin" />
            </div>
            <template v-else>
              <!-- Cards -->
              <div class="grid grid-cols-2 gap-4">
                <UCard>
                  <div class="text-xl font-bold text-slate-900">€ {{ totaleRimborsato.toFixed(2) }}</div>
                  <div class="text-xs text-slate-500 mt-0.5">Totale rimborsato</div>
                </UCard>
                <UCard>
                  <div class="text-xl font-bold" :class="rimborsiDaPagare > 0 ? 'text-warning-600' : 'text-slate-900'">
                    € {{ rimborsiDaPagare.toFixed(2) }}
                  </div>
                  <div class="text-xs text-slate-500 mt-0.5">Da rimborsare</div>
                </UCard>
              </div>

              <!-- Tabella rimborsi -->
              <UCard :ui="{ body: 'p-0' }">
                <UTable :data="reimbursements" :columns="colonneReimb">
                  <template #dataRichiesta-cell="{ row }">
                    {{ new Date(row.original.dataRichiesta).toLocaleDateString('it-IT') }}
                  </template>
                  <template #importo-cell="{ row }">€ {{ parseFloat(row.original.importo).toFixed(2) }}</template>
                  <template #importoPagato-cell="{ row }">€ {{ parseFloat(row.original.importoPagato).toFixed(2) }}</template>
                  <template #residuoReimb-cell="{ row }">
                    <span :class="(parseFloat(row.original.importo) - parseFloat(row.original.importoPagato)) > 0.01 ? 'text-error-600' : 'text-slate-400'">
                      € {{ (parseFloat(row.original.importo) - parseFloat(row.original.importoPagato)).toFixed(2) }}
                    </span>
                  </template>
                  <template #stato-cell="{ row }">
                    <UBadge :color="coloreStatoRimborso(row.original.stato)" variant="subtle" size="xs">
                      {{ row.original.stato }}
                    </UBadge>
                  </template>
                  <template #azioni-cell="{ row }">
                    <div class="flex items-center justify-end gap-1">
                      <UButton
                        v-if="row.original.stato !== 'PAGATO'"
                        size="xs"
                        variant="ghost"
                        @click="apriPagaRimborso(row.original)"
                      >
                        Paga
                      </UButton>
                      <UButton
                        icon="i-heroicons-trash"
                        size="xs" color="error" variant="ghost"
                        title="Elimina rimborso"
                        :loading="eliminandoRimborso === row.original.id"
                        @click="eliminaRimborso(row.original)"
                      />
                    </div>
                  </template>
                </UTable>
                <div v-if="reimbursements.length === 0" class="py-8 text-center text-sm text-slate-400">
                  Nessun rimborso registrato
                </div>
              </UCard>
            </template>
          </div>
        </template>

        <!-- ─── Tab STATISTICHE ─── -->
        <template #statistiche>
          <div class="space-y-4 pt-4">
            <div v-if="pendingPerf" class="py-8 text-center">
              <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-slate-300 mx-auto animate-spin" />
            </div>
            <template v-else>
              <!-- Performance mensile -->
              <UCard :ui="{ body: 'p-0' }">
                <div class="px-4 py-3 border-b border-slate-100 text-sm font-medium text-slate-700">
                  Performance ultimi 6 mesi
                </div>
                <UTable :data="performance" :columns="colonnePerf">
                  <template #meseLabel-cell="{ row }">
                    <span class="capitalize">{{ row.original.meseLabel }}</span>
                  </template>
                  <template #ricavo-cell="{ row }">€ {{ row.original.ricavo.toFixed(2) }}</template>
                  <template #compenso-cell="{ row }">€ {{ row.original.compenso.toFixed(2) }}</template>
                  <template #margine-cell="{ row }">
                    <span :class="row.original.margine >= 0 ? 'text-success-600' : 'text-error-600'">
                      € {{ row.original.margine.toFixed(2) }}
                    </span>
                  </template>
                  <template #marginePerc-cell="{ row }">
                    <span :class="row.original.marginePerc >= 0 ? 'text-success-600' : 'text-error-600'">
                      {{ row.original.marginePerc }}%
                    </span>
                  </template>
                </UTable>
              </UCard>

              <!-- Distribuzione tipo -->
              <UCard v-if="stats">
                <div class="text-xs text-slate-400 mb-3 font-medium uppercase tracking-wide">Distribuzione lezioni per tipo</div>
                <div class="space-y-3">
                  <div v-for="t in stats.distribuzioneTipo" :key="t.tipo">
                    <div class="flex justify-between text-sm mb-1">
                      <span class="font-medium">{{ t.tipo }}</span>
                      <span class="text-slate-500">{{ t.percentuale }}% ({{ t.oreTotali.toFixed(1) }} ore)</span>
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-2">
                      <div class="bg-tfn-500 h-2 rounded-full" :style="{ width: `${t.percentuale}%` }" />
                    </div>
                  </div>
                  <div v-if="stats.distribuzioneTipo.length === 0" class="text-sm text-slate-400">Nessun dato</div>
                </div>
              </UCard>

              <!-- Top 5 studenti -->
              <UCard v-if="stats && stats.topStudenti.length > 0">
                <div class="text-xs text-slate-400 mb-3 font-medium uppercase tracking-wide">Top 5 alunni seguiti</div>
                <div class="space-y-2">
                  <div v-for="s in stats.topStudenti" :key="s.id" class="flex items-center justify-between text-sm">
                    <NuxtLink :to="`/studenti/${s.id}`" class="text-slate-700 hover:text-tfn-600">
                      {{ s.lastName }} {{ s.firstName }}
                    </NuxtLink>
                    <div class="text-slate-500">
                      {{ s.numLezioni }} lezioni · {{ s.oreTotali.toFixed(1) }} ore
                    </div>
                  </div>
                </div>
              </UCard>
            </template>
          </div>
        </template>

      </UTabs>

    </template>

    <div v-else class="py-20 text-center text-slate-400">Tutor non trovato</div>

    <!-- ─── Modal Modifica Anagrafica ─── -->
    <UModal v-model:open="modalModificaAperto" title="Modifica tutor" :ui="{ width: 'max-w-xl' }">
      <template #body>
        <UForm :state="datiModifica" class="space-y-4" @submit="salvaTutor">
          <div class="grid grid-cols-2 gap-4">
            <UFormField name="firstName" label="Nome"><UInput v-model="datiModifica.firstName" class="w-full" /></UFormField>
            <UFormField name="lastName" label="Cognome"><UInput v-model="datiModifica.lastName" class="w-full" /></UFormField>
          </div>
          <UFormField name="email" label="Email"><UInput v-model="datiModifica.email" type="email" class="w-full" /></UFormField>
          <UFormField name="phone" label="Telefono"><UInput v-model="datiModifica.phone" class="w-full" /></UFormField>
          <div class="grid grid-cols-2 gap-4">
            <UFormField name="codiceFiscale" label="Cod. Fiscale"><UInput v-model="datiModifica.codiceFiscale" class="w-full" /></UFormField>
            <UFormField name="partitaIva" label="P.IVA"><UInput v-model="datiModifica.partitaIva" class="w-full" /></UFormField>
          </div>
          <UFormField name="indirizzo" label="Indirizzo"><UInput v-model="datiModifica.indirizzo" class="w-full" /></UFormField>
          <div class="grid grid-cols-2 gap-4">
            <UFormField name="citta" label="Città"><UInput v-model="datiModifica.citta" class="w-full" /></UFormField>
            <UFormField name="cap" label="CAP"><UInput v-model="datiModifica.cap" class="w-full" /></UFormField>
          </div>
          <UFormField name="modalitaPagamento" label="Modalità compenso">
            <USelect
              v-model="datiModifica.modalitaPagamento"
              :items="[{ label: 'A ore', value: 'ORE' }, { label: 'Forfait mensile', value: 'FORFAIT' }]"
              class="w-full"
            />
          </UFormField>
          <UFormField v-if="datiModifica.modalitaPagamento === 'FORFAIT'" name="importoForfait" label="Importo forfait (€)">
            <UInput v-model="datiModifica.importoForfait" type="number" class="w-full" />
          </UFormField>
          <UFormField name="noteInterne" label="Note interne">
            <UTextarea v-model="datiModifica.noteInterne" :rows="3" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-3 pt-2">
            <UButton variant="ghost" @click="modalModificaAperto = false">Annulla</UButton>
            <UButton type="submit" :loading="salvando">Salva</UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- ─── Modal Gestisci Materie ─── -->
    <UModal v-model:open="modalMaterieAperto" title="Gestisci materie" :ui="{ width: 'max-w-md' }">
      <template #body>
        <div class="space-y-4">
          <div class="flex gap-2">
            <USelectMenu
              v-model="materiaSelezionata"
              :items="materieNonAssegnate"
              placeholder="Seleziona dal pool globale..."
              class="flex-1"
            />
            <UButton @click="aggiungiMateriaSelezionata" :disabled="!materiaSelezionata">Aggiungi</UButton>
          </div>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="(m, i) in materieLocali"
              :key="i"
              class="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-sm px-3 py-1 rounded-full"
            >
              {{ m }}
              <button class="text-slate-400 hover:text-error-500" @click="rimuoviMateria(i)">×</button>
            </span>
            <span v-if="materieLocali.length === 0" class="text-sm text-slate-400">Nessuna materia</span>
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <UButton variant="ghost" @click="modalMaterieAperto = false">Annulla</UButton>
            <UButton :loading="salvando" @click="salvaMaterie">Salva materie</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- ─── Modal Liquida Mese (dettaglio) ─── -->
    <UModal v-model:open="modalLiquidaDettaglioAperto" title="Liquida mese" :ui="{ width: 'max-w-md' }">
      <template #body>
        <UForm :state="datiLiquidaDettaglio" class="space-y-4" @submit="confermaLiquidaDettaglio">
          <UFormField name="mese" label="Mese">
            <UInput v-model="datiLiquidaDettaglio.mese" type="month" class="w-full" />
          </UFormField>
          <UFormField name="importo" label="Importo (€)">
            <UInput v-model="datiLiquidaDettaglio.importo" type="number" step="0.01" class="w-full" />
          </UFormField>
          <UFormField name="metodo" label="Metodo">
            <USelect v-model="datiLiquidaDettaglio.metodo" :items="metodiPagamento" class="w-full" />
          </UFormField>
          <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <UCheckbox v-model="datiLiquidaDettaglio.proBono" />
            Pro Bono
          </label>
          <UFormField name="note" label="Note">
            <UTextarea v-model="datiLiquidaDettaglio.note" :rows="2" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-3 pt-2">
            <UButton variant="ghost" @click="modalLiquidaDettaglioAperto = false">Annulla</UButton>
            <UButton type="submit" :loading="salvando">Conferma</UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- ─── Modal Nuovo Rimborso ─── -->
    <UModal v-model:open="modalNuovoRimborsoAperto" title="Nuovo rimborso spese" :ui="{ width: 'max-w-md' }">
      <template #body>
        <UForm :state="datiNuovoRimborso" class="space-y-4" @submit="creaNuovoRimborso">
          <UFormField name="importo" label="Importo (€)" required>
            <UInput v-model="datiNuovoRimborso.importo" type="number" step="0.01" class="w-full" />
          </UFormField>
          <UFormField name="descrizione" label="Descrizione" required>
            <UInput v-model="datiNuovoRimborso.descrizione" placeholder="Es. Carburante, materiali..." class="w-full" />
          </UFormField>
          <UFormField name="dataRichiesta" label="Data richiesta">
            <UInput v-model="datiNuovoRimborso.dataRichiesta" type="date" class="w-full" />
          </UFormField>
          <UFormField name="note" label="Note">
            <UTextarea v-model="datiNuovoRimborso.note" :rows="2" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-3 pt-2">
            <UButton variant="ghost" @click="modalNuovoRimborsoAperto = false">Annulla</UButton>
            <UButton type="submit" :loading="salvando">Registra rimborso</UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- ─── Modal Paga Rimborso ─── -->
    <UModal v-model:open="modalPagaRimborsoAperto" title="Paga rimborso" :ui="{ width: 'max-w-sm' }">
      <template #body>
        <UForm :state="datiPagaRimborso" class="space-y-4" @submit="confermaPagaRimborso">
          <div v-if="rimborsoSelezionato" class="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
            {{ rimborsoSelezionato.descrizione }} —
            residuo: € {{ (parseFloat(rimborsoSelezionato.importo) - parseFloat(rimborsoSelezionato.importoPagato)).toFixed(2) }}
          </div>
          <UFormField name="importoPagamento" label="Importo pagato (€)">
            <UInput v-model="datiPagaRimborso.importoPagamento" type="number" step="0.01" class="w-full" />
          </UFormField>
          <UFormField name="metodo" label="Metodo">
            <USelect v-model="datiPagaRimborso.metodo" :items="metodiPagamento" class="w-full" />
          </UFormField>
          <UFormField name="note" label="Note">
            <UTextarea v-model="datiPagaRimborso.note" :rows="2" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-3 pt-2">
            <UButton variant="ghost" @click="modalPagaRimborsoAperto = false">Annulla</UButton>
            <UButton type="submit" :loading="salvando">Conferma pagamento</UButton>
          </div>
        </UForm>
      </template>
    </UModal>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['admin-or-super'] })

const route = useRoute()
const toast = useToast()
const { user: sessionUser } = useUserSession()

const id = route.params.id as string

// Protezione TUTOR: vede solo sé stesso
if (sessionUser.value?.role === 'TUTOR' && String(sessionUser.value?.id) !== id) {
  await navigateTo('/')
}

// ─── Fetch dati principali ─────────────────────
const { data: tutor, pending: pendingTutor, refresh: refreshTutor } = useLazyFetch(`/api/tutors/${id}`, {
  default: () => null,
})
const { data: compensation, pending: pendingComp, refresh: refreshComp } = useLazyFetch(`/api/tutors/${id}/compensation`, {
  default: () => [] as any[],
})
const { data: reimbursements, pending: pendingReimb, refresh: refreshReimb } = useLazyFetch(`/api/tutors/${id}/reimbursements`, {
  default: () => [] as any[],
})
const { data: tutorPayments, refresh: refreshTutorPayments } = useLazyFetch(`/api/tutors/${id}/payments`, {
  default: () => [] as any[],
})
const eliminandoCompenso = ref<string | null>(null)

async function eliminaCompenso(p: any) {
  if (!confirm(`Eliminare il compenso di € ${parseFloat(p.importo).toFixed(2)}? Verrà rimosso anche il movimento contabile collegato.`)) return
  eliminandoCompenso.value = p.id
  try {
    await $fetch(`/api/tutor-payments/${p.id}`, { method: 'DELETE' })
    toast.add({ title: 'Compenso eliminato', color: 'success' })
    refreshTutorPayments()
    refreshComp()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Eliminazione non riuscita', color: 'error' })
  } finally {
    eliminandoCompenso.value = null
  }
}
const { data: performance, pending: pendingPerf } = useLazyFetch(`/api/tutors/${id}/performance`, {
  default: () => [] as any[],
})
const { data: stats } = useLazyFetch(`/api/tutors/${id}/stats`, {
  default: () => null as any,
})

// ─── Computed KPI ──────────────────────────────
const arretratiTotali = computed(() =>
  (compensation.value ?? []).reduce((s: number, m: any) => s + (m.residuo > 0.01 && !m.isMeseCorrente ? m.residuo : 0), 0)
)
const mesiArretrati = computed(() =>
  (compensation.value ?? []).filter((m: any) => m.residuo > 0.01 && !m.isMeseCorrente).length
)
const totaleCompensoPagato = computed(() =>
  (compensation.value ?? []).reduce((s: number, m: any) => s + m.pagato, 0)
)
const compensoMeseCorrente = computed(() =>
  (compensation.value ?? []).find((m: any) => m.isMeseCorrente)?.residuo ?? 0
)
const totaleRimborsato = computed(() =>
  (reimbursements.value ?? []).reduce((s: number, r: any) => s + parseFloat(r.importoPagato), 0)
)
const rimborsiDaPagare = computed(() =>
  (reimbursements.value ?? []).reduce((s: number, r: any) =>
    s + Math.max(0, parseFloat(r.importo) - parseFloat(r.importoPagato)), 0)
)

// ─── Tab ──────────────────────────────────────
const tabs = [
  { label: 'Anagrafica', slot: 'anagrafica' },
  { label: 'Compensi',   slot: 'compensi' },
  { label: 'Rimborsi',   slot: 'rimborsi' },
  { label: 'Statistiche', slot: 'statistiche' },
]

// ─── Colonne tabelle ──────────────────────────
const colonneComp = [
  { id: 'meseLabel',         header: 'Mese' },
  { id: 'numLezioni',        header: 'Lezioni' },
  { id: 'compensoCalcolato', header: 'Compenso' },
  { id: 'pagato',            header: 'Liquidato' },
  { id: 'residuo',           header: 'Residuo' },
  { id: 'stato',             header: 'Stato' },
  { id: 'azioni',            header: '' },
]
const colonneReimb = [
  { id: 'dataRichiesta',  header: 'Data' },
  { id: 'descrizione',    header: 'Descrizione' },
  { id: 'importo',        header: 'Importo' },
  { id: 'importoPagato',  header: 'Pagato' },
  { id: 'residuoReimb',   header: 'Residuo' },
  { id: 'stato',          header: 'Stato' },
  { id: 'azioni',         header: '' },
]
const colonnePerf = [
  { id: 'meseLabel',   header: 'Mese' },
  { id: 'numLezioni',  header: 'Lezioni' },
  { id: 'numStudenti', header: 'Studenti' },
  { id: 'ricavo',      header: 'Ricavo generato' },
  { id: 'compenso',    header: 'Compenso' },
  { id: 'margine',     header: 'Margine' },
  { id: 'marginePerc', header: '%' },
]

// ─── Helper colori badge ──────────────────────
function coloreStatoPagamento(stato: string) {
  if (stato === 'PAGATO')   return 'success'
  if (stato === 'PARZIALE') return 'warning'
  if (stato === 'PRO_BONO') return 'neutral'
  return 'error'
}
function coloreStatoRimborso(stato: string) {
  if (stato === 'PAGATO')   return 'success'
  if (stato === 'PARZIALE') return 'warning'
  return 'error'
}

// ─── Metodi pagamento ─────────────────────────
const metodiPagamento = [
  { label: 'Contanti', value: 'CONTANTI' },
  { label: 'Bonifico', value: 'BONIFICO' },
  { label: 'POS',      value: 'POS' },
  { label: 'Assegno',  value: 'ASSEGNO' },
  { label: 'Altro',    value: 'ALTRO' },
]

// ─── Modal Modifica ───────────────────────────
const modalModificaAperto = ref(false)
const salvando = ref(false)
const datiModifica = reactive({
  firstName: tutor.value?.firstName ?? '',
  lastName: tutor.value?.lastName ?? '',
  email: tutor.value?.email ?? '',
  phone: tutor.value?.phone ?? '',
  codiceFiscale: tutor.value?.codiceFiscale ?? '',
  partitaIva: tutor.value?.partitaIva ?? '',
  indirizzo: tutor.value?.indirizzo ?? '',
  citta: tutor.value?.citta ?? '',
  cap: tutor.value?.cap ?? '',
  modalitaPagamento: tutor.value?.modalitaPagamento ?? 'ORE',
  importoForfait: tutor.value?.importoForfait ?? '',
  noteInterne: tutor.value?.noteInterne ?? '',
})

watch(tutor, (t) => {
  if (!t) return
  Object.assign(datiModifica, {
    firstName: t.firstName ?? '',
    lastName: t.lastName ?? '',
    email: t.email ?? '',
    phone: t.phone ?? '',
    codiceFiscale: t.codiceFiscale ?? '',
    partitaIva: t.partitaIva ?? '',
    indirizzo: t.indirizzo ?? '',
    citta: t.citta ?? '',
    cap: t.cap ?? '',
    modalitaPagamento: t.modalitaPagamento ?? 'ORE',
    importoForfait: t.importoForfait ?? '',
    noteInterne: t.noteInterne ?? '',
  })
})

async function salvaTutor() {
  salvando.value = true
  try {
    await $fetch(`/api/tutors/${id}`, {
      method: 'PUT',
      body: {
        ...datiModifica,
        phone: datiModifica.phone || null,
        codiceFiscale: datiModifica.codiceFiscale || null,
        partitaIva: datiModifica.partitaIva || null,
        indirizzo: datiModifica.indirizzo || null,
        citta: datiModifica.citta || null,
        cap: datiModifica.cap || null,
        importoForfait: datiModifica.importoForfait || null,
        noteInterne: datiModifica.noteInterne || null,
      },
    })
    toast.add({ title: 'Tutor aggiornato', color: 'success' })
    modalModificaAperto.value = false
    refreshTutor()
  } catch {
    toast.add({ title: 'Errore nel salvataggio', color: 'error' })
  } finally {
    salvando.value = false
  }
}

// ─── Modal Materie ────────────────────────────
const modalMaterieAperto = ref(false)
const materiaSelezionata = ref('')
const materieLocali = ref<string[]>([...((tutor.value?.materie as string[]) ?? [])])

// Fetch materie globali
const { data: configsData } = useLazyFetch('/api/settings/configs', { default: () => ({}) })
const materieDisponibili = computed<string[]>(() => {
  try { return JSON.parse(configsData.value?.materie || '[]') } catch { return [] }
})
const materieNonAssegnate = computed(() => materieDisponibili.value.filter(m => !materieLocali.value.includes(m)))

watch(tutor, (t) => {
  materieLocali.value = [...((t?.materie as string[]) ?? [])]
})

function aggiungiMateriaSelezionata() {
  const m = materiaSelezionata.value
  if (m && !materieLocali.value.includes(m)) {
    materieLocali.value.push(m)
    materiaSelezionata.value = ''
  }
}
function rimuoviMateria(i: number) {
  materieLocali.value.splice(i, 1)
}
async function salvaMaterie() {
  salvando.value = true
  try {
    await $fetch(`/api/tutors/${id}`, {
      method: 'PUT',
      body: { materie: materieLocali.value },
    })
    toast.add({ title: 'Materie aggiornate', color: 'success' })
    modalMaterieAperto.value = false
    refreshTutor()
  } catch {
    toast.add({ title: 'Errore nel salvataggio', color: 'error' })
  } finally {
    salvando.value = false
  }
}

// ─── Modal Liquida (dettaglio e lista compensi) ─
const modalLiquidaDettaglioAperto = ref(false)
const now = new Date()
const datiLiquidaDettaglio = reactive({
  mese:    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  importo: '',
  metodo:  'BONIFICO',
  proBono: false,
  note:    '',
})

function apriLiquidaDettaglio() {
  const meseCorr = (compensation.value ?? []).find((m: any) => m.isMeseCorrente)
  const oggi = new Date()
  datiLiquidaDettaglio.mese = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}`
  if (meseCorr) datiLiquidaDettaglio.importo = String(meseCorr.residuo)
  modalLiquidaDettaglioAperto.value = true
}

function apriLiquidaMese(mese: any) {
  datiLiquidaDettaglio.mese = mese.mese
  datiLiquidaDettaglio.importo = String(mese.residuo)
  modalLiquidaDettaglioAperto.value = true
}

async function confermaLiquidaDettaglio() {
  salvando.value = true
  try {
    const [anno, meseNum] = datiLiquidaDettaglio.mese.split('-').map(Number)
    const meseISO = new Date(anno!, meseNum! - 1, 1).toISOString()
    await $fetch(`/api/tutors/${id}/pay`, {
      method: 'POST',
      body: {
        mese:    meseISO,
        importo: datiLiquidaDettaglio.proBono ? '0' : datiLiquidaDettaglio.importo,
        metodo:  datiLiquidaDettaglio.metodo,
        proBono: datiLiquidaDettaglio.proBono,
        note:    datiLiquidaDettaglio.note || undefined,
      },
    })
    toast.add({ title: 'Liquidazione registrata', color: 'success' })
    modalLiquidaDettaglioAperto.value = false
    refreshComp()
    refreshTutor()
    refreshTutorPayments()
  } catch {
    toast.add({ title: 'Errore nella liquidazione', color: 'error' })
  } finally {
    salvando.value = false
  }
}

// ─── Modal Nuovo Rimborso ─────────────────────
const modalNuovoRimborsoAperto = ref(false)
const datiNuovoRimborso = reactive({
  importo:       '',
  descrizione:   '',
  dataRichiesta: new Date().toISOString().substring(0, 10),
  note:          '',
})

async function creaNuovoRimborso() {
  if (!datiNuovoRimborso.importo || !datiNuovoRimborso.descrizione) {
    toast.add({ title: 'Importo e descrizione obbligatori', color: 'error' })
    return
  }
  salvando.value = true
  try {
    await $fetch(`/api/tutors/${id}/reimbursements`, {
      method: 'POST',
      body: { ...datiNuovoRimborso },
    })
    toast.add({ title: 'Rimborso registrato', color: 'success' })
    modalNuovoRimborsoAperto.value = false
    Object.assign(datiNuovoRimborso, { importo: '', descrizione: '', dataRichiesta: new Date().toISOString().substring(0, 10), note: '' })
    refreshReimb()
  } catch {
    toast.add({ title: 'Errore nel salvataggio', color: 'error' })
  } finally {
    salvando.value = false
  }
}

// ─── Elimina rimborso ─────────────────────────
const eliminandoRimborso = ref<string | null>(null)

async function eliminaRimborso(r: any) {
  if (!confirm(`Eliminare il rimborso "${r.descrizione}"? Verranno eliminati anche i relativi movimenti contabili.`)) return
  eliminandoRimborso.value = r.id
  try {
    await $fetch(`/api/tutors/${id}/reimbursements/${r.id}`, { method: 'DELETE' })
    toast.add({ title: 'Rimborso eliminato', color: 'success' })
    refreshReimb()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Eliminazione non riuscita', color: 'error' })
  } finally {
    eliminandoRimborso.value = null
  }
}

// ─── Modal Paga Rimborso ──────────────────────
const modalPagaRimborsoAperto = ref(false)
const rimborsoSelezionato = ref<any>(null)
const datiPagaRimborso = reactive({ importoPagamento: '', metodo: 'BONIFICO', note: '' })

function apriPagaRimborso(r: any) {
  rimborsoSelezionato.value = r
  const residuo = parseFloat(r.importo) - parseFloat(r.importoPagato)
  datiPagaRimborso.importoPagamento = residuo.toFixed(2)
  datiPagaRimborso.metodo = 'BONIFICO'
  datiPagaRimborso.note = ''
  modalPagaRimborsoAperto.value = true
}

async function confermaPagaRimborso() {
  if (!rimborsoSelezionato.value) return
  salvando.value = true
  try {
    await $fetch(`/api/tutors/${id}/reimbursements/${rimborsoSelezionato.value.id}/pay`, {
      method: 'POST',
      body: { ...datiPagaRimborso },
    })
    toast.add({ title: 'Rimborso pagato', color: 'success' })
    modalPagaRimborsoAperto.value = false
    refreshReimb()
  } catch {
    toast.add({ title: 'Errore nel pagamento', color: 'error' })
  } finally {
    salvando.value = false
  }
}

// ─── Menu azioni header ───────────────────────
const menuAzioni = computed(() => [[
  {
    label: tutor.value?.active ? 'Disattiva tutor' : 'Riattiva tutor',
    icon: tutor.value?.active ? 'i-heroicons-pause-circle' : 'i-heroicons-play-circle',
    onSelect: () => toggleAttivo(),
  },
]])

async function toggleAttivo() {
  try {
    if (tutor.value?.active) {
      await $fetch(`/api/tutors/${id}`, { method: 'DELETE' })
      toast.add({ title: 'Tutor disattivato', color: 'info' })
    } else {
      await $fetch(`/api/tutors/${id}`, { method: 'PUT', body: { active: true } })
      toast.add({ title: 'Tutor riattivato', color: 'success' })
    }
    refreshTutor()
  } catch (err: any) {
    toast.add({ title: err.data?.statusMessage ?? 'Errore aggiornamento stato', color: 'error' })
  }
}
</script>
