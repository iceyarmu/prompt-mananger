export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationAction {
  label: string;
  action: () => void;
}

export interface NotificationOptions {
  type?: NotificationType;
  duration?: number;
  actions?: NotificationAction[];
}

class NotificationManager {
  private container: HTMLElement | null = null;
  
  private ensureContainer() {
    if (!this.container) {
      this.container = document.getElementById('notification-container');
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.className = 'fixed top-4 right-4 z-50 space-y-2';
        document.body.appendChild(this.container);
      }
    }
    return this.container;
  }
  
  show(message: string, type: NotificationType = 'info', duration: number = 3000, actions: NotificationAction[] = []) {
    const container = this.ensureContainer();
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type} p-4 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in`;
    
    // Set background colors based on type
    const bgColors: Record<NotificationType, string> = {
      success: 'bg-green-500 text-white',
      error: 'bg-red-500 text-white',
      warning: 'bg-yellow-500 text-white',
      info: 'bg-blue-500 text-white'
    };
    
    notification.className += ` ${bgColors[type]}`;
    
    // Message content
    const messageEl = document.createElement('span');
    messageEl.textContent = message;
    messageEl.className = 'flex-1';
    notification.appendChild(messageEl);
    
    // Actions
    if (actions.length > 0) {
      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'flex gap-2';
      
      actions.forEach(action => {
        const button = document.createElement('button');
        button.textContent = action.label;
        button.className = 'px-3 py-1 bg-white bg-opacity-20 rounded hover:bg-opacity-30 transition-colors';
        button.onclick = () => {
          action.action();
          this.remove(notification);
        };
        actionsContainer.appendChild(button);
      });
      
      notification.appendChild(actionsContainer);
    }
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.className = 'text-2xl leading-none hover:opacity-75 transition-opacity';
    closeBtn.onclick = () => this.remove(notification);
    notification.appendChild(closeBtn);
    
    container.appendChild(notification);
    
    // Auto remove after duration (if duration > 0)
    if (duration > 0) {
      setTimeout(() => {
        this.remove(notification);
      }, duration);
    }
    
    return notification;
  }
  
  remove(notification: HTMLElement) {
    notification.classList.add('animate-slide-out');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }
}

const notificationManager = new NotificationManager();

export function showNotification(
  message: string, 
  type: NotificationType = 'info', 
  duration: number = 3000,
  actions: NotificationAction[] = []
) {
  return notificationManager.show(message, type, duration, actions);
}

// Add required styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slide-in {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slide-out {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
  
  .animate-slide-in {
    animation: slide-in 0.3s ease-out;
  }
  
  .animate-slide-out {
    animation: slide-out 0.3s ease-out;
  }
`;
document.head.appendChild(style);