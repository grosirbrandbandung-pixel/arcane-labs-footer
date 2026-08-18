import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * WebGL wireframe terrain wave + starfield.
 * Pure animation effect, fills its parent container.
 */
export default function TerraWave() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      400,
    );
    camera.position.set(0, 2.2, 14);
    camera.lookAt(0, 2.0, -60);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // ---- terrain ----
    const geometry = new THREE.PlaneGeometry(240, 240, 120, 120);
    geometry.rotateX(-Math.PI / 2);

    const uniforms = {
      uTime: { value: 0 },
      uNear: { value: new THREE.Color(0x2ee6a8) },
      uFar: { value: new THREE.Color(0xffffff) },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      wireframe: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying float vDepth;
        varying float vFade;

        float wave(vec3 p) {
          float h = 0.0;
          h += sin(p.x * 0.14 + uTime * 0.55) * 0.9;
          h += sin(p.z * 0.11 - uTime * 0.42) * 0.7;
          h += sin((p.x + p.z) * 0.07 + uTime * 0.3) * 0.6;
          return h;
        }

        void main() {
          vec3 pos = position;
          // waves grow toward the horizon, floor stays flat-ish near camera
          float ridge = smoothstep(10.0, 90.0, -pos.z);
          pos.y += wave(pos) * ridge * 2.6;

          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          vDepth = -mv.z;
          vFade = ridge;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uNear;
        uniform vec3 uFar;
        varying float vDepth;
        varying float vFade;

        void main() {
          vec3 col = mix(uNear, uFar, smoothstep(0.55, 1.0, vFade));
          // fade out with distance so the horizon dissolves into black
          float a = 1.0 - smoothstep(40.0, 150.0, vDepth);
          a *= 0.35 + 0.65 * smoothstep(0.0, 0.6, vFade);
          gl_FragColor = vec4(col, a * 0.9);
        }
      `,
    });

    const terrain = new THREE.Mesh(geometry, material);
    terrain.position.z = -60;
    scene.add(terrain);

    // ---- stars ----
    const starCount = 700;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 220;
      starPos[i * 3 + 1] = 6 + Math.random() * 70;
      starPos[i * 3 + 2] = -Math.random() * 200;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        color: 0x39f0ab,
        size: 0.45,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.75,
      }),
    );
    scene.add(stars);

    // ---- loop ----
    const clock = new THREE.Clock();
    let frame = 0;
    const render = () => {
      uniforms.uTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      geometry.dispose();
      material.dispose();
      starGeo.dispose();
      (stars.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
}
