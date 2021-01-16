import * as THREE from 'three';
import {renderer, camera, runtime, world, universe, physics, ui, rig, app, appManager, popovers, crypto} from 'app';

const tokensHost = `https://tokens.webaverse.com`;
const landHost = `https://land.webaverse.com`;
const storageHost = `https://ipfs.exokit.org`;

(async () => {
  const parcelsJson = await universe.getParcels();
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

      const {name} = parcel;
      const {rarity} = parcel.properties;
      const extents = JSON.parse(parcel.properties.extents);
      const o = {
        contentId: id || `https://webaverse.github.io/parcels/parcel.json`,
        room: name.replace(/ /g, '-'),
        rarity,
        extents,
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
      
      const box = new THREE.Box3(
        new THREE.Vector3().fromArray(extents[0]),
        new THREE.Vector3().fromArray(extents[1]),
      );
      const popoverWidth = 600;
      const popoverHeight = 200;
      const popoverTextMesh = (() => {
        const textMesh = ui.makeTextMesh(name, undefined, 0.5, 'center', 'middle');
        textMesh.position.z = 0.1;
        textMesh.scale.x = popoverHeight / popoverWidth;
        textMesh.color = 0xFFFFFF;
        return textMesh;
      })();
      const popoverTarget = new THREE.Object3D();
      box.getCenter(popoverTarget.position)
        .add(new THREE.Vector3(0, 0.5, 0));
      const popoverMesh = popovers.addPopover(popoverTextMesh, {
        width: popoverWidth,
        height: popoverHeight,
        target: popoverTarget,
      });
    })().catch(console.warn);
  }
})();