import { defineComponent, h, ref } from 'vue';
import {
  formEasyFieldPropOptions,
  useFormEasyField,
  type FormEasyFieldProps
} from './use-form-easy-field';

/** 使用端点管理器上传文件的 Vue 基础字段组件。 */
export const VueUpload = defineComponent({
  name: 'FormEasyVueUpload',
  inheritAttrs: false,
  props: {
    ...formEasyFieldPropOptions,
    /** 是否允许一次选择多个文件。 */
    multiple: { type: Boolean, default: false },
    /** 原生文件选择框接受的 MIME 类型或扩展名。 */
    accept: { type: String, default: undefined },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const { value, disabled, fieldId, invokeEndpoint, updateValue } = useFormEasyField<unknown>(
      props as FormEasyFieldProps,
      emit
    );
    /** 当前是否正在上传。 */
    const uploading = ref(false);
    /** 上传失败时展示的错误信息。 */
    const errorMessage = ref<string>();
    /** 用于取消过期上传请求的控制器。 */
    let uploadAbortController: AbortController | undefined;

    /** 选择文件后上传，并将端点返回的 URL 写回字段。 */
    const handleChange = async (event: Event): Promise<void> => {
      const files = Array.from((event.target as HTMLInputElement).files ?? []);
      if (files.length === 0) return;
      uploadAbortController?.abort();
      const abortController = new AbortController();
      uploadAbortController = abortController;
      uploading.value = true;
      errorMessage.value = undefined;
      try {
        const urls = await Promise.all(files.map(async file => {
          const result = await invokeEndpoint<File, unknown>('upload', file, abortController.signal);
          if (typeof result !== 'string') throw new Error('上传端点必须返回文件 URL 字符串。');
          return result;
        }));
        if (!abortController.signal.aborted) {
          updateValue(props.multiple ? JSON.stringify(urls) : urls[0]);
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          errorMessage.value = error instanceof Error ? error.message : String(error);
          console.error(`字段“${fieldId.value}”上传文件失败：`, error);
        }
      } finally {
        if (!abortController.signal.aborted) uploading.value = false;
      }
    };

    /** 将字段值转换为可展示的已上传 URL 列表。 */
    const getUploadedUrls = (): string[] => {
      if (typeof value.value !== 'string' || value.value.length === 0) return [];
      if (!props.multiple) return [value.value];
      try {
        const urls = JSON.parse(value.value);
        return Array.isArray(urls) && urls.every(url => typeof url === 'string') ? urls : [];
      } catch {
        return [];
      }
    };

    /** 渲染选择文件、上传状态和已上传文件地址。 */
    return () => h('div', { class: 'form-easy-vue-upload' }, [
      h('input', {
        type: 'file',
        accept: props.accept,
        multiple: props.multiple,
        disabled: disabled.value || uploading.value,
        onChange: handleChange
      }),
      uploading.value ? h('p', '正在上传…') : null,
      errorMessage.value ? h('p', { class: 'form-easy-vue-upload__error' }, `上传失败：${errorMessage.value}`) : null,
      ...getUploadedUrls().map(url => h('a', { href: url, target: '_blank', rel: 'noreferrer' }, url))
    ]);
  }
});
