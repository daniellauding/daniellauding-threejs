import * as THREE from 'three'

export type EnvironmentType = 'default' | 'beach' | 'forest' | 'city'

interface EnvironmentConfig {
  groundColor: number
  groundTexture?: string // folder name in /textures/ (has color.jpg, normal.jpg, roughness.jpg)
  fogColor: number
  fogDensity: number
  skyTopColor: [number, number, number]
  skyBottomColor: [number, number, number]
  sunColor: number
  sunIntensity: number
  sunPosition: THREE.Vector3
  ambientColor: number
  ambientIntensity: number
}

const ENVIRONMENTS: Record<EnvironmentType, EnvironmentConfig> = {
  default: {
    groundColor: 0x2a2a3e,
    fogColor: 0x1a1a3e,
    fogDensity: 0.012,
    skyTopColor: [0.35, 0.15, 0.25],
    skyBottomColor: [0.06, 0.05, 0.16],
    sunColor: 0xffcc88,
    sunIntensity: 2.5,
    sunPosition: new THREE.Vector3(15, 25, 10),
    ambientColor: 0x6b5b8a,
    ambientIntensity: 1.0,
  },
  beach: {
    groundColor: 0xd4b896,
    groundTexture: 'sand',
    fogColor: 0x87ceeb,
    fogDensity: 0.005,
    skyTopColor: [0.3, 0.6, 0.9],
    skyBottomColor: [0.9, 0.7, 0.5],
    sunColor: 0xfffde8,
    sunIntensity: 3.0,
    sunPosition: new THREE.Vector3(20, 30, -5),
    ambientColor: 0xffeedd,
    ambientIntensity: 1.2,
  },
  forest: {
    groundColor: 0x2d4a1e,
    groundTexture: 'grass',
    fogColor: 0x3a5a2e,
    fogDensity: 0.02,
    skyTopColor: [0.15, 0.3, 0.15],
    skyBottomColor: [0.1, 0.15, 0.08],
    sunColor: 0xddeebb,
    sunIntensity: 1.5,
    sunPosition: new THREE.Vector3(5, 15, 8),
    ambientColor: 0x4a6a3a,
    ambientIntensity: 0.8,
  },
  city: {
    groundColor: 0x444444,
    groundTexture: 'asphalt',
    fogColor: 0x555566,
    fogDensity: 0.008,
    skyTopColor: [0.2, 0.2, 0.3],
    skyBottomColor: [0.15, 0.12, 0.18],
    sunColor: 0xeeddcc,
    sunIntensity: 2.0,
    sunPosition: new THREE.Vector3(10, 20, 15),
    ambientColor: 0x888899,
    ambientIntensity: 1.0,
  },
}

/**
 * Simple water plane with animated shader
 */
export function createWater(size = 200): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(size, size, 50, 50)
  const mat = new THREE.MeshStandardMaterial({
    color: 0x006994,
    transparent: true,
    opacity: 0.7,
    roughness: 0.1,
    metalness: 0.3,
  })
  const water = new THREE.Mesh(geo, mat)
  water.rotation.x = -Math.PI / 2
  water.position.y = -0.3
  water.receiveShadow = true
  return water
}

/**
 * Animate water vertices for wave effect
 */
export function animateWater(water: THREE.Mesh, time: number) {
  const pos = water.geometry.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getY(i)
    pos.setZ(i, Math.sin(x * 0.3 + time) * 0.15 + Math.cos(z * 0.2 + time * 0.7) * 0.1)
  }
  pos.needsUpdate = true
  water.geometry.computeVertexNormals()
}

/**
 * Create simple procedural trees (no GLB needed)
 */
export function createTree(height = 3, trunkColor = 0x8B4513, leafColor = 0x228B22): THREE.Group {
  const tree = new THREE.Group()

  // Trunk
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.15, height * 0.4, 8),
    new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.9 })
  )
  trunk.position.y = height * 0.2
  trunk.castShadow = true
  tree.add(trunk)

  // Leaves (3 cones stacked)
  for (let i = 0; i < 3; i++) {
    const radius = (0.8 - i * 0.2) * (height / 3)
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(radius, height * 0.3, 8),
      new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.8 })
    )
    cone.position.y = height * 0.35 + i * height * 0.2
    cone.castShadow = true
    tree.add(cone)
  }

  return tree
}

/**
 * Create a palm tree
 */
export function createPalmTree(height = 5): THREE.Group {
  const tree = new THREE.Group()

  // Curved trunk
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.15, height, 8),
    new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.9 })
  )
  trunk.position.y = height / 2
  trunk.rotation.z = 0.1
  trunk.castShadow = true
  tree.add(trunk)

  // Palm leaves (flat ellipsoids)
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 8, 4),
      new THREE.MeshStandardMaterial({ color: 0x2d5a1e, roughness: 0.7 })
    )
    leaf.scale.set(0.3, 0.05, 1)
    leaf.position.set(Math.cos(angle) * 0.8, height - 0.2, Math.sin(angle) * 0.8)
    leaf.rotation.set(-0.5, angle, 0)
    leaf.castShadow = true
    tree.add(leaf)
  }

  return tree
}

/**
 * Scatter objects randomly in a radius
 */
export function scatter(
  createFn: () => THREE.Object3D,
  count: number,
  radius: number,
  scene: THREE.Scene,
  avoidCenter = 5
): THREE.Object3D[] {
  const objects: THREE.Object3D[] = []
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const dist = avoidCenter + Math.random() * (radius - avoidCenter)
    const obj = createFn()
    obj.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist)
    obj.rotation.y = Math.random() * Math.PI * 2
    const scale = 0.7 + Math.random() * 0.6
    obj.scale.setScalar(scale)
    scene.add(obj)
    objects.push(obj)
  }
  return objects
}

/**
 * Load PBR ground textures (color + normal + roughness)
 */
export function loadGroundTexture(folderName: string, ground: THREE.Mesh) {
  const loader = new THREE.TextureLoader()
  const mat = ground.material as THREE.MeshStandardMaterial

  // Remove vertex colors when using textures
  mat.vertexColors = false

  const repeat = 40
  const loadTex = (file: string) => {
    const tex = loader.load(`/textures/${folderName}/${file}`)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(repeat, repeat)
    return tex
  }

  mat.map = loadTex('color.jpg')
  mat.map.colorSpace = THREE.SRGBColorSpace
  mat.normalMap = loadTex('normal.jpg')
  mat.roughnessMap = loadTex('roughness.jpg')
  mat.roughness = 1
  mat.metalness = 0
  mat.color.set(0xffffff) // let texture define color
  mat.needsUpdate = true
}

/**
 * Reset ground to vertex colors (for default env)
 */
export function resetGroundToVertexColors(ground: THREE.Mesh, baseColor: number) {
  const mat = ground.material as THREE.MeshStandardMaterial
  mat.map = null
  mat.normalMap = null
  mat.roughnessMap = null
  mat.vertexColors = true
  mat.roughness = 0.85
  mat.metalness = 0.05
  mat.color.set(0xffffff)

  // Recolor vertices
  const colors = ground.geometry.attributes.color
  const pos = ground.geometry.attributes.position
  const base = new THREE.Color(baseColor)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getY(i)
    const dist = Math.sqrt(x * x + z * z) / 100
    const t = Math.min(dist, 1)
    colors.setXYZ(i,
      THREE.MathUtils.lerp(base.r, base.r * 0.5, t),
      THREE.MathUtils.lerp(base.g, base.g * 0.5, t),
      THREE.MathUtils.lerp(base.b, base.b * 0.5, t)
    )
  }
  colors.needsUpdate = true
  mat.needsUpdate = true
}

export { ENVIRONMENTS, type EnvironmentConfig }
