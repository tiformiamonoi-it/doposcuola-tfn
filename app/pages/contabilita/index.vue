<template>
  <div class="space-y-6">

    <!-- Intestazione -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold text-slate-900">Contabilità</h2>
        <p class="text-sm text-slate-500 mt-0.5">Cruscotto finanziario e gestione movimenti</p>
      </div>
      <div class="flex items-center gap-2">
        <UButton icon="i-heroicons-arrow-path" variant="outline" size="sm" :loading="pending" @click="refreshAll">
          Aggiorna
        </UButton>
        <UButton icon="i-heroicons-plus" size="sm" @click="modalNuovoMovimentoAperto = true">
          Nuovo Movimento
        </UButton>
      </div>
    </div>

    <!-- ─── BARRA PERIODO (comanda card + lista movimenti) ─── -->
    <div class="flex flex-wrap items-end gap-3 bg-white rounded-xl ring-1 ring-slate-200 shadow-sm p-4">
      <UFormField label="Dal">
        <UInput type="date" v-model="periodo.dataInizio" @change="onPeriodoChange" />
      </UFormField>
      <UFormField label="Al">
        <UInput type="date" v-model="periodo.dataFine" @change="onPeriodoChange" />
      </UFormField>
      <UButton icon="i-heroicons-arrow-uturn-left" variant="soft" color="neutral" @click="azzeraFiltri">
        Azzera filtri
      </UButton>
      <p class="text-xs text-slate-400 ml-auto self-center">
        Di default: dal 1° gennaio {{ annoCorrente }} a oggi
      </p>
    </div>

    <!-- Skeleton caricamento -->
    <template v-if="pending">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <USkeleton v-for="i in 3" :key="i" class="h-28 rounded-xl" />
      </div>
      <USkeleton class="h-48 rounded-xl" />
    </template>

    <template v-else-if="dash">

      <!-- ─── PERIODO SELEZIONATO: 4 KPI sempre visibili ─── -->
      <div>
        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Periodo selezionato</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          <UCard class="bg-green-50 border-green-100">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs text-green-600 font-medium uppercase tracking-wide flex items-center gap-1">Entrate
                  <StatHelp text="Tutti i soldi incassati nel periodo scelto (pagamenti pacchetti e altre entrate). Gli storni sono già sottratti." />
                </p>
                <p class="text-2xl font-bold text-green-700 mt-1">
                  € {{ fmt(dash.periodo.entrate) }}
                </p>
                <p v-if="proventiEntrate > 0" class="text-[11px] font-semibold text-green-600 mt-1">
                  + € {{ fmt(proventiEntrate) }} da proventi diversi (a parte)
                </p>
              </div>
              <UIcon name="i-heroicons-arrow-trending-up" class="w-6 h-6 text-green-400" />
            </div>
          </UCard>

          <UCard class="bg-red-50 border-red-100">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs text-red-600 font-medium uppercase tracking-wide flex items-center gap-1">Uscite
                  <StatHelp text="Tutti i soldi usciti nel periodo scelto: compensi tutor pagati, spese, rimborsi." />
                </p>
                <p class="text-2xl font-bold text-red-700 mt-1">
                  € {{ fmt(dash.periodo.uscite) }}
                </p>
                <p v-if="proventiUscite > 0" class="text-[11px] font-semibold text-red-500 mt-1">
                  − € {{ fmt(proventiUscite) }} costi per proventi diversi (a parte)
                </p>
              </div>
              <UIcon name="i-heroicons-arrow-trending-down" class="w-6 h-6 text-red-400" />
            </div>
          </UCard>

          <UCard :class="dash.periodo.margine >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs font-medium uppercase tracking-wide flex items-center gap-1" :class="dash.periodo.margine >= 0 ? 'text-blue-600' : 'text-orange-600'">
                  Margine netto
                  <StatHelp text="Entrate meno uscite del periodo: quello che resta prima di costi fissi e tasse." />
                </p>
                <p class="text-2xl font-bold mt-1" :class="dash.periodo.margine >= 0 ? 'text-blue-700' : 'text-orange-700'">
                  € {{ fmt(dash.periodo.margine) }}
                </p>
              </div>
              <UIcon name="i-heroicons-scale" class="w-6 h-6" :class="dash.periodo.margine >= 0 ? 'text-blue-400' : 'text-orange-400'" />
            </div>
          </UCard>

          <!-- E7 — Break-even (margine - costi fissi) -->
          <UCard :class="dash.breakEven >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs font-medium uppercase tracking-wide flex items-center gap-1" :class="dash.breakEven >= 0 ? 'text-emerald-600' : 'text-rose-600'">
                  Break-even
                  <StatHelp text="Margine meno i costi fissi del periodo (affitto, utenze…). Se è positivo, l'attività si sta ripagando da sola." />
                </p>
                <p class="text-2xl font-bold mt-1" :class="dash.breakEven >= 0 ? 'text-emerald-700' : 'text-rose-700'">
                  € {{ fmt(dash.breakEven) }}
                </p>
                <p class="text-[11px] mt-1" :class="dash.breakEven >= 0 ? 'text-emerald-400' : 'text-rose-400'">
                  Margine − € {{ fmt(dash.costiFissi.periodo) }} costi fissi
                </p>
              </div>
              <UIcon name="i-heroicons-presentation-chart-line" class="w-6 h-6" :class="dash.breakEven >= 0 ? 'text-emerald-400' : 'text-rose-400'" />
            </div>
          </UCard>

        </div>
      </div>

      <!-- ─── ALTRI INDICATORI DEL PERIODO (richiudibile) ─── -->
      <UCollapsible v-model:open="sezioniAperte.altri">
        <button type="button" class="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors">
          <UIcon name="i-heroicons-chevron-right" class="w-3.5 h-3.5 transition-transform" :class="sezioniAperte.altri ? 'rotate-90' : ''" />
          Altri indicatori del periodo
        </button>
        <template #content>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">

            <!-- Costi fissi mensili -->
            <UCard class="bg-slate-50 border-slate-200">
              <div class="flex items-start justify-between">
                <div>
                  <p class="text-xs text-slate-500 font-medium uppercase tracking-wide flex items-center gap-1">Costi fissi mensili
                    <StatHelp text="Le spese fisse impostate in Impostazioni (affitto, utenze…). Qui vedi il valore mensile e il totale sul periodo scelto." />
                  </p>
                  <p class="text-2xl font-bold text-slate-700 mt-1">
                    € {{ fmt(dash.costiFissi.mensili) }}
                  </p>
                  <p class="text-[11px] text-slate-400 mt-1">
                    € {{ fmt(dash.costiFissi.periodo) }} in {{ dash.costiFissi.mesi }} mesi
                  </p>
                </div>
                <UIcon name="i-heroicons-building-office" class="w-6 h-6 text-slate-400" />
              </div>
            </UCard>

            <!-- E4 — Tasse stimate (25% entrate; i proventi diversi sono mostrati a parte come +X) -->
            <UCard class="bg-violet-50 border-violet-100">
              <div class="flex items-start justify-between">
                <div>
                  <p class="text-xs text-violet-600 font-medium uppercase tracking-wide flex items-center gap-1">Tasse stimate
                    <StatHelp text="Stima prudenziale: il 25% delle entrate del periodo. I proventi diversi sono indicati a parte come +X. Non è un calcolo fiscale ufficiale — serve solo a non farsi sorprendere." />
                  </p>
                  <p class="text-2xl font-bold text-violet-700 mt-1">
                    € {{ fmt(dash.periodo.entrate * 0.25) }}
                  </p>
                  <p class="text-[11px] text-violet-400 mt-1">~25% delle entrate</p>
                  <p v-if="proventiEntrate > 0" class="text-[11px] font-semibold text-violet-600 mt-0.5">
                    + € {{ fmt(proventiEntrate * 0.25) }} da proventi diversi
                  </p>
                </div>
                <UIcon name="i-heroicons-calculator" class="w-6 h-6 text-violet-400" />
              </div>
            </UCard>

            <UCard :class="dash.fattureInAttesa.count > 0 ? 'bg-yellow-50 border-yellow-100' : 'bg-slate-50'">
              <div class="flex items-start justify-between">
                <div>
                  <p class="text-xs font-medium uppercase tracking-wide flex items-center gap-1" :class="dash.fattureInAttesa.count > 0 ? 'text-yellow-600' : 'text-slate-400'">
                    Fatture da emettere
                    <StatHelp text="Pagamenti per cui il cliente ha chiesto fattura e che non risultano ancora emesse. La lista completa è in fondo alla pagina." />
                  </p>
                  <p class="text-2xl font-bold mt-1" :class="dash.fattureInAttesa.count > 0 ? 'text-yellow-700' : 'text-slate-600'">
                    {{ dash.fattureInAttesa.count }}
                  </p>
                </div>
                <UIcon name="i-heroicons-document-text" class="w-6 h-6" :class="dash.fattureInAttesa.count > 0 ? 'text-yellow-400' : 'text-slate-300'" />
              </div>
            </UCard>

            <!-- Fatturato: tutte le fatture segnate come emesse (storico) -->
            <UCard class="bg-teal-50 border-teal-100">
              <div class="flex items-start justify-between">
                <div>
                  <p class="text-xs text-teal-600 font-medium uppercase tracking-wide flex items-center gap-1">
                    Fatturato
                    <StatHelp text="Numero e somma di tutte le fatture segnate come emesse, dall'inizio dell'attività (non dipende dal periodo scelto)." />
                  </p>
                  <p class="text-2xl font-bold text-teal-700 mt-1">
                    € {{ fmt(dash.fatturato?.totale ?? 0) }}
                  </p>
                  <p class="text-[11px] text-teal-400 mt-1">{{ dash.fatturato?.count ?? 0 }} fatture emesse</p>
                </div>
                <UIcon name="i-heroicons-document-check" class="w-6 h-6 text-teal-400" />
              </div>
            </UCard>

          </div>
        </template>
      </UCollapsible>

      <!-- ─── BREAKDOWN DOPOSCUOLA vs MARKETING (richiudibile) ─── -->
      <UCollapsible v-if="dash.breakdown" v-model:open="sezioniAperte.aree" class="mt-2">
        <button type="button" class="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors">
          <UIcon name="i-heroicons-chevron-right" class="w-3.5 h-3.5 transition-transform" :class="sezioniAperte.aree ? 'rotate-90' : ''" />
          Suddivisione area (nel periodo)
        </button>
        <template #content>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">

          <UCard class="bg-teal-50 border-teal-100">
            <div class="flex items-center gap-2 mb-3">
              <UIcon name="i-heroicons-academic-cap" class="w-5 h-5 text-teal-500" />
              <p class="text-sm font-semibold text-teal-700">Doposcuola</p>
              <span class="text-[11px] text-teal-400">(eccetto marketing e proventi diversi)</span>
              <StatHelp text="Entrate, uscite e margine del periodo per l'attività principale: tutte le categorie tranne marketing e proventi diversi." />
            </div>
            <div class="grid grid-cols-3 gap-2 text-center">
              <div>
                <p class="text-[10px] text-green-600 uppercase font-medium">Entrate</p>
                <p class="text-lg font-bold text-green-700">€ {{ fmt(dash.breakdown.doposcuola.entrate) }}</p>
              </div>
              <div>
                <p class="text-[10px] text-red-600 uppercase font-medium">Uscite</p>
                <p class="text-lg font-bold text-red-700">€ {{ fmt(dash.breakdown.doposcuola.uscite) }}</p>
              </div>
              <div>
                <p class="text-[10px] uppercase font-medium" :class="dash.breakdown.doposcuola.margine >= 0 ? 'text-blue-600' : 'text-orange-600'">Margine</p>
                <p class="text-lg font-bold" :class="dash.breakdown.doposcuola.margine >= 0 ? 'text-blue-700' : 'text-orange-700'">€ {{ fmt(dash.breakdown.doposcuola.margine) }}</p>
              </div>
            </div>
          </UCard>

          <UCard class="bg-purple-50 border-purple-100">
            <div class="flex items-center gap-2 mb-3">
              <UIcon name="i-heroicons-megaphone" class="w-5 h-5 text-purple-500" />
              <p class="text-sm font-semibold text-purple-700">Marketing</p>
              <span class="text-[11px] text-purple-400">(categoria = marketing)</span>
              <StatHelp text="Solo i movimenti con categoria marketing: quanto spendi (e incassi) per promuovere l'attività." />
            </div>
            <div class="grid grid-cols-3 gap-2 text-center">
              <div>
                <p class="text-[10px] text-green-600 uppercase font-medium">Entrate</p>
                <p class="text-lg font-bold text-green-700">€ {{ fmt(dash.breakdown.marketing.entrate) }}</p>
              </div>
              <div>
                <p class="text-[10px] text-red-600 uppercase font-medium">Uscite</p>
                <p class="text-lg font-bold text-red-700">€ {{ fmt(dash.breakdown.marketing.uscite) }}</p>
              </div>
              <div>
                <p class="text-[10px] uppercase font-medium" :class="dash.breakdown.marketing.margine >= 0 ? 'text-blue-600' : 'text-orange-600'">Margine</p>
                <p class="text-lg font-bold" :class="dash.breakdown.marketing.margine >= 0 ? 'text-blue-700' : 'text-orange-700'">€ {{ fmt(dash.breakdown.marketing.margine) }}</p>
              </div>
            </div>
          </UCard>

        </div>
        </template>
      </UCollapsible>

      <!-- ─── MOVIMENTI PER METODO (richiudibile) ─── -->
      <UCollapsible v-model:open="sezioniAperte.metodi">
        <button type="button" class="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors">
          <UIcon name="i-heroicons-chevron-right" class="w-3.5 h-3.5 transition-transform" :class="sezioniAperte.metodi ? 'rotate-90' : ''" />
          Movimenti per metodo (nel periodo)
        </button>
        <template #content>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-3">

          <UCard v-for="m in cardsMetodo" :key="m.key">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" :class="m.iconBg">
                <UIcon :name="m.icon" class="w-4 h-4" :class="m.iconText" />
              </div>
              <p class="text-sm font-semibold text-slate-700 flex items-center gap-1">{{ m.label }}
                <StatHelp :text="`Entrate e uscite del periodo pagate con ${m.label.toLowerCase()}.`" />
              </p>
            </div>
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-xs text-green-600">Entrate</span>
                <span class="text-sm font-bold text-green-700">€ {{ fmt(m.dati.entrate) }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-red-600">Uscite</span>
                <span class="text-sm font-bold text-red-700">− € {{ fmt(m.dati.uscite) }}</span>
              </div>
            </div>
          </UCard>

          <!-- Totale del periodo -->
          <UCard class="bg-tfn-50 border-tfn-100">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-8 h-8 rounded-full bg-tfn-100 flex items-center justify-center shrink-0">
                <UIcon name="i-heroicons-circle-stack" class="w-4 h-4 text-tfn-600" />
              </div>
              <p class="text-sm font-semibold text-tfn-700 flex items-center gap-1">Totale
                <StatHelp text="Somma di tutti i metodi di pagamento nel periodo scelto." />
              </p>
            </div>
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-xs text-green-600">Entrate</span>
                <span class="text-sm font-bold text-green-700">€ {{ fmt(dash.perMetodo.totale.entrate) }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-red-600">Uscite</span>
                <span class="text-sm font-bold text-red-700">− € {{ fmt(dash.perMetodo.totale.uscite) }}</span>
              </div>
            </div>
          </UCard>

        </div>
        </template>
      </UCollapsible>

      <!-- ─── RIMANENZE (richiudibile) ─── -->
      <UCollapsible v-model:open="sezioniAperte.cassa">
        <button type="button" class="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors">
          <UIcon name="i-heroicons-chevron-right" class="w-3.5 h-3.5 transition-transform" :class="sezioniAperte.cassa ? 'rotate-90' : ''" />
          Rimanenze di cassa (saldo attuale, dall'inizio attività)
        </button>
        <template #content>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">

          <UCard :class="dash.saldiCassa.contanti >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs font-medium uppercase tracking-wide flex items-center gap-1" :class="dash.saldiCassa.contanti >= 0 ? 'text-emerald-600' : 'text-red-600'">
                  Cassa contanti
                  <StatHelp text="Saldo TOTALE dei contanti dall'inizio dell'attività: non dipende dal periodo selezionato in alto." />
                </p>
                <p class="text-2xl font-bold mt-1" :class="dash.saldiCassa.contanti >= 0 ? 'text-emerald-700' : 'text-red-700'">
                  € {{ fmt(dash.saldiCassa.contanti) }}
                </p>
                <p class="text-[11px] text-slate-400 mt-1">Entrate − uscite in contanti</p>
              </div>
              <UIcon name="i-heroicons-banknotes" class="w-7 h-7" :class="dash.saldiCassa.contanti >= 0 ? 'text-emerald-400' : 'text-red-400'" />
            </div>
          </UCard>

          <UCard :class="dash.saldiCassa.banca >= 0 ? 'bg-sky-50 border-sky-100' : 'bg-red-50 border-red-100'">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs font-medium uppercase tracking-wide flex items-center gap-1" :class="dash.saldiCassa.banca >= 0 ? 'text-sky-600' : 'text-red-600'">
                  Cassa banca
                  <StatHelp text="Saldo TOTALE sul conto (POS + bonifici + assegni) dall'inizio dell'attività: non dipende dal periodo selezionato." />
                </p>
                <p class="text-2xl font-bold mt-1" :class="dash.saldiCassa.banca >= 0 ? 'text-sky-700' : 'text-red-700'">
                  € {{ fmt(dash.saldiCassa.banca) }}
                </p>
                <p class="text-[11px] text-slate-400 mt-1">POS + bonifici + assegni (entrate − uscite)</p>
              </div>
              <UIcon name="i-heroicons-building-library" class="w-7 h-7" :class="dash.saldiCassa.banca >= 0 ? 'text-sky-400' : 'text-red-400'" />
            </div>
          </UCard>

        </div>
        </template>
      </UCollapsible>

      <!-- ─── PREVISIONI + E5 DEBITI TUTOR (richiudibile) ─── -->
      <UCollapsible v-model:open="sezioniAperte.previsionale" class="mt-8">
        <button type="button" class="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors">
          <UIcon name="i-heroicons-chevron-right" class="w-3.5 h-3.5 transition-transform" :class="sezioniAperte.previsionale ? 'rotate-90' : ''" />
          Previsionale e debiti
        </button>
        <template #content>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">

          <!-- E6: cliccabili → apre modal lista voci -->
          <UCard class="bg-indigo-50 border-indigo-100 cursor-pointer hover:shadow-md transition-shadow" @click="apriPrevisionale('CREDITO')">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs text-indigo-600 font-medium uppercase tracking-wide flex items-center gap-1">Da Incassare (Crediti)
                  <StatHelp text="Soldi che devi ancora incassare, registrati come crediti. Clicca la card per il dettaglio delle voci." />
                </p>
                <p class="text-2xl font-bold text-indigo-700 mt-1">
                  € {{ fmt(dash.previsioni.crediti) }}
                </p>
                <p class="text-[11px] text-indigo-300 mt-1">clicca per vedere il dettaglio</p>
              </div>
              <UIcon name="i-heroicons-arrow-down-tray" class="w-6 h-6 text-indigo-400" />
            </div>
          </UCard>

          <UCard class="bg-pink-50 border-pink-100 cursor-pointer hover:shadow-md transition-shadow" @click="apriPrevisionale('DEBITO')">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs text-pink-600 font-medium uppercase tracking-wide flex items-center gap-1">Da Pagare (Debiti)
                  <StatHelp text="Soldi che devi ancora pagare, registrati come debiti. Clicca la card per il dettaglio delle voci." />
                </p>
                <p class="text-2xl font-bold text-pink-700 mt-1">
                  € {{ fmt(dash.previsioni.debiti) }}
                </p>
                <p class="text-[11px] text-pink-300 mt-1">clicca per vedere il dettaglio</p>
              </div>
              <UIcon name="i-heroicons-arrow-up-tray" class="w-6 h-6 text-pink-400" />
            </div>
          </UCard>

          <!-- E5 — Compensi tutor non liquidati -->
          <UCard :class="tutorDebitiTotale > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50'">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs font-medium uppercase tracking-wide flex items-center gap-1" :class="tutorDebitiTotale > 0 ? 'text-amber-600' : 'text-slate-400'">
                  Compensi Tutor Dovuti
                  <StatHelp text="Compensi maturati dai tutor per le lezioni svolte e non ancora liquidati." />
                </p>
                <p class="text-2xl font-bold mt-1" :class="tutorDebitiTotale > 0 ? 'text-amber-700' : 'text-slate-600'">
                  € {{ fmt(tutorDebitiTotale) }}
                </p>
                <p class="text-[11px] mt-1" :class="tutorDebitiCount > 0 ? 'text-amber-500' : 'text-slate-400'">
                  {{ tutorDebitiCount }} tutor da liquidare
                </p>
              </div>
              <UIcon name="i-heroicons-user-group" class="w-6 h-6" :class="tutorDebitiTotale > 0 ? 'text-amber-400' : 'text-slate-300'" />
            </div>
          </UCard>

        </div>
        </template>
      </UCollapsible>

      <!-- ─── LISTA MOVIMENTI ─── -->
      <UCard class="mt-8">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-list-bullet" class="w-5 h-5 text-slate-500" />
            <span class="font-medium text-slate-800">Tutti i Movimenti</span>
            <UTooltip text="Scarica i movimenti filtrati in un file apribile con Excel (da girare al commercialista)">
              <UButton icon="i-heroicons-arrow-down-tray" variant="outline" color="neutral" size="xs" class="ml-auto" :loading="scaricandoCsv" @click="scaricaCsv">
                Scarica CSV
              </UButton>
            </UTooltip>
          </div>
        </template>

        <div class="flex flex-wrap gap-3 mb-4 items-end">
          <p class="text-xs text-slate-400 self-center mr-1">
            Periodo: <strong class="text-slate-600">{{ formatData(periodo.dataInizio) }} → {{ formatData(periodo.dataFine) }}</strong> (modificalo dai filtri in alto)
          </p>
          <UFormField label="Tipo">
            <USelect v-model="filtroEntries.tipo" :items="[{label: 'Tutti', value: 'TUTTI'}, {label: 'Entrata', value: 'ENTRATA'}, {label: 'Uscita', value: 'USCITA'}, {label: 'Credito', value: 'CREDITO'}, {label: 'Debito', value: 'DEBITO'}, {label: 'Nota/Atteso', value: 'NOTA'}, {label: 'Storno', value: 'STORNO'}]" class="w-40" />
          </UFormField>
          <UFormField label="Categoria">
            <USelect v-model="filtroEntries.categoria" :items="opzioniFiltro" class="w-52" />
          </UFormField>
        </div>

        <UTable :data="entries" :columns="colonneEntries" :loading="pendingEntries">
          <template #data-cell="{ row }">{{ formatData(row.original.data) }}</template>
          <template #tipo-cell="{ row }">
            <UBadge :color="row.original.tipo === 'ENTRATA' ? 'success' : row.original.tipo === 'USCITA' ? 'error' : row.original.tipo === 'CREDITO' ? 'indigo' : row.original.tipo === 'DEBITO' ? 'pink' : row.original.tipo === 'NOTA' ? 'warning' : 'neutral'" variant="subtle" size="xs">
              {{ labelTipo(row.original.tipo) }}
            </UBadge>
          </template>
          <template #descrizione-cell="{ row }">
            <span class="text-sm text-slate-700">
              {{ row.original.descrizione }}
              <UTooltip v-if="row.original.linkedEntryId" text="Movimento accoppiato 'Proventi diversi': entrata e uscita gemelle">
                <UBadge color="neutral" variant="subtle" size="xs" class="ml-1">↔</UBadge>
              </UTooltip>
            </span>
          </template>
          <template #categoria-cell="{ row }">
            <UBadge color="neutral" variant="outline" size="xs">{{ labelCategoria(row.original.categoria) }}</UBadge>
          </template>
          <template #metodoPagamento-cell="{ row }">
            <span class="text-sm text-slate-600">{{ labelMetodo(row.original.metodoPagamento) }}</span>
          </template>
          <template #importo-cell="{ row }">
            <span class="font-medium" :class="row.original.tipo === 'USCITA' || row.original.tipo === 'DEBITO' ? 'text-error-600' : 'text-slate-800'">
              {{ row.original.tipo === 'USCITA' || row.original.tipo === 'DEBITO' ? '-' : '' }}€ {{ fmt(parseFloat(row.original.importo)) }}
            </span>
          </template>
          <!-- E1 — Colonna fattura (dove richiesta; sui manuali in entrata si può attivare al volo) -->
          <template #fatturaEmessa-cell="{ row }">
            <template v-if="row.original.richiedeFattura">
              <UTooltip :text="row.original.fatturaEmessa ? 'Fattura emessa ✓' : 'Fattura NON emessa — clicca per segnare'">
                <UButton
                  :icon="row.original.fatturaEmessa ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-circle'"
                  :color="row.original.fatturaEmessa ? 'success' : 'warning'"
                  variant="ghost" size="xs"
                  :loading="toggling === row.original.id"
                  @click="toggleFattura(row.original)"
                />
              </UTooltip>
            </template>
            <UTooltip v-else-if="isManuale(row.original) && row.original.tipo === 'ENTRATA'" text="Aggiungi alle fatture da emettere">
              <UButton
                icon="i-heroicons-document-plus"
                color="neutral" variant="ghost" size="xs"
                :loading="toggling === row.original.id"
                @click="richiediFattura(row.original)"
              />
            </UTooltip>
            <span v-else class="text-slate-200 text-xs select-none">—</span>
          </template>
          <template #azioni-cell="{ row }">
            <div class="flex justify-end gap-1">
              <UButton
                v-if="isManuale(row.original) && !row.original.linkedEntryId"
                icon="i-heroicons-pencil-square"
                size="xs" color="neutral" variant="ghost"
                title="Modifica"
                @click="apriModifica(row.original)"
              />
              <UTooltip v-else :text="row.original.linkedEntryId ? 'Movimento accoppiato: elimina la coppia e ricreala' : 'Movimento automatico: modificalo dal pagamento di origine'">
                <UButton icon="i-heroicons-pencil-square" size="xs" color="neutral" variant="ghost" disabled />
              </UTooltip>
              <UButton
                icon="i-heroicons-trash"
                size="xs" color="error" variant="ghost"
                title="Elimina"
                @click="apriElimina(row.original)"
              />
            </div>
          </template>
        </UTable>
        <div class="mt-4 flex justify-center border-t border-slate-100 pt-4" v-if="metaEntries && metaEntries.totalPages > 1">
          <UPagination v-model:page="filtroEntries.page" :total="metaEntries.total" :items-per-page="filtroEntries.limit" @update:page="cambiaPagina" />
        </div>
      </UCard>

      <!-- ─── FATTURE IN ATTESA ─── -->
      <UCard v-if="dash.fattureInAttesa.count > 0" class="mt-8">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-document-text" class="w-4 h-4 text-yellow-500" />
            <span class="font-medium text-slate-800">Fatture da emettere</span>
            <UBadge color="warning" variant="subtle">{{ dash.fattureInAttesa.count }}</UBadge>
          </div>
        </template>
        <UTable
          :data="dash.fattureInAttesa.lista"
          :columns="colonneFatture"
        >
          <template #importo-cell="{ row }">
            <span class="font-medium text-slate-800">€ {{ fmt(parseFloat(row.original.importo)) }}</span>
          </template>
          <template #dataPagamento-cell="{ row }">
            <span class="text-slate-600 text-sm">{{ formatData(row.original.dataPagamento) }}</span>
          </template>
          <template #metodoPagamento-cell="{ row }">
            <UBadge color="neutral" variant="outline" size="xs">{{ row.original.metodoPagamento }}</UBadge>
          </template>
          <template #azione-cell="{ row }">
            <UButton
              size="xs"
              color="warning"
              variant="outline"
              :loading="segnandoFattura === row.original.entryId"
              @click="segnaFatturaEmessa(row.original)"
            >
              Segna emessa
            </UButton>
          </template>
        </UTable>
      </UCard>

    </template>

    <!-- Errore di caricamento: prima la pagina restava semplicemente vuota -->
    <template v-else>
      <UAlert
        color="error"
        icon="i-heroicons-exclamation-triangle"
        title="Impossibile caricare la contabilità"
        description="Il caricamento dei dati non è andato a buon fine. Riprova; se il problema persiste, riavvia l'applicazione."
      />
      <UButton icon="i-heroicons-arrow-path" variant="outline" @click="refreshAll">Riprova</UButton>
    </template>

    <!-- ─── MODAL NUOVO MOVIMENTO ─── -->
    <UModal v-model:open="modalNuovoMovimentoAperto" title="Nuovo Movimento Manuale">
      <template #body>
        <!-- E2: schema Zod + @error per focus automatico -->
        <UForm :schema="nuovoMovimentoSchema" :state="nuovoMovimento" class="space-y-4" @submit="salvaMovimento" @error="onFormError">
          <div class="grid grid-cols-2 gap-4">
            <UFormField name="tipo" label="Tipo" required>
              <USelect v-model="nuovoMovimento.tipo" :items="opzioniTipoMovimento" class="w-full" />
            </UFormField>
            <UFormField name="data" label="Data" required>
              <UInput type="date" v-model="nuovoMovimento.data" class="w-full" />
            </UFormField>
          </div>

          <UFormField name="descrizione" label="Descrizione" required>
            <UInput v-model="nuovoMovimento.descrizione" placeholder="Es. Pagamento affitto" class="w-full" />
          </UFormField>

          <div class="grid grid-cols-2 gap-4">
            <UFormField name="importo" label="Importo (€)" required>
              <UInputNumber v-model="nuovoMovimento.importo" :min="0.01" :step="0.01" class="w-full" />
            </UFormField>
            <UFormField name="metodoPagamento" label="Metodo">
              <USelect v-model="nuovoMovimento.metodoPagamento" :items="['CONTANTI', 'BONIFICO', 'POS', 'ASSEGNO', 'ALTRO']" class="w-full" />
            </UFormField>
          </div>

          <!-- Proventi diversi: categorie fissate dal server, il flag fattura parte attivo -->
          <UFormField v-if="nuovoMovimento.tipo !== 'PROVENTI_DIVERSI'" name="categoria" label="Categoria">
            <USelect v-model="nuovoMovimento.categoria" :items="opzioniForm" value-key="value" class="w-full" />
          </UFormField>

          <p v-if="nuovoMovimento.tipo === 'PROVENTI_DIVERSI'" class="text-xs text-slate-500 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
            Verranno creati <strong>due movimenti gemelli</strong>: +€ in entrata ("Proventi diversi") e
            −€ in uscita ("Costi per proventi diversi"). Il margine netto non cambia, ma entrate,
            tasse stimate e fatture aumentano.
          </p>

          <UFormField v-if="['ENTRATA', 'PROVENTI_DIVERSI'].includes(nuovoMovimento.tipo)" name="richiedeFattura">
            <UCheckbox v-model="nuovoMovimento.richiedeFattura" label="Richiede fattura" />
          </UFormField>

          <div class="flex justify-end gap-3 pt-4">
            <UButton variant="ghost" @click="modalNuovoMovimentoAperto = false">Annulla</UButton>
            <UButton type="submit" :loading="salvandoMovimento">Registra</UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- ─── MODAL ELIMINA MOVIMENTO (elimina / storno) ─── -->
    <UModal v-model:open="modalEliminaAperto" title="Elimina movimento">
      <template #body>
        <div class="space-y-3">
          <p class="text-sm text-slate-600">
            Stai per eliminare il movimento
            <strong>{{ movimentoDaEliminare?.descrizione }}</strong>
            (€ {{ movimentoDaEliminare ? fmt(parseFloat(movimentoDaEliminare.importo)) : '' }}).
          </p>
          <p v-if="movimentoDaEliminare && isAuto(movimentoDaEliminare)" class="text-sm text-amber-600">
            ⚠️ È un movimento <strong>automatico</strong> collegato a un pagamento: "Elimina definitivamente"
            rimuoverà anche il pagamento di origine e ricalcolerà i saldi.
          </p>
          <p v-if="movimentoDaEliminare?.linkedEntryId" class="text-sm text-amber-600">
            ⚠️ È un movimento <strong>accoppiato "Proventi diversi"</strong>: l'operazione (eliminazione o storno)
            riguarderà anche la riga gemella, così entrate e uscite restano in equilibrio.
          </p>
          <p class="text-sm text-slate-500">
            Lo <strong>storno</strong> mantiene lo storico creando un movimento opposto (consigliato a fini fiscali).
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton variant="ghost" @click="modalEliminaAperto = false">Annulla</UButton>
          <UButton color="neutral" variant="outline" :loading="eliminando === 'storno'" @click="eseguiElimina('storno')">Crea storno</UButton>
          <UButton color="error" :loading="eliminando === 'delete'" @click="eseguiElimina('delete')">Elimina definitivamente</UButton>
        </div>
      </template>
    </UModal>

    <!-- ─── MODAL MODIFICA MOVIMENTO MANUALE ─── -->
    <UModal v-model:open="modalModificaAperto" title="Modifica movimento manuale">
      <template #body>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Tipo">
              <USelect v-model="modificaMovimento.tipo" :items="[{label:'Entrata',value:'ENTRATA'},{label:'Uscita',value:'USCITA'},{label:'Credito',value:'CREDITO'},{label:'Debito',value:'DEBITO'},{label:'Nota',value:'NOTA'}]" class="w-full" />
            </UFormField>
            <UFormField label="Data">
              <UInput type="date" v-model="modificaMovimento.data" class="w-full" />
            </UFormField>
          </div>
          <UFormField label="Descrizione">
            <UInput v-model="modificaMovimento.descrizione" class="w-full" />
          </UFormField>
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Importo (€)">
              <UInputNumber v-model="modificaMovimento.importo" :min="0.01" :step="0.01" class="w-full" />
            </UFormField>
            <UFormField label="Metodo">
              <USelect v-model="modificaMovimento.metodoPagamento" :items="['CONTANTI', 'BONIFICO', 'POS', 'ASSEGNO', 'ALTRO']" class="w-full" />
            </UFormField>
          </div>
          <UFormField label="Categoria">
            <USelect v-model="modificaMovimento.categoria" :items="opzioniForm" value-key="value" class="w-full" />
          </UFormField>
          <UFormField v-if="modificaMovimento.tipo === 'ENTRATA'" name="richiedeFattura">
            <UCheckbox v-model="modificaMovimento.richiedeFattura" label="Richiede fattura" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton variant="ghost" @click="modalModificaAperto = false">Annulla</UButton>
          <UButton :loading="salvandoModifica" @click="salvaModifica">Salva modifiche</UButton>
        </div>
      </template>
    </UModal>

    <!-- ─── MODAL E6 — Dettaglio Crediti / Debiti ─── -->
    <UModal
      :open="modalPrevisionale !== null"
      :title="modalPrevisionale === 'CREDITO' ? 'Da Incassare — Crediti' : 'Da Pagare — Debiti'"
      @update:open="(v) => { if (!v) modalPrevisionale = null }"
    >
      <template #body>
        <div v-if="loadingPrevisionali" class="flex justify-center py-10">
          <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-slate-400" />
        </div>
        <p v-else-if="entriePrevisionali.length === 0" class="text-center py-8 text-sm text-slate-400">
          Nessun movimento trovato
        </p>
        <UTable
          v-else
          :data="entriePrevisionali"
          :columns="[
            { accessorKey: 'data',            header: 'Data' },
            { accessorKey: 'descrizione',     header: 'Descrizione' },
            { accessorKey: 'metodoPagamento', header: 'Metodo' },
            { accessorKey: 'importo',         header: 'Importo' },
          ]"
        >
          <template #data-cell="{ row }">{{ formatData(row.original.data) }}</template>
          <template #metodoPagamento-cell="{ row }">{{ labelMetodo(row.original.metodoPagamento) }}</template>
          <template #importo-cell="{ row }">
            <span class="font-medium text-slate-800">€ {{ fmt(parseFloat(row.original.importo)) }}</span>
          </template>
        </UTable>
      </template>
    </UModal>

  </div>
</template>

<script setup lang="ts">
import { z } from 'zod'
import { labelMetodo, labelTipo } from '~/utils/contabilita'
import { mappaEtichette } from '#shared/accounting-categories'

definePageMeta({ middleware: ['admin-only'] })

const toast = useToast()

// ─── Categorie (gestite da Impostazioni → Categorie) ───
const { data: categorieData, refresh: refreshCategorie } = useLazyFetch('/api/accounting/categories')
const categorie = computed(() => categorieData.value ?? [])
const mappaCategorie = computed(() => mappaEtichette(categorie.value))
function labelCategoria(cat: string | null | undefined): string {
  if (!cat) return '—'
  return mappaCategorie.value[cat] ?? cat
}
// Filtro: tutte le categorie esistenti. Form manuale: escluse quelle automatiche di sistema.
const opzioniFiltro = computed(() => [
  { label: 'Tutte le categorie', value: 'TUTTE' },
  ...categorie.value.map((c) => ({ label: c.etichetta, value: c.chiave })),
])
const opzioniForm = computed(() =>
  categorie.value.filter((c) => !c.sistema).map((c) => ({ label: c.etichetta, value: c.chiave })),
)

// ─── Periodo (default: dal 1° gennaio dell'anno corrente a oggi) ───
// oggiISO() = giorno civile italiano (con toISOString il periodo escludeva
// i movimenti di oggi tra mezzanotte e le ~2 di notte)
const OGGI_ISO    = oggiISO()
const INIZIO_ANNO = `${OGGI_ISO.slice(0, 4)}-01-01`

const periodo = reactive({
  dataInizio: INIZIO_ANNO,
  dataFine: OGGI_ISO,
})

// Mostrato nella barra periodo ("dal 1° gennaio X a oggi")
const annoCorrente = OGGI_ISO.slice(0, 4)

// ─── Fetch dashboard (reattiva al periodo) ───
const { data: dash, pending, refresh: refreshDash } = useLazyFetch('/api/accounting/dashboard', {
  query: computed(() => ({
    dataInizio: periodo.dataInizio || undefined,
    dataFine: periodo.dataFine || undefined,
  })),
  watch: false,
})

// Proventi diversi del periodo: righe "+X (a parte)" nelle card e "+X" nelle tasse.
// Il server manda i totali (e la voce nel form) solo agli account autorizzati.
const proventiEntrate  = computed(() => (dash.value as any)?.proventiDiversi?.entrate ?? 0)
const proventiUscite   = computed(() => (dash.value as any)?.proventiDiversi?.uscite ?? 0)
const proventiVisibili = computed(() => (dash.value as any)?.proventiVisibili === true)

const opzioniTipoMovimento = computed(() => [
  { label: 'Entrata (Cassa Reale)', value: 'ENTRATA' },
  { label: 'Uscita (Cassa Reale)', value: 'USCITA' },
  { label: 'Credito (Da incassare)', value: 'CREDITO' },
  { label: 'Debito (Da pagare)', value: 'DEBITO' },
  ...(proventiVisibili.value ? [{ label: 'Proventi diversi (entrata + uscita)', value: 'PROVENTI_DIVERSI' }] : []),
])

// E5 — Debiti tutor
const { data: debitiTutor, refresh: refreshDebitiTutor } = useLazyFetch('/api/tutors/debiti-summary', {
  watch: false,
})
const tutorDebitiTotale = computed(() => debitiTutor.value?.totale ?? 0)
const tutorDebitiCount  = computed(() => debitiTutor.value?.tutorsConDebiti ?? 0)

// E6 — Modal dettaglio Crediti / Debiti
const modalPrevisionale    = ref<'CREDITO' | 'DEBITO' | null>(null)
const entriePrevisionali   = ref<any[]>([])
const loadingPrevisionali  = ref(false)

async function apriPrevisionale(tipo: 'CREDITO' | 'DEBITO') {
  modalPrevisionale.value   = tipo
  loadingPrevisionali.value = true
  try {
    const res = await $fetch<{ data: any[] }>('/api/accounting/entries', { query: { tipo, limit: 100 } })
    entriePrevisionali.value = res.data ?? []
  } finally {
    loadingPrevisionali.value = false
  }
}

// ─── Lista Movimenti (stesso periodo + filtri Tipo/Categoria) ───
const filtroEntries = reactive({
  tipo:      'TUTTI',
  categoria: 'TUTTE',
  page:      1,
  limit:     50,
})

const { data: entriesData, pending: pendingEntries, refresh: refreshEntries } = useLazyFetch('/api/accounting/entries', {
  query: computed(() => ({
    dataInizio: periodo.dataInizio || undefined,
    dataFine: periodo.dataFine || undefined,
    tipo: (filtroEntries.tipo && filtroEntries.tipo !== 'TUTTI') ? filtroEntries.tipo : undefined,
    categoria: (filtroEntries.categoria && filtroEntries.categoria !== 'TUTTE') ? filtroEntries.categoria : undefined,
    page: filtroEntries.page,
    limit: filtroEntries.limit,
  })),
  watch: false,
})
const entries = computed(() => entriesData.value?.data ?? [])
const metaEntries = computed(() => entriesData.value?.meta)

function caricaEntries() {
  filtroEntries.page = 1
  refreshEntries()
}

// ─── Export CSV (movimenti filtrati, tutte le pagine) ───
const scaricandoCsv = ref(false)

async function scaricaCsv() {
  scaricandoCsv.value = true
  try {
    const res = await $fetch<{ data: any[] }>('/api/accounting/entries', {
      query: {
        dataInizio: periodo.dataInizio || undefined,
        dataFine: periodo.dataFine || undefined,
        tipo: (filtroEntries.tipo && filtroEntries.tipo !== 'TUTTI') ? filtroEntries.tipo : undefined,
        categoria: (filtroEntries.categoria && filtroEntries.categoria !== 'TUTTE') ? filtroEntries.categoria : undefined,
        page: 1,
        limit: 10000, // ponytail: una sola pagina gigante — sopra i 10k movimenti servirà uno streaming
      },
    })
    const righe = res.data ?? []

    // Separatore ';' e BOM UTF-8: è quello che Excel italiano si aspetta
    const escapeCsv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const intestazione = ['Data', 'Tipo', 'Categoria', 'Descrizione', 'Metodo', 'Importo', 'Fattura richiesta', 'Fattura emessa']
    const corpo = righe.map((r) => [
      formatData(r.data),
      labelTipo(r.tipo),
      labelCategoria(r.categoria),
      r.descrizione ?? '',
      labelMetodo(r.metodoPagamento),
      // Virgola decimale per Excel italiano
      String(parseFloat(r.importo ?? '0').toFixed(2)).replace('.', ','),
      r.richiedeFattura ? 'Sì' : 'No',
      r.fatturaEmessa ? 'Sì' : 'No',
    ].map(escapeCsv).join(';'))

    // ﻿ = BOM: senza, Excel mostra le lettere accentate sbagliate
    const csv = '﻿' + [intestazione.map(escapeCsv).join(';'), ...corpo].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `movimenti_${periodo.dataInizio}_${periodo.dataFine}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    toast.add({ title: 'Errore durante l\'esportazione', color: 'error' })
  } finally {
    scaricandoCsv.value = false
  }
}

// USelect (Reka UI) non emette un evento `change` affidabile → osserviamo i filtri.
watch(() => [filtroEntries.tipo, filtroEntries.categoria], caricaEntries)

function cambiaPagina() {
  refreshEntries()
}

function onPeriodoChange() {
  filtroEntries.page = 1
  refreshDash()
  refreshEntries()
}

function azzeraFiltri() {
  periodo.dataInizio = INIZIO_ANNO
  periodo.dataFine = OGGI_ISO
  filtroEntries.tipo = 'TUTTI'
  filtroEntries.categoria = 'TUTTE'
  filtroEntries.page = 1
  refreshDash()
  refreshEntries()
}

function refreshAll() {
  refreshDash()
  refreshEntries()
  refreshDebitiTutor()
  refreshCategorie()
}

// ─── Card "per metodo" ───
const cardsMetodo = computed(() => {
  const pm = dash.value?.perMetodo
  if (!pm) return []
  return [
    { key: 'contanti', label: 'Contanti', icon: 'i-heroicons-banknotes',        iconBg: 'bg-green-100',  iconText: 'text-green-600',  dati: pm.contanti },
    { key: 'bonifico', label: 'Bonifici', icon: 'i-heroicons-building-library', iconBg: 'bg-blue-100',   iconText: 'text-blue-600',   dati: pm.bonifico },
    { key: 'pos',      label: 'POS',      icon: 'i-heroicons-credit-card',      iconBg: 'bg-purple-100', iconText: 'text-purple-600', dati: pm.pos },
    { key: 'assegno',  label: 'Assegni',  icon: 'i-heroicons-document',         iconBg: 'bg-yellow-100', iconText: 'text-yellow-600', dati: pm.assegno },
  ]
})

// ─── Sezioni richiudibili (stato ricordato per browser via cookie, mai localStorage) ───
const sezioniAperte = useCookie<Record<string, boolean>>('contabilita-sezioni', {
  default: () => ({ altri: true, aree: true, metodi: true, cassa: true, previsionale: true }),
})

import { oggiISO, formatData, formatImporto as fmt } from '~/utils/format'

// ─── Colonne Tabelle ───
const colonneEntries = [
  { accessorKey: 'data', header: 'Data' },
  { accessorKey: 'tipo', header: 'Tipo' },
  { accessorKey: 'categoria', header: 'Categoria' },
  { accessorKey: 'descrizione', header: 'Descrizione' },
  { accessorKey: 'metodoPagamento', header: 'Metodo' },
  { accessorKey: 'importo', header: 'Importo' },
  { id: 'fatturaEmessa', header: 'Fattura' },  // E1
  { id: 'azioni', header: '' },
]

const colonneFatture = [
  { accessorKey: 'importo',         header: 'Importo' },
  { accessorKey: 'dataPagamento',   header: 'Data pagamento' },
  { accessorKey: 'tipoPagamento',   header: 'Tipo' },
  { accessorKey: 'metodoPagamento', header: 'Metodo' },
  { id: 'azione', accessorKey: 'entryId', header: '' },
]

// ─── E1 — Toggle fattura ───
const toggling = ref<string | null>(null)

async function toggleFattura(entry: any) {
  toggling.value = entry.id
  const nuovoStato = !entry.fatturaEmessa
  try {
    if (entry.paymentId) {
      await $fetch(`/api/payments/${entry.paymentId}/invoice`, { method: 'PUT', body: { fatturaEmessa: nuovoStato } })
    } else {
      await $fetch(`/api/accounting/entries/${entry.id}`, { method: 'PUT', body: { fatturaEmessa: nuovoStato } })
    }
    toast.add({ title: nuovoStato ? 'Fattura segnata come emessa' : 'Fattura rimossa', color: 'success', icon: 'i-heroicons-check-circle' })
    refreshAll()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Operazione non riuscita', color: 'error' })
  } finally {
    toggling.value = null
  }
}

// Movimento manuale in entrata senza flag fattura: lo aggiunge alle "fatture da emettere"
async function richiediFattura(entry: any) {
  toggling.value = entry.id
  try {
    await $fetch(`/api/accounting/entries/${entry.id}`, { method: 'PUT', body: { richiedeFattura: true } })
    toast.add({ title: 'Aggiunto alle fatture da emettere', color: 'success', icon: 'i-heroicons-document-plus' })
    refreshAll()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Operazione non riuscita', color: 'error' })
  } finally {
    toggling.value = null
  }
}

// ─── Segna fattura emessa (sezione Fatture in attesa) ───
const segnandoFattura = ref<string | null>(null)

async function segnaFatturaEmessa(row: any) {
  segnandoFattura.value = row.entryId
  try {
    // Movimenti manuali (es. Proventi diversi) non hanno un pagamento collegato
    if (row.paymentId) {
      await $fetch(`/api/payments/${row.paymentId}/invoice`, { method: 'PUT', body: { fatturaEmessa: true } })
    } else {
      await $fetch(`/api/accounting/entries/${row.entryId}`, { method: 'PUT', body: { fatturaEmessa: true } })
    }
    toast.add({ title: 'Fattura segnata come emessa', color: 'success', icon: 'i-heroicons-check-circle' })
    refreshDash()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile aggiornare', color: 'error' })
  } finally {
    segnandoFattura.value = null
  }
}

// ─── E2 — Schema Zod per form nuovo movimento + focus automatico ───
const nuovoMovimentoSchema = z.object({
  tipo:            z.enum(['ENTRATA', 'USCITA', 'CREDITO', 'DEBITO', 'PROVENTI_DIVERSI']),
  data:            z.string().min(1),
  descrizione:     z.string().min(1, 'La descrizione è obbligatoria'),
  importo:         z.number().min(0.01, 'Importo deve essere > 0'),
  metodoPagamento: z.string().optional(),
  categoria:       z.string().optional(),
  richiedeFattura: z.boolean().optional(),
})

function onFormError(errors: any) {
  const firstPath = errors?.errors?.[0]?.path
  if (firstPath) {
    nextTick(() => {
      const el = document.querySelector(`[name="${firstPath}"]`) as HTMLElement | null
      el?.focus()
    })
  }
}

// ─── Nuovo Movimento Manuale ───
const modalNuovoMovimentoAperto = ref(false)
const salvandoMovimento = ref(false)

const nuovoMovimento = reactive({
  tipo: 'USCITA' as 'ENTRATA' | 'USCITA' | 'CREDITO' | 'DEBITO' | 'PROVENTI_DIVERSI',
  importo: 0,
  descrizione: '',
  categoria: 'spese_generali',
  metodoPagamento: 'BONIFICO',
  data: oggiISO(),
  richiedeFattura: false,
})

// Proventi diversi nascono con "richiede fattura" attivo (si può togliere a mano)
watch(() => nuovoMovimento.tipo, (t) => {
  nuovoMovimento.richiedeFattura = t === 'PROVENTI_DIVERSI'
})

async function salvaMovimento() {
  salvandoMovimento.value = true
  try {
    const isProventi = nuovoMovimento.tipo === 'PROVENTI_DIVERSI'
    await $fetch('/api/accounting/entries', {
      method: 'POST',
      body: {
        tipo: nuovoMovimento.tipo,
        importo: Number(nuovoMovimento.importo),
        descrizione: nuovoMovimento.descrizione,
        // Proventi diversi: le categorie le fissa il server (coppia gemella)
        categoria: isProventi ? undefined : (nuovoMovimento.categoria || 'varie'),
        metodoPagamento: nuovoMovimento.metodoPagamento,
        data: nuovoMovimento.data,
        richiedeFattura: nuovoMovimento.richiedeFattura,
      }
    })
    toast.add({ title: 'Movimento registrato', color: 'success' })
    modalNuovoMovimentoAperto.value = false
    nuovoMovimento.importo = 0
    nuovoMovimento.descrizione = ''
    refreshAll()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: 'Impossibile salvare il movimento', color: 'error' })
  } finally {
    salvandoMovimento.value = false
  }
}

// ─── Azioni movimenti ───
function isAuto(row: any) {
  return !!(row.paymentId || row.tutorPaymentId || row.reimbursementId)
}
function isManuale(row: any) {
  return !isAuto(row)
}

const modalEliminaAperto = ref(false)
const movimentoDaEliminare = ref<any>(null)
const eliminando = ref<'delete' | 'storno' | null>(null)

function apriElimina(row: any) {
  movimentoDaEliminare.value = row
  modalEliminaAperto.value = true
}

async function eseguiElimina(mode: 'delete' | 'storno') {
  if (!movimentoDaEliminare.value) return
  eliminando.value = mode
  try {
    await $fetch(`/api/accounting/entries/${movimentoDaEliminare.value.id}`, { method: 'DELETE', query: { mode } })
    toast.add({ title: mode === 'storno' ? 'Storno creato' : 'Movimento eliminato', color: 'success' })
    modalEliminaAperto.value = false
    movimentoDaEliminare.value = null
    refreshAll()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Operazione non riuscita', color: 'error' })
  } finally {
    eliminando.value = null
  }
}

const modalModificaAperto = ref(false)
const salvandoModifica = ref(false)
const modificaMovimento = reactive({
  id: '', tipo: 'USCITA', importo: 0, descrizione: '', categoria: '', metodoPagamento: 'BONIFICO', data: '',
  richiedeFattura: false,
})

function apriModifica(row: any) {
  modificaMovimento.id          = row.id
  modificaMovimento.tipo        = row.tipo
  modificaMovimento.importo     = parseFloat(row.importo)
  modificaMovimento.descrizione = row.descrizione
  modificaMovimento.categoria   = row.categoria ?? ''
  modificaMovimento.metodoPagamento = row.metodoPagamento ?? 'BONIFICO'
  modificaMovimento.data        = row.data ? new Date(row.data).toISOString().substring(0, 10) : ''
  modificaMovimento.richiedeFattura = !!row.richiedeFattura
  modalModificaAperto.value     = true
}

async function salvaModifica() {
  salvandoModifica.value = true
  try {
    await $fetch(`/api/accounting/entries/${modificaMovimento.id}`, {
      method: 'PUT',
      body: {
        tipo:            modificaMovimento.tipo,
        importo:         Number(modificaMovimento.importo),
        descrizione:     modificaMovimento.descrizione,
        categoria:       modificaMovimento.categoria || null,
        metodoPagamento: modificaMovimento.metodoPagamento || null,
        data:            modificaMovimento.data,
        richiedeFattura: modificaMovimento.tipo === 'ENTRATA' ? modificaMovimento.richiedeFattura : false,
      },
    })
    toast.add({ title: 'Movimento aggiornato', color: 'success' })
    modalModificaAperto.value = false
    refreshAll()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Modifica non riuscita', color: 'error' })
  } finally {
    salvandoModifica.value = false
  }
}
</script>
