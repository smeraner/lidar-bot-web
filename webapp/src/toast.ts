export class Toast {
  private static container: HTMLDivElement | null = null;

  private static init() {
    if (this.container) return;
    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    document.body.appendChild(this.container);
  }

  static show(
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    duration = 3000,
    action?: { label: string; callback: () => void },
  ) {
    this.init();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    if (type === 'success') icon.textContent = '✅';
    else if (type === 'error') icon.textContent = '❌';
    else if (type === 'warning') icon.textContent = '⚠️';
    else icon.textContent = 'ℹ️';

    const text = document.createElement('span');
    text.className = 'toast-text';
    text.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(text);

    if (action) {
      const btn = document.createElement('button');
      btn.className = 'toast-action-btn';
      btn.textContent = action.label;
      btn.onclick = (e) => {
        e.stopPropagation();
        action.callback();
      };
      toast.appendChild(btn);
    }

    this.container?.appendChild(toast);

    // Trigger reflow for animation
    void toast.offsetHeight;
    toast.classList.add('visible');

    if (duration > 0) {
      setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => {
          toast.remove();
        }, 300);
      }, duration);
    }
  }

  static success(msg: string) {
    this.show(msg, 'success');
  }
  static error(msg: string) {
    this.show(msg, 'error', 5000);
  }
  static info(msg: string) {
    this.show(msg, 'info');
  }
  static warn(msg: string) {
    this.show(msg, 'warning');
  }
}
