/**
 * 兼容 moduleResolution=node 的 Element Plus 渲染器类型入口。
 * 现代 TypeScript 会优先使用 package.json 的 exports 配置，旧版解析器
 * 则会从包根目录查找这个声明文件。
 */
export * from './dist/element-plus-basic-field-renderer';
