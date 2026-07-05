import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

function fallbackTexture(album) {
  const canvas = document.createElement('canvas');
  canvas.width = 420; canvas.height = 520;
  const ctx = canvas.getContext('2d');
  const [c1, c2, c3] = album.palette;
  const gradient = ctx.createLinearGradient(0, 0, 420, 520);
  gradient.addColorStop(0, c1); gradient.addColorStop(0.56, c2); gradient.addColorStop(1, c3);
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 420, 520);
  ctx.globalAlpha = 0.62; ctx.strokeStyle = c3; ctx.lineWidth = 2;
  for (let r = 44; r < 330; r += 28) { ctx.beginPath(); ctx.arc(305, 182, r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.globalAlpha = 0.9; ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(305, 182, 34, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1; ctx.fillStyle = c3; ctx.font = '500 14px Arial'; ctx.fillText(`ECHO / ${String(album.billboard_rank).padStart(3, '0')}`, 28, 40);
  ctx.font = '700 30px Arial';
  const words = album.title.split(' '); let line = ''; let y = 410;
  words.slice(0, 7).forEach((word) => { const next = `${line}${word} `; if (ctx.measureText(next).width > 350) { ctx.fillText(line, 28, y); y += 34; line = `${word} `; } else line = next; });
  ctx.fillText(line, 28, y);
  ctx.font = '500 16px Arial'; ctx.fillText(album.artist.toUpperCase(), 29, Math.min(495, y + 35));
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

/**
 * 加载真实封面图或回退到渐变纹理的 Hook
 */
function useCoverTexture(album) {
  const fallback = useMemo(() => fallbackTexture(album), [album]);
  const [texture, setTexture] = useState(fallback);

  useEffect(() => {
    if (!album.cover_url) {
      setTexture(fallback);
      return;
    }

    const loader = new THREE.TextureLoader();
    let disposed = false;

    loader.load(
      album.cover_url,
      (tex) => {
        if (disposed) { tex.dispose(); return; }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        setTexture(tex);
      },
      undefined,
      () => { if (!disposed) setTexture(fallback); }
    );

    return () => {
      disposed = true;
      setTexture((prev) => {
        if (prev !== fallback) prev.dispose();
        return fallback;
      });
    };
  }, [album.cover_url, album.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return texture;
}

function AlbumPlane({ album, index, onSelect }) {
  const mesh = useRef();
  const [hovered, setHovered] = useState(false);
  const texture = useCoverTexture(album);
  const angle = index * 0.39;
  const radius = 7.25 + Math.sin(index * 0.8) * 0.2;
  const position = [Math.sin(angle) * radius, (index - 49.5) * 0.12, Math.cos(angle) * radius];
  const rotation = [0, angle, 0];
  useFrame((_state, delta) => {
    const target = hovered ? 1.1 : 1;
    mesh.current.scale.lerp(new THREE.Vector3(target, target, target), Math.min(1, delta * 10));
  });
  return (
    <mesh ref={mesh} position={position} rotation={rotation}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
      onClick={(e) => { e.stopPropagation(); onSelect(album); }}>
      <planeGeometry args={[1.55, 1.92]} />
      <meshStandardMaterial map={texture} roughness={0.58} metalness={0.08} side={THREE.DoubleSide} emissive={hovered ? '#222511' : '#000000'} />
    </mesh>
  );
}

function Tower({ albums, onSelect }) {
  const group = useRef();
  useFrame((_state, delta) => { group.current.rotation.y += delta * 0.045; });
  return <group ref={group}>{albums.map((album, index) => <AlbumPlane key={album.id} album={album} index={index} onSelect={onSelect} />)}</group>;
}

export default function SpiralGallery({ albums, onSelect }) {
  return (
    <Canvas dpr={[1, 1.6]} camera={{ position: [0, 0.4, 17], fov: 46 }} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={1.8} />
      <directionalLight position={[5, 7, 10]} intensity={2.4} />
      <Tower albums={albums} onSelect={onSelect} />
      <OrbitControls enablePan={false} enableZoom minDistance={11} maxDistance={25} rotateSpeed={0.35} autoRotate autoRotateSpeed={0.18} />
      <Environment preset="city" />
    </Canvas>
  );
}
