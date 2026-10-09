import { hana } from './sdk.js';
import { mountAppUi } from './app-ui.js';

mountAppUi(document.getElementById('app'), 'SettingsPage', {});
await hana.ready();