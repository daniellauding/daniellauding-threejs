export interface Emote {
  name: string
  command: string   // /dance, /sleep, etc
  icon: string      // emoji
  file: string      // GLB filename
  loop: boolean     // loop or play once
  category: 'dance' | 'action' | 'pose' | 'sport'
}

export const EMOTES: Emote[] = [
  // Dances
  { name: 'Dance',        command: '/dance',      icon: '\u{1F57A}', file: 'dance.glb',        loop: true,  category: 'dance' },
  { name: 'Bass Beats',   command: '/bass',       icon: '\u{1F3B6}', file: 'bass-beats.glb',   loop: true,  category: 'dance' },
  { name: 'Cardio Dance', command: '/cardio',     icon: '\u{1F4AA}', file: 'cardio-dance.glb', loop: true,  category: 'dance' },

  // Actions
  { name: 'Backflip',     command: '/backflip',   icon: '\u{1F938}', file: 'backflip.glb',     loop: false, category: 'action' },
  { name: 'Spin Jump',    command: '/spin',       icon: '\u{1F300}', file: 'spin-jump.glb',    loop: false, category: 'action' },
  { name: 'Boxing',       command: '/box',        icon: '\u{1F94A}', file: 'boxing.glb',       loop: true,  category: 'action' },
  { name: 'Block',        command: '/block',      icon: '\u{1F6E1}', file: 'block.glb',        loop: true,  category: 'action' },
  { name: 'Archery',      command: '/archery',    icon: '\u{1F3F9}', file: 'archery.glb',      loop: false, category: 'action' },

  // Poses
  { name: 'Sleep',        command: '/sleep',      icon: '\u{1F634}', file: 'sleeping.glb',     loop: true,  category: 'pose' },
  { name: 'Crawl',        command: '/crawl',      icon: '\u{1F40D}', file: 'crawl.glb',        loop: true,  category: 'pose' },
  { name: 'Crawl Back',   command: '/crawlback',  icon: '\u{23EA}',  file: 'crawl-back.glb',   loop: true,  category: 'pose' },

  // Sport
  { name: 'Air Squat',    command: '/squat',      icon: '\u{1F3CB}', file: 'air-squat.glb',    loop: true,  category: 'sport' },
  { name: 'Burpee',       command: '/burpee',     icon: '\u{1F525}', file: 'burpee.glb',       loop: true,  category: 'sport' },
]
