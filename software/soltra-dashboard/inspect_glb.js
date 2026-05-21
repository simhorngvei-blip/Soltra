import fs from 'fs';

function inspectGlb(filepath) {
  const buf = fs.readFileSync(filepath);
  const bufView = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  const magic = bufView.getUint32(0, true);
  if (magic !== 0x46546C67) {
    console.error('Not a GLB');
    return;
  }

  const length = bufView.getUint32(8, true);
  let offset = 12;
  let jsonStr = null;

  while(offset < length) {
    const chunkLength = bufView.getUint32(offset, true);
    const chunkType = bufView.getUint32(offset + 4, true);
    
    if (chunkType === 0x4E4F534A) {
      jsonStr = Buffer.from(buf.buffer, buf.byteOffset + offset + 8, chunkLength).toString('utf8');
      break;
    }
    offset += 8 + chunkLength;
  }

  if (!jsonStr) {
    console.error('No JSON chunk found');
    return;
  }

  const json = JSON.parse(jsonStr);
  console.log('--- GLB JSON INSPECTION ---');
  console.log('Nodes count:', json.nodes ? json.nodes.length : 0);
  console.log('Skins count:', json.skins ? json.skins.length : 0);
  console.log('Meshes count:', json.meshes ? json.meshes.length : 0);
  console.log('Animations count:', json.animations ? json.animations.length : 0);
  
  if (json.animations && json.animations.length > 0) {
    const anim = json.animations[0];
    console.log('First animation structure:');
    console.log('  Name:', anim.name);
    console.log('  Channels count:', anim.channels.length);
    if (anim.channels.length > 0) {
      console.log('  First channel target node:', anim.channels[0].target.node);
    }
  }

  if (json.skins) {
    let maxJoint = -1;
    json.skins.forEach(s => {
      s.joints.forEach(j => {
        if (j > maxJoint) maxJoint = j;
      });
    });
    console.log('Max joint index referenced by skins:', maxJoint);
    if (json.nodes && maxJoint >= json.nodes.length) {
      console.log('!!! ERROR !!! Max joint index EXCEEDS nodes length!');
    } else {
      console.log('Joint indices within range of nodes array.');
    }
  }
}

inspectGlb('d:/SOLTRA/soltra-dashboard/public/idle_anim.glb');
