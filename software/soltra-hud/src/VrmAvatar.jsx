import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { loadAnim } from 'vrm-mixamo-retarget';
import * as THREE from 'three';

/**
 * Enhanced VrmAvatar component supporting:
 * - Realistic Shading (MeshStandardMaterial conversion)
 * - Multi-animation cross-fading
 * - VRM Expressions (Facial Blendshapes)
 * - Auto-Blink system
 */
export default function VrmAvatar({ 
  position = [0, 0, 0], 
  rotation = [0, 0, 0], 
  scale = 1, 
  realisticShading = true,
  shaderMode = 'toon',
  animationName = 'idle',
  expressionName = 'neutral',
  isTalking = false,
  audioAnalyser = null // Optional Web Audio AnalyserNode
}) {
  const [vrm, setVrm] = useState(null);
  const mixerRef = useRef(null);
  const actionsRef = useRef({}); // Store AnimationActions
  const currentActionRef = useRef(null);
  const mouthOscillationRef = useRef(0);

  // ─── 1. Initial Load ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const loadAvatar = async () => {
      try {
        const vrmLoader = new GLTFLoader();
        vrmLoader.crossOrigin = 'anonymous';
        vrmLoader.register((parser) => new VRMLoaderPlugin(parser));

        const vrmGltf = await new Promise((resolve, reject) => 
          vrmLoader.load('/avatar.vrm', resolve, undefined, reject)
        );
        if (cancelled) return;

        const loadedVrm = vrmGltf.userData.vrm;
        VRMUtils.rotateVRM0(loadedVrm);

        // Convert ALL meshes to selected shading
        if (realisticShading || shaderMode === 'toon') {
          loadedVrm.scene.traverse((child) => {
            if (child.isMesh && child.material) {
              const oldMat = child.material;
              
              if (oldMat.map) {
                const isEye = child.name.toLowerCase().includes('eye') || 
                              (oldMat.name && oldMat.name.toLowerCase().includes('eye')) ||
                              (oldMat.name && oldMat.name.toLowerCase().includes('hitomi')) ||
                              (oldMat.name && oldMat.name.toLowerCase().includes('pupil'));

                let newMat;
                if (shaderMode === 'toon') {
                  newMat = new THREE.MeshToonMaterial({
                    map: oldMat.map,
                    color: new THREE.Color(0xffffff),
                    // Red/Cyan aesthetic: Cyan eyes, slightly dark-blue body base to absorb red light well
                    emissive: isEye ? new THREE.Color(0x00ffff) : new THREE.Color(0x0a1128),
                    emissiveMap: isEye ? oldMat.map : null,
                    emissiveIntensity: isEye ? 1.0 : 0.2, 
                    transparent: oldMat.transparent,
                    alphaTest: oldMat.alphaTest,
                    side: THREE.DoubleSide,
                  });
                } else {
                  newMat = new THREE.MeshStandardMaterial({
                    map: oldMat.map,
                    color: oldMat.color,
                    roughness: 0.8,
                    metalness: 0.1,
                    transparent: oldMat.transparent,
                    alphaTest: oldMat.alphaTest,
                    side: THREE.DoubleSide,
                    emissive: isEye ? new THREE.Color(0xffffff) : new THREE.Color(0x000000),
                    emissiveMap: isEye ? oldMat.map : null,
                    emissiveIntensity: isEye ? 0.6 : 0, // Brightens the eyes
                  });
                }

                child.material = newMat;

                // Update expression binds to point to the new material
                if (loadedVrm.expressionManager) {
                  const expressions = loadedVrm.expressionManager.expressions || [];
                  expressions.forEach(exp => {
                    if (exp._bindsMaterialColor) {
                      exp._bindsMaterialColor.forEach(bind => {
                        if (bind.material === oldMat) bind.material = newMat;
                      });
                    }
                    if (exp._bindsTextureTransform) {
                      exp._bindsTextureTransform.forEach(bind => {
                        if (bind.material === oldMat) bind.material = newMat;
                      });
                    }
                  });
                }
              }
            }
          });
        }

        // Debug: Log available expressions
        const manager = loadedVrm.expressionManager;
        if (manager) {
          const names = manager.expressions?.map(e => e.expressionName) 
                     || Object.keys(manager._expressionMap || {});
          console.log('[VrmAvatar] Available expressions:', names);
        } else {
          console.warn('[VrmAvatar] No expressionManager found on this VRM!');
        }

        setVrm(loadedVrm);

        // Load default animation
        const mixer = new THREE.AnimationMixer(loadedVrm.scene);
        mixerRef.current = mixer;

        const clip = await loadAnim('/idle_anim.fbx', loadedVrm);
        if (clip && !cancelled) {
          const action = mixer.clipAction(clip);
          action.play();
          actionsRef.current['idle'] = action;
          currentActionRef.current = action;
        }
      } catch (err) {
        console.error('[VrmAvatar] Setup failed:', err);
      }
    };

    loadAvatar();

    return () => {
      cancelled = true;
      mixerRef.current?.stopAllAction();
    };
  }, []); // Only on mount

  // ─── 2. Handle Animation Switching ────────────────────────────
  useEffect(() => {
    if (!vrm || !mixerRef.current) return;

    const switchAnimation = async () => {
      const mixer = mixerRef.current;
      
      // If talking, we might want to prioritize a talking animation if available
      const targetAnim = (isTalking && actionsRef.current['talking']) ? 'talking' : animationName;

      if (actionsRef.current[targetAnim]) {
        const nextAction = actionsRef.current[targetAnim];
        if (nextAction === currentActionRef.current) return;

        nextAction.reset().fadeIn(0.5).play();
        currentActionRef.current?.fadeOut(0.5);
        currentActionRef.current = nextAction;
      } else {
        try {
          const path = `/${targetAnim}_anim.fbx`;
          const clip = await loadAnim(path, vrm);
          if (clip) {
            const nextAction = mixer.clipAction(clip);
            actionsRef.current[targetAnim] = nextAction;
            
            nextAction.reset().fadeIn(0.5).play();
            currentActionRef.current?.fadeOut(0.5);
            currentActionRef.current = nextAction;
          }
        } catch (e) {
          console.warn(`[VrmAvatar] Failed to load animation: ${targetAnim}`, e);
        }
      }
    };

    switchAnimation();
  }, [animationName, vrm, isTalking]);

  // ─── 3. Handle Expression Changes ─────────────────────────────
  useEffect(() => {
    if (!vrm) return;
    const manager = vrm.expressionManager;
    if (!manager) return;

    // Reset all expressions first
    const allExpressions = ['happy', 'sad', 'angry', 'relaxed', 'surprised',
                            'joy', 'sorrow', 'fun',
                            'aa', 'ih', 'ou', 'ee', 'oh'];
    allExpressions.forEach(exp => {
      try { manager.setValue(exp, 0.0); } catch (_) { /* skip missing */ }
    });

    const expMap = {
      'neutral': [],
      'happy': ['happy', 'joy'],
      'relaxed': ['relaxed', 'fun'],
      'surprised': ['surprised'],
      'angry': ['angry'],
      'sad': ['sad', 'sorrow']
    };

    // Apply the selected expression
    if (expressionName && expressionName !== 'neutral') {
      const targetExpressions = expMap[expressionName] || [expressionName];
      let applied = false;
      for (const target of targetExpressions) {
        try {
          manager.setValue(target, 1.0);
          console.log(`[VrmAvatar] Expression set: ${target} = 1.0`);
          applied = true;
          break; // Stop after successfully setting an expression
        } catch (e) {
          // keep trying alternatives
        }
      }
      if (!applied) {
        console.warn(`[VrmAvatar] Expression "${expressionName}" and its variants not found in model.`);
      }
    }
  }, [expressionName, vrm]);

  // ─── 4. Update Loop ───────────────────────────────────────────
  useFrame((state, delta) => {
    if (!vrm) return;

    // Update animation mixer
    mixerRef.current?.update(delta);

    const manager = vrm.expressionManager;
    if (manager) {
      const t = state.clock.elapsedTime;
      
      // Auto-Blink: natural blinking every ~4 seconds
      const blinkCycle = t % 4;
      const blinkValue = (blinkCycle > 3.85 && blinkCycle < 4.0) ? 1.0 : 0.0;
      try { manager.setValue('blink', blinkValue); } catch (_) { /* skip */ }

      // Audio-driven Lip-Sync via AnalyserNode
      if (audioAnalyser) {
        const dataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
        audioAnalyser.getByteFrequencyData(dataArray);
        
        // Calculate average volume from frequencies
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        // Normalize volume (0 to 1)
        const volume = Math.min(1.0, average / 128.0);
        
        // Map volume to mouth shapes
        // aa (open mouth) responds to overall volume
        // oh (rounded mouth) responds to lower frequencies
        // ih (wide mouth) responds to higher frequencies
        
        const lowSum = dataArray.slice(0, 10).reduce((a,b)=>a+b, 0) / 10;
        const highSum = dataArray.slice(20, 40).reduce((a,b)=>a+b, 0) / 20;
        
        const mouthA = Math.min(1.0, volume * 1.5);
        const mouthO = Math.min(1.0, (lowSum / 255.0) * 1.2);
        const mouthI = Math.min(1.0, (highSum / 255.0) * 1.2);

        try {
          manager.setValue('aa', mouthA);
          manager.setValue('oh', mouthO * 0.5);
          manager.setValue('ih', mouthI * 0.3);
        } catch (_) { /* skip */ }

      } else if (isTalking) {
        // Fallback Procedural Lip-Sync
        mouthOscillationRef.current += delta * 12; // Speed of talking
        const mouthA = (Math.sin(mouthOscillationRef.current) + 1) * 0.5;
        const mouthO = (Math.cos(mouthOscillationRef.current * 0.7) + 1) * 0.3;
        
        try {
          manager.setValue('aa', mouthA * 0.8);
          manager.setValue('oh', mouthO * 0.5);
        } catch (_) { /* skip */ }
      } else {
        // Close mouth when not talking
        try {
          manager.setValue('aa', 0);
          manager.setValue('oh', 0);
          manager.setValue('ih', 0);
        } catch (_) { /* skip */ }
      }
    }

    // CRITICAL: Update VRM internals (physics, expressions, spring bones)
    vrm.update(delta);
  });

  if (!vrm) return null;

  return <primitive object={vrm.scene} position={position} rotation={rotation} scale={scale} />;
}
