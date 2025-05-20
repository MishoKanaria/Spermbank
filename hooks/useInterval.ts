import { useEffect, useRef } from 'react';


export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);
  const frameId = useRef<number | null>(null);
  const lastRunTime = useRef<number>(0);

  // Update callback ref when callback changes
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Handle animation frame setup and cleanup
  useEffect(() => {
    // Clear any existing animation frame
    if (frameId.current) {
      cancelAnimationFrame(frameId.current);
      frameId.current = null;
    }

    // Don't set up animation if delay is null
    if (delay === null) return;

    const animate = (timestamp: number) => {
      if (!lastRunTime.current) {
        lastRunTime.current = timestamp;
      }

      const elapsed = timestamp - lastRunTime.current;
      if (elapsed >= delay) {
        savedCallback.current();
        lastRunTime.current = timestamp;
      }

      frameId.current = requestAnimationFrame(animate);
    };

    frameId.current = requestAnimationFrame(animate);

    // Cleanup function
    return () => {
      if (frameId.current) {
        cancelAnimationFrame(frameId.current);
        frameId.current = null;
      }
    };
  }, [delay]);
} 