'use client'

import React, { useEffect, Suspense, useRef, useMemo, useState } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { Stage, Environment, Html, OrbitControls, Bounds } from '@react-three/drei'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRM, VRMLoaderPlugin, VRMUtils, VRMExpressionPresetName, VRMHumanBoneName } from '@pixiv/three-vrm'
import * as THREE from 'three'

class VRMCustomLoader extends GLTFLoader { }

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
  const [vrm, setVrm] = useState<VRM | null>(null)

  useEffect(() => {
    let isMounted = true
    let loadedVrm: VRM | null = null

    const loader = new GLTFLoader()
    loader.register((parser) => new VRMLoaderPlugin(parser))

    loader.load(url, (gltf) => {
      const vrmData = gltf.userData.vrm as VRM
      if (vrmData && isMounted) {
        VRMUtils.removeUnnecessaryVertices(gltf.scene)
        VRMUtils.combineSkeletons(gltf.scene)
        vrmData.scene.rotation.y = 0

        // Force a relaxed A-Pose
        const leftArm = vrmData.humanoid?.getNormalizedBoneNode('leftUpperArm')
        const rightArm = vrmData.humanoid?.getNormalizedBoneNode('rightUpperArm')
        if (leftArm) {
          leftArm.rotation.z = -1.2 // Rotate left arm down
          leftArm.rotation.x = 0.2 // Bring slightly forward
        }
        if (rightArm) {
          rightArm.rotation.z = 1.2 // Rotate right arm down
          rightArm.rotation.x = 0.2 // Bring slightly forward
        }

        const leftHand = vrmData.humanoid?.getNormalizedBoneNode('leftHand')
        const rightHand = vrmData.humanoid?.getNormalizedBoneNode('rightHand')
        if (leftHand) leftHand.rotation.x = -0.2 // Relax hand
        if (rightHand) rightHand.rotation.x = -0.2 // Relax hand

        loadedVrm = vrmData
        setVrm(vrmData)
      }
    }, undefined, (err) => {
      console.error("VRM Load Error:", err)
    })

    return () => {
      isMounted = false
      if (loadedVrm) {
        loadedVrm.scene.traverse((child: any) => {
          if (child.isMesh) {
            child.geometry?.dispose()
            if (Array.isArray(child.material)) {
              child.material.forEach((m: any) => m.dispose())
            } else {
              child.material?.dispose()
            }
          }
        })
      }
    }
  }, [url])

  useFrame((state, delta) => {
    if (vrm) {
      vrm.update(delta)

      // Head tracking
      const head = vrm.humanoid?.getNormalizedBoneNode('head')
      if (head) {
        const targetX = -state.mouse.y * 0.3
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

  if (!vrm) return <SimpleLoader />
  return <primitive object={vrm.scene} position={[0, 0, 0]} />
}

export function VRMScene({ url }: { url: string }) {
  return (
    <div className="w-full h-full min-h-[400px]">
      <Canvas camera={{ position: [0, 1.5, 4], fov: 40 }}>
        <Suspense fallback={<SimpleLoader />}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[5, 5, 5]} intensity={1.5} />
          <pointLight position={[-5, 5, -5]} intensity={1} color="#00ffff" />
          <Bounds fit observe margin={1.0}>
            <Model url={url} />
          </Bounds>
          <OrbitControls 
            makeDefault
            target={[0, 1.2, 0]}
            enablePan={false} 
            enableZoom={false}
            enableDamping={true}
            dampingFactor={0.02}
            minDistance={2} 
            maxDistance={8}
            maxPolarAngle={Math.PI / 2 + 0.1} 
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
