import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Enable global Three.js asset cache for instantaneous subsequent loads
THREE.Cache.enabled = true;

interface Props {
  onLoad?: () => void;
  onProgress?: (percent: number) => void;
  onClick?: () => void;
}

const AlexaViewer: React.FC<Props> = ({ onLoad, onProgress, onClick }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.6;
    mount.appendChild(renderer.domElement);

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    camera.position.set(0, 10, 42);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.8;
    controls.enablePan = false;
    controls.minDistance = 20;
    controls.maxDistance = 80;
    controls.minPolarAngle = Math.PI * 0.1;
    controls.maxPolarAngle = Math.PI * 0.72;
    controls.target.set(0, 3, 0);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 3.0));

    const keyLight = new THREE.DirectionalLight(0xffffff, 5.5);
    keyLight.position.set(10, 22, 18);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x4c8dff, 2.0);
    fillLight.position.set(-14, 6, -8);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffeedd, 2.5);
    rimLight.position.set(0, 18, -22);
    scene.add(rimLight);

    const ringLight = new THREE.PointLight(0x1caad9, 8, 35);
    ringLight.position.set(0, 8, 0);
    scene.add(ringLight);

    // Load model
    let mixer: THREE.AnimationMixer | null = null;
    let listeningMode = false;
    let listeningTimer: ReturnType<typeof setTimeout> | null = null;

    const loader = new GLTFLoader();
    loader.load(
      '/alexa/scene.gltf',
      (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const centre = new THREE.Vector3();
        box.getCenter(centre);
        const size = new THREE.Vector3();
        box.getSize(size);
        const scaleFactor = 16 / Math.max(size.x, size.y, size.z);
        model.scale.setScalar(scaleFactor);
        box.setFromObject(model);
        box.getCenter(centre);
        model.position.sub(centre);
        model.position.y = 0;

        model.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh) {
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (mat?.isMeshStandardMaterial) mat.envMapIntensity = 1.8;
          }
        });

        scene.add(model);
        onProgress?.(100);
        onLoad?.();

        if (gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model);
          gltf.animations.forEach((c) => mixer!.clipAction(c).play());
        }
      },
      (xhr) => {
        if (xhr.lengthComputable && xhr.total > 0) {
          const percent = Math.min(Math.round((xhr.loaded / xhr.total) * 100), 99);
          onProgress?.(percent);
        }
      },
      (err) => console.error('GLTF load error:', err)
    );

    // Simple click → listening mode (no raycasting, no crashes)
    const handleClick = () => {
      listeningMode = true;
      controls.autoRotate = false;
      onClick?.();
      if (listeningTimer) clearTimeout(listeningTimer);
      listeningTimer = setTimeout(() => {
        listeningMode = false;
        controls.autoRotate = true;
      }, 3000);
    };
    mount.addEventListener('click', handleClick);

    // Resize
    const handleResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation loop
    const clock = new THREE.Clock();
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      if (listeningMode) {
        ringLight.intensity = 18 + Math.sin(elapsed * 10) * 6;
        ringLight.color.setHSL((0.54 + elapsed * 0.1) % 1, 1.0, 0.65);
      } else {
        ringLight.intensity = 6 + Math.sin(elapsed * 2.2) * 3;
        ringLight.color.setHSL(0.54, 0.95, 0.58);
      }

      if (mixer) mixer.update(delta);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animId);
      if (listeningTimer) clearTimeout(listeningTimer);
      window.removeEventListener('resize', handleResize);
      mount.removeEventListener('click', handleClick);
      controls.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);         // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={mountRef}
      style={{ width: '100%', height: '100%', cursor: 'pointer' }} // keep pointer
    />
  );
};

export default AlexaViewer;
