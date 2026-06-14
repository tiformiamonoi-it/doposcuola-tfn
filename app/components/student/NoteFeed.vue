<template>
  <div class="space-y-6">
    
    <!-- Nuova Nota Form -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-pencil-square" class="w-5 h-5 text-tfn-500" />
          <h3 class="font-semibold text-slate-800">Scrivi una nota</h3>
        </div>
      </template>

      <form @submit.prevent="submitNota" class="space-y-4">
        <UFormField name="contenuto">
          <UTextarea 
            v-model="nuovaNota.contenuto" 
            placeholder="Scrivi qui il contenuto della nota..." 
            :rows="3" 
            autoresize 
            class="w-full"
            required
          />
        </UFormField>
        
        <div class="flex items-center justify-between">
          <UFormField name="visibilita" label="Visibilità">
            <USelect 
              v-model="nuovaNota.visibilita" 
              :items="[
                { label: 'Interna (Solo Staff)', value: 'INTERNA' },
                { label: 'Famiglia (Visibile ai genitori)', value: 'FAMIGLIA' }
              ]"
            />
          </UFormField>
          
          <UButton 
            type="submit" 
            icon="i-heroicons-paper-airplane" 
            :loading="salvando"
            :disabled="!nuovaNota.contenuto.trim()"
          >
            Aggiungi Nota
          </UButton>
        </div>
      </form>
    </UCard>

    <!-- Lista Note -->
    <div v-if="pending" class="space-y-4">
      <USkeleton v-for="i in 2" :key="i" class="h-24 w-full" />
    </div>

    <div v-else-if="!note?.length" class="text-center py-8 text-slate-400 text-sm">
      <UIcon name="i-heroicons-document-text" class="w-8 h-8 mx-auto mb-2 opacity-50" />
      <p>Nessuna nota presente per questo studente.</p>
    </div>

    <div v-else class="space-y-4">
      <UCard 
        v-for="nota in note" 
        :key="nota.id" 
        class="relative transition-all"
        :ui="{ body: 'p-4', header: 'p-3 bg-slate-50/50' }"
      >
        <div class="flex items-start justify-between mb-2">
          <div class="flex items-center gap-2">
            <UAvatar :alt="nota.author?.firstName || 'User'" size="sm" class="bg-tfn-100 text-tfn-600" />
            <div>
              <div class="text-sm font-medium text-slate-800">
                {{ nota.author?.firstName }} {{ nota.author?.lastName }}
                <span class="text-xs text-slate-500 font-normal ml-1">({{ nota.author?.role }})</span>
              </div>
              <div class="text-xs text-slate-400">
                {{ formatDataOra(nota.createdAt) }}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <UBadge 
              :color="nota.visibilita === 'FAMIGLIA' ? 'success' : 'warning'" 
              variant="subtle" 
              size="xs"
            >
              {{ nota.visibilita === 'FAMIGLIA' ? 'Famiglia' : 'Interna' }}
            </UBadge>
            
            <UDropdownMenu 
              v-if="puoModificare(nota)" 
              :items="[
                [
                  { label: 'Elimina', icon: 'i-heroicons-trash', color: 'error', onSelect: () => confermaElimina(nota.id) }
                ]
              ]"
            >
              <UButton icon="i-heroicons-ellipsis-vertical" variant="ghost" color="neutral" size="sm" />
            </UDropdownMenu>
          </div>
        </div>
        
        <p class="text-sm text-slate-700 whitespace-pre-wrap">{{ nota.contenuto }}</p>
      </UCard>
    </div>

  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ studentId: string }>()
const toast = useToast()
const { user: sessionUser } = useUserSession()

// Fetch note
const { data: note, pending, refresh } = await useFetch<any[]>(`/api/students/${props.studentId}/notes`)

// Form
const salvando = ref(false)
const nuovaNota = reactive({
  contenuto: '',
  visibilita: 'INTERNA'
})

async function submitNota() {
  if (!nuovaNota.contenuto.trim()) return
  
  salvando.value = true
  try {
    await $fetch('/api/notes', {
      method: 'POST',
      body: {
        studentId: props.studentId,
        contenuto: nuovaNota.contenuto,
        visibilita: nuovaNota.visibilita
      }
    })
    
    toast.add({ title: 'Nota aggiunta', color: 'success', icon: 'i-heroicons-check-circle' })
    nuovaNota.contenuto = ''
    nuovaNota.visibilita = 'INTERNA'
    refresh()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage || 'Impossibile aggiungere la nota', color: 'error' })
  } finally {
    salvando.value = false
  }
}

// Permissions
function puoModificare(nota: any) {
  if (!sessionUser.value) return false
  const role = sessionUser.value.role
  if (role === 'ADMIN' || role === 'SUPER_TUTOR') return true
  return nota.authorId === sessionUser.value.id
}

// Delete
async function confermaElimina(id: string) {
  if (!confirm('Sei sicuro di voler eliminare questa nota?')) return
  
  try {
    await $fetch(`/api/notes/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Nota eliminata', color: 'success' })
    refresh()
  } catch (err: any) {
    toast.add({ title: 'Errore', description: err?.data?.statusMessage || 'Impossibile eliminare', color: 'error' })
  }
}

// Utils
function formatDataOra(d: string) {
  return new Date(d).toLocaleString('it-IT', { 
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}
</script>
