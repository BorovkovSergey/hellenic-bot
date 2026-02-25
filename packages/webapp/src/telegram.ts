declare global {
  interface Window {
    Telegram: {
      WebApp: {
        initData: string;
        initDataUnsafe: any;
        colorScheme: string;
        themeParams: Record<string, string>;
        expand: () => void;
        close: () => void;
        BackButton: {
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
          isVisible: boolean;
        };
        HapticFeedback: {
          impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
          notificationOccurred: (type: "error" | "success" | "warning") => void;
          selectionChanged: () => void;
        };
        showConfirm: (message: string, callback: (confirmed: boolean) => void) => void;
      };
    };
  }
}

export const tg = window.Telegram?.WebApp;

export function expandApp() {
  tg?.expand();
}

export function showBackButton(handler: () => void) {
  tg?.BackButton.show();
  tg?.BackButton.onClick(handler);
  return () => {
    tg?.BackButton.offClick(handler);
    tg?.BackButton.hide();
  };
}

export function hapticLight() {
  tg?.HapticFeedback.impactOccurred("light");
}

export function hapticSuccess() {
  tg?.HapticFeedback.notificationOccurred("success");
}

export function hapticError() {
  tg?.HapticFeedback.notificationOccurred("error");
}

export function showConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (tg?.showConfirm) {
      tg.showConfirm(message, resolve);
    } else {
      resolve(window.confirm(message));
    }
  });
}
