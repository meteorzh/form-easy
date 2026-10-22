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
  FormLoadingDetail,
  FormReadyDetail,
  FormSchema
} from '@wenzhencn/form-easy';
import { ensureFormEasyCustomElements } from './custom-elements';

type FormEasyCreatorElement = HTMLElement & {
  value?: FormSchema;
  basicFieldRenderer?: BasicFieldRenderer | null;
  getSchema?: () => Promise<FormSchema>;
  getDesignerSchema?: () => Promise<FormSchema>;
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
    /** 转发原生 formLoadingChange 事件。 */
    loadingChange: (_detail: FormLoadingDetail) => true,
    /** 转发原生 formReady 事件。 */
    ready: (_detail: FormReadyDetail) => true,
    /** Vue v-model 更新事件。 */
    'update:modelValue': (_value: FormSchema) => true
  },
  setup(props, { emit, attrs, expose }) {
    const element = ref<FormEasyCreatorElement>();
    let schemaChangeListener: ((event: Event) => void) | undefined;
    let formLoadingListener: ((event: Event) => void) | undefined;
    let formReadyListener: ((event: Event) => void) | undefined;
    /** 当前是否正在按新 value 重新载入设计器。 */
    const loading = ref(false);

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
      formLoadingListener = (event: Event): void => {
        const detail = (event as CustomEvent<FormLoadingDetail>).detail;
        loading.value = detail.loading;
        emit('loadingChange', detail);
      };
      formReadyListener = (event: Event): void => {
        emit('ready', (event as CustomEvent<FormReadyDetail>).detail);
      };
      element.value?.addEventListener('schemaChange', schemaChangeListener);
      element.value?.addEventListener('formLoadingChange', formLoadingListener);
      element.value?.addEventListener('formReady', formReadyListener);
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
      if (formLoadingListener) {
        element.value?.removeEventListener('formLoadingChange', formLoadingListener);
      }
      if (formReadyListener) {
        element.value?.removeEventListener('formReady', formReadyListener);
      }
    });

    expose({
      getSchema: () =>
        element.value?.getSchema?.() ?? Promise.resolve(props.modelValue ?? props.value),
      getDesignerSchema: () =>
        element.value?.getDesignerSchema?.() ?? Promise.resolve(props.modelValue ?? props.value),
      validate: () => element.value?.validate?.() ?? Promise.resolve(false),
      loading,
      element
    });

    return () => h('form-easy-creator', {
      ...attrs,
      ref: element
    });
  }
});

export default FormEasyCreator;
