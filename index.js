import * as THREE from 'three';
import {renderer, camera, runtime, world, universe, physics, ui, rig, app, appManager, popovers, crypto} from 'app';

const tokensHost = `https://tokens.webaverse.com`;
const landHost = `https://land.webaverse.com`;
const storageHost = `https://ipfs.exokit.org`;

(async () => {
  const res = await fetch(`https://webaverse.github.io/parcels/parcels.json`);
  const parcelsJson = await res.json();
  for (const parcel of parcelsJson) {
    (async () => {
      const res = await fetch(`${landHost}/${parcel.id}`);
      const land = await res.json();
      const {hash: contentId} = land.properties;
      
      const id = (() => {
        const id = parseInt(contentId, 10);
        if (id > 0) {
          return id;
        } else {
          let u;
          try {
            u = new URL(contentId);
          } catch (err) {
            u = null;
          }
          if (u && /\.[^\.]+$/.test(u.pathname)) {
            return contentId;
          } else {
            return null;
          }
        }
      })();

      const {name, rarity, extents} = parcel;
      const o = {
        contentId: id || `https://webaverse.github.io/parcels/parcel.json`,
        room: name.replace(/ /g, '-'),
        extents,
        rarity,
      };
      const s = JSON.stringify(o);
      const b = new Blob([s], {
        type: 'application/json',
      });
      const u = URL.createObjectURL(b) + '/parcel.url';
      const object = await world.addStaticObject(u, null, new THREE.Vector3(), new THREE.Quaternion());
      
      if (id !== null) {
        const box = new THREE.Box3(
          new THREE.Vector3().fromArray(object.json.extents[0]),
          new THREE.Vector3().fromArray(object.json.extents[1]),
        );
        const center = box.getCenter(new THREE.Vector3());
        center.y = 0;
        const object2 = world.addStaticObject(id, null, center, new THREE.Quaternion());
      }
    })().catch(console.warn);
  }
})();