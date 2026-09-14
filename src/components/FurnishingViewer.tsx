import { useEffect, useRef, useState } from 'react';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';
import { X, RotateCcw } from 'lucide-react';
export default function FurnishingViewer({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<ArcRotateCamera>();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState('Loading furnishing…');
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    let engine: Engine;
    try { engine = new Engine(ref.current!, true, { preserveDrawingBuffer: false, stencil: true }); }
    catch { setStatus('3D furnishings need a browser with hardware acceleration. You can close this window and continue using the workspace.'); return () => prior?.focus(); }
    engine.setHardwareScalingLevel(Math.max(1, devicePixelRatio / 1.5));
    const scene = new Scene(engine); scene.clearColor = new Color4(.94,.925,.895,1);
    const camera = new ArcRotateCamera('Furnishing camera', -Math.PI / 2.5, Math.PI / 2.8, 6.7, new Vector3(0,.8,0), scene);
    camera.lowerRadiusLimit=3; camera.upperRadiusLimit=12; camera.attachControl(ref.current!, true); cameraRef.current=camera;
    new HemisphericLight('Studio skylight', new Vector3(1,2,-1), scene).intensity=2;
    let disposed=false;
    SceneLoader.ImportMeshAsync('', '/models/', 'lounge-sofa.glb', scene).then(() => { if (!disposed) setStatus(''); }).catch(() => { if (!disposed) setStatus('The furnishing could not load. Close and reopen to retry.'); });
    engine.runRenderLoop(() => { if (!document.hidden) scene.render(); });
    const resize=()=>engine.resize(); window.addEventListener('resize',resize);
    const key=(e: KeyboardEvent)=> { if(e.key==='Escape') onClose(); };
    window.addEventListener('keydown',key);
    return()=>{ disposed=true; window.removeEventListener('resize',resize); window.removeEventListener('keydown',key); scene.dispose(); engine.dispose(); prior?.focus(); };
  }, []);
  return <div className="furnishing-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="furnishing-title" className="furnishing-dialog"><header><div><h2 id="furnishing-title">The lounge collection</h2><p>Forest upholstery · walnut frame · brushed brass</p></div><button ref={closeRef} aria-label="Close furnishings" onClick={onClose}><X size={22}/></button></header><canvas ref={ref} aria-label="Rotatable 3D lounge sofa"/>{status && <p role="status" className="furnishing-status">{status}</p>}<footer><span>Drag to explore. Scroll or pinch to zoom.</span><button onClick={()=>{const c=cameraRef.current;if(c){c.alpha=-Math.PI/2.5;c.beta=Math.PI/2.8;c.radius=6.7;}}}><RotateCcw size={15}/> Reset</button></footer></section></div>;
}
