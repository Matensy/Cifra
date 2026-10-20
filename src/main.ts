import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/vt323/400.css';
import './style.css';
import { applySettings } from './ui/app';
import { sfx } from './ui/audio';
import { initFx } from './ui/fx';
import { showTitle } from './ui/screens/title';

initFx();
applySettings();
// Atalhos só de desenvolvimento, para testar telas específicas:
// ?enemy=<id> abre um combate, &q abre a quebra manual, ?screen=lab|codex abre a tela.
const params = import.meta.env.DEV ? new URLSearchParams(location.search) : new URLSearchParams();
const debugEnemy = params.get('enemy');
if (debugEnemy) {
  import('./ui/screens/flow').then((m) => m.debugFight(debugEnemy));
  if (params.has('q')) setTimeout(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' })), 2600);
} else if (params.get('screen') === 'lab') import('./ui/screens/lab').then((m) => m.showLab(showTitle));
else if (params.get('screen') === 'codex') import('./ui/screens/codex').then((m) => m.showCodex(showTitle));
else if (params.get('screen')) import('./ui/screens/flow').then((m) => m.debugScreen(params.get('screen')!));
else showTitle();

// Som de clique em qualquer botão (o áudio só pode começar após uma interação).
document.addEventListener('pointerdown', (e) => {
  if ((e.target as Element).closest('button')) sfx.click();
}, { capture: true });
