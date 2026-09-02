import { Component, Event, EventEmitter, h, Prop, State } from '@stencil/core';
import type { EndpointManager } from '../../../managers/endpoint-manager';
import type { FormField } from '../../../types';

/** 使用端点管理器上传文件的默认 H5 基础字段组件。 */
@Component({ tag: 'form-easy-upload', styleUrl: 'form-easy-upload.css' })
export class FormEasyUpload {
  /** 当前字段值；单文件为 URL，多文件为 URL 数组的 JSON 字符串。 */
  @Prop() value: unknown;
  /** 是否允许一次选择多个文件。 */
  @Prop() multiple = false;
  /** 原生文件选择框接受的 MIME 类型或扩展名。 */
  @Prop() accept?: string;
  /** 是否禁用当前控件。 */
  @Prop() disabled = false;
  /** 当前字段可调用异步服务的端点管理器。 */
  @Prop() endpointManager?: EndpointManager;
  /** 当前字段配置。 */
  @Prop() field!: FormField;
  /** 当前字段完整唯一标识。 */
  @Prop() fieldId!: string;
  /** 当前所属表单键。 */
  @Prop() formKey!: string;
  /** 上传完成后通知 form-easy 字段更新值。 */
  @Event() valueChange!: EventEmitter<string>;
  /** 当前是否正在上传。 */
  @State() private uploading = false;
  /** 上传失败时展示的错误信息。 */
  @State() private errorMessage?: string;
  /** 用于取消组件卸载前未完成上传的控制器。 */
  private uploadAbortController?: AbortController;

  /** 组件卸载时取消仍在执行的上传请求。 */
  disconnectedCallback(): void {
    this.uploadAbortController?.abort();
  }

  /** 选择文件后上传，并将端点返回的 URL 写回字段。 */
  private handleFileChange = async (event: Event): Promise<void> => {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    if (files.length === 0) return;
    if (!this.endpointManager) {
      this.errorMessage = '未配置可用的端点管理器。';
      console.error(new Error(this.errorMessage));
      return;
    }

    this.uploadAbortController?.abort();
    const abortController = new AbortController();
    this.uploadAbortController = abortController;
    this.uploading = true;
    this.errorMessage = undefined;
    try {
      const urls = await Promise.all(files.map(file => this.uploadFile(file, abortController.signal)));
      if (abortController.signal.aborted) return;
      this.valueChange.emit(this.multiple ? JSON.stringify(urls) : urls[0]);
    } catch (error) {
      if (abortController.signal.aborted) return;
      this.errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`字段“${this.fieldId}”上传文件失败：`, error);
    } finally {
      if (!abortController.signal.aborted) this.uploading = false;
    }
  };

  /** 调用端点管理器上传一个文件，并校验结果为 URL 字符串。 */
  private async uploadFile(file: File, signal: AbortSignal): Promise<string> {
    const result = await this.endpointManager!.invoke<File, unknown>(
      'upload',
      { formKey: this.formKey, fieldId: this.fieldId, field: this.field, input: file, signal }
    );
    if (typeof result !== 'string') throw new Error('上传端点必须返回文件 URL 字符串。');
    return result;
  }

  /** 将字段值转换为可展示的已上传 URL 列表。 */
  private get uploadedUrls(): string[] {
    if (typeof this.value !== 'string' || this.value.length === 0) return [];
    if (!this.multiple) return [this.value];
    try {
      const urls = JSON.parse(this.value);
      return Array.isArray(urls) && urls.every(url => typeof url === 'string') ? urls : [];
    } catch {
      return [];
    }
  }

  /** 渲染选择文件、上传状态和已上传文件地址。 */
  render() {
    return (
      <div class="upload">
        <input
          type="file"
          accept={this.accept}
          multiple={this.multiple}
          disabled={this.disabled || this.uploading}
          onChange={this.handleFileChange}
        />
        {this.uploading && <p>正在上传…</p>}
        {this.errorMessage && <p class="error">上传失败：{this.errorMessage}</p>}
        {this.uploadedUrls.map(url => <a href={url} target="_blank" rel="noreferrer">{url}</a>)}
      </div>
    );
  }
}
