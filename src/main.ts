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
  facingYaw: 0,  // direction character faces (only changes with movement/both-mouse)
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

// --- Camera (WoW-style: mouse always controls camera, not character) ---
const cam = {
  yaw: 0,           // camera orbit yaw (mouse controls this)
  pitch: 0.3,       // camera orbit pitch
  distance: 5,
  minDistance: 1.5,
  maxDistance: 30,
  currentDistance: 5,
  thirdPerson: true,
  frontView: false,  // V toggles
}

// --- Input ---
const keys: Record<string, boolean> = {}
let chatActive = false
let isRightMouseDown = false
let isLeftMouseDown = false
let isBothMouseDown = false

document.getElementById('instructions')! // ref kept in DOM

let altFreelook = false
let altYawOffset = 0

document.addEventListener('keydown', (e) => {
  if (chatActive) return
  keys[e.code] = true
  if (e.code === 'Space') e.preventDefault()
  if (e.code === 'KeyV') cam.frontView = !cam.frontView
  if (e.code === 'KeyZ') player.isProne = !player.isProne

  if (e.code === 'AltLeft' || e.code === 'AltRight') {
    e.preventDefault()
    if (!altFreelook) {
      altFreelook = true
      altYawOffset = 0
      canvas.requestPointerLock() // lock pointer so mouse can orbit freely
    }
  }
})
document.addEventListener('keyup', (e) => {
  keys[e.code] = false
  if (e.code === 'AltLeft' || e.code === 'AltRight') {
    altFreelook = false
    altYawOffset = 0
    if (document.pointerLockElement === canvas) document.exitPointerLock()
  }
})

// Prevent Alt from blocking other keys
window.addEventListener('keydown', (e) => {
  if (e.altKey) e.preventDefault()
})

// Right-click drag = orbit camera. Left click = free for clicking objects.
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) isLeftMouseDown = true
  if (e.button === 2) isRightMouseDown = true
  isBothMouseDown = isLeftMouseDown && isRightMouseDown
})

canvas.addEventListener('mouseup', (e) => {
  if (e.button === 0) isLeftMouseDown = false
  if (e.button === 2) isRightMouseDown = false
  isBothMouseDown = isLeftMouseDown && isRightMouseDown
})

canvas.addEventListener('contextmenu', (e) => e.preventDefault())

// Right-click drag = orbit camera (uses movementX for smooth drag)
canvas.addEventListener('mousemove', (e) => {
  if (!isRightMouseDown) return
  const sensitivity = 0.003
  cam.yaw -= e.movementX * sensitivity
  cam.pitch -= e.movementY * sensitivity
  cam.pitch = Math.max(-Math.PI / 6, Math.min(Math.PI / 2.2, cam.pitch))
})

// Alt+mouse = freelook (pointer locked so no edge limit)
document.addEventListener('mousemove', (e) => {
  if (!altFreelook || document.pointerLockElement !== canvas) return
  const sensitivity = 0.003
  altYawOffset -= e.movementX * sensitivity
  cam.pitch -= e.movementY * sensitivity
  cam.pitch = Math.max(-Math.PI / 6, Math.min(Math.PI / 2.2, cam.pitch))
})

// Scroll = zoom
canvas.addEventListener('wheel', (e) => {
  e.preventDefault()
  cam.distance += e.deltaY * 0.01
  cam.distance = Math.max(cam.minDistance, Math.min(cam.maxDistance, cam.distance))
  cam.thirdPerson = cam.distance > cam.minDistance + 0.1
}, { passive: false })

// Left click on objects = raycasting (placeholder for future interaction)
const raycaster = new THREE.Raycaster()
const mouseNDC = new THREE.Vector2()

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect()
  mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(mouseNDC, camera)
  const hits = raycaster.intersectObjects(sceneObjects)
  if (hits.length > 0) {
    const obj = hits[0].object as THREE.Mesh
    const mat = obj.material as THREE.MeshStandardMaterial
    // Flash the object on click
    const origEmissive = mat.emissive.getHex()
    mat.emissive.set(0xffffff)
    setTimeout(() => mat.emissive.setHex(origEmissive), 200)
    console.log('Clicked:', obj.geometry.type)
  }
})

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
        cam.yaw -= dx * sensitivity
        cam.pitch -= dy * sensitivity
        cam.pitch = Math.max(-Math.PI / 6, Math.min(Math.PI / 2.2, cam.pitch))
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
    cam.frontView = !cam.frontView
    btnCamera.classList.toggle('active', cam.frontView)
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
      // focus chat input
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

// Prevent game input when typing, but let Enter and Escape through
chatInput.addEventListener('keydown', (e) => {
  if (e.code !== 'Enter' && e.code !== 'Escape') e.stopPropagation()
})
chatInput.addEventListener('keyup', (e) => {
  if (e.code !== 'Enter' && e.code !== 'Escape') e.stopPropagation()
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

  // Movement relative to CAMERA direction (WoW-style)
  const moveSpeed = player.speed * (player.isSprinting ? player.sprintMultiplier : 1) * (player.isCrouching ? 0.5 : 1)
  const camForward = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw))
  const camRight = new THREE.Vector3(-camForward.z, 0, camForward.x)

  // Arrow left/right = rotate character (like WoW turn keys)
  const turnSpeed = 2.5
  if (keys['ArrowLeft']) player.facingYaw -= turnSpeed * delta
  if (keys['ArrowRight']) player.facingYaw += turnSpeed * delta

  // Arrow up/down = move in character facing direction
  const facingForward = new THREE.Vector3(-Math.sin(player.facingYaw), 0, -Math.cos(player.facingYaw))

  const moveDir = new THREE.Vector3()
  if (keys['KeyW'] || isBothMouseDown) moveDir.add(camForward)
  if (keys['KeyS']) moveDir.sub(camForward)
  if (keys['KeyA']) moveDir.sub(camRight)
  if (keys['KeyD']) moveDir.add(camRight)
  if (keys['ArrowUp']) moveDir.add(facingForward)
  if (keys['ArrowDown']) moveDir.sub(facingForward)

  // Mobile joystick input
  if (joystick.active) {
    moveDir.add(camForward.clone().multiplyScalar(-joystick.y))
    moveDir.add(camRight.clone().multiplyScalar(joystick.x))
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

  // Object collision (simple sphere-based)
  const playerRadius = 0.5
  for (const obj of sceneObjects) {
    const objBox = new THREE.Box3().setFromObject(obj)
    const objCenter = objBox.getCenter(new THREE.Vector3())
    const objSize = objBox.getSize(new THREE.Vector3())
    const objRadius = Math.max(objSize.x, objSize.z) * 0.5

    const dx = player.position.x - objCenter.x
    const dz = player.position.z - objCenter.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    const minDist = playerRadius + objRadius

    if (dist < minDist && dist > 0) {
      // Push player out
      const pushX = (dx / dist) * (minDist - dist)
      const pushZ = (dz / dist) * (minDist - dist)
      player.position.x += pushX
      player.position.z += pushZ
      // Kill velocity in collision direction
      player.velocity.x *= 0.3
      player.velocity.z *= 0.3
    }
  }

  // Update character model
  const horizontalSpeed = Math.sqrt(player.velocity.x ** 2 + player.velocity.z ** 2)
  character.setPosition(player.position.x, player.position.y, player.position.z)
  character.updateFromMovement(horizontalSpeed, player.isGrounded, player.isCrouching, player.isSprinting, player.isProne)

  // Character faces movement direction (not camera direction)
  if (moveDir.lengthSq() > 0.01) {
    player.facingYaw = Math.atan2(moveDir.x, moveDir.z)
    character.setRotation(player.facingYaw, delta)
  }

  character.update(delta)

  // Show/hide model based on camera mode
  if (character.model) {
    character.model.visible = cam.thirdPerson
  }

  // Camera orbits around player (WoW-style: independent of character facing)
  cam.currentDistance += (cam.distance - cam.currentDistance) * 5 * delta

  const eyePos = new THREE.Vector3(
    player.position.x,
    player.position.y + player.height,
    player.position.z
  )

  if (cam.thirdPerson) {
    const sign = cam.frontView ? -1 : 1
    const effectiveYaw = cam.yaw + altYawOffset
    const camOffset = new THREE.Vector3(
      sign * Math.sin(effectiveYaw) * Math.cos(cam.pitch) * cam.currentDistance,
      Math.sin(cam.pitch) * cam.currentDistance + player.height * 0.5,
      sign * Math.cos(effectiveYaw) * Math.cos(cam.pitch) * cam.currentDistance
    )
    camera.position.copy(eyePos).add(camOffset)
    camera.position.y = Math.max(0.3, camera.position.y)
    camera.lookAt(eyePos)
  } else {
    // First person: camera uses cam.yaw for look direction
    camera.position.copy(eyePos)
    const lookDir = new THREE.Vector3(
      -Math.sin(cam.yaw) * Math.cos(cam.pitch),
      Math.sin(cam.pitch),
      -Math.cos(cam.yaw) * Math.cos(cam.pitch)
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
