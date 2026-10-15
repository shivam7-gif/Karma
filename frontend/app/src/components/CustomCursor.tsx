import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const SIZE = 80; // canvas px

const CustomCursor: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: -200, y: -200 });
  const clickedRef = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Renderer (tiny, transparent) ─────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(SIZE, SIZE);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    mount.appendChild(renderer.domElement);

    // ── Scene ─────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();

    // ── Camera ────────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100);
    camera.position.set(0, 0, 18);

    // ── Lighting ──────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 2.5));

    const key = new THREE.DirectionalLight(0xffffff, 4);
    key.position.set(5, 10, 8);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x88aaff, 2);
    fill.position.set(-6, -4, 6);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 3);
    rim.position.set(0, -8, -10);
    scene.add(rim);

    // ── Load cursor model ─────────────────────────────────────────────────────
    let cursorGroup: THREE.Group | null = null;
    const loader = new GLTFLoader();

    loader.load(
      '/cursor_3d/scene.gltf',
      (gltf) => {
        const model = gltf.scene;

        // Normalise size + centre
        const box = new THREE.Box3().setFromObject(model);
        const centre = new THREE.Vector3();
        box.getCenter(centre);
        const size = new THREE.Vector3();
        box.getSize(size);
        const scale = 7 / Math.max(size.x, size.y, size.z);
        model.scale.setScalar(scale);
        box.setFromObject(model);
        box.getCenter(centre);
        model.position.sub(centre);

        // Tilt naturally like a real cursor arrow
        model.rotation.z = 0.3;   // slight clockwise lean
        model.rotation.x = -0.15; // slight backward tip

        // Override materials — white body with a dark accent
        model.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (!mat) return;
          const name = mat.name || '';
          if (name === 'Material.002') {
            // Black tip/outline
            mesh.material = new THREE.MeshStandardMaterial({
              color: 0x111111, roughness: 0.3, metalness: 0.1,
            });
          } else if (name === 'Material.001') {
            // Accent grey
            mesh.material = new THREE.MeshStandardMaterial({
              color: 0x888888, roughness: 0.4, metalness: 0.05,
            });
          } else {
            // Main white body
            mesh.material = new THREE.MeshStandardMaterial({
              color: 0xffffff, roughness: 0.25, metalness: 0.05,
            });
          }
        });

        cursorGroup = new THREE.Group();
        cursorGroup.add(model);
        scene.add(cursorGroup);
      },
      undefined,
      (err) => console.error('Cursor GLTF error:', err)
    );

    // ── Animation loop ────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let animId: number;
    // Smooth-follow target
    const smooth = { x: -200, y: -200 };

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Lerp towards real mouse pos for smooth lag
      smooth.x += (posRef.current.x - smooth.x) * 0.18;
      smooth.y += (posRef.current.y - smooth.y) * 0.18;

      // Position the overlay div
      if (mount) {
        mount.style.left = `${smooth.x}px`;
        mount.style.top  = `${smooth.y}px`;
      }

      if (cursorGroup) {
        if (clickedRef.current) {
          // Clicked state: squash down, tilt forward
          cursorGroup.rotation.x = THREE.MathUtils.lerp(cursorGroup.rotation.x, 0.5, 0.15);
          cursorGroup.scale.y    = THREE.MathUtils.lerp(cursorGroup.scale.y, 0.75, 0.15);
          cursorGroup.scale.x    = THREE.MathUtils.lerp(cursorGroup.scale.x, 1.15, 0.15);
        } else {
          // Idle: gentle float bob + slow Y-axis spin
          cursorGroup.rotation.x = THREE.MathUtils.lerp(cursorGroup.rotation.x, 0, 0.1);
          cursorGroup.scale.y    = THREE.MathUtils.lerp(cursorGroup.scale.y, 1, 0.1);
          cursorGroup.scale.x    = THREE.MathUtils.lerp(cursorGroup.scale.x, 1, 0.1);
          cursorGroup.position.y = Math.sin(elapsed * 2.5) * 0.15;
          cursorGroup.rotation.y = Math.sin(elapsed * 1.2) * 0.12;
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    // ── Mouse tracking ────────────────────────────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
      setVisible(true);
    };
    const onMouseLeave = () => setVisible(false);
    const onMouseDown = () => { clickedRef.current = true; };
    const onMouseUp   = () => { clickedRef.current = false; };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'fixed',
        width: `${SIZE}px`,
        height: `${SIZE}px`,
        // Offset so hotspot (tip) is top-left of canvas
        transform: 'translate(-12px, -8px)',
        pointerEvents: 'none',
        zIndex: 9999,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.2s ease',
        // Will be moved via JS in animation loop
        left: '-200px',
        top: '-200px',
      }}
    />
  );
};

export default CustomCursor;
