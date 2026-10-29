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
  anonymous?: boolean;
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
    /** 需要载入设计器编辑的表单 schema；编辑结果请通过 schemaChange 事件获取。 */
    value: {
      type: Object as PropType<FormSchema | undefined>,
      default: undefined
    },
    /** 匿名模式：不显示表单 key 和表单名的输入，value 必须包含 key；载入期间不能切换。 */
    anonymous: {
      type: Boolean,
      default: false
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
    /** 转发原生 formLoading 事件。 */
    loading: (_detail: FormLoadingDetail) => true,
    /** 转发原生 formReady 事件。 */
    ready: (_detail: FormReadyDetail) => true
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
      // 先同步模式再同步 value：匿名模式会校验 value 是否带 key。
      target.anonymous = props.anonymous;
      target.value = props.value;
      target.basicFieldRenderer = props.basicFieldRenderer;
    };

    onMounted(async () => {
      await ensureFormEasyCustomElements();
      syncProperties();
      schemaChangeListener = (event: Event): void => {
        emit('schemaChange', (event as CustomEvent<FormEasyCreatorChangeDetail>).detail);
      };
      formLoadingListener = (event: Event): void => {
        loading.value = true;
        emit('loading', (event as CustomEvent<FormLoadingDetail>).detail);
      };
      formReadyListener = (event: Event): void => {
        loading.value = false;
        emit('ready', (event as CustomEvent<FormReadyDetail>).detail);
      };
      element.value?.addEventListener('schemaChange', schemaChangeListener);
      element.value?.addEventListener('formLoading', formLoadingListener);
      element.value?.addEventListener('formReady', formReadyListener);
    });

    watch(
      () => [props.value, props.anonymous, props.basicFieldRenderer],
      syncProperties,
      { deep: false }
    );

    onBeforeUnmount(() => {
      if (schemaChangeListener) {
        element.value?.removeEventListener('schemaChange', schemaChangeListener);
      }
      if (formLoadingListener) {
        element.value?.removeEventListener('formLoading', formLoadingListener);
      }
      if (formReadyListener) {
        element.value?.removeEventListener('formReady', formReadyListener);
      }
    });

    expose({
      getSchema: () =>
        element.value?.getSchema?.() ?? Promise.resolve(props.value),
      getDesignerSchema: () =>
        element.value?.getDesignerSchema?.() ?? Promise.resolve(props.value),
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
