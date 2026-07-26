<template>
  <div class="divide-y divide-border">
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-foreground">{{ t('settings.language') }}</h2>
        <p class="mt-1 text-sm/6 text-muted-foreground">{{ t('settings.language.hint') }}</p>
      </div>
      <div class="md:col-span-2 sm:max-w-xl">
        <div class="flex gap-6">
          <label class="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input type="radio" :checked="locale === 'de'" value="de" @change="setLocale('de')" class="accent-accent" />
            {{ t('settings.language.de') }}
          </label>
          <label class="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input type="radio" :checked="locale === 'en'" value="en" @change="setLocale('en')" class="accent-accent" />
            {{ t('settings.language.en') }}
          </label>
        </div>
      </div>
    </div>
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-foreground">{{ t('settings.unit') }}</h2>
        <p class="mt-1 text-sm/6 text-muted-foreground">{{ t('settings.unit.hint') }}</p>
      </div>
      <div class="md:col-span-2 sm:max-w-xl">
        <div class="flex gap-6">
          <label v-for="u in ['m', 'cm', 'mm']" :key="u" class="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input type="radio" :checked="unit === u" :value="u" @change="setUnit(u)" class="accent-accent" />
            {{ u }}
          </label>
        </div>
      </div>
    </div>
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-foreground">{{ t('settings.photos_per_page') }}</h2>
        <p class="mt-1 text-sm/6 text-muted-foreground">{{ t('settings.photos_per_page.hint') }}</p>
      </div>
      <div class="md:col-span-2 sm:max-w-xl">
        <Select :model-value="String(photosPerPage)" @update:model-value="setPhotosPerPage(Number($event))">
          <SelectTrigger class="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="n in VALID" :key="n" :value="String(n)">{{ n }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useLocale } from '../../composables/useLocale.js'
import { useMeasureUnit } from '../../composables/useMeasureUnit'
import { usePhotoSettings } from '../../composables/usePhotoSettings.js'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

const { t, locale, setLocale } = useLocale()
const { unit, setUnit } = useMeasureUnit()
const { photosPerPage, setPhotosPerPage, VALID } = usePhotoSettings()
</script>
