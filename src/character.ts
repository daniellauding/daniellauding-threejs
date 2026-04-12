import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { type Emote } from './emotes'

export type AnimationState = 'idle' | 'walk' | 'run' | 'jump' | 'crouchIdle' | 'crouchWalk' | 'prone'

export class Character {
  model: THREE.Object3D | null = null
  mixer: THREE.AnimationMixer | null = null
  actions: Map<string, THREE.AnimationAction> = new Map()
  currentState: string = 'idle'
  playingEmote = false
  lockedEmote = false // true = don't cancel emote on movement (sit/ride)
  private fadeDuration = 0.25
  modelOffset = new THREE.Vector3()
  private loader = new GLTFLoader()

  async load(
    scene: THREE.Scene,
    animationPaths: Record<AnimationState, string>
  ): Promise<void> {
    const idleGltf = await this.loadGLTF(this.loader, animationPaths.idle)
    this.model = idleGltf.scene

    const box = new THREE.Box3().setFromObject(this.model)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const scale = 1.7 / size.y
    this.model.scale.setScalar(scale)

    this.modelOffset.set(
      -center.x * scale,
      -box.min.y * scale,
      -center.z * scale
    )
    this.model.position.copy(this.modelOffset)

    this.model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })

    scene.add(this.model)
    this.mixer = new THREE.AnimationMixer(this.model)

    // Listen for emote finish
    this.mixer.addEventListener('finished', () => {
      if (this.playingEmote) {
        this.playingEmote = false
        this.setState('idle')
      }
    })

    if (idleGltf.animations.length > 0) {
      const idleAction = this.mixer.clipAction(idleGltf.animations[0])
      this.actions.set('idle', idleAction)
      idleAction.play()
    }

    const otherStates = Object.entries(animationPaths).filter(([state]) => state !== 'idle')
    const loadPromises = otherStates.map(async ([state, path]) => {
      try {
        const gltf = await this.loadGLTF(this.loader, path)
        if (gltf.animations.length > 0) {
          const action = this.mixer!.clipAction(gltf.animations[0])
          this.actions.set(state, action)
          console.log(`Animation "${state}" loaded`)
        }
      } catch (err) {
        console.warn(`Failed to load animation "${state}":`, err)
      }
    })

    await Promise.all(loadPromises)
    console.log(`Character ready with ${this.actions.size} animations`)
  }

  /**
   * Preload an emote animation from its GLB file
   */
  async loadEmote(emote: Emote): Promise<void> {
    const key = `emote:${emote.command}`
    if (this.actions.has(key)) return // already loaded

    try {
      const gltf = await this.loadGLTF(this.loader, `/models/animations/${emote.file}`)
      if (gltf.animations.length > 0 && this.mixer) {
        const action = this.mixer.clipAction(gltf.animations[0])
        this.actions.set(key, action)
      }
    } catch (err) {
      console.warn(`Failed to load emote "${emote.name}":`, err)
    }
  }

  /**
   * Play an emote animation
   */
  playEmote(emote: Emote) {
    const key = `emote:${emote.command}`
    const action = this.actions.get(key)
    if (!action) return

    // Fade out current
    const currentAction = this.actions.get(this.currentState)
    if (currentAction) currentAction.fadeOut(this.fadeDuration)

    action.reset().fadeIn(this.fadeDuration).play()

    if (emote.loop) {
      action.setLoop(THREE.LoopRepeat, Infinity)
    } else {
      action.setLoop(THREE.LoopOnce, 1)
      action.clampWhenFinished = true
    }

    this.currentState = key
    this.playingEmote = true
  }

  /**
   * Stop current emote and return to idle
   */
  stopEmote() {
    if (!this.playingEmote) return
    this.playingEmote = false
    this.lockedEmote = false
    this.setState('idle')
  }

  setState(newState: string) {
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
    this.playingEmote = false
  }

  updateFromMovement(speed: number, isGrounded: boolean, isCrouching: boolean, isSprinting: boolean, isProne: boolean) {
    // Locked emote (sit/ride) = never cancel from movement
    if (this.lockedEmote) return
    // Regular emote = cancel if moving
    if (this.playingEmote && speed > 0.5) {
      this.stopEmote()
    }
    if (this.playingEmote) return

    if (!isGrounded) {
      this.setState('jump')
      return
    }

    if (isProne) {
      this.setState('prone')
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

  /** Returns the uniform scale applied to the model (e.g. 1.7 / originalHeight) */
  getModelScale(): number {
    return this.model ? this.model.scale.x : 1
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
