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

    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-white">{{ t('settings.photos_per_page') }}</h2>
        <p class="mt-1 text-sm/6 text-gray-400">{{ t('settings.photos_per_page.hint') }}</p>
      </div>
      <div class="md:col-span-2 sm:max-w-xl">
        <select
          :value="photosPerPage"
          @change="photosPerPage = Number($event.target.value)"
          class="rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent w-32"
        >
          <option v-for="n in VALID" :key="n" :value="n">{{ n }}</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useLocale } from '../../composables/useLocale.js'
import { usePhotoSettings } from '../../composables/usePhotoSettings.js'

const { t, locale, setLocale } = useLocale()
const { photosPerPage, VALID } = usePhotoSettings()
</script>
