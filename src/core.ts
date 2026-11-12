export const APP_PREFIX = 'https://acsdd.github.io/ArtistWave/'

export function isArtistWaveMiniUrl(raw: string, prefix: string = APP_PREFIX): boolean {
  try {
    const base = new URL(prefix)
    const target = new URL(raw)
    return (
      target.origin === base.origin &&
      target.pathname === `${base.pathname}mini-player.html`
    )
  } catch {
    return false
  }
}

export type ArtistWaveMode = 'audio' | 'studio' | 'youtube'

export interface ProbeState {
  mini?: unknown
  mode?: unknown
}

export interface Probe {
  mini: boolean
  mode: ArtistWaveMode
}

export function parseProbe(raw: ProbeState | null | undefined): Probe {
  const mini = raw?.mini === true
  const mode = raw?.mode === 'studio' || raw?.mode === 'youtube' ? raw.mode : 'audio'
  return { mini, mode }
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface WorkArea {
  x: number
  y: number
  width: number
  height: number
}

export function computeMiniBounds(workArea: WorkArea, restore: Rect): Rect {
  const width = Math.min(380, workArea.width - 24)
  const height = Math.min(workArea.height, restore.height)
  const x = Math.max(workArea.x, workArea.x + workArea.width - width - 26)
  return { x, y: workArea.y, width, height }
}

export interface ArtistWaveQueueItem {
  title: string
  artist: string
  index: number
  source: 'smart' | 'library'
}

export interface ArtistWaveSnapshot {
  title: string
  artist: string
  cover: string
  source: string
  playing: boolean
  currentTime: number
  duration: number
  volume: number
  favorite: boolean
  hasTrack: boolean
  shuffle: boolean
  repeat: string
  queueLength: number
  upNext: ArtistWaveQueueItem[]
}

export interface SiteState {
  title?: unknown
  artist?: unknown
  cover?: unknown
  source?: unknown
  playing?: unknown
  currentTime?: unknown
  duration?: unknown
  volume?: unknown
  favorite?: unknown
  hasTrack?: unknown
  shuffle?: unknown
  repeat?: unknown
  queueLength?: unknown
  upNext?: unknown
}

const MAX_UP_NEXT = 4

function clockSafe(value: unknown, maximum?: number): number {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) return 0
  if (maximum !== undefined && maximum > 0) return Math.min(number, maximum)
  return number
}

export function normalizeSnapshot(raw: SiteState): ArtistWaveSnapshot {
  const duration = clockSafe(raw.duration)
  const cover = typeof raw.cover === 'string' && /^https:\/\//i.test(raw.cover) ? raw.cover : ''
  const repeat = typeof raw.repeat === 'string' ? raw.repeat : 'Repeat: off'
  const upNext = Array.isArray(raw.upNext)
    ? raw.upNext
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        .map((item) => ({
          title: typeof item.title === 'string' ? item.title : '',
          artist: typeof item.artist === 'string' ? item.artist : '',
          index: Number.isInteger(item.index) ? (item.index as number) : -1,
          source: item.source === 'smart' ? ('smart' as const) : ('library' as const)
        }))
        .filter((item) => item.index >= 0 && item.title)
        .slice(0, MAX_UP_NEXT)
    : []

  return {
    title: typeof raw.title === 'string' && raw.title ? raw.title : 'Nothing playing yet',
    artist:
      typeof raw.artist === 'string' && raw.artist ? raw.artist : 'Choose a track in ArtistWave',
    cover,
    source: typeof raw.source === 'string' && raw.source ? raw.source : 'READY',
    playing: raw.playing === true,
    currentTime: clockSafe(raw.currentTime, duration || undefined),
    duration,
    volume: Math.min(1, Math.max(0, Number(raw.volume) || 0)),
    favorite: raw.favorite === true,
    hasTrack: raw.hasTrack === true,
    shuffle: raw.shuffle === true,
    repeat,
    queueLength: Number.isInteger(raw.queueLength) ? (raw.queueLength as number) : 0,
    upNext
  }
}