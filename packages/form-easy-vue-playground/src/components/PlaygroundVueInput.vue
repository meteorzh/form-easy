<script setup lang="ts">
/** Vue 自定义字段组件接收的属性。 */
const props = withDefaults(defineProps<{
  /** 当前字段值。 */
  modelValue?: unknown;
  /** 兼容渲染器传入的字段值。 */
  value?: unknown;
  /** 是否禁用字段。 */
  disabled?: boolean;
  /** 输入框占位提示。 */
  placeholder?: string;
}>(), {
  modelValue: undefined,
  value: undefined,
  disabled: false,
  placeholder: '由 Vue 组件渲染的字段'
});

/** 向 form-easy 的 Vue 渲染器同步字段值。 */
const emit = defineEmits<{
  /** 字段输入值发生变化。 */
  'update:modelValue': [value: string];
}>();

/** 优先使用 v-model 值，并兼容 value 属性。 */
function getDisplayValue(): string {
  return String(props.modelValue ?? props.value ?? '');
}

/** 将输入内容回传给上层渲染器。 */
function handleInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value);
}
</script>

<template>
  <label class="vue-input">
    <span>Vue component</span>
    <input
      :value="getDisplayValue()"
      :disabled="disabled"
      :placeholder="placeholder"
      type="text"
      @input="handleInput"
    >
  </label>
</template>

<style scoped>
.vue-input { display: grid; gap: 6px; }
.vue-input span { color: #327a4a; font: 700 10px/1 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .08em; text-transform: uppercase; }
.vue-input input { width: 100%; border: 1px solid #72c58d; border-radius: 5px; padding: 8px 10px; color: #172033; background: #f5fff5; font: inherit; outline: none; }
.vue-input input:focus { border-color: #2f9a55; box-shadow: 0 0 0 3px rgb(185 255 102 / 32%); }
.vue-input input:disabled { color: #7b8a80; background: #eef4ef; }
</style>
