import { createApp } from 'vue';
import App from './App.vue';
import { defineCustomElements } from 'form-easy/loader';
import 'element-plus/dist/index.css';

defineCustomElements();
createApp(App).mount('#app');
