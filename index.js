import * as THREE from 'three';
import {renderer, camera, runtime, world, universe, physics, ui, rig, app, appManager, popovers, crypto} from 'app';

(async () => {
  const res = await fetch(`https://webaverse.github.io/parcels/parcels.json`);
  const parcelsJson = await res.json();
  for (const parcel of parcelsJson) {
    (async () => {
      const {name, rarity, extents} = parcel;
      const o = {
        start_url: `https://webaverse.github.io/parcels/parcel.json`,
        room: name.replace(/ /g, '-'),
        extents,
        rarity,
      };
      const s = JSON.stringify(o);
      const b = new Blob([s], {
        type: 'application/json',
      });
      const u = URL.createObjectURL(b) + '/parcel.url';
      const [object, parcelJson] = await Promise.all([
        world.addStaticObject(u, null, new THREE.Vector3(), new THREE.Quaternion()),
        crypto.getParcel(parcel.id),
      ]);
      console.log('got parcel json', parcelJson);
    })().catch(console.warn);
  }
})();