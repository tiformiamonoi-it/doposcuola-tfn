<template>
  <div class="min-h-screen bg-white">

    <!-- ═══ HEADER ═══ -->
    <header class="fixed top-0 left-0 right-0 h-16 bg-tfn-500 flex items-center justify-between px-4 z-40">
      <div class="w-8" />
      <span class="font-heading font-semibold text-white text-base tracking-tight">
        Ti Formiamo Noi
      </span>
      <div class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
        <span class="text-white text-xs font-semibold">
          {{ user?.firstName?.[0] ?? 'G' }}
        </span>
      </div>
    </header>

    <!-- ═══ DESKTOP NAV (md+) ═══ -->
    <nav class="hidden md:flex fixed top-16 left-0 right-0 bg-white border-b border-slate-200 justify-center gap-8 h-12 items-center z-30">
      <NuxtLink
        v-for="item in visibleNavItems"
        :key="item.route"
        :to="item.route"
        class="flex items-center gap-1.5 text-sm font-medium transition-colors"
        :class="isActive(item.route)
          ? 'text-tfn-600'
          : 'text-slate-500 hover:text-slate-900'"
      >
        <UIcon :name="item.icon" class="w-4 h-4" />
        {{ item.label }}
      </NuxtLink>
    </nav>

    <!-- ═══ CONTENUTO ═══ -->
    <main class="pt-16 pb-16 md:pt-28 md:pb-0 min-h-screen">
      <div class="max-w-[680px] mx-auto px-4 md:px-6 py-6">
        <slot />
      </div>
    </main>

    <!-- ═══ BOTTOM NAV (mobile) ═══ -->
    <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex z-40 h-16">
      <NuxtLink
        v-for="item in visibleNavItems"
        :key="item.route"
        :to="item.route"
        class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
        :class="isActive(item.route) ? 'text-tfn-600' : 'text-slate-400'"
      >
        <UIcon :name="item.icon" class="w-6 h-6" />
        <span class="text-[10px] font-medium">{{ item.label }}</span>
      </NuxtLink>
    </nav>

  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { user } = useUserSession()

const { data: studentsData } = await useFetch('/api/portal/students')
const students = computed(() => (studentsData.value as any[]) ?? [])

const prenotazioneAbilitata = computed(() =>
  students.value.some((s: any) => s.abilitatoPrenotazioneOnline)
)

const allNavItems = [
  { icon: 'i-heroicons-home',          label: 'Home',    route: '/portale',          always: true },
  { icon: 'i-heroicons-calendar-days', label: 'Prenota', route: '/portale/prenota',  always: false },
  { icon: 'i-heroicons-document-text', label: 'Note',    route: '/portale/note',     always: true },
  { icon: 'i-heroicons-user',          label: 'Profilo', route: '/portale/profilo',  always: true },
]

const visibleNavItems = computed(() =>
  allNavItems.filter(item => item.always || prenotazioneAbilitata.value)
)

function isActive(path: string) {
  if (path === '/portale') return route.path === '/portale'
  return route.path.startsWith(path)
}
</script>
