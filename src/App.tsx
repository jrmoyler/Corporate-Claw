import { useEffect, useRef, useState } from 'react';
import { SceneManager } from './three/SceneManager';
import UIOverlay from './components/UIOverlay';
import { animate } from 'animejs';

export default function App() {
  const canvas = useRef<HTMLDivElement>(null);
  const manager = useRef<SceneManager | null>(null);
  const [status, setStatus] = useState('Preparing your office…');
  const [error, setError] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let disposed = false;
    try {
      const scene = new SceneManager(canvas.current!);
      manager.current = scene;
      scene.ready.then(() => { if (!disposed) setStatus(''); }).catch(e => { if (!disposed) { setError(true); setStatus(e.message); } });
    } catch (e) { setError(true); setStatus(e instanceof Error ? e.message : 'Unable to start the office.'); }
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) animate('.workspace-header', { opacity: [0, 1], translateY: [-12, 0], duration: 600 });
    return () => { disposed = true; manager.current?.dispose(); manager.current = null; };
  }, []);
  return <main className="workspace">
    <div ref={canvas} className="office-canvas" aria-label="Interactive 3D office" />
    <UIOverlay ready={!status} paused={paused} onPause={() => { const next = !paused; setPaused(next); if (manager.current) manager.current.paused = next; }} onReset={() => manager.current?.resetView()} />
    {status && <div className="loading-screen" role={error ? 'alert' : 'status'}><div className="loading-mark">C<span>/</span>C</div><h1>Corporate Claw</h1><p>{status}</p>{error ? <button onClick={() => location.reload()}>Reload office</button> : <div className="loading-track" />}</div>}
  </main>;
}
