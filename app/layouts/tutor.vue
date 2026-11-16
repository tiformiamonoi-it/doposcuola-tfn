<template>
  <div class="pf min-h-screen bg-pf-fondo text-pf-testo font-sans overflow-x-hidden">
    <!-- L'AREA TUTOR, nella stessa veste del portale famiglie (layouts/portal.vue): colonna
         larga al massimo 640 px, testata blu messa da ogni pagina, menu in basso con la Card
         al centro. Solo per il ruolo TUTOR: Super Tutor e Admin restano sul gestionale (D1). -->
    <div class="mx-auto max-w-[640px] min-h-screen flex flex-col pb-28">
      <slot />

      <footer class="mt-auto px-5 pt-10 pb-4 text-center text-xs text-pf-grigio">
        <NuxtLink to="/privacy" class="inline-block py-2 px-1 hover:underline">Privacy</NuxtLink> ·
        <NuxtLink to="/termini" class="inline-block py-2 px-1 hover:underline">Termini</NuxtLink> ·
        <NuxtLink to="/cookie" class="inline-block py-2 px-1 hover:underline">Cookie</NuxtLink>
      </footer>
    </div>

    <PortaleMenu :voci="VOCI" />

    <!-- Benvenuto al primo accesso e Novità dopo un aggiornamento, a schermo intero come
         nel portale famiglie (D6). Schermate dei tutor in Presentazione e in shared/changelog.ts. -->
    <PortalePresentazione />
  </div>
</template>

<script setup lang="ts">
// Le cinque voci del tutor (D2). Niente campanella: il tutor oggi non ha notifiche.
// La Disponibilità accende "Lezioni" (ci si arriva da lì); le Note non accendono niente.
const VOCI = [
  { to: '/area-tutor',             etichetta: 'Home',        icona: 'i-heroicons-home' },
  { to: '/tutor-calendario',       etichetta: 'Lezioni',     icona: 'i-heroicons-calendar-days', anche: ['/area-tutor/disponibilita'] },
  { to: '/area-tutor/card',        etichetta: 'Card',        icona: 'i-heroicons-qr-code', centrale: true },
  { to: '/area-tutor/convenzioni', etichetta: 'Convenzioni', icona: 'i-heroicons-tag' },
  { to: '/area-tutor/profilo',     etichetta: 'Profilo',     icona: 'i-heroicons-user' },
]
</script>
