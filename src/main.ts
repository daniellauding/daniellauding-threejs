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
  yaw: Math.PI,     // camera orbit yaw - start behind player
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
let classicMode = false // false = free camera, true = mouse steers character
let fpsMode = false     // F = toggle first-person FPS mode (FOV 90, locked behind)
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
  // Tab = cycle: Free → Classic → FPS → Free
  if (e.code === 'Tab') {
    e.preventDefault()
    if (fpsMode) {
      // FPS → Free
      fpsMode = false
      classicMode = false
      camera.fov = 60
      cam.distance = 5
      cam.thirdPerson = true
      camera.updateProjectionMatrix()
      if (document.pointerLockElement === canvas) document.exitPointerLock()
      addChatMessage('* Free camera mode', 'system-msg')
    } else if (classicMode) {
      // Classic → FPS
      classicMode = false
      fpsMode = true
      camera.fov = 90
      cam.distance = 0
      cam.currentDistance = 0
      cam.thirdPerson = false
      camera.updateProjectionMatrix()
      canvas.requestPointerLock()
      addChatMessage('* FPS mode (FOV 90, mouse aims)', 'system-msg')
    } else {
      // Free → Classic
      classicMode = true
      addChatMessage('* Classic mode (mouse steers)', 'system-msg')
    }
  }
  // F = quick toggle FPS
  if (e.code === 'KeyF' && !chatActive) {
    fpsMode = !fpsMode
    classicMode = false
    if (fpsMode) {
      camera.fov = 90
      cam.distance = 0
      cam.currentDistance = 0
      cam.thirdPerson = false
      canvas.requestPointerLock()
    } else {
      camera.fov = 60
      cam.distance = 5
      cam.thirdPerson = true
      if (document.pointerLockElement === canvas) document.exitPointerLock()
    }
    camera.updateProjectionMatrix()
    addChatMessage(fpsMode ? '* FPS mode (FOV 90, mouse aims)' : '* Free camera mode', 'system-msg')
  }

  if (e.code === 'AltLeft' || e.code === 'AltRight') {
    e.preventDefault()
    if (!altFreelook) {
      altFreelook = true
      altYawOffset = 0
      if (!fpsMode) canvas.requestPointerLock() // FPS already has pointer lock
    }
  }
})
document.addEventListener('keyup', (e) => {
  keys[e.code] = false
  if (e.code === 'AltLeft' || e.code === 'AltRight') {
    altFreelook = false
    altYawOffset = 0
    // Only exit pointer lock if not in FPS mode
    if (!fpsMode && document.pointerLockElement === canvas) document.exitPointerLock()
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

// Exit FPS mode when pointer lock is lost (Esc)
document.addEventListener('pointerlockchange', () => {
  if (fpsMode && document.pointerLockElement !== canvas) {
    fpsMode = false
    camera.fov = 60
    cam.distance = 5
    cam.thirdPerson = true
    camera.updateProjectionMatrix()
  }
})

// Right-click drag = orbit camera. In FPS mode: mouse always aims.
canvas.addEventListener('mousemove', (e) => {
  const isFpsLocked = fpsMode && document.pointerLockElement === canvas
  if (!isRightMouseDown && !isFpsLocked) return
  const sensitivity = 0.003

  if (fpsMode) {
    // FPS: mouse right = look right, mouse up = look up (natural FPS aiming)
    cam.yaw -= e.movementX * sensitivity
    cam.pitch -= e.movementY * sensitivity
  } else {
    // Third-person orbit: drag right = look right, drag up = look up
    cam.yaw -= e.movementX * sensitivity
    cam.pitch += e.movementY * sensitivity
  }
  cam.pitch = Math.max(-Math.PI / 6, Math.min(Math.PI / 2.2, cam.pitch))

  // Classic mode: right-drag also turns the character
  if (classicMode) {
    player.facingYaw = cam.yaw
  }
})

// Alt+mouse = freelook (pointer locked so no edge limit)
document.addEventListener('mousemove', (e) => {
  if (!altFreelook || document.pointerLockElement !== canvas) return
  const sensitivity = 0.003
  altYawOffset -= e.movementX * sensitivity
  cam.pitch += e.movementY * sensitivity
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

// --- On-screen controls (work with touch AND mouse) ---
const joystick = { x: 0, y: 0, active: false, touchId: -1 }
const lookTouch = { id: -1, startX: 0, startY: 0, lastX: 0, lastY: 0 }

const joystickZone = document.getElementById('joystick-zone')!
const joystickBase = document.getElementById('joystick-base')!
const joystickThumb = document.getElementById('joystick-thumb')!
const btnJump = document.getElementById('btn-jump')!
const btnSprint = document.getElementById('btn-sprint')!
const btnCamera = document.getElementById('btn-camera')!

// --- Joystick: shared logic for touch + mouse ---
function updateJoystickFromPointer(clientX: number, clientY: number) {
  const rect = joystickBase.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const dx = clientX - cx
  const dy = clientY - cy
  const maxDist = rect.width / 2
  const dist = Math.min(Math.sqrt(dx * dx + dy * dy), maxDist)
  const angle = Math.atan2(dy, dx)

  joystick.x = (Math.cos(angle) * dist) / maxDist
  joystick.y = (Math.sin(angle) * dist) / maxDist

  const thumbX = Math.cos(angle) * dist
  const thumbY = Math.sin(angle) * dist
  joystickThumb.style.transform = `translate(calc(-50% + ${thumbX}px), calc(-50% + ${thumbY}px))`
}

function resetJoystickState() {
  joystick.x = 0
  joystick.y = 0
  joystick.active = false
  joystick.touchId = -1
  joystickThumb.style.transform = 'translate(-50%, -50%)'
  joystickThumb.classList.remove('active')
}

// Joystick: touch
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
      updateJoystickFromPointer(touch.clientX, touch.clientY)
    }
  }
})

const resetJoystickTouch = (e: TouchEvent) => {
  for (const touch of Array.from(e.changedTouches)) {
    if (touch.identifier === joystick.touchId) resetJoystickState()
  }
}
joystickZone.addEventListener('touchend', resetJoystickTouch)
joystickZone.addEventListener('touchcancel', resetJoystickTouch)

// Joystick: mouse (click-drag on joystick)
let joystickMouseDown = false
joystickZone.addEventListener('mousedown', (e) => {
  e.preventDefault()
  joystickMouseDown = true
  joystick.active = true
  joystickThumb.classList.add('active')
  updateJoystickFromPointer(e.clientX, e.clientY)
})

document.addEventListener('mousemove', (e) => {
  if (joystickMouseDown) {
    updateJoystickFromPointer(e.clientX, e.clientY)
  }
})

document.addEventListener('mouseup', () => {
  if (joystickMouseDown) {
    joystickMouseDown = false
    resetJoystickState()
  }
})

// Look touch (swipe on canvas)
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault()
  if (lookTouch.id === -1) {
    const touch = e.changedTouches[0]
    lookTouch.id = touch.identifier
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
      cam.pitch += dy * sensitivity
      cam.pitch = Math.max(-Math.PI / 6, Math.min(Math.PI / 2.2, cam.pitch))
      lookTouch.lastX = touch.clientX
      lookTouch.lastY = touch.clientY
    }
  }
})

const resetLook = (e: TouchEvent) => {
  for (const touch of Array.from(e.changedTouches)) {
    if (touch.identifier === lookTouch.id) lookTouch.id = -1
  }
}
canvas.addEventListener('touchend', resetLook)
canvas.addEventListener('touchcancel', resetLook)

// --- Action buttons (work with touch + mouse click) ---
let sprintOn = false

// Helper: add both touch and click handlers
function setupBarButton(id: string, onActivate: () => void, onDeactivate?: () => void) {
  const btn = document.getElementById(id)
  if (!btn) return
  // Touch
  btn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); onActivate() })
  if (onDeactivate) btn.addEventListener('touchend', () => onDeactivate())
  // Mouse
  btn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); onActivate() })
  if (onDeactivate) btn.addEventListener('mouseup', () => onDeactivate())
  btn.addEventListener('click', (e) => { e.stopPropagation() }) // prevent canvas click-through
}

setupBarButton('btn-jump',
  () => { keys['Space'] = true; btnJump.classList.add('active') },
  () => { keys['Space'] = false; btnJump.classList.remove('active') }
)

setupBarButton('btn-sprint', () => {
  sprintOn = !sprintOn
  keys['ShiftLeft'] = sprintOn
  btnSprint.classList.toggle('active', sprintOn)
})

setupBarButton('btn-camera', () => {
  cam.frontView = !cam.frontView
  btnCamera.classList.toggle('active', cam.frontView)
})

setupBarButton('btn-emote-mobile', () => {
  document.getElementById('emote-panel')!.classList.toggle('hidden')
})

setupBarButton('btn-chat-mobile', () => {
  chatActive = true
  const input = document.getElementById('chat-input') as HTMLInputElement
  input.classList.add('active')
  input.focus()
})

// --- Gamepad support ---
const gamepadState: {
  connected: boolean; index: number;
  prev: Record<number, boolean>;
  menuIndex?: number; emoteIndex?: number;
} = {
  connected: false, index: -1,
  prev: {},
}

// Quick-chat options for gamepad users (no keyboard needed)
const QUICK_CHATS = [
  'Hello!', 'GG!', 'Nice!', 'Thanks!', 'Bye!',
  '/dance', '/backflip', '/box', '/sleep', '/spin',
]
let quickChatOpen = false
let quickChatIndex = 0

window.addEventListener('gamepadconnected', (e) => {
  gamepadState.connected = true
  gamepadState.index = e.gamepad.index
  addChatMessage(`* Gamepad connected: ${e.gamepad.id}`, 'system-msg')
})

window.addEventListener('gamepaddisconnected', () => {
  gamepadState.connected = false
  gamepadState.index = -1
  addChatMessage('* Gamepad disconnected', 'system-msg')
})

function pollGamepad() {
  if (!gamepadState.connected) return
  const gp = navigator.getGamepads()[gamepadState.index]
  if (!gp) return

  // Left stick = movement (axes 0, 1)
  const deadzone = 0.15
  const lx = Math.abs(gp.axes[0]) > deadzone ? gp.axes[0] : 0
  const ly = Math.abs(gp.axes[1]) > deadzone ? gp.axes[1] : 0
  joystick.x = lx
  joystick.y = ly
  joystick.active = lx !== 0 || ly !== 0

  // Right stick = camera (axes 2, 3)
  const rx = Math.abs(gp.axes[2]) > deadzone ? gp.axes[2] : 0
  const ry = Math.abs(gp.axes[3]) > deadzone ? gp.axes[3] : 0
  if (rx !== 0 || ry !== 0) {
    cam.yaw -= rx * 0.04
    cam.pitch += ry * 0.04
    cam.pitch = Math.max(-Math.PI / 6, Math.min(Math.PI / 2.2, cam.pitch))
  }

  // Helper: detect button press (not hold)
  function pressed(i: number): boolean {
    const now = gp!.buttons[i]?.pressed || false
    const was = gamepadState.prev[i] || false
    gamepadState.prev[i] = now
    return now && !was
  }

  // --- Context-sensitive controls ---
  const emotePanel = document.getElementById('emote-panel')!
  const emoteOpen = !emotePanel.classList.contains('hidden')

  if (menuOpen) {
    // IN MENU: D-pad navigates, A selects
    const btns = menuEl.querySelectorAll<HTMLButtonElement>('.menu-btn')
    const menuIndex = gamepadState.menuIndex ?? 0

    if (pressed(12)) gamepadState.menuIndex = Math.max(0, menuIndex - 1) // D-up
    if (pressed(13)) gamepadState.menuIndex = Math.min(btns.length - 1, menuIndex + 1) // D-down

    // Highlight current
    btns.forEach((b, i) => b.classList.toggle('active', i === (gamepadState.menuIndex ?? 0)))

    if (pressed(0)) btns[gamepadState.menuIndex ?? 0]?.click() // A = select
    if (pressed(1)) toggleMenu() // B = close

  } else if (quickChatOpen) {
    // IN QUICK-CHAT: D-pad picks, A sends, B closes
    if (pressed(12)) quickChatIndex = (quickChatIndex - 1 + QUICK_CHATS.length) % QUICK_CHATS.length // D-up
    if (pressed(13)) quickChatIndex = (quickChatIndex + 1) % QUICK_CHATS.length // D-down

    updateQuickChatUI()

    if (pressed(0)) { // A = send
      const msg = QUICK_CHATS[quickChatIndex]
      if (msg.startsWith('/')) {
        handleChatCommand(msg)
      } else {
        showSpeechBubble(msg, false)
      }
      quickChatOpen = false
      updateQuickChatUI()
    }
    if (pressed(1)) { // B = close
      quickChatOpen = false
      updateQuickChatUI()
    }

  } else if (emoteOpen) {
    // IN EMOTE PANEL: D-pad navigates, A triggers, B closes
    const emoteBtns = emotePanel.querySelectorAll<HTMLButtonElement>('.emote-btn')
    const ei = gamepadState.emoteIndex ?? 0

    if (pressed(12)) gamepadState.emoteIndex = Math.max(0, ei - 4) // D-up (grid row)
    if (pressed(13)) gamepadState.emoteIndex = Math.min(emoteBtns.length - 1, ei + 4) // D-down
    if (pressed(14)) gamepadState.emoteIndex = Math.max(0, ei - 1) // D-left
    if (pressed(15)) gamepadState.emoteIndex = Math.min(emoteBtns.length - 1, ei + 1) // D-right

    emoteBtns.forEach((b, i) => b.classList.toggle('gp-focus', i === (gamepadState.emoteIndex ?? 0)))

    if (pressed(0)) emoteBtns[gamepadState.emoteIndex ?? 0]?.click() // A = select
    if (pressed(1)) emotePanel.classList.add('hidden') // B = close

  } else {
    // GAMEPLAY: normal controls
    if (gp.buttons[0]?.pressed) keys['Space'] = true // A = jump (hold ok)

    if (pressed(1)) { // B = emote panel
      gamepadState.emoteIndex = 0
      emotePanel.classList.toggle('hidden')
    }

    if (pressed(2)) { // X = quick chat (gamepad-friendly, no keyboard needed)
      quickChatOpen = true
      quickChatIndex = 0
      updateQuickChatUI()
    }

    if (pressed(3)) { // Y = cycle camera mode
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab' }))
    }

    if (pressed(12)) cam.frontView = !cam.frontView // D-up = front view

    if (pressed(9)) toggleMenu() // Start = menu
  }

  // Triggers = sprint (always, regardless of context)
  if (gp.buttons[6]?.pressed || gp.buttons[7]?.pressed) {
    keys['ShiftLeft'] = true
  } else if (gamepadState.connected) {
    keys['ShiftLeft'] = sprintOn
  }
}

// --- Quick chat UI (for gamepad) ---
const quickChatEl = document.createElement('div')
quickChatEl.id = 'quick-chat'
quickChatEl.className = 'hidden'
document.body.appendChild(quickChatEl)

function updateQuickChatUI() {
  if (!quickChatOpen) {
    quickChatEl.className = 'hidden'
    return
  }
  quickChatEl.className = ''
  quickChatEl.innerHTML = QUICK_CHATS.map((msg, i) =>
    `<div class="qc-item${i === quickChatIndex ? ' active' : ''}">${msg}</div>`
  ).join('')
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
}).then(() => {
  loadingEl.remove()
  console.log('Character loaded! Emotes load on first use.')
}).catch((err) => {
  loadingEl.textContent = 'Failed to load model'
  console.error(err)
})

// --- Emote panel ---
const emotePanel = document.getElementById('emote-panel')!
const emoteGrid = document.getElementById('emote-grid')!
const emoteToggle = document.getElementById('emote-toggle')

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

emoteToggle?.addEventListener('click', (e) => {
  e.stopPropagation()
  emotePanel.classList.toggle('hidden')
})

// Close emote panel on click outside
document.addEventListener('click', () => {
  if (!emotePanel.classList.contains('hidden')) {
    emotePanel.classList.add('hidden')
  }
})

async function triggerEmote(emote: Emote) {
  await character.loadEmote(emote) // lazy-load on first use (no-op if already loaded)
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
    addChatMessage('Commands: /say, /yell, ' + EMOTES.map(e => e.command).join(', ') + ', /stop, /fps', 'system-msg')
    return true
  }

  if (cmd === '/fps') {
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }))
    return true
  }

  // /say <text> = speech bubble
  if (text.toLowerCase().startsWith('/say ')) {
    const msg = text.slice(5).trim()
    if (msg) showSpeechBubble(msg, false)
    return true
  }

  // /yell <text> = red speech bubble
  if (text.toLowerCase().startsWith('/yell ')) {
    const msg = text.slice(6).trim()
    if (msg) showSpeechBubble(msg, true)
    return true
  }

  return false
}

// --- Speech bubble ---
const bubbleEl = document.createElement('div')
bubbleEl.id = 'speech-bubble'
bubbleEl.className = 'hidden'
document.body.appendChild(bubbleEl)

let bubbleTimeout: ReturnType<typeof setTimeout> | null = null

function showSpeechBubble(text: string, isYell: boolean) {
  bubbleEl.textContent = isYell ? text.toUpperCase() + '!' : text
  bubbleEl.className = isYell ? 'yell' : ''
  addChatMessage(isYell ? `Daniel yells: ${text.toUpperCase()}!` : `Daniel says: ${text}`, isYell ? 'yell-msg' : 'chat-msg')

  if (bubbleTimeout) clearTimeout(bubbleTimeout)
  bubbleTimeout = setTimeout(() => {
    bubbleEl.className = 'hidden'
  }, isYell ? 5000 : 4000)
}

// Update bubble position each frame (called from update loop)
function updateBubblePosition() {
  if (bubbleEl.classList.contains('hidden')) return
  if (!character.model) return

  const headPos = new THREE.Vector3(
    player.position.x,
    player.position.y + player.height + 0.5,
    player.position.z
  )
  headPos.project(camera)

  const x = (headPos.x * 0.5 + 0.5) * window.innerWidth
  const y = (-headPos.y * 0.5 + 0.5) * window.innerHeight
  bubbleEl.style.left = `${x}px`
  bubbleEl.style.top = `${y}px`
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
          // No slash command = treat as /say
          showSpeechBubble(text, false)
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

// --- GUI Menu (Esc or Start button) ---
const menuEl = document.createElement('div')
menuEl.id = 'game-menu'
menuEl.className = 'hidden'
menuEl.innerHTML = `
  <div class="menu-panel">
    <h2>Menu</h2>
    <button class="menu-btn" data-action="resume">Resume</button>
    <button class="menu-btn" data-action="env-default">Default World</button>
    <button class="menu-btn" data-action="env-beach">Beach</button>
    <button class="menu-btn" data-action="env-forest">Forest</button>
    <button class="menu-btn" data-action="env-city">City</button>
    <div class="menu-divider"></div>
    <button class="menu-btn" data-action="help">Controls Help</button>
  </div>
`
document.body.appendChild(menuEl)

let menuOpen = false

function toggleMenu() {
  menuOpen = !menuOpen
  menuEl.className = menuOpen ? '' : 'hidden'
}

// Menu button clicks
menuEl.addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  const action = target.dataset.action
  if (!action) return

  if (action === 'resume') {
    toggleMenu()
  } else if (action.startsWith('env-')) {
    const envName = action.slice(4) as import('./environment').EnvironmentType
    switchEnvironment(envName)
    toggleMenu()
    addChatMessage(`* Switched to ${envName} environment`, 'system-msg')
  } else if (action === 'help') {
    addChatMessage('* Controls: WASD move | Right-drag orbit | Tab mode | E emotes | Enter chat | G interact | Z prone | Space jump | Shift sprint | Esc menu', 'system-msg')
    toggleMenu()
  }
})

// Esc opens menu (when not in chat)
document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && !chatActive) {
    toggleMenu()
  }
})

// --- Environment switching ---
import { ENVIRONMENTS, createWater, animateWater, createTree, createPalmTree, scatter, type EnvironmentType } from './environment'

let currentEnv: EnvironmentType = 'default'
let waterMesh: THREE.Mesh | null = null
let envObjects: THREE.Object3D[] = []

function switchEnvironment(envType: EnvironmentType) {
  const config = ENVIRONMENTS[envType]
  currentEnv = envType

  // Remove old env objects
  for (const obj of envObjects) {
    scene.remove(obj)
    obj.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
      }
    })
  }
  envObjects = []

  // Remove old water
  if (waterMesh) { scene.remove(waterMesh); waterMesh = null }

  // Update ground color
  const groundMat = ground.material as THREE.MeshStandardMaterial
  if (groundMat.vertexColors) {
    // Recolor vertices
    const colors = ground.geometry.attributes.color
    const pos = ground.geometry.attributes.position
    const baseColor = new THREE.Color(config.groundColor)
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getY(i)
      const dist = Math.sqrt(x * x + z * z) / 100
      const t = Math.min(dist, 1)
      colors.setXYZ(i,
        THREE.MathUtils.lerp(baseColor.r, baseColor.r * 0.5, t),
        THREE.MathUtils.lerp(baseColor.g, baseColor.g * 0.5, t),
        THREE.MathUtils.lerp(baseColor.b, baseColor.b * 0.5, t)
      )
    }
    colors.needsUpdate = true
  }

  // Update fog
  scene.fog = new THREE.FogExp2(config.fogColor, config.fogDensity)

  // Update sky
  const skyColors = sky.geometry.attributes.color
  for (let i = 0; i < sky.geometry.attributes.position.count; i++) {
    const y = sky.geometry.attributes.position.getY(i)
    const t = (y / 400 + 1) * 0.5
    skyColors.setXYZ(i,
      THREE.MathUtils.lerp(config.skyBottomColor[0], config.skyTopColor[0], t * t),
      THREE.MathUtils.lerp(config.skyBottomColor[1], config.skyTopColor[1], t),
      THREE.MathUtils.lerp(config.skyBottomColor[2], config.skyTopColor[2], Math.sqrt(t))
    )
  }
  skyColors.needsUpdate = true

  // Update lighting
  dirLight.color.set(config.sunColor)
  dirLight.intensity = config.sunIntensity
  dirLight.position.copy(config.sunPosition)

  // Add environment-specific objects
  if (envType === 'beach') {
    waterMesh = createWater(200)
    scene.add(waterMesh)
    envObjects.push(...scatter(() => createPalmTree(4 + Math.random() * 3), 15, 80, scene, 8))
  } else if (envType === 'forest') {
    envObjects.push(...scatter(() => createTree(2 + Math.random() * 3), 40, 80, scene, 6))
  }
}

// --- Update loop ---
const clock = new THREE.Clock()

function update(delta: number) {
  // Gamepad polling
  pollGamepad()

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
  // Camera is at offset (sin(yaw), _, cos(yaw)) from player.
  // "Forward" = away from camera = opposite of offset direction.
  const camForward = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw))
  const camRight = new THREE.Vector3(-camForward.z, 0, camForward.x)

  // Arrow left/right = rotate whole body + direction (WoW turn keys)
  const turnSpeed = 2.5
  let isTurning = false
  if (keys['ArrowLeft']) { player.facingYaw += turnSpeed * delta; isTurning = true }
  if (keys['ArrowRight']) { player.facingYaw -= turnSpeed * delta; isTurning = true }

  // Arrow up/down = move in character facing direction
  const facingForward = new THREE.Vector3(Math.sin(player.facingYaw), 0, Math.cos(player.facingYaw))

  // In classic mode, WASD uses character facing direction. In free mode, uses camera.
  const fwd = classicMode ? facingForward : camForward
  const rgt = classicMode
    ? new THREE.Vector3(-facingForward.z, 0, facingForward.x)
    : camRight

  const moveDir = new THREE.Vector3()
  if (keys['KeyW'] || isBothMouseDown) moveDir.add(fwd)
  if (keys['KeyS']) moveDir.sub(fwd)
  if (keys['KeyA']) moveDir.sub(rgt)
  if (keys['KeyD']) moveDir.add(rgt)
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

  // World boundary (keep on ground plane, 95m radius)
  const worldRadius = 95
  const distFromCenter = Math.sqrt(player.position.x ** 2 + player.position.z ** 2)
  if (distFromCenter > worldRadius) {
    const angle = Math.atan2(player.position.x, player.position.z)
    player.position.x = Math.sin(angle) * worldRadius
    player.position.z = Math.cos(angle) * worldRadius
    player.velocity.x = 0
    player.velocity.z = 0
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

  // Character faces movement direction, or turns with arrow keys
  if (moveDir.lengthSq() > 0.01 && !isTurning) {
    player.facingYaw = Math.atan2(moveDir.x, moveDir.z)
  }
  // Always apply rotation (arrow keys change facingYaw directly)
  character.setRotation(player.facingYaw, delta)

  character.update(delta)

  // FPS mode: character faces where camera looks, show partial model (hands/arms)
  if (fpsMode) {
    player.facingYaw = cam.yaw + Math.PI
    character.setRotation(player.facingYaw, delta)
  }

  // Show/hide model - in FPS show body (camera clips through head naturally)
  if (character.model) {
    character.model.visible = fpsMode || cam.thirdPerson
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
    // First person / FPS: camera at eye level
    const fpsYaw = cam.yaw + altYawOffset // Alt = look around freely in FPS
    camera.position.copy(eyePos)
    // Slight forward offset so you can see your own hands/body below
    const lookFwd = new THREE.Vector3(-Math.sin(fpsYaw), 0, -Math.cos(fpsYaw))
    camera.position.add(lookFwd.clone().multiplyScalar(0.15))

    const lookDir = new THREE.Vector3(
      -Math.sin(fpsYaw) * Math.cos(cam.pitch),
      Math.sin(cam.pitch),
      -Math.cos(fpsYaw) * Math.cos(cam.pitch)
    )
    camera.lookAt(camera.position.clone().add(lookDir))
  }

  // Rotate decorative objects
  for (const obj of sceneObjects) {
    obj.rotation.y += delta * 0.3
  }

  updateBubblePosition()

  // Animate water if in beach env
  if (waterMesh && currentEnv === 'beach') {
    animateWater(waterMesh, clock.elapsedTime)
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
