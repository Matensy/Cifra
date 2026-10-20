// Mini-helpers de DOM (sem framework).

type Child = Node | string | number | null | undefined | false | Child[];
type Props = Record<string, unknown> & { class?: string; style?: string; dataset?: Record<string, string> };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (k === 'dataset') Object.assign(el.dataset, v as Record<string, string>);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else if (k === 'value' && 'value' in el) (el as HTMLInputElement).value = String(v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

/** append() que aceita null/false/arrays (como o h()). */
export function add(el: Element, ...children: Child[]) {
  append(el, children);
}

function append(el: Element, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : String(c));
  }
}

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T | null;
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export function clear(el: Element) {
  while (el.firstChild) el.firstChild.remove();
}

export function mount(...nodes: Node[]) {
  const app = document.getElementById('app')!;
  hideTip();
  clear(app);
  app.append(...nodes);
  app.scrollTop = 0;
}

/** Tooltip global que segue o mouse. */
export function tip(el: HTMLElement, content: () => Node | string) {
  const box = document.getElementById('tooltip')!;
  const move = (e: MouseEvent) => {
    const pad = 16;
    const r = box.getBoundingClientRect();
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad;
    if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad;
    box.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
  };
  el.addEventListener('mouseenter', (e) => {
    clear(box);
    const c = content();
    box.append(typeof c === 'string' ? h('div', null, c) : c);
    box.classList.add('show');
    move(e);
  });
  el.addEventListener('mousemove', move);
  el.addEventListener('mouseleave', () => box.classList.remove('show'));
  el.addEventListener('mousedown', () => box.classList.remove('show'));
}

export function hideTip() {
  document.getElementById('tooltip')!.classList.remove('show');
}

/** Anima um número subindo/descendo até o valor final. */
export function countTo(el: HTMLElement, from: number, to: number, ms = 600) {
  const start = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - start) / ms);
    el.textContent = String(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Modal genérico; devolve uma função para fechar. */
export function modal(content: Node, opts: { onClose?: () => void; wide?: boolean; dismissable?: boolean } = {}): () => void {
  const close = () => {
    overlay.classList.add('closing');
    setTimeout(() => overlay.remove(), 180);
    document.removeEventListener('keydown', onKey);
    opts.onClose?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && opts.dismissable !== false) close();
  };
  hideTip();
  const overlay = h('div', { class: 'overlay' }, h('div', { class: 'modal' + (opts.wide ? ' wide' : '') }, content));
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay && opts.dismissable !== false) close();
  });
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  return close;
}

export function toast(text: string, kind: 'info' | 'good' | 'bad' | 'learn' = 'info', ms = 3800) {
  // Com uma janela aberta, o aviso aparece DENTRO dela (senão ficaria por cima do conteúdo).
  const openModal = document.querySelector('.overlay:not(.closing) .modal');
  let box = document.getElementById('toasts')!;
  if (openModal) {
    box = openModal.querySelector<HTMLElement>('.modal-toasts') ?? openModal.appendChild(h('div', { class: 'modal-toasts' }));
  }
  const t = h('div', { class: `toast ${kind}` }, text);
  box.append(t);
  while (box.children.length > 4) box.firstChild!.remove();
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 300);
  }, ms);
}
