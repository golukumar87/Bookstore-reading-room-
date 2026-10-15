import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

const featuredCovers = [
  { title: 'BHAGAVAD GITA', author: 'EDWIN ARNOLD', color: '#b35e36', accent: '#ffd27b' },
  { title: 'RAMAYANA', author: 'R. T. H. GRIFFITH', color: '#315f59', accent: '#b7e0bd' },
  { title: 'GITANJALI', author: 'RABINDRANATH TAGORE', color: '#a64f5d', accent: '#f6d5a0' },
  { title: 'PANCHATANTRA', author: 'VISHNU SHARMA', color: '#56508d', accent: '#e7cbff' }
]

function makeCoverTexture(book) {
  const canvas = document.createElement('canvas')
  canvas.width = 360
  canvas.height = 500
  const context = canvas.getContext('2d')
  const gradient = context.createLinearGradient(0, 0, 360, 500)
  gradient.addColorStop(0, book.color)
  gradient.addColorStop(1, '#18243b')
  context.fillStyle = gradient
  context.fillRect(0, 0, 360, 500)

  context.strokeStyle = `${book.accent}bb`
  context.lineWidth = 3
  context.strokeRect(22, 22, 316, 456)
  context.fillStyle = `${book.accent}2e`
  context.beginPath()
  context.arc(180, 250, 112, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = book.accent
  context.font = 'bold 42px Georgia, serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  const words = book.title.split(' ')
  const lines = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (context.measureText(next).width > 286 && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  const startY = 245 - (lines.length - 1) * 26
  lines.forEach((titleLine, index) => context.fillText(titleLine, 180, startY + index * 54, 286))
  context.font = 'bold 14px Arial, sans-serif'
  context.letterSpacing = '3px'
  context.fillText(book.author, 180, 422, 286)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function BookScene({ bookCount = 0 }) {
  const hostRef = useRef(null)
  const [webglUnavailable, setWebglUnavailable] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    let renderer
    let frame = 0
    let observer
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
    } catch {
      setWebglUnavailable(true)
      return undefined
    }

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
    camera.position.set(0, 0, 9)
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.domElement.setAttribute('aria-hidden', 'true')
    host.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 2.15))
    const keyLight = new THREE.DirectionalLight(0xfff0d2, 3.5)
    keyLight.position.set(-3, 5, 8)
    scene.add(keyLight)
    const rimLight = new THREE.PointLight(0x82c9ff, 32, 20)
    rimLight.position.set(4, 1, 4)
    scene.add(rimLight)
    const warmLight = new THREE.PointLight(0xffbc7a, 18, 16)
    warmLight.position.set(-4, -2, 2)
    scene.add(warmLight)

    const stack = new THREE.Group()
    scene.add(stack)
    const bookObjects = []
    const palette = ['#c8aa78', '#425b77', '#8a4c46', '#d2c8ad']
    const bookSlots = [-2.05, -0.7, 0.7, 2.05]

    featuredCovers.forEach((book, index) => {
      const group = new THREE.Group()
      const width = index === 1 ? 1.5 : 1.42
      const height = index === 2 ? 2.14 : 2
      const depth = 0.3
      const pageMaterial = new THREE.MeshStandardMaterial({
        color: '#f4ead2',
        roughness: 0.92,
        metalness: 0
      })
      const sideMaterial = new THREE.MeshStandardMaterial({
        color: palette[index],
        roughness: 0.72,
        metalness: 0.02
      })
      const coverMaterial = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        map: makeCoverTexture(book),
        roughness: 0.8
      })
      const pages = new THREE.Mesh(
        new THREE.BoxGeometry(width - 0.08, height - 0.08, depth - 0.045),
        [sideMaterial, pageMaterial, pageMaterial, pageMaterial, pageMaterial, pageMaterial]
      )
      pages.position.z = -0.018
      group.add(pages)
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, 0.035),
        [sideMaterial, sideMaterial, sideMaterial, sideMaterial, coverMaterial, sideMaterial]
      )
      body.castShadow = true
      body.position.z = depth / 2 - 0.005
      group.add(body)

      const spine = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, height - 0.04, 0.035),
        new THREE.MeshStandardMaterial({ color: palette[index], roughness: 0.66 })
      )
      spine.position.set(-width / 2 + 0.045, 0, depth / 2 + 0.008)
      group.add(spine)

      group.position.set(bookSlots[index], index % 2 === 0 ? -0.08 : 0.08, (3 - index) * 0.09)
      group.rotation.z = (index - 1.5) * -0.055
      group.rotation.y = (index - 1.5) * 0.055
      stack.add(group)
      bookObjects.push({ group, baseY: group.position.y, phase: index * 1.3 })
    })

    const haloGeometry = new THREE.TorusGeometry(2.75, 0.009, 8, 140)
    const haloMaterial = new THREE.MeshBasicMaterial({ color: 0xd6e6ff, transparent: true, opacity: 0.46 })
    const halo = new THREE.Mesh(haloGeometry, haloMaterial)
    halo.position.set(0, 0, -1.2)
    halo.scale.y = 0.64
    stack.add(halo)

    const innerHalo = new THREE.Mesh(
      new THREE.TorusGeometry(2.42, 0.006, 6, 120),
      new THREE.MeshBasicMaterial({ color: 0xffdfa0, transparent: true, opacity: 0.32 })
    )
    innerHalo.position.set(0, 0, -1.1)
    innerHalo.scale.y = 0.72
    innerHalo.rotation.z = Math.PI * 0.18
    stack.add(innerHalo)

    const particles = new Float32Array(150 * 3)
    for (let index = 0; index < 150; index += 1) {
      particles[index * 3] = (Math.random() - 0.5) * 8
      particles[index * 3 + 1] = (Math.random() - 0.5) * 5.5
      particles[index * 3 + 2] = (Math.random() - 0.5) * 2 - 0.8
    }
    const particleGeometry = new THREE.BufferGeometry()
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particles, 3))
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xffe7b1,
      size: 0.022,
      transparent: true,
      opacity: 0.66,
      sizeAttenuation: true,
      depthWrite: false
    })
    const dust = new THREE.Points(particleGeometry, particleMaterial)
    scene.add(dust)

    const pointer = new THREE.Vector2()
    const targetPointer = new THREE.Vector2()
    const onPointerMove = (event) => {
      const bounds = host.getBoundingClientRect()
      targetPointer.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
      targetPointer.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * -2
    }
    const onPointerLeave = () => targetPointer.set(0, 0)
    host.addEventListener('pointermove', onPointerMove, { passive: true })
    host.addEventListener('pointerleave', onPointerLeave)

    const resize = () => {
      const { width, height } = host.getBoundingClientRect()
      if (!width || !height) return
      camera.aspect = width / height
      camera.position.z = width < 500 ? 11.3 : 10
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
      renderer.render(scene, camera)
    }

    observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reducedMotion) {
      const animate = (time) => {
        pointer.lerp(targetPointer, 0.035)
        stack.rotation.y = Math.sin(time * 0.00024) * 0.1 + pointer.x * 0.09
        stack.rotation.x = Math.sin(time * 0.00019) * 0.04 + pointer.y * 0.045
        bookObjects.forEach(({ group, baseY, phase }) => {
          group.position.y = baseY + Math.sin(time * 0.0007 + phase) * 0.06
        })
        halo.rotation.z = time * 0.000055
        innerHalo.rotation.z = Math.PI * 0.18 - time * 0.00004
        dust.rotation.y = Math.sin(time * 0.00008) * 0.08 + pointer.x * 0.025
        renderer.render(scene, camera)
        frame = window.requestAnimationFrame(animate)
      }
      frame = window.requestAnimationFrame(animate)
    }

    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
      host.removeEventListener('pointermove', onPointerMove)
      host.removeEventListener('pointerleave', onPointerLeave)
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose()
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => {
            material.map?.dispose()
            material.dispose()
          })
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return (
    <div className={`hero-book-scene ${webglUnavailable ? 'hero-book-scene-fallback' : ''}`} ref={hostRef} role="img" aria-label="Interactive three-dimensional floating books">
      <div className="hero-scene-glow" />
      <span className="hero-scene-chip hero-scene-chip-top"><span>✦</span> Curated for you</span>
      <span className="hero-scene-chip hero-scene-chip-bottom">
        {bookCount > 0 ? <><strong>{bookCount.toLocaleString('en-IN')}</strong> books to explore</> : 'Curated books and stories'}
      </span>
      {webglUnavailable && (
        <div className="hero-scene-fallback">
          <span>📚</span>
          <strong>Find your next favorite</strong>
          <small>Stories, ideas and adventures</small>
        </div>
      )}
      <span className="hero-scene-caption">
        <strong>Golu Kumar</strong>
        <small>Full Stack Developer</small>
      </span>
    </div>
  )
}

export default BookScene
