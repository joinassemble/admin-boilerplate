import './app.css';
import { mount } from 'svelte';
import App from './app.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('#app element not found');

mount(App, { target });
