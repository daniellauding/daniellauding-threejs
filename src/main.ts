import './style.css'
import * as THREE from 'three'
import { Character } from './character'
import { EMOTES, type Emote } from './emotes'

// --- Scene setup ---
const canvas = document.getElementById('canvas') as HTMLCanvasElement
const scene = new THREE.Scene()

// --- Sky gradient (warm sunset vibes) ---
scene.background = new THREE.Color(0x0f0c29)
scene.fog = new THREE.FogExp2(0x1a1a3e, 0.012)

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.2

// --- Lighting (warm sunset + cool fill) ---
scene.add(new THREE.AmbientLight(0x6b5b8a, 1.0))
scene.add(new THREE.HemisphereLight(0xffa86b, 0x2a2a5e, 0.6)) // warm sky, cool ground

const dirLight = new THREE.DirectionalLight(0xffcc88, 2.5)
dirLight.position.set(15, 25, 10)
dirLight.castShadow = true
dirLight.shadow.mapSize.set(2048, 2048)
dirLight.shadow.camera.near = 0.5
dirLight.shadow.camera.far = 100
dirLight.shadow.camera.left = -30
dirLight.shadow.camera.right = 30
dirLight.shadow.camera.top = 30
dirLight.shadow.camera.bottom = -30
scene.add(dirLight)

const fillLight = new THREE.DirectionalLight(0x6b8aff, 0.6)
fillLight.position.set(-10, 8, -5)
scene.add(fillLight)

const rimLight = new THREE.DirectionalLight(0xff6b9d, 0.4)
rimLight.position.set(0, 3, -15)
scene.add(rimLight)

// --- Ground (gradient-ish via vertex colors) ---
const groundGeo = new THREE.PlaneGeometry(200, 200, 100, 100)
const groundColors = new Float32Array(groundGeo.attributes.position.count * 3)
const groundPos = groundGeo.attributes.position
for (let i = 0; i < groundPos.count; i++) {
  const x = groundPos.getX(i)
  const z = groundPos.getY(i) // Y in plane space = Z in world
  const dist = Math.sqrt(x * x + z * z) / 100
  // Center: warm teal, edges: deep purple
  const r = THREE.MathUtils.lerp(0.15, 0.08, Math.min(dist, 1))
  const g = THREE.MathUtils.lerp(0.22, 0.10, Math.min(dist, 1))
  const b = THREE.MathUtils.lerp(0.28, 0.18, Math.min(dist, 1))
  groundColors[i * 3] = r
  groundColors[i * 3 + 1] = g
  groundColors[i * 3 + 2] = b
}
groundGeo.setAttribute('color', new THREE.BufferAttribute(groundColors, 3))

const ground = new THREE.Mesh(
  groundGeo,
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 })
)
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

const grid = new THREE.GridHelper(200, 80, 0x4a3a6e, 0x2a2a4e)
grid.position.y = 0.01
grid.material.opacity = 0.3
grid.material.transparent = true
scene.add(grid)

// --- Skybox gradient (big sphere) ---
const skyGeo = new THREE.SphereGeometry(400, 32, 32)
const skyColors = new Float32Array(skyGeo.attributes.position.count * 3)
for (let i = 0; i < skyGeo.attributes.position.count; i++) {
  const y = skyGeo.attributes.position.getY(i)
  const t = (y / 400 + 1) * 0.5 // 0 = bottom, 1 = top
  // Bottom: deep indigo → mid: purple → top: warm orange
  const r = THREE.MathUtils.lerp(0.06, 0.35, t * t)
  const g = THREE.MathUtils.lerp(0.05, 0.15, t)
  const b = THREE.MathUtils.lerp(0.16, 0.25, Math.sqrt(t))
  skyColors[i * 3] = r
  skyColors[i * 3 + 1] = g
  skyColors[i * 3 + 2] = b
}
skyGeo.setAttribute('color', new THREE.BufferAttribute(skyColors, 3))
const sky = new THREE.Mesh(
  skyGeo,
  new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })
)
scene.add(sky)

// --- Decorative objects ---
const sceneObjects: THREE.Mesh[] = []
const shapes = [
  { geo: new THREE.BoxGeometry(2, 2, 2), pos: [8, 1, -5], color: 0xff6b6b },
  { geo: new THREE.SphereGeometry(1.2, 32, 32), pos: [-6, 1.2, -8], color: 0x6bcfff },
  { geo: new THREE.ConeGeometry(1, 3, 8), pos: [4, 1.5, -12], color: 0x6bff8b },
  { geo: new THREE.TorusGeometry(1, 0.4, 16, 32), pos: [-10, 1.5, 3], color: 0xffb86b },
  { geo: new THREE.CylinderGeometry(0.8, 0.8, 4, 16), pos: [12, 2, -15], color: 0xd66bff },
  { geo: new THREE.OctahedronGeometry(1.5), pos: [-4, 1.5, -18], color: 0xff6bdb },
  { geo: new THREE.IcosahedronGeometry(1.2), pos: [15, 1.2, 5], color: 0x6bffd6 },
  { geo: new THREE.TorusKnotGeometry(1, 0.3, 64, 16), pos: [-12, 2, -12], color: 0xffff6b },
] as const

shapes.forEach(({ geo, pos, color }) => {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.6 })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(pos[0], pos[1], pos[2])
  mesh.castShadow = true
  mesh.receiveShadow = true
  scene.add(mesh)
  sceneObjects.push(mesh)
})

// --- Player state ---
const player = {
  position: new THREE.Vector3(0, 0, 0),
  velocity: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  height: 1.7,
  speed: 8,
  sprintMultiplier: 2.2,
  crouchHeight: 0.9,
  standHeight: 1.7,
  jumpForce: 8,
  gravity: -20,
  isGrounded: true,
  isCrouching: false,
  isSprinting: false,
  isProne: false,
  proneHeight: 0.4,
}

// --- Camera orbit ---
const orbit = {
  distance: 5,
  minDistance: 1.5,
  maxDistance: 30,
  currentDistance: 5,
  thirdPerson: true,
  frontView: false,    // V toggles front camera
  freelook: false,     // Alt = freelook (camera orbits, player keeps direction)
  freelookYaw: 0,      // separate yaw for freelook
  freelookPitch: 0,
}

// --- Input ---
const keys: Record<string, boolean> = {}
let isPointerLocked = false
let isRightMouseDown = false
let isLeftMouseDown = false
let isBothMouseDown = false

const crosshair = document.getElementById('crosshair')!
const instructions = document.getElementById('instructions')!

document.addEventListener('keydown', (e) => {
  keys[e.code] = true
  if (e.code === 'Space') e.preventDefault()
  if (e.code === 'KeyV') orbit.frontView = !orbit.frontView
  if (e.code === 'KeyZ' && !chatActive) player.isProne = !player.isProne

  // Alt = start freelook (prevent default to stop browser menu)
  if (e.code === 'AltLeft' || e.code === 'AltRight') {
    e.preventDefault()
    if (!orbit.freelook) {
      orbit.freelook = true
      orbit.freelookYaw = 0
      orbit.freelookPitch = player.pitch
    }
  }
})
document.addEventListener('keyup', (e) => {
  keys[e.code] = false

  if (e.code === 'AltLeft' || e.code === 'AltRight') {
    orbit.freelook = false
    orbit.freelookYaw = 0
  }
})

// Prevent Alt from stealing focus/blocking other keys
window.addEventListener('keydown', (e) => {
  if (e.altKey) e.preventDefault()
})

canvas.addEventListener('click', () => {
  if (!isPointerLocked) canvas.requestPointerLock()
})

document.addEventListener('pointerlockchange', () => {
  isPointerLocked = document.pointerLockElement === canvas
  crosshair.classList.toggle('active', isPointerLocked)
  instructions.classList.toggle('hidden', isPointerLocked)
})

canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) isLeftMouseDown = true
  if (e.button === 2) isRightMouseDown = true
  isBothMouseDown = isLeftMouseDown && isRightMouseDown
  if (e.button === 2 && !isPointerLocked) canvas.requestPointerLock()
})

canvas.addEventListener('mouseup', (e) => {
  if (e.button === 0) isLeftMouseDown = false
  if (e.button === 2) isRightMouseDown = false
  isBothMouseDown = isLeftMouseDown && isRightMouseDown
})

canvas.addEventListener('contextmenu', (e) => e.preventDefault())

document.addEventListener('mousemove', (e) => {
  if (!isPointerLocked) return
  const sensitivity = 0.002

  if (orbit.freelook) {
    orbit.freelookYaw += e.movementX * sensitivity
    orbit.freelookPitch += e.movementY * sensitivity
    orbit.freelookPitch = Math.max(-Math.PI / 6, Math.min(Math.PI / 2.2, orbit.freelookPitch))
  } else {
    player.yaw += e.movementX * sensitivity
    player.pitch += e.movementY * sensitivity
    player.pitch = Math.max(-Math.PI / 6, Math.min(Math.PI / 2.2, player.pitch))
  }
})

canvas.addEventListener('wheel', (e) => {
  e.preventDefault()
  orbit.distance += e.deltaY * 0.01
  orbit.distance = Math.max(orbit.minDistance, Math.min(orbit.maxDistance, orbit.distance))
  orbit.thirdPerson = orbit.distance > orbit.minDistance + 0.1
}, { passive: false })

// --- Mobile touch controls ---
const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0

// Joystick state
const joystick = { x: 0, y: 0, active: false, touchId: -1 }
const lookTouch = { id: -1, startX: 0, startY: 0, lastX: 0, lastY: 0 }

if (isMobile) {
  const joystickZone = document.getElementById('joystick-zone')!
  const joystickBase = document.getElementById('joystick-base')!
  const joystickThumb = document.getElementById('joystick-thumb')!
  const btnJump = document.getElementById('btn-jump')!
  const btnSprint = document.getElementById('btn-sprint')!
  const btnCamera = document.getElementById('btn-camera')!

  // Joystick touch
  joystickZone.addEventListener('touchstart', (e) => {
    e.preventDefault()
    const touch = e.changedTouches[0]
    joystick.touchId = touch.identifier
    joystick.active = true
    joystickThumb.classList.add('active')
  })

  joystickZone.addEventListener('touchmove', (e) => {
    e.preventDefault()
    for (const touch of Array.from(e.changedTouches)) {
      if (touch.identifier === joystick.touchId) {
        const rect = joystickBase.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const dx = touch.clientX - cx
        const dy = touch.clientY - cy
        const maxDist = rect.width / 2
        const dist = Math.min(Math.sqrt(dx * dx + dy * dy), maxDist)
        const angle = Math.atan2(dy, dx)

        joystick.x = (Math.cos(angle) * dist) / maxDist
        joystick.y = (Math.sin(angle) * dist) / maxDist

        const thumbX = Math.cos(angle) * dist
        const thumbY = Math.sin(angle) * dist
        joystickThumb.style.transform = `translate(calc(-50% + ${thumbX}px), calc(-50% + ${thumbY}px))`
      }
    }
  })

  const resetJoystick = (e: TouchEvent) => {
    for (const touch of Array.from(e.changedTouches)) {
      if (touch.identifier === joystick.touchId) {
        joystick.x = 0
        joystick.y = 0
        joystick.active = false
        joystick.touchId = -1
        joystickThumb.style.transform = 'translate(-50%, -50%)'
        joystickThumb.classList.remove('active')
      }
    }
  }
  joystickZone.addEventListener('touchend', resetJoystick)
  joystickZone.addEventListener('touchcancel', resetJoystick)

  // Look touch (anywhere on canvas not on controls)
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault()
    if (lookTouch.id === -1) {
      const touch = e.changedTouches[0]
      lookTouch.id = touch.identifier
      lookTouch.startX = touch.clientX
      lookTouch.startY = touch.clientY
      lookTouch.lastX = touch.clientX
      lookTouch.lastY = touch.clientY
    }
  })

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault()
    for (const touch of Array.from(e.changedTouches)) {
      if (touch.identifier === lookTouch.id) {
        const sensitivity = 0.004
        const dx = touch.clientX - lookTouch.lastX
        const dy = touch.clientY - lookTouch.lastY
        player.yaw += dx * sensitivity
        player.pitch += dy * sensitivity
        player.pitch = Math.max(-Math.PI / 6, Math.min(Math.PI / 2.2, player.pitch))
        lookTouch.lastX = touch.clientX
        lookTouch.lastY = touch.clientY
      }
    }
  })

  const resetLook = (e: TouchEvent) => {
    for (const touch of Array.from(e.changedTouches)) {
      if (touch.identifier === lookTouch.id) {
        lookTouch.id = -1
      }
    }
  }
  canvas.addEventListener('touchend', resetLook)
  canvas.addEventListener('touchcancel', resetLook)

  // Action buttons
  btnJump.addEventListener('touchstart', (e) => {
    e.preventDefault()
    keys['Space'] = true
    btnJump.classList.add('active')
  })
  btnJump.addEventListener('touchend', () => {
    keys['Space'] = false
    btnJump.classList.remove('active')
  })

  let sprintOn = false
  btnSprint.addEventListener('touchstart', (e) => {
    e.preventDefault()
    sprintOn = !sprintOn
    keys['ShiftLeft'] = sprintOn
    btnSprint.classList.toggle('active', sprintOn)
  })

  btnCamera.addEventListener('touchstart', (e) => {
    e.preventDefault()
    orbit.frontView = !orbit.frontView
    btnCamera.classList.toggle('active', orbit.frontView)
  })
}

// --- Character (animated model) ---
const character = new Character()

const loadingEl = document.createElement('div')
loadingEl.id = 'loading'
loadingEl.textContent = 'Loading model...'
document.body.appendChild(loadingEl)

// Load rigged model with Meshy animations
character.load(scene, {
  idle: '/models/animations/idle.glb',
  walk: '/models/animations/walk.glb',
  run: '/models/animations/run.glb',
  jump: '/models/animations/jump.glb',
  crouchIdle: '/models/animations/crouch-idle.glb',
  crouchWalk: '/models/animations/crouch-walk.glb',
  prone: '/models/animations/sleeping.glb',
}).then(async () => {
  loadingEl.textContent = 'Loading emotes...'
  // Preload all emotes in parallel
  await Promise.all(EMOTES.map(e => character.loadEmote(e)))
  loadingEl.remove()
  console.log('Character + emotes loaded!')
}).catch((err) => {
  loadingEl.textContent = 'Failed to load model'
  console.error(err)
})

// --- Emote panel ---
const emotePanel = document.getElementById('emote-panel')!
const emoteGrid = document.getElementById('emote-grid')!
const emoteToggle = document.getElementById('emote-toggle')!

EMOTES.forEach((emote) => {
  const btn = document.createElement('button')
  btn.className = 'emote-btn'
  btn.innerHTML = `<span class="icon">${emote.icon}</span><span class="label">${emote.name}</span>`
  btn.title = emote.command
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    triggerEmote(emote)
  })
  emoteGrid.appendChild(btn)
})

emoteToggle.addEventListener('click', (e) => {
  e.stopPropagation()
  emotePanel.classList.toggle('hidden')
})

// Close emote panel on click outside
document.addEventListener('click', () => {
  if (!emotePanel.classList.contains('hidden')) {
    emotePanel.classList.add('hidden')
  }
})

function triggerEmote(emote: Emote) {
  character.playEmote(emote)
  addChatMessage(`* Daniel ${emote.name.toLowerCase()}s`, 'emote-msg')
  emotePanel.classList.add('hidden')
}

// E key toggles emote panel
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && !chatActive) {
    emotePanel.classList.toggle('hidden')
  }
})

// --- Chat system ---
const chatInput = document.getElementById('chat-input') as HTMLInputElement
const chatLog = document.getElementById('chat-log')!
let chatActive = false

function addChatMessage(text: string, className = 'chat-msg') {
  const msg = document.createElement('div')
  msg.className = `chat-msg ${className}`
  msg.textContent = text
  chatLog.appendChild(msg)
  chatLog.scrollTop = chatLog.scrollHeight

  // Auto-remove after 8 seconds
  setTimeout(() => {
    msg.style.transition = 'opacity 0.5s'
    msg.style.opacity = '0'
    setTimeout(() => msg.remove(), 500)
  }, 8000)
}

function handleChatCommand(text: string): boolean {
  const cmd = text.toLowerCase().trim()

  // Check emote commands
  const emote = EMOTES.find(e => e.command === cmd)
  if (emote) {
    triggerEmote(emote)
    return true
  }

  // Built-in commands
  if (cmd === '/stop' || cmd === '/cancel') {
    character.stopEmote()
    addChatMessage('* Stopped emote', 'system-msg')
    return true
  }

  if (cmd === '/help') {
    addChatMessage('Commands: ' + EMOTES.map(e => e.command).join(', ') + ', /stop', 'system-msg')
    return true
  }

  return false
}

document.addEventListener('keydown', (e) => {
  // Enter toggles chat
  if (e.code === 'Enter') {
    if (!chatActive) {
      chatActive = true
      chatInput.classList.add('active')
      chatInput.focus()
      if (isPointerLocked) document.exitPointerLock()
      e.preventDefault()
    } else {
      const text = chatInput.value.trim()
      if (text) {
        if (!handleChatCommand(text)) {
          addChatMessage(`Daniel: ${text}`)
        }
      }
      chatInput.value = ''
      chatInput.classList.remove('active')
      chatInput.blur()
      chatActive = false
      e.preventDefault()
    }
  }

  // Escape closes chat
  if (e.code === 'Escape' && chatActive) {
    chatInput.value = ''
    chatInput.classList.remove('active')
    chatInput.blur()
    chatActive = false
  }
})

// Prevent game input when typing
chatInput.addEventListener('keydown', (e) => {
  e.stopPropagation()
})
chatInput.addEventListener('keyup', (e) => {
  e.stopPropagation()
})

// --- Update loop ---
const clock = new THREE.Clock()

function update(delta: number) {
  // Sprint, crouch & prone
  player.isSprinting = keys['ShiftLeft'] || keys['ShiftRight']
  const wantsCrouch = keys['ControlLeft'] || keys['ControlRight']

  if (player.isProne) {
    player.height = player.proneHeight
  } else if (wantsCrouch && !player.isCrouching) {
    player.isCrouching = true
    player.height = player.crouchHeight
  } else if (!wantsCrouch && player.isCrouching) {
    player.isCrouching = false
    player.height = player.standHeight
  }

  // Cancel prone if moving
  if (player.isProne && (keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'] || keys['Space'])) {
    player.isProne = false
    player.height = player.standHeight
  }

  // Movement
  const moveSpeed = player.speed * (player.isSprinting ? player.sprintMultiplier : 1) * (player.isCrouching ? 0.5 : 1)
  const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw))
  const right = new THREE.Vector3(-forward.z, 0, forward.x)

  const moveDir = new THREE.Vector3()
  if (keys['KeyW'] || keys['ArrowUp'] || isBothMouseDown) moveDir.add(forward)
  if (keys['KeyS'] || keys['ArrowDown']) moveDir.sub(forward)
  if (keys['KeyA'] || keys['ArrowLeft']) moveDir.sub(right)
  if (keys['KeyD'] || keys['ArrowRight']) moveDir.add(right)

  // Mobile joystick input
  if (joystick.active) {
    moveDir.add(forward.clone().multiplyScalar(-joystick.y))
    moveDir.add(right.clone().multiplyScalar(joystick.x))
  }

  if (moveDir.lengthSq() > 0) {
    moveDir.normalize()
    player.velocity.x = moveDir.x * moveSpeed
    player.velocity.z = moveDir.z * moveSpeed
  } else {
    player.velocity.x *= 0.85
    player.velocity.z *= 0.85
  }

  // Jump
  if (keys['Space'] && player.isGrounded) {
    player.velocity.y = player.jumpForce
    player.isGrounded = false
  }

  // Gravity
  player.velocity.y += player.gravity * delta

  // Apply velocity
  player.position.x += player.velocity.x * delta
  player.position.z += player.velocity.z * delta
  player.position.y += player.velocity.y * delta

  // Ground collision
  if (player.position.y <= 0) {
    player.position.y = 0
    player.velocity.y = 0
    player.isGrounded = true
  }

  // Update character model
  const horizontalSpeed = Math.sqrt(player.velocity.x ** 2 + player.velocity.z ** 2)
  character.setPosition(player.position.x, player.position.y, player.position.z)
  character.updateFromMovement(horizontalSpeed, player.isGrounded, player.isCrouching, player.isSprinting, player.isProne)

  if (moveDir.lengthSq() > 0.01) {
    character.setRotation(Math.atan2(moveDir.x, moveDir.z), delta)
  }

  character.update(delta)

  // Show/hide model based on camera mode (always visible during freelook)
  if (character.model) {
    character.model.visible = orbit.thirdPerson || orbit.freelook
  }

  // Camera
  orbit.currentDistance += (orbit.distance - orbit.currentDistance) * 5 * delta

  const eyePos = new THREE.Vector3(
    player.position.x,
    player.position.y + player.height,
    player.position.z
  )

  if (orbit.thirdPerson) {
    // Camera yaw: use freelook offset when Alt is held
    const camYaw = orbit.freelook ? player.yaw + orbit.freelookYaw : player.yaw
    const camPitch = orbit.freelook ? orbit.freelookPitch : player.pitch
    const sign = orbit.frontView ? -1 : 1

    const camOffset = new THREE.Vector3(
      sign * Math.sin(camYaw) * Math.cos(camPitch) * orbit.currentDistance,
      Math.sin(camPitch) * orbit.currentDistance + player.height * 0.5,
      sign * Math.cos(camYaw) * Math.cos(camPitch) * orbit.currentDistance
    )
    camera.position.copy(eyePos).add(camOffset)
    camera.position.y = Math.max(0.3, camera.position.y)
    camera.lookAt(eyePos)
  } else {
    camera.position.copy(eyePos)
    const lookDir = new THREE.Vector3(
      -Math.sin(player.yaw) * Math.cos(player.pitch),
      Math.sin(player.pitch),
      -Math.cos(player.yaw) * Math.cos(player.pitch)
    )
    camera.lookAt(camera.position.clone().add(lookDir))
  }

  // Rotate decorative objects
  for (const obj of sceneObjects) {
    obj.rotation.y += delta * 0.3
  }
}

function animate() {
  requestAnimationFrame(animate)
  const delta = Math.min(clock.getDelta(), 0.1)
  update(delta)
  renderer.render(scene, camera)
}

animate()

// --- Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})
