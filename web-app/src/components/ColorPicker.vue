<template>
  <div class="color-picker">
    <div class="color-input-row">
      <select v-model="selectedPreset" @change="onPresetChange" class="color-select">
        <option value="">{{ $t('color.picker.custom') }}</option>
        <optgroup v-for="brand in brands" :key="brand" :label="brand">
          <option
            v-for="f in filtersByBrand(brand)"
            :key="f.code"
            :value="f.code"
          >{{ f.code }} — {{ f.name }}</option>
        </optgroup>
      </select>
      <input
        v-model="customText"
        type="text"
        :placeholder="$t('color.picker.placeholder')"
        class="color-text"
        @input="onCustomInput"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import filtersData from '@shared/filters.json'

const props = defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])

const selectedPreset = ref('')
const customText = ref(props.modelValue)

const brands = computed(() => [...new Set(filtersData.map(f => f.brand))])
const filtersByBrand = (brand) => filtersData.filter(f => f.brand === brand)

watch(() => props.modelValue, (val) => {
  const found = filtersData.find(f => f.code === val)
  if (found) {
    selectedPreset.value = val
    customText.value = val
  } else {
    selectedPreset.value = ''
    customText.value = val
  }
}, { immediate: true })

function onPresetChange() {
  if (selectedPreset.value) {
    customText.value = selectedPreset.value
    emit('update:modelValue', selectedPreset.value)
  }
}

function onCustomInput() {
  selectedPreset.value = ''
  emit('update:modelValue', customText.value)
}
</script>
