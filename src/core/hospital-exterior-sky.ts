import * as THREE from 'three';

/** Atmospheric sky behind the native city geometry; no photographic backdrop. */
export function createHospitalExteriorSky() {
  const uniforms = { horizon: { value: new THREE.Color() }, zenith: { value: new THREE.Color() },
    cloud: { value: new THREE.Color() }, strength: { value: .25 } };
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, toneMapped: false, uniforms,
    vertexShader: `varying vec3 direction;
      void main() {
        direction = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `varying vec3 direction;
      uniform vec3 horizon, zenith, cloud;
      uniform float strength;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 cell = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(cell), hash(cell + vec2(1, 0)), f.x),
          mix(hash(cell + vec2(0, 1)), hash(cell + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        vec3 dir = normalize(direction);
        float elevation = max(dir.y, 0.0);
        vec3 color = mix(horizon, zenith, smoothstep(0.0, .5, elevation));
        float field = .65 * noise(dir.xz * 12.0) + .35 * noise(dir.xz * 28.0);
        float clouds = smoothstep(.35, .75, field) * smoothstep(.015, .18, elevation);
        gl_FragColor = vec4(mix(color, cloud, clouds * strength), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(3500, 32, 16), material);
  mesh.name = 'HospitalAtmosphericSky'; mesh.renderOrder = -10; mesh.frustumCulled = false;
  return { mesh,
    setTheme(dark: boolean) {
      uniforms.horizon.value.set(dark ? 0x263c50 : 0xc3cdd3);
      uniforms.zenith.value.set(dark ? 0x0b1b30 : 0x97aabd);
      uniforms.cloud.value.set(dark ? 0x42566a : 0xe1e5e7);
      uniforms.strength.value = dark ? .12 : .35;
    },
    dispose() { mesh.geometry.dispose(); material.dispose(); },
  };
}
