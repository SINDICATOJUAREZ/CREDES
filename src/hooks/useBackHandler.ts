'use client';

import { useEffect, useRef, useId } from 'react';
import { backManager } from '@/lib/back-handler';
import { toast } from 'sonner';

/**
 * Hook to register a back-button action for modals, dialogs, drawers, or subviews.
 * When the user presses the phone's native back button or uses edge-swipe gesture,
 * onBack() will be executed instead of exiting the application.
 */
export function useBackHandler({
  enabled,
  onBack,
  id: customId
}: {
  enabled: boolean;
  onBack: () => void;
  id?: string;
}) {
  const autoId = useId();
  const id = customId || autoId;
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!enabled) return;

    backManager.register(id, () => {
      onBackRef.current?.();
    });

    return () => {
      backManager.unregister(id);
    };
  }, [enabled, id]);
}

/**
 * Hook to guard the root application screen from accidental exit.
 * On mobile, pressing back at the root dashboard prompts "Presiona atrás nuevamente para salir".
 */
export function useRootBackGuard() {
  useEffect(() => {
    backManager.setExitToastCallback(() => {
      toast('Presiona atrás nuevamente para salir', {
        duration: 2000,
        position: 'bottom-center'
      });
    });

    backManager.enableRootGuard();

    return () => {
      backManager.setExitToastCallback(null);
      backManager.disableRootGuard();
    };
  }, []);
}
