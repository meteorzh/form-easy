import {
  Component,
  Event,
  EventEmitter,
  h,
  Prop,
  State,
  Watch
} from '@stencil/core';
import type { ComponentValidationResult } from '../../types';

/** 设计器文本编辑器支持的内容处理模式。 */
export type CreatorEditorMode = 'json' | 'text';

/** creator 内部用于输入 JSON 值或普通多行文本的编辑器。 */
@Component({
  tag: 'form-easy-creator-json-editor',
  styleUrl: 'form-easy-creator-json-editor.css'
})
export class FormEasyCreatorJsonEditor {
  /** JSON 模式下为解析后的值，文本模式下为原始字符串。 */
  @Prop() value: unknown;
  /** 编辑内容的处理模式，默认解析并输出 JSON 值。 */
  @Prop() mode: CreatorEditorMode = 'json';
  /** 输入占位提示。 */
  @Prop() placeholder?: string;
  /** 文本编辑器默认显示行数。 */
  @Prop() rows = 4;
  /** 当前编辑器是否禁用。 */
  @Prop() disabled = false;
  /** 内容解析成功后向动态表单回传真实值。 */
  @Event() valueChange!: EventEmitter<unknown>;
  /** JSON 解析状态发生变化时向字段容器报告校验结果。 */
  @Event() componentValidationChange!: EventEmitter<ComponentValidationResult>;

  /** 用户正在编辑的原始文本，允许暂时保存不完整的 JSON。 */
  @State() private draftText = '';
  /** 当前 JSON 草稿对应的解析错误。 */
  @State() private parseError?: string;
  /** 当前编辑器是否拥有输入焦点。 */
  private editing = false;
  /** 最近一次成功解析的 JSON 值。 */
  private parsedValue: unknown;

  /** 首次加载时根据外部真实值创建可编辑文本。 */
  componentWillLoad(): void {
    this.parsedValue = this.value;
    this.draftText = this.stringifyValue(this.value);
  }

  /** 非编辑状态下将外部真实值同步为编辑器文本。 */
  @Watch('value')
  protected synchronizeExternalValue(value: unknown): void {
    if (this.editing) return;
    this.parsedValue = value;
    this.draftText = this.stringifyValue(value);
    this.clearValidationError();
  }

  /** 编辑模式变化后按照新模式重新生成展示文本。 */
  @Watch('mode')
  protected synchronizeEditorMode(): void {
    this.parsedValue = this.value;
    this.draftText = this.stringifyValue(this.value);
    this.clearValidationError();
  }

  /** 更新文本草稿；JSON 模式仅在解析成功后更新动态表单字段值。 */
  private handleInput = (event: Event): void => {
    const draftText = (event.target as HTMLTextAreaElement).value;
    this.draftText = draftText;
    if (this.mode === 'text') {
      this.parsedValue = draftText;
      this.clearValidationError();
      this.valueChange.emit(draftText);
      return;
    }
    this.parseJsonDraft(draftText);
  };

  /** 记录编辑器已获得焦点，避免外部回写覆盖输入中间态。 */
  private handleFocus = (): void => {
    this.editing = true;
  };

  /** 结束编辑，并在 JSON 合法时将内容格式化。 */
  private handleBlur = (): void => {
    this.editing = false;
    if (this.mode === 'json' && !this.parseError) {
      this.draftText = this.stringifyValue(this.parsedValue);
    }
  };

  /** 尝试解析 JSON 草稿，失败时仅保留文本而不污染字段真实值。 */
  private parseJsonDraft(draftText: string): void {
    if (!draftText.trim()) {
      this.setValidationError('JSON 内容不能为空，请输入 null 表示空值。');
      return;
    }
    try {
      const parsedValue = JSON.parse(draftText) as unknown;
      this.parsedValue = parsedValue;
      this.clearValidationError();
      this.valueChange.emit(parsedValue);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.setValidationError(`JSON 内容无法解析：${reason}`);
    }
  }

  /** 保存并上报当前 JSON 解析错误。 */
  private setValidationError(message: string): void {
    this.parseError = message;
    this.componentValidationChange.emit({ valid: false, message });
  }

  /** 清除已有 JSON 解析错误并上报有效状态。 */
  private clearValidationError(): void {
    this.parseError = undefined;
    this.componentValidationChange.emit({ valid: true });
  }

  /** 按当前模式将外部值转换为编辑器显示文本。 */
  private stringifyValue(value: unknown): string {
    if (this.mode === 'text') return String(value ?? '');
    try {
      return JSON.stringify(value, null, 2) ?? '';
    } catch {
      return '';
    }
  }

  /** 渲染 creator 专用多行文本编辑器。 */
  render() {
    return (
      <textarea
        value={this.draftText}
        placeholder={this.placeholder}
        rows={this.rows}
        disabled={this.disabled}
        spellcheck={false}
        aria-invalid={String(Boolean(this.parseError))}
        onFocus={this.handleFocus}
        onInput={this.handleInput}
        onBlur={this.handleBlur}
      />
    );
  }
}
