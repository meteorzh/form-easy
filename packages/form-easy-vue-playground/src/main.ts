import { createApp } from 'vue';
import App from './App.vue';
import { defineCustomElements } from 'form-easy/loader';

defineCustomElements();
createApp(App).mount('#app');
