import * as THREE from 'three';

/**
 * Full Mixamo bone name → VRM HumanoidBoneName mapping.
 * Covers the complete standard humanoid rig.
 */
export const mixamoVRMRigMap = {
  // Core spine
  mixamorigHips:           'hips',
  mixamorigSpine:          'spine',
  mixamorigSpine1:         'chest',
  mixamorigSpine2:         'upperChest',
  mixamorigNeck:           'neck',
  mixamorigHead:           'head',

  // Left arm
  mixamorigLeftShoulder:   'leftShoulder',
  mixamorigLeftArm:        'leftUpperArm',
  mixamorigLeftForeArm:    'leftLowerArm',
  mixamorigLeftHand:       'leftHand',

  // Right arm
  mixamorigRightShoulder:  'rightShoulder',
  mixamorigRightArm:       'rightUpperArm',
  mixamorigRightForeArm:   'rightLowerArm',
  mixamorigRightHand:      'rightHand',

  // Left leg
  mixamorigLeftUpLeg:      'leftUpperLeg',
  mixamorigLeftLeg:        'leftLowerLeg',
  mixamorigLeftFoot:       'leftFoot',
  mixamorigLeftToeBase:    'leftToes',

  // Right leg
  mixamorigRightUpLeg:     'rightUpperLeg',
  mixamorigRightLeg:       'rightLowerLeg',
  mixamorigRightFoot:      'rightFoot',
  mixamorigRightToeBase:   'rightToes',

  // Left hand fingers
  mixamorigLeftHandThumb1:   'leftThumbMetacarpal',
  mixamorigLeftHandThumb2:   'leftThumbProximal',
  mixamorigLeftHandThumb3:   'leftThumbDistal',
  mixamorigLeftHandIndex1:   'leftIndexProximal',
  mixamorigLeftHandIndex2:   'leftIndexIntermediate',
  mixamorigLeftHandIndex3:   'leftIndexDistal',
  mixamorigLeftHandMiddle1:  'leftMiddleProximal',
  mixamorigLeftHandMiddle2:  'leftMiddleIntermediate',
  mixamorigLeftHandMiddle3:  'leftMiddleDistal',
  mixamorigLeftHandRing1:    'leftRingProximal',
  mixamorigLeftHandRing2:    'leftRingIntermediate',
  mixamorigLeftHandRing3:    'leftRingDistal',
  mixamorigLeftHandPinky1:   'leftLittleProximal',
  mixamorigLeftHandPinky2:   'leftLittleIntermediate',
  mixamorigLeftHandPinky3:   'leftLittleDistal',

  // Right hand fingers
  mixamorigRightHandThumb1:  'rightThumbMetacarpal',
  mixamorigRightHandThumb2:  'rightThumbProximal',
  mixamorigRightHandThumb3:  'rightThumbDistal',
  mixamorigRightHandIndex1:  'rightIndexProximal',
  mixamorigRightHandIndex2:  'rightIndexIntermediate',
  mixamorigRightHandIndex3:  'rightIndexDistal',
  mixamorigRightHandMiddle1: 'rightMiddleProximal',
  mixamorigRightHandMiddle2: 'rightMiddleIntermediate',
  mixamorigRightHandMiddle3: 'rightMiddleDistal',
  mixamorigRightHandRing1:   'rightRingProximal',
  mixamorigRightHandRing2:   'rightRingIntermediate',
  mixamorigRightHandRing3:   'rightRingDistal',
  mixamorigRightHandPinky1:  'rightLittleProximal',
  mixamorigRightHandPinky2:  'rightLittleIntermediate',
  mixamorigRightHandPinky3:  'rightLittleDistal',
};

/**
 * Retargets a Mixamo AnimationClip to drive a VRM humanoid rig.
 *
 * @param {THREE.AnimationClip} clip  - The raw Mixamo animation clip.
 * @param {import('@pixiv/three-vrm').VRM} vrm - The loaded VRM instance.
 * @returns {THREE.AnimationClip} A new clip with corrected VRM bone track names.
 */
export function retargetMixamoClip(clip, vrm) {
  const tracks = [];

  for (const track of clip.tracks) {
    // Track names look like: "mixamorigHips.quaternion" or "mixamorigHips.position"
    const parts = track.name.split('.');
    const mixamoBone = parts[0];
    const property   = parts[1];

    const vrmBoneName = mixamoVRMRigMap[mixamoBone];
    if (!vrmBoneName) continue; // skip unmapped bones

    const vrmNode = vrm.humanoid?.getNormalizedBoneNode(vrmBoneName);
    if (!vrmNode) continue;     // skip bones absent in this VRM model

    // Clone track and rename to the VRM node's UUID-independent name
    const vrmTrackName = `${vrmNode.name}.${property}`;
    const clonedTrack  = track.clone();
    clonedTrack.name   = vrmTrackName;

    tracks.push(clonedTrack);
  }

  return new THREE.AnimationClip('retargeted', clip.duration, tracks);
}
