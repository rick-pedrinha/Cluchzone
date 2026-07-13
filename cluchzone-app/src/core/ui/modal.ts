// ═══════════════════════════════════════════════════════════
// CLUTCHZONE — Modal Manager (Singleton)
// Replaces multiple modal open/close implementations
// ═══════════════════════════════════════════════════════════

class ModalManager {
  private _active: string | null = null;

  open(id: string): void {
    this.closeAll();
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('open');
    this._active = id;
    // Close on backdrop click
    el.addEventListener('click', this._onBackdropClick.bind(this, id), { once: true });
    // Close on Escape
    document.addEventListener('keydown', this._onEscape.bind(this), { once: true });
  }

  close(id: string): void {
    const el = document.getElementById(id);
    el?.classList.remove('open');
    if (this._active === id) this._active = null;
  }

  closeAll(): void {
    document.querySelectorAll('.modal-overlay.open').forEach(el => el.classList.remove('open'));
    this._active = null;
  }

  isOpen(id: string): boolean {
    return document.getElementById(id)?.classList.contains('open') ?? false;
  }

  private _onBackdropClick(id: string, event: Event): void {
    const target = event.target as HTMLElement;
    if (target.id === id) this.close(id);
  }

  private _onEscape(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this._active) this.close(this._active);
  }
}

export const modal = new ModalManager();
