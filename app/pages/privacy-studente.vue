<template>
  <div class="min-h-screen bg-slate-50 py-10 px-4">
    <div class="max-w-2xl mx-auto">
      <h1 class="font-heading text-2xl font-bold text-slate-900 mb-6">La tua privacy</h1>
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <p class="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{{ PRIVACY_STUDENTE_TESTO }}</p>
      </div>
      <p class="text-xs text-slate-400 mt-4">Versione: {{ PRIVACY_STUDENTE_VERSION }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PRIVACY_STUDENTE_TESTO, PRIVACY_STUDENTE_VERSION } from '#shared/legal'

definePageMeta({ layout: false })
useHead({ title: 'Privacy studenti — Ti Formiamo Noi' })
</script>
