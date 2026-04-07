<template>
  <div class="divide-y divide-white/10">
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-white">{{ t('settings.language') }}</h2>
        <p class="mt-1 text-sm/6 text-gray-400">{{ t('settings.language.hint') }}</p>
      </div>
      <div class="md:col-span-2 sm:max-w-xl">
        <div class="flex gap-6">
          <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input type="radio" :checked="locale === 'de'" value="de" @change="setLocale('de')" class="accent-accent" />
            {{ t('settings.language.de') }}
          </label>
          <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input type="radio" :checked="locale === 'en'" value="en" @change="setLocale('en')" class="accent-accent" />
            {{ t('settings.language.en') }}
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useLocale } from '../../composables/useLocale.js'

const { t, locale, setLocale } = useLocale()
</script>
