import * as THREE from 'three';
import {renderer, camera, runtime, world, universe, physics, ui, rig, app, appManager, popovers} from 'app';

const rootScene = new THREE.Object3D();
app.object.add(rootScene);

const numParcels = 7;

(async () => {
  const promises = [];
  for (let i = 1; i <= numParcels; i++) {
    const p = (async () => {
      const u = `https://webaverse.github.io/parcels/parcels/${i}.json`;
      await world.addStaticObject(u, null, new THREE.Vector3(), new THREE.Quaternion());
    })();
    promises.push(p);
  }
  await Promise.all(promises);
})();