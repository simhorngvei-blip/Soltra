'use client'

import React, { useEffect, Suspense, useRef, useMemo, useState } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { Stage, Environment, Html } from '@react-three/drei'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRM, VRMLoaderPlugin, VRMUtils, VRMExpressionPresetName, VRMHumanBoneName } from '@pixiv/three-vrm'
import * as THREE from 'three'

class VRMCustomLoader extends GLTFLoader {}

function SimpleLoader() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[#00d9ff] border-t-transparent rounded-full animate-spin" />
        <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest animate-pulse">
          Initializing Avatar Core...
        </span>
      </div>
    </Html>
  )
}

function Model({ url }: { url: string }) {
  // Load VRM
  const gltf = useLoader(VRMCustomLoader, url, (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser))
  })

  const vrm = useMemo(() => {
    const vrmData = gltf.userData.vrm as VRM
    if (vrmData) {
      VRMUtils.removeUnnecessaryVertices(gltf.scene)
      VRMUtils.removeUnnecessaryJoints(gltf.scene)
      vrmData.scene.rotation.y = Math.PI

      // Apply Toon Shader & Red/Cyan Aesthetic
      vrmData.scene.traverse((child: any) => {
        if (child.isMesh && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          
          const newMaterials = materials.map((oldMat: any) => {
            if (!oldMat.map) return oldMat;

            const isEye = child.name.toLowerCase().includes('eye') || 
                          (oldMat.name && oldMat.name.toLowerCase().includes('eye')) ||
                          (oldMat.name && oldMat.name.toLowerCase().includes('hitomi')) ||
                          (oldMat.name && oldMat.name.toLowerCase().includes('pupil'));
                          
            const newMat = new THREE.MeshToonMaterial({
              map: oldMat.map,
              color: new THREE.Color(0xffffff),
              emissive: isEye ? new THREE.Color(0x00ffff) : new THREE.Color(0x0a1128),
              emissiveMap: isEye ? oldMat.map : null,
              emissiveIntensity: isEye ? 1.0 : 0.2,
              transparent: oldMat.transparent,
              alphaTest: oldMat.alphaTest,
              side: THREE.DoubleSide,
            });

            // Update expression binds
            if (vrmData.expressionManager) {
              const expressions = vrmData.expressionManager.expressions || [];
              expressions.forEach(exp => {
                if ((exp as any)._bindsMaterialColor) {
                  (exp as any)._bindsMaterialColor.forEach((bind: any) => {
                    if (bind.material === oldMat) bind.material = newMat;
                  });
                }
                if ((exp as any)._bindsTextureTransform) {
                  (exp as any)._bindsTextureTransform.forEach((bind: any) => {
                    if (bind.material === oldMat) bind.material = newMat;
                  });
                }
              });
            }
            return newMat;
          });

          child.material = Array.isArray(child.material) ? newMaterials : newMaterials[0];
        }
      })

      return vrmData
    }
    return null
  }, [gltf])

  useFrame((state, delta) => {
    if (vrm) {
      vrm.update(delta)

      // Head tracking
      const head = vrm.humanoid?.getNormalizedBoneNode('head')
      if (head) {
        const targetX = state.mouse.y * 0.3
        const targetY = state.mouse.x * 0.4
        head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, targetX, 0.1)
        head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, targetY, 0.1)
      }

      // Blink
      if (vrm.expressionManager) {
        const t = state.clock.getElapsedTime()
        const blinkValue = Math.max(0, Math.sin(t * 0.8) > 0.98 ? 1 : 0)
        vrm.expressionManager.setValue(VRMExpressionPresetName.Blink, blinkValue)
      }
    }
  })

  return vrm ? <primitive object={vrm.scene} position={[0, -1.2, 0]} /> : null
}

export function VRMScene({ url }: { url: string }) {
  return (
    <div className="w-full h-full min-h-[400px]">
      <Canvas camera={{ position: [0, 0, 2.5], fov: 35 }}>
        <Suspense fallback={<SimpleLoader />}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[5, 5, 5]} intensity={1.5} />
          <pointLight position={[-5, 5, -5]} intensity={1} color="#00ffff" />
          <Stage intensity={0} adjustCamera={false} environment={null}>
            <Model url={url} />
          </Stage>
        </Suspense>
      </Canvas>
    </div>
  )
}
