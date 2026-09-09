import { Component, Event, EventEmitter, h, Prop } from '@stencil/core';

/** creator 内部用于输入多行 JSON 或 JavaScript 代码的文本编辑器。 */
@Component({
  tag: 'form-easy-creator-json-editor',
  styleUrl: 'form-easy-creator-json-editor.css'
})
export class FormEasyCreatorJsonEditor {
  /** 当前文本值。 */
  @Prop() value: unknown;
  /** 输入占位提示。 */
  @Prop() placeholder?: string;
  /** 文本编辑器默认显示行数。 */
  @Prop() rows = 4;
  /** 当前编辑器是否禁用。 */
  @Prop() disabled = false;
  /** 文本变更时向动态表单回传新值。 */
  @Event() valueChange!: EventEmitter<string>;

  /** 将文本输入同步给动态表单字段。 */
  private handleInput = (event: Event): void => {
    this.valueChange.emit((event.target as HTMLTextAreaElement).value);
  };

  /** 渲染 creator 专用多行文本编辑器。 */
  render() {
    return (
      <textarea
        value={String(this.value ?? '')}
        placeholder={this.placeholder}
        rows={this.rows}
        disabled={this.disabled}
        spellcheck={false}
        onInput={this.handleInput}
      />
    );
  }
}
