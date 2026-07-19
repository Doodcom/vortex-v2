import { useState, useEffect, useRef } from 'react';
import { COMFY_URL } from '../lib/comfyApi';

interface ComfyNodeState {
  state?: string;
  value?: number;
  max?: number;
  [key: string]: unknown;
}

export function useComfySocket() {
  const [status, setStatus] = useState('disconnected');
  const [progress, setProgress] = useState(0);
  const [lastImage, setLastImage] = useState<string | null>(null);
  const [lastVideo, setLastVideo] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [clientId] = useState(() => Math.random().toString(36).substring(7));
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function connect() {
      // Clear any pending reconnect
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

      console.log('[ComfySocket] Attempting connection to 127.0.0.1:8188...');
      // Using 127.0.0.1 explicitly to avoid localhost resolution delays/issues on some Linux setups
      const ws = new WebSocket(`ws://127.0.0.1:8188/ws?clientId=${clientId}`);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log('[ComfySocket] Connected successfully');
        setStatus('connected');
      };

      ws.onclose = () => {
        console.log('[ComfySocket] Connection closed. Retrying in 3s...');
        setStatus('disconnected');
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error('[ComfySocket] Connection error:', err);
        setStatus('error');
        // onclose will also be called, which handles the reconnect
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[ComfySocket] Message type:', data.type);
          
          if (data.type === 'progress') {
            const { value, max } = data.data;
            setProgress((value / max) * 100);
          }

          // Modern ComfyUI emits progress_state instead of progress
          if (data.type === 'progress_state') {
            const nodes: Record<string, ComfyNodeState> = data.data?.nodes ?? {};
            const active = Object.values(nodes).find((n) => n.state === 'in_progress');
            if (active && active.max && active.max > 0 && active.value !== undefined) {
              setProgress((active.value / active.max) * 100);
            }
          }
          
          if (data.type === 'executed') {
            const out = data.data?.output ?? {};
            if (out.images?.length) {
              const image = out.images[0];
              setLastImage(`${COMFY_URL}/view?filename=${image.filename}&subfolder=${image.subfolder}&type=${image.type}`);
              setProgress(0);
            }
            const vidList = out.gifs ?? out.videos ?? out.mp4 ?? null;
            if (vidList?.length) {
              const vid = vidList[0];
              setLastVideo(`${COMFY_URL}/view?filename=${vid.filename}&subfolder=${vid.subfolder}&type=${vid.type}`);
              setProgress(0);
            }
          }

          if (data.type === 'execution_error') {
            const raw = data.data?.exception_message ?? 'Unknown ComfyUI error';
            console.error('[ComfySocket] Execution error:', raw);
            let msg = raw;
            if (raw.includes('Errno 32') || raw.includes('Broken pipe') || raw.includes('BrokenPipeError')) {
              msg = 'ComfyUI was interrupted (Broken Pipe). VRAM is likely exhausted — purge VRAM and try again.';
            } else if (raw.includes('CUDA out of memory') || raw.includes('out of memory') || raw.includes('OOM')) {
              msg = 'Out of GPU memory. Reduce resolution, close other GPU apps, or purge VRAM.';
            } else if (raw.includes('No module named') || raw.includes('ImportError') || raw.includes('ModuleNotFoundError')) {
              msg = `Missing ComfyUI custom node dependency. Try running AI Sync in the Updates tab.`;
            } else if (raw.includes('CUDA error') || raw.includes('device-side assert')) {
              msg = 'GPU error during generation. Purge VRAM and try again.';
            } else if (raw.length > 200) {
              msg = raw.slice(0, 200) + '...';
            }
            setGenerationError(msg);
            setProgress(0);
          }

          if (data.type === 'execution_interrupted') {
            console.warn('[ComfySocket] Generation interrupted');
            setGenerationError('Generation was interrupted by the user.');
            setProgress(0);
          }
        } catch (e) {
          console.error("[ComfySocket] Message parse error:", e);
        }
      };
    }

    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        // Remove listeners before closing to avoid triggering reconnect on unmount
        socketRef.current.onclose = null;
        socketRef.current.onerror = null;
        socketRef.current.close();
      }
    };
  }, [clientId]);

  return { status, progress, lastImage, lastVideo, generationError, resetError: () => setGenerationError(null), clientId };
}
