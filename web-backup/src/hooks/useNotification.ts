import { useState, useCallback } from 'react';

interface NotificationState {
  id: string;
  message: string;
  type: 'loading' | 'success' | 'error';
  progress?: number;
  isVisible: boolean;
}

let notificationIdCounter = 0;

export const useNotification = () => {
  const [notification, setNotification] = useState<NotificationState | null>(null);

  const showNotification = useCallback((message: string, type: 'loading' | 'success' | 'error' = 'loading', progress?: number) => {
    const id = `notification-${++notificationIdCounter}`;
    console.log('🎬 NOTIFICATION DEBUG: showNotification called', { message, type, progress, id });

    setNotification({
      id,
      message,
      type,
      progress,
      isVisible: true
    });

    // Auto-hide success and error notifications after 3 seconds
    if (type === 'success' || type === 'error') {
      setTimeout(() => {
        console.log('🎬 NOTIFICATION DEBUG: Auto-hiding notification', id);
        setNotification(prev => prev?.id === id ? { ...prev, isVisible: false } : prev);
        // Remove from state after animation completes
        setTimeout(() => {
          setNotification(prev => prev?.id === id ? null : prev);
        }, 500);
      }, 3000);
    }

    return id;
  }, []);

  const updateNotification = useCallback((id: string, updates: Partial<Pick<NotificationState, 'message' | 'type' | 'progress'>>) => {
    setNotification(prev => {
      if (!prev || prev.id !== id) return prev;

      const newNotification = { ...prev, ...updates };

      // Auto-hide if changed to success or error
      if ((updates.type === 'success' || updates.type === 'error') && prev.type !== updates.type) {
        setTimeout(() => {
          setNotification(current => current?.id === id ? { ...current, isVisible: false } : current);
          // Remove from state after animation completes
          setTimeout(() => {
            setNotification(current => current?.id === id ? null : current);
          }, 500);
        }, 3000);
      }

      return newNotification;
    });
  }, []);

  const hideNotification = useCallback((id?: string) => {
    setNotification(prev => {
      if (!prev || (id && prev.id !== id)) return prev;
      return { ...prev, isVisible: false };
    });

    // Remove from state after animation completes
    setTimeout(() => {
      setNotification(prev => {
        if (!prev || (id && prev.id !== id)) return prev;
        return null;
      });
    }, 500);
  }, []);

  const loading = useCallback((message: string, progress?: number) => {
    return showNotification(message, 'loading', progress);
  }, [showNotification]);

  const success = useCallback((message: string) => {
    return showNotification(message, 'success');
  }, [showNotification]);

  const error = useCallback((message: string) => {
    return showNotification(message, 'error');
  }, [showNotification]);

  const update = useCallback((id: string, updates: { render?: string; type?: 'loading' | 'success' | 'error'; progress?: number }) => {
    updateNotification(id, {
      message: updates.render || '',
      type: updates.type,
      progress: updates.progress
    });
  }, [updateNotification]);

  return {
    notification,
    loading,
    success,
    error,
    update,
    hide: hideNotification
  };
};