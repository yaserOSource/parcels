import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
// import {GLTFLoader} from 'GLTFLoader';
// import {renderer, camera, runtime, world, universe, physics, ui, rig, app, scene, appManager, popovers, crypto, constants} from 'app';
import metaversefile from 'metaversefile';
const {useFrame, useLocalPlayer/* , useUi*/} = metaversefile;

const localBox = new THREE.Box3();

// const ui = useUi();

const landHost = `https://mainnetsidechain-land.webaverse.com`;
const rarityColors = {
  common: [0xDCDCDC, 0x373737],
  uncommon: [0xff8400, 0x875806],
  rare: [0x00CE21, 0x00560E],
  epic: [0x00B3DB, 0x003743],
  legendary: [0xAD00EA, 0x32002D],
};
const baseUnit = 4;
const getParcels = async () => {
  const res = await fetch(`${landHost}/1-100`);
  if (res.ok) {
    const j = await res.json();
    return j;
  } else {
    return [];
  }
};
const boxGeometry = new THREE.BoxBufferGeometry(1, 1, 1);
const portalMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uColor: {
      type: 'c',
      value: new THREE.Color(0xffa726),
    },
    uTime: {
      type: 'f',
      value: 0,
      // needsUpdate: true,
    },
    uDistance: {
      type: 'f',
      value: 0,
      // needsUpdate: true,
    },
    uUserPosition: {
      type: 'v3',
      value: new THREE.Vector3(),
      // needsUpdate: true,
    },
  },
  vertexShader: `\
    precision highp float;
    precision highp int;

    #define PI 3.1415926535897932384626433832795

    uniform vec4 uSelectRange;
    uniform float uTime;
    uniform float uDistance;
    // uniform vec3 uUserPosition;

    // attribute vec3 barycentric;
    attribute float ao;
    attribute float skyLight;
    attribute float torchLight;
    attribute float particle;
    attribute float bar;

    // varying vec3 vViewPosition;
    varying vec3 vModelPosition;
    varying vec2 vUv;
    varying vec3 vBarycentric;
    varying float vAo;
    varying float vSkyLight;
    varying float vTorchLight;
    varying vec3 vSelectColor;
    varying vec2 vWorldUv;
    varying vec3 vPos;
    varying vec3 vNormal;
    varying float vParticle;
    varying float vBar;
    // varying float vUserDelta;

    void main() {
      vec3 p = position;
      if (bar < 1.0) {
        float wobble = uDistance <= 0. ? sin(uTime * PI*10.)*0.02 : 0.;
        p.y *= (1.0 + wobble) * min(max(1. - uDistance/3., 0.), 1.0);
      }
      p.y += 0.01;
      vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
      vModelPosition = (modelMatrix * vec4(p, 1.0)).xyz;
      gl_Position = projectionMatrix * mvPosition;

      // vViewPosition = -mvPosition.xyz;
      vUv = uv;
      // vBarycentric = barycentric;
      float vid = float(gl_VertexID);
      if (mod(vid, 3.) < 0.5) {
        vBarycentric = vec3(1., 0., 0.);
      } else if (mod(vid, 3.) < 1.5) {
        vBarycentric = vec3(0., 1., 0.);
      } else {
        vBarycentric = vec3(0., 0., 1.);
      }
      vAo = ao/27.0;
      vSkyLight = skyLight/8.0;
      vTorchLight = torchLight/8.0;

      vSelectColor = vec3(0.);
      if (
        position.x >= uSelectRange.x &&
        position.z >= uSelectRange.y &&
        position.x < uSelectRange.z &&
        position.z < uSelectRange.w
      ) {
        vSelectColor = vec3(${new THREE.Color(0x4fc3f7).toArray().join(', ')});
      }

      vec3 vert_tang;
      vec3 vert_bitang;
      if (abs(normal.y) < 0.05) {
        if (abs(normal.x) > 0.95) {
          vert_bitang = vec3(0., 1., 0.);
          vert_tang = normalize(cross(vert_bitang, normal));
          vWorldUv = vec2(dot(position, vert_tang), dot(position, vert_bitang));
        } else {
          vert_bitang = vec3(0., 1., 0.);
          vert_tang = normalize(cross(vert_bitang, normal));
          vWorldUv = vec2(dot(position, vert_tang), dot(position, vert_bitang));
        }
      } else {
        vert_tang = vec3(1., 0., 0.);
        vert_bitang = normalize(cross(vert_tang, normal));
        vWorldUv = vec2(dot(position, vert_tang), dot(position, vert_bitang));
      }
      vWorldUv /= 4.0;
      vec3 vert_norm = normal;

      vec3 t = normalize(normalMatrix * vert_tang);
      vec3 b = normalize(normalMatrix * vert_bitang);
      vec3 n = normalize(normalMatrix * vert_norm);
      mat3 tbn = transpose(mat3(t, b, n));

      vPos = p;
      vNormal = normal;
      vParticle = particle;
      vBar = bar;
      // vUserDelta = max(abs(modelPosition.x - uUserPosition.x), abs(modelPosition.z - uUserPosition.z));
    }
  `,
  fragmentShader: `\
    precision highp float;
    precision highp int;

    #define PI 3.1415926535897932384626433832795

    // uniform float sunIntensity;
    // uniform sampler2D tex;
    uniform vec3 uColor;
    uniform float uTime;
    // uniform vec3 sunDirection;
    uniform float uDistance;
    uniform vec3 uUserPosition;
    float parallaxScale = 0.3;
    float parallaxMinLayers = 50.;
    float parallaxMaxLayers = 50.;

    // varying vec3 vViewPosition;
    varying vec3 vModelPosition;
    varying vec2 vUv;
    varying vec3 vBarycentric;
    varying float vAo;
    varying float vSkyLight;
    varying float vTorchLight;
    varying vec3 vSelectColor;
    varying vec2 vWorldUv;
    varying vec3 vPos;
    varying vec3 vNormal;
    varying float vParticle;
    varying float vBar;
    // varying float vUserDelta;

    float edgeFactor(vec2 uv) {
      float divisor = 0.5;
      float power = 0.5;
      return min(
        pow(abs(uv.x - round(uv.x/divisor)*divisor), power),
        pow(abs(uv.y - round(uv.y/divisor)*divisor), power)
      ) > 0.1 ? 0.0 : 1.0;
      /* return 1. - pow(abs(uv.x - round(uv.x/divisor)*divisor), power) *
        pow(abs(uv.y - round(uv.y/divisor)*divisor), power); */
    }

    vec3 getTriPlanarBlend(vec3 _wNorm){
      // in wNorm is the world-space normal of the fragment
      vec3 blending = abs( _wNorm );
      // blending = normalize(max(blending, 0.00001)); // Force weights to sum to 1.0
      // float b = (blending.x + blending.y + blending.z);
      // blending /= vec3(b, b, b);
      // return min(min(blending.x, blending.y), blending.z);
      blending = normalize(blending);
      return blending;
    }

    void main() {
      // vec3 diffuseColor2 = vec3(${new THREE.Color(0xffa726).toArray().join(', ')});
      float normalRepeat = 1.0;

      vec3 blending = getTriPlanarBlend(vNormal);
      float xaxis = edgeFactor(vPos.yz * normalRepeat);
      float yaxis = edgeFactor(vPos.xz * normalRepeat);
      float zaxis = edgeFactor(vPos.xy * normalRepeat);
      float f = xaxis * blending.x + yaxis * blending.y + zaxis * blending.z;

      // vec2 worldUv = vWorldUv;
      // worldUv = mod(worldUv, 1.0);
      // float f = edgeFactor();
      // float f = max(normalTex.x, normalTex.y, normalTex.z);

      /* if (vPos.y > 0.) {
        f = 1.0;
      } */

      float d = gl_FragCoord.z/gl_FragCoord.w;
      vec3 c = uColor; // diffuseColor2; // mix(diffuseColor1, diffuseColor2, abs(vPos.y/10.));
      // float f2 = 1. + d/10.0;
      float a;
      if (vParticle > 0.) {
        a = 1.;
      } else if (vBar > 0.) {
        float userDelta = length(uUserPosition - vModelPosition);
        a = 1.25 - userDelta;
      } else {
        a = min(max(f, 0.3), 1.);
      }
      if (uDistance <= 0.) {
        c *= 0.5 + pow(1. - uTime, 3.);
      }
      if (a < 0.) {
        discard;
      }
      gl_FragColor = vec4(c, a);
    }
  `,
  transparent: true,
  // polygonOffset: true,
  // polygonOffsetFactor: -1,
  // polygonOffsetUnits: 1,
});
const makePortalMesh = json => {

  const extents = JSON.parse(json.properties.extents);
  const center = new THREE.Vector3((extents[1][0] + extents[0][0]) / 2, (extents[1][1] + extents[0][1]) / 2, (extents[1][2] + extents[0][2]) / 2);
  const size = new THREE.Vector3(extents[1][0] - extents[0][0], extents[1][1] - extents[0][1], extents[1][2] - extents[0][2]);
  const color = (rarityColors[json.rarity] || rarityColors.legendary)[0];

  const geometries = [];

  const w = baseUnit;
  const planeGeometry = new THREE.PlaneBufferGeometry(size.x, size.z, size.x, size.z)
    .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI/2)))
    .applyMatrix4(new THREE.Matrix4().makeTranslation(center.x, center.y, center.z));
  for (let i = 0; i < planeGeometry.attributes.position.array.length; i += 3) {
    planeGeometry.attributes.position.array[i+1] = Math.random() * 0.2;
  }
  planeGeometry.setAttribute('particle', new THREE.BufferAttribute(new Float32Array(planeGeometry.attributes.position.array.length/3), 1));
  planeGeometry.setAttribute('bar', new THREE.BufferAttribute(new Float32Array(planeGeometry.attributes.position.array.length/3), 1));
  geometries.push(planeGeometry);


  for (let i = 0; i < 20; i++) {
    const width = 0.02;
    const height = 0.2;
    const g = boxGeometry.clone()
      .applyMatrix4(new THREE.Matrix4().makeScale(width, height, width))
      .applyMatrix4(new THREE.Matrix4().makeTranslation(center.x + width/2 + (-1/2 + Math.random()) * w * (1-width/2), 0.3/2 + Math.random() * (1-width/2), center.z + height/2 + (-1/2 + Math.random()) * w * (1-width/2)));
    g.setAttribute('particle', new THREE.BufferAttribute(new Float32Array(g.attributes.position.array.length/3).fill(1), 1));
    g.setAttribute('bar', new THREE.BufferAttribute(new Float32Array(g.attributes.position.array.length/3), 1));
    geometries.push(g);
  }

  const geometry = BufferGeometryUtils.mergeBufferGeometries(geometries);
  const material = portalMaterial.clone();
  if (color) {
    material.uniforms.uColor.value.setHex(color);
  }
  const portalMesh = new THREE.Mesh(geometry, material);
  portalMesh.boundingBox = new THREE.Box3(
    new THREE.Vector3(extents[0][0], extents[0][1], extents[0][2]),
    new THREE.Vector3(extents[1][0], extents[1][1], extents[1][2]),
  );
  portalMesh.frustumCulled = false;
  
  const o = new THREE.Object3D();
  o.add(portalMesh);

  o.update = () => {
    const {position} = useLocalPlayer();

    const now = Date.now();
    portalMesh.material.uniforms.uTime.value = (now%500)/500;
    portalMesh.material.uniforms.uDistance.value = localBox.copy(portalMesh.boundingBox)
      .applyMatrix4(portalMesh.matrixWorld)
      .distanceToPoint(position);
    portalMesh.material.uniforms.uUserPosition.value.copy(position);
    portalMesh.updateMatrixWorld();
  };
  o.updateMatrixWorld();
  return o;
};

export default () => {
  const object = new THREE.Object3D();

  (async () => {
    const parcelsJson = await getParcels();
    // parcelsJson = parcelsJson.slice(0, 1);
    for (const parcel of parcelsJson) {
      (async () => {
        const landUrl = `${landHost}/${parcel.id}`;
        const res = await fetch(landUrl);
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
        const u = await (async () => {
          if (typeof id === 'number') {
            const res = await fetch(`https://tokens.webaverse.com/${id}`);
            const j = await res.json();
            const {properties: {ext, hash, name}} = j;
            // console.warn(j);
            return `https://ipfs.exokit.org/${hash}/${name}.${ext}`;
          } else if (typeof id === 'string') {
            return id;
          } else {
            return null;
          }
        })();
        // console.log('loading', parcel, id, u);
        
        const {name} = parcel;
        const {rarity} = parcel.properties;
        const extents = JSON.parse(parcel.properties.extents);
        const box = new THREE.Box3(
          new THREE.Vector3().fromArray(extents[0]),
          new THREE.Vector3().fromArray(extents[1])
        );
        const center = box.getCenter(new THREE.Vector3());
        const centerBox = new THREE.Box3(
          box.min.clone().sub(center),
          box.max.clone().sub(center)
        );

        const portalMesh = makePortalMesh(land);
        portalMesh.updateMatrixWorld();
        object.add(portalMesh);

      })();
    }
  })();
  
  useFrame(() => {
    for (const child of object.children) {
      child.update();
    }
  });
  
  return object;
};
