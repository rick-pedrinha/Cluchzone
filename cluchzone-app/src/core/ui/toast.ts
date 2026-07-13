// ═══════════════════════════════════════════════════════════
// CLUTCHZONE — Toast Notification System (Singleton)
// Replaces 4+ duplicate showToast() implementations
// ═══════════════════════════════════════════════════════════

export type ToastType = 'success' | 'error' | 'warning' | 'info';

const COLORS: Record<ToastType, string> = {
  success: '#00ff88',
  error: '#ff3333',
  warning: '#ffd700',
  info: '#00d4ff',
};

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠️',
  info: 'ℹ',
};

let _container: HTMLElement | null = null;

function getContainer(): HTMLElement {
  if (_container) return _container;
  _container = document.getElementById('toast-container');
  if (!_container) {
    _container = document.createElement('div');
    _container.id = 'toast-container';
    _container.style.cssText = [
      'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
      'z-index:99999', 'display:flex', 'flex-direction:column', 'align-items:center', 'gap:8px',
    ].join(';');
    document.body.appendChild(_container);
  }
  return _container;
}

export function showToast(message: string, type: ToastType = 'info', duration = 4000): void {
  const color = COLORS[type];
  const container = getContainer();

  const toast = document.createElement('div');
  toast.style.cssText = [
    `padding:12px 20px`, `border-radius:8px`, `font-weight:700`, `font-size:13px`,
    `background:rgba(10,13,22,0.98)`, `border:1px solid ${color}`,
    `color:${color}`, `box-shadow:0 4px 20px rgba(0,0,0,0.6)`,
    `font-family:'Rajdhani',sans-serif`, `transition:all 0.3s ease`,
    `transform:translateY(20px)`, `opacity:0`, `display:flex`, `align-items:center`, `gap:8px`,
    `max-width:360px`, `text-align:center`,
  ].join(';');
  toast.innerHTML = `<span>${ICONS[type]}</span><span>${message}</span>`;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });

  setTimeout(() => {
    toast.style.transform = 'translateY(-10px)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Convenience helpers
export const toast = {
  success: (msg: string) => showToast(msg, 'success'),
  error: (msg: string) => showToast(msg, 'error'),
  warning: (msg: string) => showToast(msg, 'warning'),
  info: (msg: string) => showToast(msg, 'info'),
};
