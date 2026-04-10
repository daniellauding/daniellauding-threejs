import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

export type AnimationState = 'idle' | 'walk' | 'run' | 'jump' | 'crouchIdle' | 'crouchWalk'

export class Character {
  model: THREE.Object3D | null = null
  mixer: THREE.AnimationMixer | null = null
  actions: Map<AnimationState, THREE.AnimationAction> = new Map()
  currentState: AnimationState = 'idle'
  private fadeDuration = 0.25
  private modelOffset = new THREE.Vector3()

  /**
   * Load rigged model with separate animation GLBs (Meshy "withSkin" exports).
   * Uses the idle GLB as the base model and loads animation clips from the others.
   */
  async load(
    scene: THREE.Scene,
    animationPaths: Record<AnimationState, string>
  ): Promise<void> {
    const loader = new GLTFLoader()

    // Load idle as the base model (it has the mesh + skeleton + idle animation)
    const idleGltf = await this.loadGLTF(loader, animationPaths.idle)
    this.model = idleGltf.scene

    // Auto-scale to human height
    const box = new THREE.Box3().setFromObject(this.model)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const scale = 1.7 / size.y
    this.model.scale.setScalar(scale)

    // Store offset so we can reapply it when setting position
    this.modelOffset.set(
      -center.x * scale,
      -box.min.y * scale,
      -center.z * scale
    )
    this.model.position.copy(this.modelOffset)

    // Enable shadows on all meshes
    this.model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })

    scene.add(this.model)

    // Create animation mixer bound to this model
    this.mixer = new THREE.AnimationMixer(this.model)

    // Register idle animation from base model
    if (idleGltf.animations.length > 0) {
      const idleAction = this.mixer.clipAction(idleGltf.animations[0])
      this.actions.set('idle', idleAction)
      idleAction.play()
    }

    // Load remaining animations in parallel
    const otherStates = Object.entries(animationPaths).filter(([state]) => state !== 'idle')
    const loadPromises = otherStates.map(async ([state, path]) => {
      try {
        const gltf = await this.loadGLTF(loader, path)
        if (gltf.animations.length > 0) {
          // clipAction with a clip from a different scene still works -
          // Three.js matches bone names from the clip to the mixer's root
          const action = this.mixer!.clipAction(gltf.animations[0])
          this.actions.set(state as AnimationState, action)
          console.log(`Animation "${state}" loaded (${gltf.animations[0].duration.toFixed(1)}s)`)
        }
      } catch (err) {
        console.warn(`Failed to load animation "${state}":`, err)
      }
    })

    await Promise.all(loadPromises)
    console.log(`Character ready with ${this.actions.size} animations`)
  }

  setState(newState: AnimationState) {
    if (newState === this.currentState) return

    const currentAction = this.actions.get(this.currentState)
    const newAction = this.actions.get(newState)

    if (!newAction) return

    if (currentAction) {
      currentAction.fadeOut(this.fadeDuration)
    }

    newAction.reset().fadeIn(this.fadeDuration).play()

    if (newState === 'jump') {
      newAction.setLoop(THREE.LoopOnce, 1)
      newAction.clampWhenFinished = true
    } else {
      newAction.setLoop(THREE.LoopRepeat, Infinity)
    }

    this.currentState = newState
  }

  updateFromMovement(speed: number, isGrounded: boolean, isCrouching: boolean, isSprinting: boolean) {
    if (!isGrounded) {
      this.setState('jump')
      return
    }

    const isMoving = speed > 0.5

    if (isCrouching) {
      this.setState(isMoving ? 'crouchWalk' : 'crouchIdle')
    } else if (isMoving && isSprinting) {
      this.setState('run')
    } else if (isMoving) {
      this.setState('walk')
    } else {
      this.setState('idle')
    }
  }

  setPosition(x: number, y: number, z: number) {
    if (!this.model) return
    this.model.position.set(
      x + this.modelOffset.x,
      y + this.modelOffset.y,
      z + this.modelOffset.z
    )
  }

  setRotation(targetAngle: number, delta: number) {
    if (!this.model) return
    let diff = targetAngle - this.model.rotation.y
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    this.model.rotation.y += diff * 10 * delta
  }

  update(delta: number) {
    this.mixer?.update(delta)
  }

  private loadGLTF(loader: GLTFLoader, path: string): Promise<import('three/addons/loaders/GLTFLoader.js').GLTF> {
    return new Promise((resolve, reject) => {
      loader.load(path, resolve, undefined, reject)
    })
  }
}
