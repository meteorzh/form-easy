import { Component, Event, EventEmitter, h, Prop, State, Watch } from '@stencil/core';

/** form-easy 默认下拉组件支持的单个选项。 */
interface SelectOption {
  /** 选项展示文本。 */
  label: string;
  /** 选项实际值。 */
  value: string | number;
  /** 是否禁用当前选项。 */
  disabled?: boolean;
}

/** 使用 componentData 作为选项来源的默认 H5 下拉字段组件。 */
@Component({ tag: 'form-easy-select', styleUrl: 'form-easy-select.css' })
export class FormEasySelect {
  /** 当前字段值。 */
  @Prop() value: unknown;
  /** 由字段组件数据加载机制提供的下拉选项。 */
  @Prop() componentData: unknown;
  /** 是否禁用当前控件。 */
  @Prop() disabled = false;
  /** 未选择值时展示的占位选项文本。 */
  @Prop() placeholder = '请选择';
  /** 值变更时通知 form-easy 字段。 */
  @Event() valueChange!: EventEmitter<string | number>;
  /** componentData 解析失败时的提示信息。 */
  @State() private errorMessage?: string;

  /** 初始化时校验组件数据。 */
  componentWillLoad(): void {
    this.validateOptions();
  }

  /** 组件数据更新后重新校验选项结构。 */
  @Watch('componentData')
  validateOptions(): void {
    if (this.componentData === undefined || this.componentData === null) {
      this.errorMessage = '下拉组件缺少选项数据。';
      return;
    }
    if (!Array.isArray(this.componentData) || !this.componentData.every(this.isSelectOption)) {
      this.errorMessage = '下拉组件数据必须是包含 label 和 value 的选项数组。';
      console.error(new Error(this.errorMessage));
      return;
    }
    this.errorMessage = undefined;
  }

  /** 判断一个未知值是否符合下拉选项结构。 */
  private isSelectOption = (value: unknown): value is SelectOption => {
    if (!value || typeof value !== 'object') return false;
    const option = value as Record<string, unknown>;
    return typeof option.label === 'string'
      && (typeof option.value === 'string' || typeof option.value === 'number')
      && (option.disabled === undefined || typeof option.disabled === 'boolean');
  };

  /** 获取已经通过结构校验的选项数组。 */
  private get options(): SelectOption[] {
    return Array.isArray(this.componentData) && this.componentData.every(this.isSelectOption)
      ? this.componentData
      : [];
  }

  /** 将用户选择的值回传给 form-easy。 */
  private handleChange = (event: Event): void => {
    const value = (event.target as HTMLSelectElement).value;
    const matchedOption = this.options.find(option => String(option.value) === value);
    if (matchedOption) this.valueChange.emit(matchedOption.value);
  };

  /** 判断当前下拉选项是否与字段值匹配。 */
  private isSelected(option: SelectOption): boolean {
    return String(option.value) === String(this.value ?? '');
  }

  /** 渲染原生 H5 下拉控件或数据格式错误提示。 */
  render() {
    if (this.errorMessage) return <p class="error">{this.errorMessage}</p>;
    return (
      <select disabled={this.disabled} onChange={this.handleChange}>
        <option value="" disabled selected={!this.options.some(option => this.isSelected(option))}>
          {this.placeholder}
        </option>
        {this.options.map(option => (
          <option value={String(option.value)} disabled={option.disabled} selected={this.isSelected(option)}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
}
