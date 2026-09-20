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
  ComponentDataManager,
  EndpointManager,
  EventCenter,
  FormChangeDetail,
  FormSchema,
  FormValueStore
} from '@wenzhencn/form-easy';
import { ensureFormEasyCustomElements } from './custom-elements';

type FormEasyElement = HTMLElement & {
  schema?: FormSchema;
  value?: Record<string, unknown>;
  basicFieldRenderer?: BasicFieldRenderer | null;
  eventCenter?: EventCenter;
  componentDataManager?: ComponentDataManager;
  endpointManager?: EndpointManager;
  formValueStore?: FormValueStore;
  maxRenderDepth?: number;
  validate?: () => Promise<boolean>;
  validateField?: (fieldId: string) => Promise<boolean>;
};

/** Vue 对 form-easy 原生组件的薄包装，不重复实现字段渲染和状态管理。 */
export const FormEasy = defineComponent({
  name: 'FormEasy',
  inheritAttrs: false,
  props: {
    /** 动态表单 schema。 */
    schema: {
      type: Object as PropType<FormSchema>,
      required: true
    },
    /** 表单预设值，也可以通过 v-model:modelValue 传入。 */
    value: {
      type: Object as PropType<Record<string, unknown> | undefined>,
      default: undefined
    },
    /** Vue 风格的双向绑定值。 */
    modelValue: {
      type: Object as PropType<Record<string, unknown> | undefined>,
      default: undefined
    },
    /** 表单级基础字段渲染器。 */
    basicFieldRenderer: {
      type: Object as PropType<BasicFieldRenderer | null | undefined>,
      default: undefined
    },
    /** 表单级事件中心。 */
    eventCenter: {
      type: Object as PropType<EventCenter | undefined>,
      default: undefined
    },
    /** 表单级组件数据管理器。 */
    componentDataManager: {
      type: Object as PropType<ComponentDataManager | undefined>,
      default: undefined
    },
    /** 表单级端点管理器。 */
    endpointManager: {
      type: Object as PropType<EndpointManager | undefined>,
      default: undefined
    },
    /** 表单级字段值存储。 */
    formValueStore: {
      type: Object as PropType<FormValueStore | undefined>,
      default: undefined
    },
    /** 表单最大渲染深度。 */
    maxRenderDepth: {
      type: Number,
      default: 32
    }
  },
  emits: {
    /** 转发原生 formChange 事件。 */
    formChange: (_detail: FormChangeDetail) => true,
    /** Vue v-model 更新事件。 */
    'update:modelValue': (_value: Record<string, unknown>) => true
  },
  setup(props, { emit, attrs, expose }) {
    const element = ref<FormEasyElement>();
    let formChangeListener: ((event: Event) => void) | undefined;

    const syncProperties = (): void => {
      const target = element.value;
      if (!target) return;
      target.schema = props.schema;
      target.value = props.modelValue ?? props.value;
      target.basicFieldRenderer = props.basicFieldRenderer;
      target.eventCenter = props.eventCenter;
      target.componentDataManager = props.componentDataManager;
      target.endpointManager = props.endpointManager;
      target.formValueStore = props.formValueStore;
      target.maxRenderDepth = props.maxRenderDepth;
    };

    onMounted(async () => {
      await ensureFormEasyCustomElements();
      syncProperties();
      formChangeListener = (event: Event): void => {
        const detail = (event as CustomEvent<FormChangeDetail>).detail;
        emit('formChange', detail);
        emit('update:modelValue', detail.formData);
      };
      element.value?.addEventListener('formChange', formChangeListener);
    });

    watch(
      () => [
        props.schema,
        props.value,
        props.modelValue,
        props.basicFieldRenderer,
        props.eventCenter,
        props.componentDataManager,
        props.endpointManager,
        props.formValueStore,
        props.maxRenderDepth
      ],
      syncProperties,
      { deep: false }
    );

    onBeforeUnmount(() => {
      if (formChangeListener) {
        element.value?.removeEventListener('formChange', formChangeListener);
      }
    });

    expose({
      validate: () => element.value?.validate?.() ?? Promise.resolve(false),
      validateField: (fieldId: string) =>
        element.value?.validateField?.(fieldId) ?? Promise.resolve(false),
      element
    });

    return () => h('form-easy', {
      ...attrs,
      ref: element
    });
  }
});

export default FormEasy;
