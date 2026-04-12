import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

export type InteractionType = 'hold' | 'sit' | 'ride' | 'decoration'

export interface InteractableConfig {
  name: string
  modelPath: string
  type: InteractionType
  /** For 'hold': which bone to attach to (e.g. 'RightHand') */
  attachBone?: string
  /** Offset from attach point or ground */
  offset?: THREE.Vector3
  /** Rotation offset */
  rotationOffset?: THREE.Euler
  /** Scale override */
  scale?: number
  /** For 'ride': speed multiplier when riding */
  speedMultiplier?: number
  /** Prompt text shown when near */
  promptText?: string
  /** Interaction radius */
  radius?: number
}

export class Interactable {
  config: InteractableConfig
  model: THREE.Object3D | null = null
  isActive = false // currently being held/sat on/ridden

  constructor(config: InteractableConfig) {
    this.config = {
      radius: 2,
      scale: 1,
      promptText: `Press G to ${config.type === 'hold' ? 'pick up' : config.type === 'sit' ? 'sit on' : config.type === 'ride' ? 'ride' : 'use'} ${config.name}`,
      ...config,
    }
  }

  async load(scene: THREE.Scene, position: THREE.Vector3): Promise<void> {
    const loader = new GLTFLoader()
    const gltf = await new Promise<any>((resolve, reject) => {
      loader.load(this.config.modelPath, resolve, undefined, reject)
    })

    const model = gltf.scene
    this.model = model

    // Auto-scale to target height using config.scale as target height in meters
    // (e.g. scale=0.5 means the object should be 0.5m tall)
    const rawBox = new THREE.Box3().setFromObject(model)
    const rawSize = rawBox.getSize(new THREE.Vector3())
    const rawHeight = Math.max(rawSize.y, 0.01)
    const targetHeight = this.config.scale || 1 // meters
    const autoScale = targetHeight / rawHeight
    model.scale.setScalar(autoScale)
    console.log(`${this.config.name}: raw ${rawSize.x.toFixed(2)}x${rawSize.y.toFixed(2)}x${rawSize.z.toFixed(2)} → scale ${autoScale.toFixed(4)} (target ${targetHeight}m)`)

    // Position on ground (feet at y=0)
    const box = new THREE.Box3().setFromObject(model)
    model.position.copy(position)
    model.position.y = -box.min.y

    // Shadows
    model.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })

    scene.add(model)
  }

  /**
   * Check if player is close enough to interact
   */
  isPlayerNear(playerPos: THREE.Vector3): boolean {
    if (!this.model || this.isActive) return false
    const dist = playerPos.distanceTo(this.model.position)
    return dist < (this.config.radius || 2)
  }

  /**
   * Attach to character bone (for 'hold' items like weapons)
   */
  attachToBone(characterModel: THREE.Object3D, boneName: string) {
    const model = this.model
    if (!model) return

    let foundBone: THREE.Object3D | undefined
    characterModel.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Bone).isBone && child.name === boneName) {
        foundBone = child
      }
    })

    if (foundBone) {
      // Save original world scale before reparenting
      const worldScale = model.scale.x // auto-calculated in load()

      model.removeFromParent()
      foundBone.add(model)
      model.position.set(0, 0, 0)
      if (this.config.offset) model.position.copy(this.config.offset)
      if (this.config.rotationOffset) model.rotation.copy(this.config.rotationOffset)

      // Compensate for inherited character scale so weapon stays world-sized
      const charScale = characterModel.scale.x
      model.scale.setScalar(worldScale / charScale)

      this.isActive = true
    } else {
      console.warn(`Bone "${boneName}" not found. Available bones:`)
      characterModel.traverse((child: THREE.Object3D) => {
        if ((child as THREE.Bone).isBone) console.log(`  - ${child.name}`)
      })
    }
  }

  /**
   * Detach from bone, place back in world
   */
  detach(scene: THREE.Scene, dropPosition: THREE.Vector3) {
    if (!this.model) return
    this.model.removeFromParent()
    scene.add(this.model)
    this.model.position.copy(dropPosition)
    this.model.position.y = 0
    this.model.rotation.set(0, 0, 0)
    this.isActive = false
  }

  /**
   * For 'sit'/'ride': lock player to this position
   */
  getSitPosition(): THREE.Vector3 | null {
    if (!this.model) return null
    const pos = this.model.position.clone()
    if (this.config.offset) pos.add(this.config.offset)
    return pos
  }
}

/**
 * Manages all interactable objects in the scene
 */
export class InteractionManager {
  items: Interactable[] = []
  nearestItem: Interactable | null = null
  activeItem: Interactable | null = null
  private promptEl: HTMLDivElement

  constructor() {
    this.promptEl = document.createElement('div')
    this.promptEl.id = 'interact-prompt'
    this.promptEl.className = 'hidden'
    document.body.appendChild(this.promptEl)
  }

  add(item: Interactable) {
    this.items.push(item)
  }

  /**
   * Call every frame to check proximity and show prompts
   */
  update(playerPos: THREE.Vector3) {
    // Find nearest interactable
    this.nearestItem = null
    let nearestDist = Infinity

    for (const item of this.items) {
      if (item.isActive) continue
      if (!item.model) continue
      const dist = playerPos.distanceTo(item.model.position)
      if (dist < (item.config.radius || 2) && dist < nearestDist) {
        nearestDist = dist
        this.nearestItem = item
      }
    }

    // Show/hide prompt
    if (this.nearestItem && !this.activeItem) {
      this.promptEl.textContent = this.nearestItem.config.promptText || 'Press G'
      this.promptEl.className = ''
    } else {
      this.promptEl.className = 'hidden'
    }
  }

  /**
   * Player pressed G - interact with nearest item
   */
  interact(scene: THREE.Scene, characterModel: THREE.Object3D | null, playerPos: THREE.Vector3): InteractableConfig | null {
    // If already holding/sitting, drop/stand
    if (this.activeItem) {
      this.activeItem.detach(scene, playerPos.clone().add(new THREE.Vector3(1, 0, 0)))
      const config = this.activeItem.config
      this.activeItem = null
      return config
    }

    // Pick up / sit on nearest
    if (this.nearestItem && characterModel) {
      const item = this.nearestItem
      if (item.config.type === 'hold' && item.config.attachBone) {
        item.attachToBone(characterModel, item.config.attachBone)
        this.activeItem = item
        return item.config
      } else if (item.config.type === 'sit' || item.config.type === 'ride') {
        item.isActive = true
        this.activeItem = item
        return item.config
      }
    }

    return null
  }
}
