<template>
  <div class="min-h-screen bg-slate-50">

    <!-- ═══ SIDEBAR ═══ -->
    <aside
      :style="{ width: collapsed ? '64px' : '240px' }"
      class="fixed left-0 top-0 h-screen bg-white border-r border-slate-200 flex flex-col z-40 overflow-hidden"
      style="transition: width 300ms ease"
    >

      <!-- Logo + Toggle -->
      <div class="h-14 flex items-center border-b border-slate-200 px-3 flex-shrink-0 gap-2">
        <UIcon name="i-heroicons-book-open" class="w-5 h-5 text-tfn-500 flex-shrink-0" />
        <span
          v-if="!collapsed"
          class="font-heading font-semibold text-slate-900 text-sm truncate flex-1"
        >
          Ti Formiamo Noi
        </span>
        <button
          @click="toggleSidebar"
          class="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400 flex-shrink-0 ml-auto"
          :title="collapsed ? 'Espandi menu' : 'Comprimi menu'"
        >
          <UIcon name="i-heroicons-bars-3" class="w-4 h-4" />
        </button>
      </div>

      <!-- Nav Items -->
      <nav class="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
        <NuxtLink
          v-for="item in navItems"
          :key="item.route"
          :to="item.route"
          class="flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-colors duration-150 relative group"
          :class="isActive(item.route)
            ? 'bg-tfn-50 text-tfn-600'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'"
        >
          <!-- Barra attiva sinistra -->
          <div
            v-if="isActive(item.route)"
            class="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-tfn-500 rounded-r"
          />
          <UIcon :name="item.icon" class="w-5 h-5 flex-shrink-0" />
          <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
          <!-- Tooltip sidebar collassata -->
          <span
            v-if="collapsed"
            class="absolute left-full ml-3 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50"
          >
            {{ item.label }}
          </span>
        </NuxtLink>
      </nav>

      <!-- Footer: Avatar + Logout -->
      <div class="border-t border-slate-200 p-2 flex-shrink-0 space-y-1">
        <!-- Avatar + nome (solo espansa) -->
        <div v-if="!collapsed" class="flex items-center gap-2 px-2 py-1.5">
          <div class="w-7 h-7 rounded-full bg-tfn-500 flex items-center justify-center flex-shrink-0">
            <span class="text-white text-xs font-semibold">A</span>
          </div>
          <div class="min-w-0">
            <p class="text-xs font-semibold text-slate-900 truncate">Admin</p>
            <p class="text-[10px] text-slate-400 uppercase tracking-wide">ADMIN</p>
          </div>
        </div>
        <!-- Logout -->
        <button
          class="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors group relative"
          :class="collapsed ? 'justify-center' : ''"
        >
          <UIcon name="i-heroicons-arrow-right-on-rectangle" class="w-5 h-5 flex-shrink-0" />
          <span v-if="!collapsed">Esci</span>
          <span
            v-if="collapsed"
            class="absolute left-full ml-3 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50"
          >
            Esci
          </span>
        </button>
      </div>
    </aside>

    <!-- ═══ HEADER ═══ -->
    <header
      :style="{ left: collapsed ? '64px' : '240px' }"
      class="fixed top-0 right-0 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-30"
      style="transition: left 300ms ease"
    >
      <h1 class="text-sm font-semibold text-slate-900">{{ pageTitle }}</h1>
      <div class="w-7 h-7 rounded-full bg-tfn-500 flex items-center justify-center">
        <span class="text-white text-xs font-semibold">A</span>
      </div>
    </header>

    <!-- ═══ MAIN CONTENT ═══ -->
    <main
      :style="{ marginLeft: collapsed ? '64px' : '240px' }"
      class="mt-14 min-h-[calc(100vh-3.5rem)] bg-slate-50 p-6"
      style="transition: margin-left 300ms ease"
    >
      <slot />
    </main>

  </div>
</template>

<script setup lang="ts">
const collapsed = useCookie<boolean>('sidebar-collapsed', {
  default: () => false,
  sameSite: 'lax',
})

function toggleSidebar() {
  collapsed.value = !collapsed.value
}

const route = useRoute()

const navItems = [
  { icon: 'i-heroicons-squares-2x2',  label: 'Dashboard',    route: '/' },
  { icon: 'i-heroicons-users',         label: 'Studenti',     route: '/studenti' },
  { icon: 'i-heroicons-cube',          label: 'Pacchetti',    route: '/pacchetti' },
  { icon: 'i-heroicons-calendar-days', label: 'Lezioni',      route: '/lezioni' },
  { icon: 'i-heroicons-academic-cap',  label: 'Tutor',        route: '/tutor' },
  { icon: 'i-heroicons-banknotes',     label: 'Contabilità',  route: '/contabilita' },
  { icon: 'i-heroicons-cog-6-tooth',   label: 'Impostazioni', route: '/impostazioni' },
]

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

const pageTitle = computed(() => {
  const item = navItems.find(n =>
    n.route === '/' ? route.path === '/' : route.path.startsWith(n.route)
  )
  return item?.label ?? 'Gestionale'
})
</script>
