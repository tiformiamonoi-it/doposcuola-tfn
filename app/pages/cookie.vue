<template>
  <div class="min-h-screen bg-slate-50 py-10 px-4">
    <div class="max-w-2xl mx-auto">
      <h1 class="font-heading text-2xl font-bold text-slate-900 mb-6">Cookie policy</h1>
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <p class="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{{ COOKIE_TESTO }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { COOKIE_TESTO } from '#shared/legal'

definePageMeta({ layout: false })
useHead({ title: 'Cookie policy — Ti Formiamo Noi' })
</script>
