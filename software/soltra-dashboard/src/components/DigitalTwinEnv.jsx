import { useGLTF } from '@react-three/drei';

/**
 * Renders the custom environment set-piece loaded from /public/set_piece.glb.
 * Wrapped in <Suspense> by the parent — useGLTF will suspend until ready.
 */
export default function DigitalTwinEnv({ position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }) {
  const { scene } = useGLTF('/set_piece.glb');
  return <primitive object={scene} position={position} rotation={rotation} scale={scale} />;
}

// Pre-warm the asset so it downloads in the background
useGLTF.preload('/set_piece.glb');
