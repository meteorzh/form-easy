import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type PropType
} from 'vue';
import type {
  BasicFieldRenderer,
  FormEasyCreatorChangeDetail,
  FormSchema
} from '@wenzhencn/form-easy';
import { ensureFormEasyCustomElements } from './custom-elements';

type FormEasyCreatorElement = HTMLElement & {
  value?: FormSchema;
  basicFieldRenderer?: BasicFieldRenderer | null;
  getSchema?: () => Promise<FormSchema>;
  validate?: () => Promise<boolean>;
};

/** Vue 对 form-easy-creator 原生设计器的薄包装。 */
export const FormEasyCreator = defineComponent({
  name: 'FormEasyCreator',
  inheritAttrs: false,
  props: {
    /** 需要编辑的表单 schema。 */
    value: {
      type: Object as PropType<FormSchema | undefined>,
      default: undefined
    },
    /** Vue 风格的设计器双向绑定值。 */
    modelValue: {
      type: Object as PropType<FormSchema | undefined>,
      default: undefined
    },
    /** 设计器右侧预览使用的基础字段渲染器。 */
    basicFieldRenderer: {
      type: Object as PropType<BasicFieldRenderer | null | undefined>,
      default: undefined
    }
  },
  emits: {
    /** 转发原生 schemaChange 事件。 */
    schemaChange: (_detail: FormEasyCreatorChangeDetail) => true,
    /** Vue v-model 更新事件。 */
    'update:modelValue': (_value: FormSchema) => true
  },
  setup(props, { emit, attrs, expose }) {
    const element = ref<FormEasyCreatorElement>();
    let schemaChangeListener: ((event: Event) => void) | undefined;

    const syncProperties = (): void => {
      const target = element.value;
      if (!target) return;
      target.value = props.modelValue ?? props.value;
      target.basicFieldRenderer = props.basicFieldRenderer;
    };

    onMounted(async () => {
      await ensureFormEasyCustomElements();
      syncProperties();
      schemaChangeListener = (event: Event): void => {
        const detail = (event as CustomEvent<FormEasyCreatorChangeDetail>).detail;
        emit('schemaChange', detail);
        emit('update:modelValue', detail.schema);
      };
      element.value?.addEventListener('schemaChange', schemaChangeListener);
    });

    watch(
      () => [props.value, props.modelValue, props.basicFieldRenderer],
      syncProperties,
      { deep: false }
    );

    onBeforeUnmount(() => {
      if (schemaChangeListener) {
        element.value?.removeEventListener('schemaChange', schemaChangeListener);
      }
    });

    expose({
      getSchema: () =>
        element.value?.getSchema?.() ?? Promise.resolve(props.modelValue ?? props.value),
      validate: () => element.value?.validate?.() ?? Promise.resolve(false),
      element
    });

    return () => h('form-easy-creator', {
      ...attrs,
      ref: element
    });
  }
});

export default FormEasyCreator;
