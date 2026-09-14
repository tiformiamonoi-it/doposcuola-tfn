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
        <UButton icon="i-heroicons-plus" size="sm" @click="modalNuovoMovimentoAperto = true;">
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

          <!-- E7 — Break-even (margine - costi fissi). Cliccabile: apre il conto riga per riga. -->
          <UCard
            class="cursor-pointer hover:shadow-md transition-shadow"
            :class="dash.breakEven >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'"
            @click="modalBreakEvenAperto = true"
          >
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs font-medium uppercase tracking-wide flex items-center gap-1" :class="dash.breakEven >= 0 ? 'text-emerald-600' : 'text-rose-600'">
                  Break-even
                  <!-- Il "?" è già un bottone: fermiamo il click qui, altrimenti aprirebbe anche il popup del calcolo -->
                  <span @click.stop>
                    <StatHelp text="Entrate meno le uscite vere, ma con le spese previste (affitto, utenze…) al posto dei movimenti che quelle spese coprono: così l'affitto non viene contato due volte. Se è positivo, l'attività si sta ripagando da sola." />
                  </span>
                </p>
                <p class="text-2xl font-bold mt-1" :class="dash.breakEven >= 0 ? 'text-emerald-700' : 'text-rose-700'">
                  € {{ fmt(dash.breakEven) }}
                </p>
                <p class="text-[11px] mt-1" :class="dash.breakEven >= 0 ? 'text-emerald-400' : 'text-rose-400'">
                  Con € {{ fmt(dash.costiFissi.periodo) }} di spese previste
                </p>
                <!-- Avviso ambra: una spesa prevista non collegata a nessuna categoria
                     rischia di essere contata due volte (prevista + movimento vero) -->
                <p v-if="speseNonCollegate.length" class="text-[11px] mt-1 text-amber-600 flex items-center gap-1">
                  <UIcon name="i-heroicons-exclamation-triangle" class="w-3.5 h-3.5 shrink-0" />
                  {{ speseNonCollegate.length === 1 ? '1 spesa non collegata' : `${speseNonCollegate.length} spese non collegate` }}
                </p>
                <!--
                  Accessibilità: la card intera si può cliccare col mouse, ma chi naviga
                  da tastiera ha bisogno di un comando vero e proprio da raggiungere con
                  Tab. Un <button> annidato dentro un altro bottone non è valido: per
                  questo la card resta un contenitore e il comando è questo link.
                -->
                <button
                  type="button"
                  class="mt-2 inline-flex items-center gap-1 text-[11px] font-medium underline underline-offset-2 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                  :class="dash.breakEven >= 0 ? 'text-emerald-700 focus-visible:outline-emerald-600' : 'text-rose-700 focus-visible:outline-rose-600'"
                  @click.stop="modalBreakEvenAperto = true"
                >
                  <UIcon name="i-heroicons-calculator" class="w-3.5 h-3.5" />
                  Vedi il calcolo
                </button>
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
                    <StatHelp text="Le spese fisse impostate in Impostazioni (affitto, utenze…). Il valore mensile è quello in vigore a fine periodo; il totale conta ogni spesa solo per i mesi in cui era davvero attiva (date Dal/Al)." />
                  </p>
                  <p class="text-2xl font-bold text-slate-700 mt-1">
                    € {{ fmt(dash.costiFissi.mensili) }}
                  </p>
                  <p class="text-[11px] text-slate-400 mt-1">
                    € {{ fmt(dash.costiFissi.periodo) }} sul periodo ({{ dash.costiFissi.mesi }} mesi)
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

          <!-- F1 — Bolli da versare: i 2 € incassati e non ancora girati allo Stato -->
          <UCard
            :class="bolliCount > 0 ? 'bg-orange-50 border-orange-100 cursor-pointer hover:shadow-md transition-shadow' : 'bg-slate-50'"
            @click="bolliCount > 0 && apriDettaglioBolli()"
          >
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs font-medium uppercase tracking-wide flex items-center gap-1" :class="bolliCount > 0 ? 'text-orange-600' : 'text-slate-400'">
                  Bolli da versare
                  <StatHelp text="Le marche da bollo da 2 € già incassate dai clienti e non ancora versate allo Stato con l'F24. Sono soldi che hai in cassa ma che non sono tuoi. Questi stessi euro sono compresi anche in 'Da Pagare (Debiti)'." />
                </p>
                <p class="text-2xl font-bold mt-1" :class="bolliCount > 0 ? 'text-orange-700' : 'text-slate-600'">
                  € {{ fmt(bolliTotale) }}
                </p>
                <p class="text-[11px] mt-1" :class="bolliCount > 0 ? 'text-orange-500' : 'text-slate-400'">
                  {{ bolliCount === 1 ? '1 bollo' : `${bolliCount} bolli` }}<span v-if="bolliCount > 0"> · clicca per il dettaglio</span>
                </p>
              </div>
              <UIcon name="i-heroicons-ticket" class="w-6 h-6" :class="bolliCount > 0 ? 'text-orange-400' : 'text-slate-300'" />
            </div>
            <div v-if="bolliCount > 0" class="mt-3">
              <UButton
                size="xs" color="warning" variant="soft" icon="i-heroicons-banknotes" block
                @click.stop="apriVersamentoF24"
              >
                Registra versamento F24
              </UButton>
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
              <UButton icon="i-heroicons-arrow-down-tray" variant="outline" color="neutral" size="xs" class="ml-auto" :loading="scaricandoCsv" @click="esportaCsv">
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
          <!-- Voci riusate da METODI_MOVIMENTO_ITEMS: un solo elenco di metodi in tutto il progetto -->
          <UFormField label="Metodo">
            <USelect v-model="filtroEntries.metodo" :items="opzioniFiltroMetodo" class="w-40" />
          </UFormField>
          <UFormField label="Categoria">
            <USelect v-model="filtroEntries.categoria" :items="opzioniFiltro" class="w-52" />
          </UFormField>
          <UFormField label="Fattura">
            <USelect
              v-model="filtroEntries.fattura"
              :items="[
                { label: 'Tutti i movimenti', value: 'TUTTE' },
                { label: 'Con fattura (da emettere + emesse)', value: 'CON' },
                { label: 'Solo da emettere', value: 'DA_EMETTERE' },
                { label: 'Solo emesse', value: 'EMESSE' },
              ]"
              class="w-64"
            />
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
              <!-- Compensi e rimborsi: nome del tutor, cliccabile per aprire la sua scheda -->
              <NuxtLink
                v-if="nomeTutor(row.original)"
                :to="`/tutor/${row.original.tutorId}`"
                class="font-medium text-primary-600 hover:underline"
              >· {{ nomeTutor(row.original) }}</NuxtLink>
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
          <!-- E1 — Colonna fattura (dove richiesta; sulle entrate manuali si attiva al volo; sulle automatiche col bottone nascosto, visibile al passaggio del mouse) -->
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
            <UTooltip v-else-if="row.original.tipo === 'ENTRATA' && (isManuale(row.original) || row.original.paymentId)" text="Aggiungi alle fatture da emettere">
              <UButton
                icon="i-heroicons-document-plus"
                color="neutral" variant="ghost" size="xs"
                :class="row.original.paymentId ? 'opacity-0 hover:opacity-100 focus-visible:opacity-100 transition-opacity' : ''"
                :loading="toggling === row.original.id"
                @click="richiediFattura(row.original)"
              />
            </UTooltip>
            <span v-else class="text-slate-200 text-xs select-none">—</span>
          </template>
          <template #azioni-cell="{ row }">
            <div class="flex justify-end gap-1">
              <UTooltip v-if="row.original.tipo === 'CREDITO' && isManuale(row.original)" text="Segna come incassato (diventa un'Entrata)">
                <UButton
                  icon="i-heroicons-banknotes"
                  size="xs" color="indigo" variant="ghost"
                  @click="apriIncasso(row.original)"
                />
              </UTooltip>
              <UTooltip v-if="row.original.tipo === 'DEBITO' && isManuale(row.original)" text="Segna come pagato (diventa un'Uscita)">
                <UButton
                  icon="i-heroicons-banknotes"
                  size="xs" color="pink" variant="ghost"
                  @click="apriIncasso(row.original)"
                />
              </UTooltip>
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
          <template #descrizione-cell="{ row }">
            <span class="text-sm text-slate-700">{{ row.original.descrizione || row.original.riferimento || '—' }}</span>
          </template>
          <template #tipoPagamento-cell="{ row }">
            <UBadge v-if="row.original.tipoMovimento === 'CREDITO'" color="indigo" variant="subtle" size="xs">Credito</UBadge>
            <span v-else class="text-sm text-slate-600">{{ row.original.tipoPagamento }}</span>
          </template>
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
              <USelect v-model="nuovoMovimento.metodoPagamento" :items="METODI_MOVIMENTO_ITEMS" class="w-full" />
            </UFormField>
          </div>

          <!-- Proventi diversi: categorie fissate dal server, il flag fattura parte attivo -->
          <UFormField v-if="nuovoMovimento.tipo !== 'PROVENTI_DIVERSI'" name="categoria" label="Categoria">
            <USelect v-model="nuovoMovimento.categoria" :items="opzioniForm" value-key="value" class="w-full" />
          </UFormField>

          <!-- Credito: scelta stato fattura (nessuna / da emettere / emessa) -->
          <template v-if="nuovoMovimento.tipo === 'CREDITO'">
            <UFormField label="Fattura">
              <USelect
                v-model="nuovoMovimento.statoFattura"
                :items="[
                  { label: 'Nessuna fattura', value: 'NESSUNA' },
                  { label: 'Da emettere', value: 'DA_EMETTERE' },
                  { label: 'Emessa', value: 'EMESSA' },
                ]"
                value-key="value"
                class="w-full"
              />
            </UFormField>
            <div v-if="nuovoMovimento.statoFattura === 'EMESSA'" class="grid grid-cols-2 gap-4">
              <UFormField label="Numero fattura">
                <UInput v-model="nuovoMovimento.numeroFattura" placeholder="Es. 42" class="w-full" />
              </UFormField>
              <UFormField label="Data emissione">
                <UInput type="date" v-model="nuovoMovimento.dataFattura" class="w-full" />
              </UFormField>
            </div>
          </template>

          <p v-if="nuovoMovimento.tipo === 'PROVENTI_DIVERSI'" class="text-xs text-slate-500 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
            Verranno creati <strong>due movimenti gemelli</strong>: +€ in entrata ("Proventi diversi") e
            −€ in uscita ("Costi per proventi diversi"). Il margine netto non cambia, ma entrate,
            tasse stimate e fatture aumentano.
          </p>

          <UFormField v-if="['ENTRATA', 'PROVENTI_DIVERSI'].includes(nuovoMovimento.tipo)" name="richiedeFattura">
            <UCheckbox v-model="nuovoMovimento.richiedeFattura" label="Richiede fattura" />
          </UFormField>

          <div class="flex justify-end gap-3 pt-4">
            <UButton variant="ghost" @click="modalNuovoMovimentoAperto = false;">Annulla</UButton>
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
          <UButton variant="ghost" @click="modalEliminaAperto = false;">Annulla</UButton>
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
              <USelect v-model="modificaMovimento.metodoPagamento" :items="METODI_MOVIMENTO_ITEMS" class="w-full" />
            </UFormField>
          </div>
          <UFormField label="Categoria">
            <USelect v-model="modificaMovimento.categoria" :items="opzioniForm" value-key="value" class="w-full" />
          </UFormField>
          <UFormField v-if="['ENTRATA', 'CREDITO'].includes(modificaMovimento.tipo)" name="richiedeFattura">
            <UCheckbox v-model="modificaMovimento.richiedeFattura" label="Fattura richiesta (da emettere)" />
            <p class="text-xs text-slate-400 mt-1">Per segnarla come <strong>emessa</strong> usa l'icona fattura nella lista movimenti (chiede numero e data).</p>
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton variant="ghost" @click="modalModificaAperto = false;">Annulla</UButton>
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

    <!-- ─── MODAL F1 — Dettaglio dei bolli ancora da versare ─── -->
    <UModal v-model:open="modalBolliAperto" title="Bolli da versare">
      <template #body>
        <div class="space-y-3">
          <p class="text-sm text-slate-500">
            Sono le marche da bollo da 2 € già incassate dalle famiglie e non ancora versate
            allo Stato. Si versano tutte insieme con un F24: non una alla volta.
          </p>
          <div v-if="loadingBolli" class="flex justify-center py-10">
            <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-slate-400" />
          </div>
          <p v-else-if="bolliLista.length === 0" class="text-center py-8 text-sm text-slate-400">
            Nessun bollo in attesa: il conto è a zero.
          </p>
          <UTable
            v-else
            :data="bolliLista"
            :columns="[
              { accessorKey: 'data',        header: 'Data' },
              { accessorKey: 'descrizione', header: 'Alunno e pacchetto' },
              { accessorKey: 'importo',     header: 'Importo' },
            ]"
          >
            <template #data-cell="{ row }">{{ formatData(row.original.data) }}</template>
            <template #descrizione-cell="{ row }">
              <span class="text-slate-700">{{ nomeBollo(row.original.descrizione) }}</span>
            </template>
            <template #importo-cell="{ row }">
              <span class="font-medium text-slate-800">€ {{ fmt(parseFloat(row.original.importo)) }}</span>
            </template>
          </UTable>
          <div v-if="bolliLista.length" class="flex items-baseline justify-between border-t border-slate-200 pt-2">
            <span class="text-sm font-medium text-slate-700">Totale da versare</span>
            <span class="text-lg font-bold text-orange-700 tabular-nums">€ {{ fmt(bolliTotale) }}</span>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton variant="ghost" @click="modalBolliAperto = false;">Chiudi</UButton>
          <UButton v-if="bolliCount > 0" color="warning" icon="i-heroicons-banknotes" @click="apriVersamentoF24">
            Registra versamento F24
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- ─── MODAL F1 — Registra il versamento cumulativo con F24 ─── -->
    <UModal v-model:open="modalVersamentoAperto" title="Registra versamento F24">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-slate-500">
            Nasce <strong>una sola uscita</strong> con il totale, e tutti i bolli ancora aperti
            vengono segnati come versati. Da quel momento spariscono da "Bolli da versare"
            e da "Da Pagare (Debiti)".
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Data del versamento">
              <UInput v-model="datiVersamento.data" type="date" class="w-full" />
            </UFormField>
            <UFormField label="Metodo">
              <USelect v-model="datiVersamento.metodo" :items="METODI_MOVIMENTO_ITEMS" class="w-full" />
            </UFormField>
          </div>
          <!-- L'importo non si scrive a mano di proposito: è sempre la somma esatta dei
               bolli che si stanno chiudendo, altrimenti uscita e debiti non tornerebbero -->
          <div class="rounded-lg bg-orange-50 border border-orange-100 px-3 py-2.5">
            <p class="text-xs text-orange-600 uppercase tracking-wide font-medium">Importo del versamento</p>
            <p class="text-2xl font-bold text-orange-700 mt-0.5">€ {{ fmt(bolliTotale) }}</p>
            <p class="text-xs text-orange-800 mt-1">
              {{ bolliCount === 1 ? '1 bollo' : `${bolliCount} bolli` }} da € 2,00 —
              il totale lo calcola il gestionale e non è modificabile, così l'uscita
              corrisponde sempre ai bolli che chiude.
            </p>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton variant="ghost" @click="modalVersamentoAperto = false;">Annulla</UButton>
          <UButton color="warning" :loading="salvandoVersamento" :disabled="bolliCount === 0" @click="confermaVersamentoF24">
            Conferma versamento
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- ─── MODAL BREAK-EVEN — il conto riga per riga ─── -->
    <UModal v-model:open="modalBreakEvenAperto" title="Come si calcola il break-even">
      <template #body>
        <div v-if="dash" class="text-sm">
          <!-- Il conto in colonna: voce a sinistra, importi incolonnati a destra -->
          <dl class="space-y-2">
            <div class="flex items-baseline justify-between gap-4">
              <dt class="text-slate-600">Entrate del periodo</dt>
              <dd class="font-medium text-green-700 tabular-nums whitespace-nowrap">+ € {{ fmt(dash.periodo.entrate) }}</dd>
            </div>
            <div class="flex items-baseline justify-between gap-4">
              <dt class="text-slate-600">Uscite del periodo</dt>
              <dd class="font-medium text-red-700 tabular-nums whitespace-nowrap">− € {{ fmt(dash.periodo.uscite) }}</dd>
            </div>

            <!--
              Il passaggio che prima mancava, ed è il motivo per cui il break-even
              sembrava disastroso: l'affitto (e le altre spese previste) veniva contato
              una volta come movimento vero e una seconda come spesa fissa. Qui i
              movimenti che le spese previste sostituiscono tornano indietro.
            -->
            <div v-if="righeSostituzione.length" class="flex items-baseline justify-between gap-4">
              <dt class="text-slate-600 pl-3">di cui sostituite dalle spese previste</dt>
              <dd class="font-medium text-green-700 tabular-nums whitespace-nowrap">+ € {{ fmt(sostituzioni.totale) }}</dd>
            </div>
          </dl>

          <!-- Categoria per categoria: quanto era previsto e quanto è uscito davvero -->
          <ul v-if="righeSostituzione.length" class="mt-2 space-y-1 pl-3 border-l-2 border-slate-100">
            <li
              v-for="riga in righeSostituzione"
              :key="riga.categoria"
              class="text-xs"
              :class="riga.sforamento ? 'rounded-md bg-amber-50 px-2 py-1 -ml-2' : ''"
            >
              <div class="flex items-baseline justify-between gap-3">
                <span class="min-w-0" :class="riga.sforamento ? 'text-amber-900 font-medium' : 'text-slate-600'">
                  {{ labelCategoria(riga.categoria) }}
                </span>
                <span class="tabular-nums whitespace-nowrap" :class="riga.sforamento ? 'text-amber-900' : 'text-slate-500'">
                  previsto € {{ fmt(riga.previsto) }} · speso davvero € {{ fmt(riga.speso) }}
                </span>
              </div>
              <p v-if="riga.sforamento" class="mt-0.5 text-amber-700 flex items-start gap-1">
                <UIcon name="i-heroicons-exclamation-triangle" class="w-3.5 h-3.5 shrink-0 mt-px" />
                <span>
                  Qui stai spendendo <strong>€ {{ fmt(riga.differenza) }} in più</strong> di quanto avevi previsto.
                  Il break-even resta calcolato sul previsto: questo è solo un avviso.
                </span>
              </p>
            </li>
          </ul>

          <dl class="space-y-2 mt-2">
            <!-- Senza nessuna spesa collegata questa riga ripeterebbe le uscite tali e
                 quali: si mostra solo quando c'è davvero qualcosa di sostituito. -->
            <div v-if="righeSostituzione.length" class="border-t border-slate-200 pt-2 flex items-baseline justify-between gap-4">
              <dt class="font-medium text-slate-700">Uscite che restano</dt>
              <dd class="font-semibold text-slate-900 tabular-nums whitespace-nowrap">= € {{ fmt(sostituzioni.usciteRestanti) }}</dd>
            </div>

            <div class="flex items-baseline justify-between gap-4">
              <dt class="text-slate-600">Spese fisse previste del periodo</dt>
              <dd class="font-medium text-red-700 tabular-nums whitespace-nowrap">− € {{ fmt(dash.costiFissi.periodo) }}</dd>
            </div>
          </dl>

          <!-- Le spese fisse una per una: la somma di queste righe È il totale qui sopra -->
          <ul v-if="dash.costiFissi.dettaglio.length" class="mt-2 space-y-1 pl-3 border-l-2 border-slate-100">
            <li
              v-for="(voce, i) in dash.costiFissi.dettaglio"
              :key="i"
              class="flex items-baseline justify-between gap-3 text-xs text-slate-500"
            >
              <span class="min-w-0">
                <span class="text-slate-600">{{ voce.nome || 'Spesa senza nome' }}</span>
                <span class="text-slate-400"> — € {{ fmt(voce.importoMensile) }} al mese × {{ etichettaMesi(voce.mesi) }}</span>
                <span v-if="voce.categoria" class="text-slate-400"> · al posto di “{{ labelCategoria(voce.categoria) }}”</span>
                <UIcon v-else name="i-heroicons-exclamation-triangle" class="w-3.5 h-3.5 text-amber-500 ml-1 align-text-bottom" title="Non collegata a nessuna categoria" />
              </span>
              <span class="tabular-nums whitespace-nowrap">€ {{ fmt(voce.totalePeriodo) }}</span>
            </li>
          </ul>
          <p v-else class="mt-2 pl-3 border-l-2 border-slate-100 text-xs text-slate-400">
            Nessuna spesa fissa attiva in questo periodo (si impostano in Impostazioni → Spese fisse).
          </p>

          <!-- Spese previste ancora scollegate: il doppio conteggio è ancora lì, e va detto -->
          <div v-if="speseNonCollegate.length" class="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
            <p class="font-medium flex items-start gap-1">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 shrink-0 mt-px text-amber-600" />
              <span>Non collegata a nessuna categoria: se la registri anche in contabilità, viene contata due volte.</span>
            </p>
            <p class="mt-1 pl-5">
              {{ speseNonCollegate.map((s) => s.nome).join(' · ') }}
            </p>
            <p class="mt-1 pl-5 text-amber-700">
              Si collega in <strong>Impostazioni → Spese fisse</strong>, colonna “Categoria che sostituisce”.
            </p>
          </div>

          <div class="mt-3 pt-2 border-t-2 border-slate-300 flex items-baseline justify-between gap-4">
            <span class="font-bold uppercase tracking-wide text-slate-700">Break-even</span>
            <span
              class="text-lg font-bold tabular-nums whitespace-nowrap"
              :class="dash.breakEven >= 0 ? 'text-emerald-700' : 'text-rose-700'"
            >= € {{ fmt(dash.breakEven) }}</span>
          </div>

          <!-- La stessa cosa detta a parole, per chi non ha voglia di leggere una colonna di numeri -->
          <p
            class="mt-4 rounded-lg p-3 leading-relaxed"
            :class="dash.breakEven >= 0 ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'"
          >
            Per andare in pari nel periodo servono <strong>€ {{ fmt(entrateNecessarie) }}</strong> di entrate:
            ne hai fatte <strong>€ {{ fmt(dash.periodo.entrate) }}</strong>.
            <template v-if="dash.breakEven < 0">
              Ti mancano <strong>€ {{ fmt(-dash.breakEven) }}</strong>.
            </template>
            <template v-else>
              Sei in pari, con <strong>€ {{ fmt(dash.breakEven) }}</strong> di margine oltre il necessario.
            </template>
          </p>
        </div>
      </template>
    </UModal>

    <!-- ─── MODAL DATI FATTURA (numero + data emissione) ─── -->
    <UModal v-model:open="modalDatiFatturaAperto" title="Dati fattura">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-slate-500">Inserisci numero e data della fattura: verranno aggiunti in coda alla descrizione del movimento.</p>
          <UFormField label="Numero fattura" required>
            <UInput v-model="datiFattura.numero" placeholder="Es. 42" class="w-full" autofocus />
          </UFormField>
          <UFormField label="Data emissione" required>
            <UInput type="date" v-model="datiFattura.data" class="w-full" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton variant="ghost" @click="modalDatiFatturaAperto = false;">Annulla</UButton>
          <UButton :disabled="!datiFattura.numero || !datiFattura.data" @click="confermaDatiFattura">Conferma</UButton>
        </div>
      </template>
    </UModal>

    <!-- ─── MODAL SEGNA SALDATO (credito → entrata, debito → uscita) ─── -->
    <UModal v-model:open="modalIncassoAperto" :title="isDebitoDaSaldare ? 'Segna debito come pagato' : 'Segna credito come incassato'">
      <template #body>
        <div class="space-y-4">
          <p v-if="isDebitoDaSaldare" class="text-sm text-slate-500">
            Il debito diventerà un'<strong>Uscita</strong> reale e sparirà dal totale "Da Pagare".
          </p>
          <p v-else class="text-sm text-slate-500">
            Il credito diventerà un'<strong>Entrata</strong> reale. Il Fatturato non cambia
            (se la fattura era già emessa resta contata una sola volta).
          </p>
          <div class="grid grid-cols-2 gap-4">
            <UFormField :label="isDebitoDaSaldare ? 'Data pagamento' : 'Data incasso'">
              <UInput type="date" v-model="datiIncasso.data" class="w-full" />
            </UFormField>
            <UFormField label="Metodo">
              <USelect v-model="datiIncasso.metodo" :items="METODI_MOVIMENTO_ITEMS" class="w-full" />
            </UFormField>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton variant="ghost" @click="modalIncassoAperto = false;">Annulla</UButton>
          <UButton :loading="salvandoIncasso" @click="confermaIncasso">
            {{ isDebitoDaSaldare ? 'Conferma pagamento' : 'Conferma incasso' }}
          </UButton>
        </div>
      </template>
    </UModal>

  </div>
</template>

<script setup lang="ts">
import { z } from 'zod'
import { labelMetodo, labelTipo, METODI_MOVIMENTO_ITEMS } from '~/utils/contabilita'
import { CAT, mappaEtichette } from '#shared/accounting-categories'

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

// Filtro Metodo della lista movimenti: riusa l'unico elenco dei metodi (app/utils/contabilita.ts)
// invece di riscriverlo, così una modifica ai metodi si riflette ovunque.
// "Altro" comprende anche i movimenti senza metodo indicato, esattamente come nella
// card "Movimenti per metodo": i due numeri devono sempre coincidere.
const opzioniFiltroMetodo = [
  { label: 'Tutti i metodi', value: 'TUTTI' },
  ...METODI_MOVIMENTO_ITEMS,
]

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
const { data: debitiTutor, refresh: refreshDebitiTutor } = useLazyFetch('/api/tutors/debiti-summary')
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
    // soloAperti: esclude i bolli già chiusi da un versamento F24, esattamente come
    // fa il totale della card. Elenco e numero grande devono sempre coincidere.
    const res = await $fetch<{ data: any[] }>('/api/accounting/entries', { query: { tipo, limit: 100, soloAperti: 'true' } })
    entriePrevisionali.value = res.data ?? []
  } finally {
    loadingPrevisionali.value = false
  }
}

// ─── F1 — Bolli da versare (card + dettaglio + versamento cumulativo F24) ───
// Il numero e il totale arrivano già dalla dashboard: la card è pronta senza
// aspettare una seconda chiamata. L'elenco si carica solo quando si apre il dettaglio.
const bolliCount  = computed(() => (dash.value as any)?.bolliDaVersare?.count ?? 0)
const bolliTotale = computed(() => (dash.value as any)?.bolliDaVersare?.totale ?? 0)

const modalBolliAperto = ref(false)
const bolliLista       = ref<any[]>([])
const loadingBolli     = ref(false)

// "Bollo — Luca Rossi · Superiori 2026/2027" → "Luca Rossi · Superiori 2026/2027":
// nella colonna "Alunno e pacchetto" la parola "Bollo" sarebbe solo rumore.
function nomeBollo(descrizione: string): string {
  return String(descrizione ?? '').replace(/^Bollo\s+—\s+/, '')
}

async function apriDettaglioBolli() {
  modalBolliAperto.value = true
  loadingBolli.value     = true
  try {
    const res = await $fetch<{ lista: any[] }>('/api/accounting/bolli')
    bolliLista.value = res.lista ?? []
  } catch {
    bolliLista.value = []
  } finally {
    loadingBolli.value = false
  }
}

const modalVersamentoAperto = ref(false)
const salvandoVersamento    = ref(false)
const datiVersamento        = reactive({ data: oggiISO(), metodo: 'BONIFICO' })

function apriVersamentoF24() {
  datiVersamento.data   = oggiISO()
  datiVersamento.metodo = 'BONIFICO'
  modalBolliAperto.value     = false
  modalVersamentoAperto.value = true
}

async function confermaVersamentoF24() {
  salvandoVersamento.value = true
  try {
    const res = await $fetch<{ bolliChiusi: number; totale: number }>('/api/accounting/bolli/versamento', {
      method: 'POST',
      body: { data: datiVersamento.data, metodoPagamento: datiVersamento.metodo },
    })
    toast.add({
      title: 'Versamento registrato',
      description: `${res.bolliChiusi === 1 ? '1 bollo chiuso' : `${res.bolliChiusi} bolli chiusi`} per € ${fmt(res.totale)}.`,
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })
    modalVersamentoAperto.value = false
    refreshAll()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile registrare il versamento', color: 'error' })
  } finally {
    salvandoVersamento.value = false
  }
}

// ─── E7 — Popup con il calcolo del break-even, voce per voce ───
const modalBreakEvenAperto = ref(false)

// Il blocco "di cui sostituite": le spese previste che prendono il posto dei movimenti
// veri, così l'affitto non viene contato due volte. Lo calcola il server.
const sostituzioni = computed(() => {
  const s = (dash.value as any)?.sostituzioni
  return {
    totale:         (s?.totale ?? 0) as number,
    usciteRestanti: (s?.usciteRestanti ?? dash.value?.periodo?.uscite ?? 0) as number,
    righe:          (s?.righe ?? []) as { categoria: string; previsto: number; speso: number; differenza: number; sforamento: boolean }[],
    nonCollegate:   (s?.nonCollegate ?? []) as { nome: string; totalePeriodo: number }[],
  }
})
const righeSostituzione  = computed(() => sostituzioni.value.righe)
const speseNonCollegate  = computed(() => sostituzioni.value.nonCollegate)

// Quante entrate servirebbero per chiudere il periodo in pari: le uscite che RESTANO
// (quelle non sostituite) più le spese previste. Non è un numero nuovo, è lo stesso
// conto letto al contrario: entrate − (uscite che restano + spese previste) = break-even.
const entrateNecessarie = computed(() => {
  const d = dash.value
  if (!d) return 0
  return Number((sostituzioni.value.usciteRestanti + (d.costiFissi.periodo ?? 0)).toFixed(2))
})

// "1 mese", "2 mesi", "1,5 mesi": i periodi non sempre coincidono con mesi interi
function etichettaMesi(mesi: number): string {
  const n = mesi.toLocaleString('it-IT', { maximumFractionDigits: 2 })
  return mesi === 1 ? '1 mese' : `${n} mesi`
}

// ─── Lista Movimenti (stesso periodo + filtri Tipo/Categoria/Metodo) ───
const filtroEntries = reactive({
  tipo:      'TUTTI',
  categoria: 'TUTTE',
  metodo:    'TUTTI',
  fattura:   'TUTTE',
  page:      1,
  limit:     50,
})

const filtroFatturaQuery = () => (filtroEntries.fattura !== 'TUTTE' ? filtroEntries.fattura : undefined)
const filtroMetodoQuery  = () => (filtroEntries.metodo  !== 'TUTTI' ? filtroEntries.metodo  : undefined)

const { data: entriesData, pending: pendingEntries, refresh: refreshEntries } = useLazyFetch('/api/accounting/entries', {
  query: computed(() => ({
    dataInizio: periodo.dataInizio || undefined,
    dataFine: periodo.dataFine || undefined,
    tipo: (filtroEntries.tipo && filtroEntries.tipo !== 'TUTTI') ? filtroEntries.tipo : undefined,
    categoria: (filtroEntries.categoria && filtroEntries.categoria !== 'TUTTE') ? filtroEntries.categoria : undefined,
    metodo: filtroMetodoQuery(),
    fattura: filtroFatturaQuery(),
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

async function esportaCsv() {
  scaricandoCsv.value = true
  try {
    const res = await $fetch<{ data: any[] }>('/api/accounting/entries', {
      query: {
        dataInizio: periodo.dataInizio || undefined,
        dataFine: periodo.dataFine || undefined,
        tipo: (filtroEntries.tipo && filtroEntries.tipo !== 'TUTTI') ? filtroEntries.tipo : undefined,
        categoria: (filtroEntries.categoria && filtroEntries.categoria !== 'TUTTE') ? filtroEntries.categoria : undefined,
        metodo: filtroMetodoQuery(),
        fattura: filtroFatturaQuery(),
        page: 1,
        limit: 10000, // ponytail: una sola pagina gigante — sopra i 10k movimenti servirà uno streaming
      },
    })
    const righe = res.data ?? []

    // Separatore ';' e BOM UTF-8 (app/utils/csv.ts): è quello che Excel italiano si aspetta
    const intestazione = ['Data', 'Tipo', 'Categoria', 'Descrizione', 'Metodo', 'Importo', 'Fattura richiesta', 'Fattura emessa']
    const corpo = righe.map((r) => [
      formatData(r.data),
      labelTipo(r.tipo),
      labelCategoria(r.categoria),
      (r.descrizione ?? '') + (nomeTutor(r) ? ` · ${nomeTutor(r)}` : ''),
      labelMetodo(r.metodoPagamento),
      // Virgola decimale per Excel italiano
      String(parseFloat(r.importo ?? '0').toFixed(2)).replace('.', ','),
      r.richiedeFattura ? 'Sì' : 'No',
      r.fatturaEmessa ? 'Sì' : 'No',
    ])

    scaricaCsv(`movimenti_${periodo.dataInizio}_${periodo.dataFine}.csv`, righeInCsv(intestazione, corpo))
  } catch {
    toast.add({ title: 'Errore durante l\'esportazione', color: 'error' })
  } finally {
    scaricandoCsv.value = false
  }
}

// USelect (Reka UI) non emette un evento `change` affidabile → osserviamo i filtri.
watch(() => [filtroEntries.tipo, filtroEntries.categoria, filtroEntries.metodo, filtroEntries.fattura], caricaEntries)

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
  filtroEntries.fattura = 'TUTTE'
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
  { accessorKey: 'descrizione',     header: 'Riferimento' },
  { accessorKey: 'importo',         header: 'Importo' },
  { accessorKey: 'dataPagamento',   header: 'Data pagamento' },
  { accessorKey: 'tipoPagamento',   header: 'Tipo' },
  { accessorKey: 'metodoPagamento', header: 'Metodo' },
  { id: 'azione', accessorKey: 'entryId', header: '' },
]

// ─── E1 — Toggle fattura ───
const toggling = ref<string | null>(null)

// ─── Modal "Dati fattura" (numero + data alla marcatura come emessa) ───
const modalDatiFatturaAperto = ref(false)
const datiFattura = reactive({ numero: '', data: oggiISO() })
// callback eseguita alla conferma del modal (sa quale entry sta marcando)
const confermaFatturaFn = ref<((numero: string, data: string) => Promise<void>) | null>(null)

function chiediDatiFattura(fn: (numero: string, data: string) => Promise<void>) {
  datiFattura.numero = ''
  datiFattura.data = oggiISO()
  confermaFatturaFn.value = fn
  modalDatiFatturaAperto.value = true
}

async function confermaDatiFattura() {
  if (!confermaFatturaFn.value) return
  await confermaFatturaFn.value(datiFattura.numero, datiFattura.data)
  modalDatiFatturaAperto.value = false
  confermaFatturaFn.value = null
}

async function toggleFattura(entry: any) {
  const nuovoStato = !entry.fatturaEmessa
  // Marcatura come EMESSA → chiedi numero + data
  if (nuovoStato) {
    chiediDatiFattura(async (numero, data) => {
      await inviaFattura(entry, true, numero, data)
    })
    return
  }
  // Rimozione della fattura → nessun dato richiesto
  await inviaFattura(entry, false)
}

// Invio effettivo: sceglie l'endpoint giusto (pagamento vs movimento manuale)
async function inviaFattura(entry: any, emessa: boolean, numero?: string, data?: string) {
  toggling.value = entry.id
  try {
    const body: Record<string, unknown> = { fatturaEmessa: emessa }
    if (emessa) { body.numeroFattura = numero; body.dataFattura = data }
    if (entry.paymentId) {
      await $fetch(`/api/payments/${entry.paymentId}/invoice`, { method: 'PUT', body })
    } else {
      await $fetch(`/api/accounting/entries/${entry.id}`, { method: 'PUT', body })
    }
    toast.add({ title: emessa ? 'Fattura segnata come emessa' : 'Fattura rimossa', color: 'success', icon: 'i-heroicons-check-circle' })
    refreshAll()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Operazione non riuscita', color: 'error' })
  } finally {
    toggling.value = null
  }
}

// Movimento in entrata senza flag fattura: lo aggiunge alle "fatture da emettere".
// Manuale → flag sul movimento; automatico → flag sul pagamento di origine.
async function richiediFattura(entry: any) {
  toggling.value = entry.id
  try {
    if (entry.paymentId) {
      await $fetch(`/api/payments/${entry.paymentId}/invoice`, { method: 'PUT', body: { richiedeFattura: true } })
    } else {
      await $fetch(`/api/accounting/entries/${entry.id}`, { method: 'PUT', body: { richiedeFattura: true } })
    }
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

function segnaFatturaEmessa(row: any) {
  chiediDatiFattura(async (numero, data) => {
    segnandoFattura.value = row.entryId
    try {
      const body = { fatturaEmessa: true, numeroFattura: numero, dataFattura: data }
      // Movimenti manuali (es. Proventi diversi, Crediti) non hanno un pagamento collegato
      if (row.paymentId) {
        await $fetch(`/api/payments/${row.paymentId}/invoice`, { method: 'PUT', body })
      } else {
        await $fetch(`/api/accounting/entries/${row.entryId}`, { method: 'PUT', body })
      }
      toast.add({ title: 'Fattura segnata come emessa', color: 'success', icon: 'i-heroicons-check-circle' })
      refreshDash()
    } catch (err: any) {
      toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Impossibile aggiornare', color: 'error' })
    } finally {
      segnandoFattura.value = null
    }
  })
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
  categoria: CAT.SPESE_GENERALI as string,
  metodoPagamento: 'BONIFICO',
  data: oggiISO(),
  richiedeFattura: false,
  statoFattura: 'NESSUNA' as 'NESSUNA' | 'DA_EMETTERE' | 'EMESSA',
  numeroFattura: '',
  dataFattura: oggiISO(),
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
        // Credito: la richiesta/emissione fattura arriva dalla tendina statoFattura
        richiedeFattura: nuovoMovimento.tipo === 'CREDITO'
          ? nuovoMovimento.statoFattura !== 'NESSUNA'
          : nuovoMovimento.richiedeFattura,
        fatturaEmessa: nuovoMovimento.tipo === 'CREDITO' && nuovoMovimento.statoFattura === 'EMESSA',
        numeroFattura: nuovoMovimento.numeroFattura || undefined,
        dataFattura: nuovoMovimento.dataFattura || undefined,
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

// Nome del tutor sui compensi/rimborsi (arriva dalla giunzione lato server).
// Lo mostriamo solo se non è già nella descrizione: i movimenti importati dal
// vecchio gestionale lo contengono già ("Compenso Mario Rossi - dicembre 2025").
function nomeTutor(r: any): string | null {
  if (!r.tutorNome) return null
  return (r.descrizione ?? '').includes(r.tutorNome) ? null : r.tutorNome
}

// ─── Azioni movimenti ───
function isAuto(row: any) {
  return !!(row.paymentId || row.tutorPaymentId || row.reimbursementId)
}
function isManuale(row: any) {
  return !isAuto(row)
}

// ─── "Segna saldato": Credito → Entrata, Debito → Uscita ───
const modalIncassoAperto = ref(false)
const movimentoDaSaldare = ref<any>(null)
const salvandoIncasso = ref(false)
const datiIncasso = reactive({ data: oggiISO(), metodo: 'BONIFICO' })
const isDebitoDaSaldare = computed(() => movimentoDaSaldare.value?.tipo === 'DEBITO')

function apriIncasso(row: any) {
  movimentoDaSaldare.value = row
  datiIncasso.data = oggiISO()
  datiIncasso.metodo = row.metodoPagamento || 'BONIFICO'
  modalIncassoAperto.value = true
}

async function confermaIncasso() {
  if (!movimentoDaSaldare.value) return
  const debito = isDebitoDaSaldare.value
  salvandoIncasso.value = true
  try {
    await $fetch(`/api/accounting/entries/${movimentoDaSaldare.value.id}`, {
      method: 'PUT',
      body: { tipo: debito ? 'USCITA' : 'ENTRATA', data: datiIncasso.data, metodoPagamento: datiIncasso.metodo },
    })
    toast.add({ title: debito ? 'Debito pagato' : 'Credito incassato', color: 'success', icon: 'i-heroicons-check-circle' })
    modalIncassoAperto.value = false
    movimentoDaSaldare.value = null
    refreshAll()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage ?? 'Operazione non riuscita', color: 'error' })
  } finally {
    salvandoIncasso.value = false
  }
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
        richiedeFattura: ['ENTRATA', 'CREDITO'].includes(modificaMovimento.tipo) ? modificaMovimento.richiedeFattura : false,
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
