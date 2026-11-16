<template>
  <!-- IL PORTALE DELLE FAMIGLIE, grafica v6. Pensato per il telefono: sul computer la
       stessa colonna sta al centro, larga al massimo 640 px, con il menu in fondo alla
       colonna. La testata blu la mette ogni pagina (components/portale/Testata.vue),
       perché cambia da una schermata all'altra (titolo, Indietro, linguette). -->
  <div class="pf min-h-screen bg-pf-fondo text-pf-testo font-sans overflow-x-hidden">
    <div class="mx-auto max-w-[640px] min-h-screen flex flex-col" :class="senzaMenu ? '' : 'pb-28'">
      <slot />

      <footer class="mt-auto px-5 pt-10 pb-4 text-center text-xs text-pf-grigio">
        <NuxtLink to="/privacy" class="inline-block py-2 px-1 hover:underline">Privacy</NuxtLink> ·
        <NuxtLink to="/termini" class="inline-block py-2 px-1 hover:underline">Termini</NuxtLink> ·
        <NuxtLink to="/cookie" class="inline-block py-2 px-1 hover:underline">Cookie</NuxtLink>
      </footer>
    </div>

    <PortaleMenu v-if="!senzaMenu" />

    <!-- Benvenuto al primo accesso e Novità dopo un aggiornamento -->
    <PortalePresentazione />
  </div>
</template>

<script setup lang="ts">
// Le pagine che hanno già il loro bottone in fondo (Prenota) o che vengono prima di
// tutto il resto (Termini) dichiarano `senzaMenu` in definePageMeta.
const route = useRoute()
const senzaMenu = computed(() => route.meta.senzaMenu === true)

// Il pallino della campanella: le notifiche nuove. La pagina Notifiche lo aggiorna
// (useState) quando si segna tutto come letto. Una lettura sola, condivisa dalle pagine.
const notificheNuove = useState<number>('portal-notifiche-nuove', () => 0)
const { data: notificheRes } = useLazyFetch<{ nuove: number }>('/api/portal/notifiche', { server: false, key: 'portale-notifiche-menu' })
watchEffect(() => { if (notificheRes.value) notificheNuove.value = notificheRes.value.nuove })
</script>
