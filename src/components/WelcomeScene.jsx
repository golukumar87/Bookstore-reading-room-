import React, { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'

function Character({
  role = 'man',
  onThanks,
  onFootstep,
  onBookReveal,
  onButtonHit,
}) {
  const isWoman = role === 'woman'
  const character = useRef()
  const leftArm = useRef()
  const rightArm = useRef()
  const leftLeg = useRef()
  const rightLeg = useRef()
  const head = useRef()
  const leftEye = useRef()
  const rightEye = useRef()
  const mouth = useRef()
  const book = useRef()
  const bookPages = useRef()
  const torso = useRef()
  const thanksSaid = useRef(false)
  const buttonHit = useRef(false)
  const bookRevealed = useRef(false)
  const lastFootstep = useRef(-1)
  const { size } = useThree()
  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const portrait = useLoader(THREE.TextureLoader, '/welcome-photo.jpe')

  useEffect(() => {
    portrait.colorSpace = THREE.SRGBColorSpace
    portrait.anisotropy = 4
  }, [portrait])
  const fabric = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const context = canvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, 128, 128)
    context.strokeStyle = 'rgba(50, 42, 32, 0.16)'
    context.lineWidth = 1
    for (let offset = 0; offset < 128; offset += 5) {
      context.beginPath()
      context.moveTo(offset, 0)
      context.lineTo(offset, 128)
      context.stroke()
      context.beginPath()
      context.moveTo(0, offset)
      context.lineTo(128, offset)
      context.stroke()
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(2, 2)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }, [])

  useEffect(() => () => fabric.dispose(), [fabric])

  useFrame(({ clock }, delta) => {
    const time = reducedMotion ? 6.9 : clock.getElapsedTime()
    const compact = size.width <= 700
    const wideCompact = compact && size.width / size.height > 1.5
    const walkStart = isWoman ? 0.65 : 0
    const walk = THREE.MathUtils.clamp((time - walkStart) / 2.5, 0, 1)
    const ease = 1 - (1 - walk) ** 3
    const gait = reducedMotion ? 0 : (1 - walk) * Math.sin(time * 8)
    const push = THREE.MathUtils.smoothstep(time, 1.45, 2.15)
    const pushPose = push * (1 - THREE.MathUtils.smoothstep(time, 2.1, 2.65))
    const bow = THREE.MathUtils.smoothstep(time, 2.55, 3.05)
      * (1 - THREE.MathUtils.smoothstep(time, 3.55, 4.1))
    const pageOpen = THREE.MathUtils.smoothstep(time, 5.05, 5.85)
    const idle = reducedMotion ? 0 : Math.sin(time * 1.7) * 0.018
    const lookTowardHost = THREE.MathUtils.smoothstep(time, 1.65, 2.1)
      * (1 - THREE.MathUtils.smoothstep(time, 3.05, 3.5))
    const blink = reducedMotion ? 0 : THREE.MathUtils.smoothstep(
      Math.sin(time * 2.1 + (isWoman ? 1.4 : 0.2)),
      0.96,
      0.995,
    )
    const smile = THREE.MathUtils.smoothstep(time, 2.15, 2.75)
    const handshake = THREE.MathUtils.smoothstep(time, 4.45, 5.0)
      * (1 - THREE.MathUtils.smoothstep(time, 6.15, 6.8))
    const handshakePulse = reducedMotion
      ? 0
      : Math.sin((time - 4.75) * Math.PI * 4) * handshake
    if (character.current) {
      const side = isWoman ? 1 : -1
      const mobileStart = wideCompact ? 6.2 : compact ? 2.7 : 5.2
      const mobileEnd = wideCompact ? 5.6 : compact ? 2.25 : 4.85
      character.current.position.x = side * THREE.MathUtils.lerp(mobileStart, mobileEnd, ease)
      character.current.position.y = -1.95 + Math.abs(gait) * 0.035 + idle
        + Math.abs(handshakePulse) * 0.035
      character.current.rotation.y = (isWoman ? -1 : 1) * 0.035 + Math.sin(time * 0.45) * 0.025
      character.current.scale.setScalar(compact ? 0.42 : 1)
    }
    if (torso.current) {
      torso.current.rotation.x = bow * 0.13 + idle * 0.3
        + handshake * 0.035 + handshakePulse * 0.06
      torso.current.scale.y = 1 + idle * 0.5
      torso.current.position.y = 1.96 - bow * 0.06 + idle
    }
    if (leftLeg.current) leftLeg.current.rotation.x = gait * 0.52
    if (rightLeg.current) rightLeg.current.rotation.x = -gait * 0.52
    if (leftArm.current) {
      const bookReach = isWoman ? THREE.MathUtils.smoothstep(time, 3.65, 4.3) : 0
      const strongHandshake = THREE.MathUtils.lerp(1.2, 2.7, handshake)
      leftArm.current.rotation.z = isWoman
        ? THREE.MathUtils.lerp(gait * 0.12 + bookReach * 0.92, strongHandshake, handshake)
          + handshakePulse * 0.28
        : gait * 0.12
    }
    if (rightArm.current) {
      const wave = isWoman
        ? THREE.MathUtils.smoothstep(time, 1.9, 2.25)
          * (1 - THREE.MathUtils.smoothstep(time, 3.15, 3.55))
        : 0
      const reachBack = isWoman ? 0 : THREE.MathUtils.smoothstep(time, 3.65, 4.15)
      const bringBookForward = isWoman ? 0 : THREE.MathUtils.smoothstep(time, 4.15, 4.9)
      const armToButton = THREE.MathUtils.smoothstep(time, 6.9, 7.7)
      const bookPose = THREE.MathUtils.lerp(-1.45, -2.55, bringBookForward)
      const bookArm = THREE.MathUtils.lerp(
        gait * -0.12,
        THREE.MathUtils.lerp(bookPose, -4.4, armToButton),
        reachBack,
      )
      const strongHandshake = THREE.MathUtils.lerp(-1.26, -2.7, handshake)
      rightArm.current.rotation.z = isWoman
        ? THREE.MathUtils.lerp(gait * -0.12, -2.35 + Math.sin(time * 12) * 0.18, wave)
        : THREE.MathUtils.lerp(bookArm + pushPose * 1.15, strongHandshake, handshake)
          - handshakePulse * 0.28
    }
    if (head.current) {
      const hostGaze = (isWoman ? -1 : 1) * lookTowardHost * 0.38
      head.current.rotation.y = hostGaze + Math.sin(time * 0.8 + (isWoman ? 1 : 0)) * 0.055
      head.current.rotation.x = Math.sin(time * 1.3) * 0.025 + (isWoman ? 0 : bow * 0.58)
    }
    if (leftEye.current) leftEye.current.scale.y = 0.052 * (1 - blink * 0.92)
    if (rightEye.current) rightEye.current.scale.y = 0.052 * (1 - blink * 0.92)
    if (mouth.current) {
      mouth.current.scale.x = 0.075 + smile * 0.022
      mouth.current.scale.y = 0.018 + smile * 0.018
    }
    if (book.current && isWoman) {
      const reveal = THREE.MathUtils.smoothstep(time, 4.05, 4.9)
      book.current.visible = reveal > 0
      book.current.position.set(
        THREE.MathUtils.lerp(-0.76, -0.65, reveal),
        THREE.MathUtils.lerp(1.95, 1.53, reveal),
        THREE.MathUtils.lerp(-0.62, 0.44, reveal),
      )
      const presentToCamera = THREE.MathUtils.smoothstep(time, 5.25, 6.05)
      book.current.rotation.set(
        THREE.MathUtils.lerp(0.12, -0.1, presentToCamera),
        THREE.MathUtils.lerp(Math.PI, -0.08, reveal),
        THREE.MathUtils.lerp(-0.18, 0.08, reveal),
      )
      book.current.scale.setScalar(reveal * (1.18 + pageOpen * 0.12) * (compact ? 3 : 1))
      if (reveal >= 0.98 && !bookRevealed.current) {
        bookRevealed.current = true
        onBookReveal()
      }
    }
    if (bookPages.current && isWoman) {
      bookPages.current.rotation.y = -pageOpen * 0.38
      bookPages.current.rotation.x = Math.sin(time * 3.5) * pageOpen * 0.06
    }
    if (!isWoman && time >= 6.85 && !thanksSaid.current) {
      thanksSaid.current = true
      onThanks()
    }
    if (!isWoman && !reducedMotion && time < 2.5) {
      const step = Math.floor(time * 3.2)
      if (step > lastFootstep.current) {
        lastFootstep.current = step
        onFootstep()
      }
    }
    if (isWoman && !reducedMotion && time >= 7.8 && !buttonHit.current) {
      buttonHit.current = true
      if (onButtonHit) {
        onButtonHit()
      }
    }
    void delta
  })

  const skin = '#b97851'
  const hoodie = isWoman ? '#6d3444' : '#10131b'
  const sleeve = isWoman ? '#945060' : '#171b25'
  const trouser = isWoman ? '#432b38' : '#252a35'
  const clothMaterial = { map: fabric, roughness: 0.96, color: '#ffffff' }

  return (
    <group ref={character} position={[isWoman ? 4.7 : -4.7, -1.95, 0]}>
      <group ref={head} position={[0, 2.92, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.39, 32, 24]} />
          <meshStandardMaterial color={skin} roughness={0.88} />
        </mesh>
        <mesh position={[0, 0.2, -0.025]} scale={[1.02, 0.72, 1.02]} castShadow>
          <sphereGeometry args={[0.39, 32, 24]} />
          <meshStandardMaterial color={isWoman ? '#171011' : '#211713'} roughness={0.94} />
        </mesh>
        {isWoman && (
          <>
            <mesh position={[0, 0.24, 0.09]} scale={[1.04, 0.55, 1.12]} castShadow>
              <sphereGeometry args={[0.39, 28, 20]} />
              <meshStandardMaterial color="#171011" roughness={0.92} />
            </mesh>
            <mesh position={[-0.29, -0.33, -0.005]} rotation={[0, 0, -0.06]} castShadow>
              <capsuleGeometry args={[0.13, 0.56, 6, 12]} />
              <meshStandardMaterial color="#171011" roughness={0.94} />
            </mesh>
            <mesh position={[0.29, -0.33, -0.005]} rotation={[0, 0, 0.06]} castShadow>
              <capsuleGeometry args={[0.13, 0.56, 6, 12]} />
              <meshStandardMaterial color="#171011" roughness={0.94} />
            </mesh>
            <mesh position={[-0.4, -0.03, 0.04]} scale={[0.045, 0.045, 0.035]}>
              <sphereGeometry args={[1, 16, 12]} />
              <meshStandardMaterial color="#e4bb78" metalness={0.5} roughness={0.42} />
            </mesh>
            <mesh position={[0.4, -0.03, 0.04]} scale={[0.045, 0.045, 0.035]}>
              <sphereGeometry args={[1, 16, 12]} />
              <meshStandardMaterial color="#e4bb78" metalness={0.5} roughness={0.42} />
            </mesh>
          </>
        )}
        <mesh position={[-0.39, -0.04, 0.015]} scale={[0.16, 0.2, 0.13]}>
          <sphereGeometry args={[0.5, 20, 16]} />
          <meshStandardMaterial color={skin} roughness={0.88} />
        </mesh>
        <mesh position={[0.39, -0.04, 0.015]} scale={[0.16, 0.2, 0.13]}>
          <sphereGeometry args={[0.5, 20, 16]} />
          <meshStandardMaterial color={skin} roughness={0.88} />
        </mesh>
        <mesh position={[-0.13, 0.03, 0.35]} scale={[0.072, 0.052, 0.028]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color="#f5e9dc" roughness={0.55} />
        </mesh>
        <mesh position={[0.13, 0.03, 0.35]} scale={[0.072, 0.052, 0.028]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color="#f5e9dc" roughness={0.55} />
        </mesh>
        <mesh ref={leftEye} position={[-0.12, 0.03, 0.378]} scale={[0.026, 0.052, 0.018]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color="#36231e" roughness={0.42} />
        </mesh>
        <mesh ref={rightEye} position={[0.14, 0.03, 0.378]} scale={[0.026, 0.052, 0.018]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color="#36231e" roughness={0.42} />
        </mesh>
        <mesh position={[0, -0.01, 0.414]} scale={[0.052, 0.07, 0.05]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color="#a86545" roughness={0.82} />
        </mesh>
        <mesh ref={mouth} position={[0, -0.13, 0.365]} scale={[0.075, 0.018, 0.02]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color="#6c302d" roughness={0.72} />
        </mesh>
        <mesh position={[-0.13, 0.115, 0.34]} rotation={[0, 0, -0.12]} scale={[0.09, 0.018, 0.018]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color="#33221d" roughness={0.92} />
        </mesh>
        <mesh position={[0.13, 0.115, 0.34]} rotation={[0, 0, 0.12]} scale={[0.09, 0.018, 0.018]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color="#33221d" roughness={0.92} />
        </mesh>
      </group>

      <mesh position={[0, 2.28, -0.17]} scale={[0.48, 0.51, 0.27]}>
        <sphereGeometry args={[1, 24, 20]} />
        <meshStandardMaterial color="#080a10" roughness={0.96} />
      </mesh>
      <mesh ref={torso} position={[0, 1.96, 0]} castShadow>
        <capsuleGeometry args={[0.46, 0.8, 8, 16]} />
        <meshStandardMaterial {...clothMaterial} color={hoodie} />
      </mesh>
      <mesh position={[0, 2.28, 0.402]} castShadow>
        <boxGeometry args={[0.075, 0.74, 0.018]} />
        <meshStandardMaterial color="#b18b55" metalness={0.42} roughness={0.52} />
      </mesh>
      <mesh position={[-0.13, 2.32, 0.405]} rotation={[0, 0, -0.28]}>
        <boxGeometry args={[0.21, 0.075, 0.035]} />
        <meshStandardMaterial color="#252a35" roughness={0.8} />
      </mesh>
      <mesh position={[0.13, 2.32, 0.405]} rotation={[0, 0, 0.28]}>
        <boxGeometry args={[0.21, 0.075, 0.035]} />
        <meshStandardMaterial color="#252a35" roughness={0.8} />
      </mesh>
      <mesh position={[-0.27, 2.18, 0.405]} rotation={[0, 0, -0.32]}>
        <boxGeometry args={[0.035, 0.36, 0.012]} />
        <meshStandardMaterial color="#394050" roughness={0.84} />
      </mesh>
      <mesh position={[0.27, 2.18, 0.405]} rotation={[0, 0, 0.32]}>
        <boxGeometry args={[0.035, 0.36, 0.012]} />
        <meshStandardMaterial color="#394050" roughness={0.84} />
      </mesh>
      <mesh position={[0, 1.49, 0]} castShadow>
        <cylinderGeometry args={isWoman ? [0.36, 0.56, 0.58, 24] : [0.34, 0.39, 0.42, 20]} />
        <meshStandardMaterial {...clothMaterial} color={isWoman ? '#71394a' : trouser} />
      </mesh>
      {isWoman && (
        <mesh position={[0, 1.57, 0.36]} castShadow>
          <boxGeometry args={[0.38, 0.42, 0.045]} />
          <meshStandardMaterial color="#d5b078" roughness={0.84} />
        </mesh>
      )}

      <group ref={leftArm} position={[-0.43, 2.3, 0]}>
        <mesh position={[-0.17, -0.36, 0]} rotation={[0, 0, -0.22]} castShadow>
          <capsuleGeometry args={[0.17, 0.46, 6, 12]} />
          <meshStandardMaterial {...clothMaterial} color={sleeve} />
        </mesh>
        <mesh position={[-0.24, -0.69, 0.025]} scale={[1, 1.18, 0.86]} castShadow>
          <sphereGeometry args={[0.14, 24, 20]} />
          <meshStandardMaterial color={skin} roughness={0.9} />
        </mesh>
        <mesh position={[-0.28, -0.79, 0.09]} rotation={[0, 0, -0.25]}>
          <capsuleGeometry args={[0.035, 0.12, 4, 8]} />
          <meshStandardMaterial color={skin} roughness={0.9} />
        </mesh>
        <mesh position={[-0.23, -0.82, 0.105]} rotation={[0, 0, -0.08]}>
          <capsuleGeometry args={[0.028, 0.1, 4, 8]} />
          <meshStandardMaterial color={skin} roughness={0.9} />
        </mesh>
        <mesh position={[-0.18, -0.81, 0.1]} rotation={[0, 0, 0.12]}>
          <capsuleGeometry args={[0.028, 0.09, 4, 8]} />
          <meshStandardMaterial color={skin} roughness={0.9} />
        </mesh>
      </group>
      <group ref={rightArm} position={[0.43, 2.3, 0]}>
        <mesh position={[0.14, -0.35, 0]} rotation={[0, 0, 0.18]} castShadow>
          <capsuleGeometry args={[0.17, 0.45, 6, 12]} />
          <meshStandardMaterial {...clothMaterial} color={sleeve} />
        </mesh>
        <mesh position={[0.2, -0.68, 0.025]} scale={[1, 1.18, 0.86]} castShadow>
          <sphereGeometry args={[0.14, 24, 20]} />
          <meshStandardMaterial color={skin} roughness={0.9} />
        </mesh>
        <mesh position={[0.16, -0.79, 0.09]} rotation={[0, 0, 0.25]}>
          <capsuleGeometry args={[0.035, 0.12, 4, 8]} />
          <meshStandardMaterial color={skin} roughness={0.9} />
        </mesh>
        <mesh position={[0.21, -0.82, 0.105]}>
          <capsuleGeometry args={[0.028, 0.1, 4, 8]} />
          <meshStandardMaterial color={skin} roughness={0.9} />
        </mesh>
        <mesh position={[0.26, -0.81, 0.1]} rotation={[0, 0, -0.12]}>
          <capsuleGeometry args={[0.028, 0.09, 4, 8]} />
          <meshStandardMaterial color={skin} roughness={0.9} />
        </mesh>
      </group>
      {isWoman && (
        <group ref={book} position={[-0.76, 1.92, -0.38]} scale={0}>
        <mesh position={[0, 0, -0.035]} castShadow>
          <boxGeometry args={[0.52, 0.68, 0.05]} />
          <meshStandardMaterial color="#57331f" roughness={0.82} />
        </mesh>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.46, 0.6, 0.04]} />
          <meshStandardMaterial color="#f2e5c9" roughness={0.95} />
        </mesh>
        <mesh position={[0, 0, 0.027]} castShadow>
          <boxGeometry args={[0.49, 0.65, 0.018]} />
          <meshStandardMaterial color="#a97847" roughness={0.76} />
        </mesh>
        <mesh position={[0, 0, 0.04]}>
          <boxGeometry args={[0.03, 0.52, 0.008]} />
          <meshStandardMaterial color="#e6c58b" metalness={0.2} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.13, 0.048]}>
          <boxGeometry args={[0.24, 0.022, 0.008]} />
          <meshStandardMaterial color="#e6c58b" metalness={0.2} roughness={0.5} />
        </mesh>
        <group ref={bookPages} position={[-0.22, 0, 0.055]}>
          <mesh position={[0.095, 0, 0]}>
            <boxGeometry args={[0.22, 0.59, 0.008]} />
            <meshStandardMaterial color="#fff4db" roughness={0.92} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0.095, 0, 0.006]}>
            <boxGeometry args={[0.16, 0.01, 0.003]} />
            <meshStandardMaterial color="#c5a981" roughness={0.85} />
          </mesh>
          <mesh position={[0.095, 0.015, 0.012]}>
            <planeGeometry args={[0.2, 0.51]} />
            <meshBasicMaterial color="#e8d3ad" />
          </mesh>
          <mesh position={[0.095, 0.015, 0.014]}>
            <planeGeometry args={[0.18, 0.48]} />
            <meshBasicMaterial map={portrait} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0.095, -0.215, 0.014]}>
            <boxGeometry args={[0.12, 0.008, 0.002]} />
            <meshStandardMaterial color="#a98a61" roughness={0.88} />
          </mesh>
        </group>
      </group>
      )}

      <group ref={leftLeg} position={[-0.2, 1.36, 0]}>
        <mesh position={[0, -0.46, 0]} castShadow>
          <capsuleGeometry args={[0.2, 0.58, 6, 12]} />
          <meshStandardMaterial {...clothMaterial} color={trouser} />
        </mesh>
        <mesh position={[0.02, -0.86, 0.09]} castShadow>
          <capsuleGeometry args={[0.19, 0.28, 5, 12]} />
          <meshStandardMaterial color="#080a0f" roughness={0.82} />
        </mesh>
      </group>
      <group ref={rightLeg} position={[0.2, 1.36, 0]}>
        <mesh position={[0, -0.46, 0]} castShadow>
          <capsuleGeometry args={[0.2, 0.58, 6, 12]} />
          <meshStandardMaterial {...clothMaterial} color={trouser} />
        </mesh>
        <mesh position={[0.02, -0.86, 0.09]} castShadow>
          <capsuleGeometry args={[0.19, 0.28, 5, 12]} />
          <meshStandardMaterial color="#080a0f" roughness={0.82} />
        </mesh>
      </group>
      {!isWoman && <mesh position={[0, 2.52, 0.34]}>
        <torusGeometry args={[0.27, 0.018, 8, 32, Math.PI]} />
        <meshStandardMaterial color="#626b7b" metalness={0.3} roughness={0.45} />
      </mesh>}
    </group>
  )
}

function BookShelf({ position, width = 2.55 }) {
  const bookColors = ['#b55c42', '#355d58', '#d0a35b', '#344a70', '#7b4650', '#d1c2a0', '#49634d']
  const shelfCount = 4
  const booksPerShelf = 10

  return (
    <group position={position}>
      <mesh position={[0, 1.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 3.45, 0.2]} />
        <meshStandardMaterial color="#342319" roughness={0.82} />
      </mesh>
      {Array.from({ length: shelfCount + 1 }, (_, shelfIndex) => (
        <mesh key={`shelf-${shelfIndex}`} position={[0, -0.12 + shelfIndex * 0.82, 0.16]} castShadow receiveShadow>
          <boxGeometry args={[width + 0.2, 0.09, 0.48]} />
          <meshStandardMaterial color="#8b5c34" roughness={0.72} />
        </mesh>
      ))}
      {Array.from({ length: shelfCount * booksPerShelf }, (_, index) => {
        const shelfIndex = Math.floor(index / booksPerShelf)
        const bookIndex = index % booksPerShelf
        const bookWidth = 0.13 + ((bookIndex + shelfIndex) % 3) * 0.025
        const bookHeight = 0.42 + ((bookIndex * 3 + shelfIndex) % 4) * 0.07
        const x = -width / 2 + 0.2 + bookIndex * ((width - 0.36) / booksPerShelf)
        const color = bookColors[(index * 3 + shelfIndex) % bookColors.length]
        return (
          <mesh
            key={`book-${index}`}
            position={[x, -0.12 + shelfIndex * 0.82 + bookHeight / 2 + 0.06, 0.28]}
            rotation={[0, 0, (bookIndex % 3 - 1) * 0.035]}
            castShadow
          >
            <boxGeometry args={[bookWidth, bookHeight, 0.22]} />
            <meshStandardMaterial color={color} roughness={0.78} />
          </mesh>
        )
      })}
      <mesh position={[0, 3.36, 0.16]} castShadow>
        <boxGeometry args={[width + 0.3, 0.16, 0.52]} />
        <meshStandardMaterial color="#bd8951" roughness={0.58} />
      </mesh>
    </group>
  )
}

function BookstoreInterior() {
  return (
    <>
      <mesh position={[0, 1.7, -5.2]} receiveShadow>
        <boxGeometry args={[17, 7, 0.3]} />
        <meshStandardMaterial color="#30251f" roughness={0.94} />
      </mesh>
      <mesh position={[0, -1.9, -0.4]} receiveShadow>
        <boxGeometry args={[18, 0.28, 12]} />
        <meshStandardMaterial color="#6d4a32" roughness={0.76} />
      </mesh>
      {Array.from({ length: 12 }, (_, index) => (
        <mesh key={`floor-plank-${index}`} position={[-5.5 + index, -1.745, 0.1]} receiveShadow>
          <boxGeometry args={[0.012, 0.012, 10.5]} />
          <meshStandardMaterial color="#b58455" roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, -1.72, 0.25]} receiveShadow>
        <boxGeometry args={[4.7, 0.018, 5.2]} />
        <meshStandardMaterial color="#513c35" roughness={0.98} />
      </mesh>
      <mesh position={[0, -1.705, 0.25]} receiveShadow>
        <boxGeometry args={[4.35, 0.012, 4.85]} />
        <meshStandardMaterial color="#785447" roughness={0.96} />
      </mesh>
      <mesh position={[0, -1.685, 0.25]} receiveShadow>
        <ringGeometry args={[1.58, 1.66, 64]} />
        <meshBasicMaterial color="#d5aa71" transparent opacity={0.24} side={THREE.DoubleSide} />
      </mesh>

      <BookShelf position={[-5.25, -1.72, -3.65]} width={2.45} />
      <BookShelf position={[4.8, -1.72, -3.65]} width={2.8} />

      <group position={[4.3, -0.9, -0.65]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[2.6, 1.55, 1.05]} />
          <meshStandardMaterial color="#55351f" roughness={0.72} />
        </mesh>
        <mesh position={[0, 0.81, 0]} castShadow>
          <boxGeometry args={[2.78, 0.16, 1.18]} />
          <meshStandardMaterial color="#c08a51" roughness={0.48} />
        </mesh>
        <mesh position={[0, 0.2, 0.535]}>
          <boxGeometry args={[1.9, 0.55, 0.02]} />
          <meshStandardMaterial color="#38271e" roughness={0.82} />
        </mesh>
        <mesh position={[0, 0.2, 0.55]}>
          <boxGeometry args={[1.78, 0.44, 0.018]} />
          <meshStandardMaterial color="#87613c" roughness={0.7} />
        </mesh>
      </group>

      <group position={[0, 3.15, -3.2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.48, 20]} />
          <meshStandardMaterial color="#8c6743" metalness={0.55} roughness={0.38} />
        </mesh>
        <mesh position={[0, -0.34, 0]}>
          <sphereGeometry args={[0.36, 24, 20]} />
          <meshStandardMaterial color="#ffd28a" emissive="#ff9b38" emissiveIntensity={1.2} />
        </mesh>
        <pointLight position={[0, -0.35, 0]} intensity={38} distance={7} color="#ffbd73" />
      </group>

      <mesh position={[-2.8, 2.25, -4.95]}>
        <boxGeometry args={[2.5, 3, 0.08]} />
        <meshStandardMaterial color="#e1a25f" emissive="#a95625" emissiveIntensity={0.55} />
      </mesh>
      <mesh position={[-2.8, 2.25, -4.88]}>
        <boxGeometry args={[2.25, 2.74, 0.04]} />
        <meshStandardMaterial color="#352921" roughness={0.94} />
      </mesh>
      <mesh position={[-2.8, 2.25, -4.84]}>
        <boxGeometry args={[1.9, 2.35, 0.025]} />
        <meshBasicMaterial color="#efb873" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <mesh position={[-2.8, 2.25, -4.81]}>
        <boxGeometry args={[0.055, 2.46, 0.08]} />
        <meshStandardMaterial color="#6a4930" roughness={0.55} />
      </mesh>
      <mesh position={[-2.8, 2.25, -4.81]}>
        <boxGeometry args={[2.08, 0.055, 0.08]} />
        <meshStandardMaterial color="#6a4930" roughness={0.55} />
      </mesh>
      <mesh position={[-2.8, 2.25, -4.79]}>
        <boxGeometry args={[0.045, 2.35, 0.09]} />
        <meshStandardMaterial color="#8d623b" roughness={0.62} />
      </mesh>
      <mesh position={[-2.8, 2.25, -4.79]}>
        <boxGeometry args={[1.95, 0.045, 0.09]} />
        <meshStandardMaterial color="#8d623b" roughness={0.62} />
      </mesh>
      <mesh position={[-2.8, 2.25, -4.86]}>
        <boxGeometry args={[0.06, 2.3, 0.12]} />
        <meshStandardMaterial color="#8d623b" roughness={0.62} />
      </mesh>
      <mesh position={[-2.8, 2.25, -4.74]}>
        <boxGeometry args={[0.045, 2.32, 0.1]} />
        <meshStandardMaterial color="#8d623b" roughness={0.62} />
      </mesh>
      <pointLight position={[-2.8, 2.2, -3.8]} intensity={24} distance={8} color="#ffc27c" />
      <mesh position={[-2.8, 0.8, -2.2]} rotation={[0.2, 0, -0.13]}>
        <cylinderGeometry args={[0.08, 1.05, 5.3, 20, 1, true]} />
        <meshBasicMaterial
          color="#ffc77e"
          transparent
          opacity={0.055}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh position={[-2.35, 0.65, -2.25]} rotation={[-0.08, 0, -0.31]}>
        <cylinderGeometry args={[0.05, 0.55, 4.6, 16, 1, true]} />
        <meshBasicMaterial
          color="#ffe0a9"
          transparent
          opacity={0.035}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  )
}

function CinematicCamera() {
  const { size } = useThree()
  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useFrame(({ camera, clock }, delta) => {
    const time = clock.getElapsedTime()
    const arrival = THREE.MathUtils.smoothstep(time, 1.4, 3)
    const bow = THREE.MathUtils.smoothstep(time, 2.55, 3.05)
      * (1 - THREE.MathUtils.smoothstep(time, 3.55, 4.1))
    const buttonTap = THREE.MathUtils.smoothstep(time, 7, 8)
    const compact = size.width <= 700
    const sceneArrival = reducedMotion ? 0 : arrival
    const sceneBow = reducedMotion ? 0 : bow
    const sceneTap = reducedMotion ? 0 : buttonTap
    const targetX = 0
    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX + sceneTap * 0.12, 1.5, delta)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, 0.3 + sceneBow * 0.12, 1.5, delta)
    const targetZ = compact ? 10.5 : 10 - sceneArrival * 0.62 - sceneBow * 0.12
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 1.5, delta)
    const bookFocus = reducedMotion
      ? 0
      : THREE.MathUtils.smoothstep(time, 5.15, 5.9)
        * (1 - THREE.MathUtils.smoothstep(time, 7.15, 7.8))
    const focusX = THREE.MathUtils.lerp(targetX + sceneTap * 0.16, 4.2, bookFocus)
    const focusY = THREE.MathUtils.lerp(0.12 + sceneBow * 0.08, -0.42, bookFocus)
    const focusCameraX = THREE.MathUtils.lerp(targetX + sceneTap * 0.12, 1, bookFocus)
    camera.position.x = THREE.MathUtils.damp(camera.position.x, focusCameraX, 1.5, delta)
    const focusDistance = THREE.MathUtils.lerp(targetZ, 8.5, bookFocus)
    camera.position.z = THREE.MathUtils.damp(camera.position.z, focusDistance, 1.5, delta)
    const focusFov = THREE.MathUtils.lerp(39, 32, bookFocus)
    if (camera.fov !== focusFov) {
      camera.fov = focusFov
      camera.updateProjectionMatrix()
    }
    camera.lookAt(focusX, focusY, 0)
  })

  return null
}

function MovingWarmLights() {
  const leftLight = useRef()
  const rightLight = useRef()
  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useFrame(({ clock }) => {
    if (reducedMotion) return
    const time = clock.getElapsedTime()
    if (leftLight.current) {
      leftLight.current.position.x = -4.8 + Math.sin(time * 0.32) * 0.34
      leftLight.current.position.y = 2.6 + Math.sin(time * 0.48) * 0.12
    }
    if (rightLight.current) {
      rightLight.current.position.x = 4.8 + Math.sin(time * 0.32 + Math.PI) * 0.34
      rightLight.current.position.y = 2.6 + Math.sin(time * 0.48 + Math.PI) * 0.12
    }
  })

  return (
    <>
      <pointLight ref={leftLight} position={[-4.8, 2.6, 2.6]} intensity={12} distance={8} color="#ffc578" />
      <pointLight ref={rightLight} position={[4.8, 2.6, 2.6]} intensity={12} distance={8} color="#e89ab0" />
    </>
  )
}

function Atmosphere({ onThanks, onFootstep, onBookReveal, onButtonHit }) {
  const points = useRef()
  const basePositions = useMemo(() => {
    const values = new Float32Array(72 * 3)
    for (let index = 0; index < 72; index += 1) {
      values[index * 3] = (Math.random() - 0.5) * 12
      values[index * 3 + 1] = Math.random() * 4 - 1.5
      values[index * 3 + 2] = -1 - Math.random() * 4
    }
    return values
  }, [])
  const positions = useMemo(() => basePositions.slice(), [basePositions])
  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useFrame(({ clock }) => {
    if (points.current) {
      if (reducedMotion) return
      const time = clock.getElapsedTime()
      const attribute = points.current.geometry.attributes.position
      for (let index = 0; index < basePositions.length / 3; index += 1) {
        attribute.array[index * 3] = basePositions[index * 3] + Math.sin(time * 0.32 + index) * 0.035
        attribute.array[index * 3 + 1] = basePositions[index * 3 + 1] + Math.sin(time * 0.45 + index * 0.7) * 0.12
        attribute.array[index * 3 + 2] = basePositions[index * 3 + 2]
      }
      attribute.needsUpdate = true
      points.current.rotation.y = Math.sin(time * 0.08) * 0.025
    }
  })

  return (
    <>
      <points ref={points}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#ffd9a0" size={0.023} transparent opacity={0.48} sizeAttenuation />
      </points>
      <CinematicCamera />
      <MovingWarmLights />
      <BookstoreInterior />
      <Character
        role="man"
        onThanks={onThanks}
        onFootstep={onFootstep}
      />
      <Character
        role="woman"
        onFootstep={onFootstep}
        onBookReveal={onBookReveal}
        onButtonHit={onButtonHit}
      />
    </>
  )
}

class SceneBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) return this.props.fallback
    return this.props.children
  }
}

function WelcomeScene({ fallback, onReady, onThanks, onFootstep, onBookReveal, onButtonHit }) {
  return (
    <SceneBoundary fallback={fallback}>
      <Canvas
        className="welcome-canvas"
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.3, 10], fov: 39 }}
        shadows="percentage"
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.15
          onReady()
        }}
        fallback={fallback}
      >
        <color attach="background" args={['#100d12']} />
        <fog attach="fog" args={['#100d12', 9, 21]} />
        <ambientLight intensity={0.55} color="#d5c0a4" />
        <directionalLight
          position={[-3, 7, 5]}
          intensity={2.8}
          color="#fff0d4"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-left={-9}
          shadow-camera-right={9}
          shadow-camera-top={7}
          shadow-camera-bottom={-5}
          shadow-bias={-0.00015}
        />
        <pointLight position={[3, 3, 4]} intensity={34} distance={14} color="#ffc47e" />
        <pointLight position={[0, 2, -2]} intensity={18} distance={9} color="#ff9b52" />
        <Atmosphere
          onThanks={onThanks}
          onFootstep={onFootstep}
          onBookReveal={onBookReveal}
          onButtonHit={onButtonHit}
        />
      </Canvas>
    </SceneBoundary>
  )
}

export default WelcomeScene
