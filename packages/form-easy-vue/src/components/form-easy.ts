import {
  defineComponent,
  h,
  nextTick,
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
  FormLoadingDetail,
  FormReadyDetail,
  FormSchema,
  FormValueStore,
  UserEvent
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
  disabled?: boolean;
  showLoadingOverlay?: boolean;
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
    /** 表单预设值；表单内部编辑请通过 formChange 事件获取。 */
    value: {
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
    },
    /** 禁用整个表单的用户编辑。 */
    disabled: {
      type: Boolean,
      default: false
    },
    /** 是否在表单上渲染 loading 蒙层。 */
    showLoadingOverlay: {
      type: Boolean,
      default: true
    }
  },
  emits: {
    /** 转发原生 formChange 事件。 */
    formChange: (_detail: FormChangeDetail) => true,
    /** 转发原生 formLoading 事件。 */
    loading: (_detail: FormLoadingDetail) => true,
    /** 转发原生 formReady 事件。 */
    ready: (_detail: FormReadyDetail) => true,
    /** 转发原生 userEvent 事件。 */
    userEvent: (_detail: UserEvent) => true
  },
  setup(props, { emit, attrs, expose }) {
    const element = ref<FormEasyElement>();
    const customElementReady = ref(false);
    let formChangeListener: ((event: Event) => void) | undefined;
    let userEventListener: ((event: Event) => void) | undefined;
    let formLoadingListener: ((event: Event) => void) | undefined;
    let formReadyListener: ((event: Event) => void) | undefined;
    /** 当前是否正在按新的 schema 或 value 重新加载表单。 */
    const loading = ref(false);

    const syncProperties = (): void => {
      const target = element.value;
      if (!target || !customElementReady.value) return;
      const schemaChanged = target.schema !== props.schema;
      target.schema = props.schema;
      // schema setter 进入 loading 时不能在同一次同步里继续写 value，
      // 等原生组件发出 formReady 后再把当前最新 value 写入新结构。
      // 原生组件尚未完成首次挂载时 schema 不会触发加载，也不会发出 formReady，
      // 此时必须直接写入 value，否则首次挂载会丢失已保存的值。
      // formLoading 由 setter 同步发出，这里读到的 loading 已是最新状态。
      if (!loading.value) {
        target.value = props.value;
      } else if (!schemaChanged && target.value !== props.value) {
        console.error(
          '表单正在加载 schema，此时不能同步 value；请等待 ready 事件后再更新。'
        );
      }
      target.basicFieldRenderer = props.basicFieldRenderer;
      target.eventCenter = props.eventCenter;
      target.componentDataManager = props.componentDataManager;
      target.endpointManager = props.endpointManager;
      target.formValueStore = props.formValueStore;
      target.maxRenderDepth = props.maxRenderDepth;
      target.disabled = props.disabled;
      target.showLoadingOverlay = props.showLoadingOverlay;
    };

    onMounted(async () => {
      await ensureFormEasyCustomElements();
      customElementReady.value = true;
      await nextTick();
      formChangeListener = (event: Event): void => {
        const detail = (event as CustomEvent<FormChangeDetail>).detail;
        emit('formChange', detail);
      };
      userEventListener = (event: Event): void => {
        emit('userEvent', (event as CustomEvent<UserEvent>).detail);
      };
      formLoadingListener = (event: Event): void => {
        loading.value = true;
        emit('loading', (event as CustomEvent<FormLoadingDetail>).detail);
      };
      formReadyListener = (event: Event): void => {
        loading.value = false;
        emit('ready', (event as CustomEvent<FormReadyDetail>).detail);
        const target = element.value;
        // 只有目标 schema 仍然是当前 props 时才同步 value，
        // 这样加载期间被拒绝的 value 修改会在加载结束后补上；
        // loading 期间被拒绝的 schema 修改必须由调用方重新提交。
        if (target && target.schema === props.schema) {
          target.value = props.value;
        }
      };
      element.value?.addEventListener('formChange', formChangeListener);
      element.value?.addEventListener('userEvent', userEventListener);
      element.value?.addEventListener('formLoading', formLoadingListener);
      element.value?.addEventListener('formReady', formReadyListener);
      syncProperties();
    });

    watch(
      () => [
        props.schema,
        props.value,
        props.basicFieldRenderer,
        props.eventCenter,
        props.componentDataManager,
        props.endpointManager,
        props.formValueStore,
        props.maxRenderDepth,
        props.disabled,
        props.showLoadingOverlay
      ],
      syncProperties,
      { deep: false }
    );

    onBeforeUnmount(() => {
      if (formChangeListener) {
        element.value?.removeEventListener('formChange', formChangeListener);
      }
      if (userEventListener) {
        element.value?.removeEventListener('userEvent', userEventListener);
      }
      if (formLoadingListener) {
        element.value?.removeEventListener('formLoading', formLoadingListener);
      }
      if (formReadyListener) {
        element.value?.removeEventListener('formReady', formReadyListener);
      }
    });

    expose({
      validate: () => element.value?.validate?.() ?? Promise.resolve(false),
      validateField: (fieldId: string) =>
        element.value?.validateField?.(fieldId) ?? Promise.resolve(false),
      loading,
      element
    });

    return () => customElementReady.value
      ? h('form-easy', {
        ...attrs,
        ref: element
      })
      : null;
  }
});

export default FormEasy;
