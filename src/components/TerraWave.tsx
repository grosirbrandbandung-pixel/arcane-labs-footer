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
      uLow: { value: new THREE.Color(0x2ee6a8) },
      uHigh: { value: new THREE.Color(0xffffff) },
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
        varying float vHeight;

        float wave(vec3 p, float breathe) {
          float h = 0.0;
          h += sin(p.x * 0.13 + uTime * 0.5) * 0.9;
          h += sin(p.z * 0.10 + uTime * 0.38) * 0.8;
          h += sin((p.x + p.z) * 0.075 - uTime * 0.28) * 0.55;
          h += sin((p.x - p.z) * 0.05 + uTime * 0.2) * 0.45;
          return h * breathe;
        }

        void main() {
          vec3 pos = position;
          // "breathing" amplitude — the whole surface swells and relaxes in place
          float breathe = 0.75 + 0.35 * sin(uTime * 0.45);
          float h = wave(pos, breathe);
          pos.y += h * 2.2;

          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          vDepth = -mv.z;
          vHeight = h;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uLow;
        uniform vec3 uHigh;
        varying float vDepth;
        varying float vHeight;

        void main() {
          // crests read white, troughs keep the mint tint
          float t = smoothstep(-0.4, 1.4, vHeight);
          vec3 col = mix(uLow, uHigh, t);
          float a = 1.0 - smoothstep(50.0, 160.0, vDepth);
          gl_FragColor = vec4(col, a * (0.55 + 0.45 * t));
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
    const starPhase = new Float32Array(starCount);
    const starScale = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      starPhase[i] = Math.random() * Math.PI * 2;
      starScale[i] = 0.5 + Math.random() * 1.6;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute("aPhase", new THREE.BufferAttribute(starPhase, 1));
    starGeo.setAttribute("aScale", new THREE.BufferAttribute(starScale, 1));

    const starUniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uColor: { value: new THREE.Color(0x39f0ab) },
    };

    const starMaterial = new THREE.ShaderMaterial({
      uniforms: starUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uPixelRatio;
        attribute float aPhase;
        attribute float aScale;
        varying float vTwinkle;

        void main() {
          vec3 pos = position;
          // gentle drifting so nothing in the sky is ever static
          pos.x += sin(uTime * 0.25 + aPhase) * 2.2;
          pos.y += cos(uTime * 0.2 + aPhase * 1.7) * 1.4;
          pos.z += mod(uTime * 3.0 + aPhase * 12.0, 200.0);
          pos.z = mod(pos.z + 200.0, 200.0) - 200.0;

          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = max(1.5, aScale * 220.0 * uPixelRatio / -mv.z);
          vTwinkle = 0.45 + 0.55 * (0.5 + 0.5 * sin(uTime * 2.0 + aPhase * 3.0));
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vTwinkle;
        void main() {
          gl_FragColor = vec4(uColor, vTwinkle);
        }
      `,
    });

    const stars = new THREE.Points(starGeo, starMaterial);
    scene.add(stars);

    // ---- mouse parallax ----
    const pointer = { x: 0, y: 0 };
    const smooth = { x: 0, y: 0 };
    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointerMove);

    // ---- loop ----
    const clock = new THREE.Clock();
    const gridStep = 2; // 240 / 120 -> wrap distance for seamless scroll
    let frame = 0;
    const render = () => {
      const t = clock.getElapsedTime();
      uniforms.uTime.value = t;
      starUniforms.uTime.value = t;

      // terrain flows continuously toward the camera
      terrain.position.z = -60 + ((t * 3.5) % gridStep);

      smooth.x += (pointer.x - smooth.x) * 0.05;
      smooth.y += (pointer.y - smooth.y) * 0.05;
      camera.position.x = smooth.x * 2.6;
      camera.position.y = 2.2 - smooth.y * 0.9;
      camera.rotation.z = -smooth.x * 0.02;
      camera.lookAt(smooth.x * 5, 2.0 - smooth.y * 1.6, -60);

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
      starUniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      geometry.dispose();
      material.dispose();
      starGeo.dispose();
      starMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
}
