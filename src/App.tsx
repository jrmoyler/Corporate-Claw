/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */


import React, { useEffect, useRef } from 'react';
import { SceneManager } from './three/SceneManager';
import UIOverlay from './components/UIOverlay';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<SceneManager | null>(null);

  useEffect(() => {
    if (!('gpu' in navigator)) {
      console.warn('[Corporate Claw] WebGPU is not available in this browser. Rendering may fail or fall back.');
      return;
    }

    if (canvasRef.current && !managerRef.current) {
      managerRef.current = new SceneManager(canvasRef.current);
    }

    return () => {
      if (managerRef.current) {
        managerRef.current.dispose();
        managerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-screen h-screen bg-white overflow-hidden">
      {/* Three.js Container */}
      <div ref={canvasRef} className="absolute inset-0 w-full h-full" />
      
      {/* UI Layer */}
      <UIOverlay />
    </div>
  );
};

export default App;
