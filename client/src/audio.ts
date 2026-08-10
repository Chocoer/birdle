/** 环境音管理：Web Audio 实现，30 秒切片循环 + 主题切换交叉淡入淡出 + 夜景随机鸟鸣 */

const VOLUME = 0.25;
const FADE_S = 1.4;

interface Scene {
  src: string;
  loopStart: number;
  loopEnd: number;
  /** 底噪音量系数（1 = 全量） */
  bedVolume: number;
}

/** 浅色=湿地水边鸟鸣，深色=夜林虫鸣（音量降 30%）；各取中段 30 秒循环 */
const SCENES: Record<'light' | 'dark', Scene> = {
  light: { src: '/sounds/wetland.mp3', loopStart: 20, loopEnd: 50, bedVolume: 1 },
  dark: { src: '/sounds/night.mp3', loopStart: 15, loopEnd: 45, bedVolume: 0.7 },
};

/** 夜林场景额外随机穿插的猫头鹰叫声切片 */
const NIGHT_BIRD = {
  src: '/sounds/owl.mp3',
  /** 两次叫声的随机间隔（秒） */
  intervalMin: 18,
  intervalMax: 40,
  /** 每次切片长度（秒） */
  slice: 6,
  /** 相对底噪的音量 */
  volume: 0.6,
};

let ctx: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();
let playing: { source: AudioBufferSourceNode; gain: GainNode; scene: 'light' | 'dark' } | null = null;
let birdTimer: ReturnType<typeof setTimeout> | null = null;
let enabled = false;

async function loadBuffer(src: string): Promise<AudioBuffer> {
  const cached = buffers.get(src);
  if (cached) return cached;
  const ac = ctx!;
  const res = await fetch(src);
  const buf = await ac.decodeAudioData(await res.arrayBuffer());
  buffers.set(src, buf);
  return buf;
}

function clearBirdTimer(): void {
  if (birdTimer) {
    clearTimeout(birdTimer);
    birdTimer = null;
  }
}

function stopCurrent(fadeOut = true): void {
  clearBirdTimer();
  if (!playing || !ctx) return;
  const old = playing;
  playing = null;
  if (fadeOut) {
    old.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_S);
    setTimeout(() => {
      try {
        old.source.stop();
      } catch {
        /* 已停止 */
      }
    }, FADE_S * 1000 + 200);
  } else {
    try {
      old.source.stop();
    } catch {
      /* 已停止 */
    }
  }
}

/** 夜林：每隔一段时间随机播放一小段猫头鹰叫声 */
async function scheduleNightBird(): Promise<void> {
  clearBirdTimer();
  const buffer = await loadBuffer(NIGHT_BIRD.src);
  if (!ctx || !playing || playing.scene !== 'dark') return;

  const ac = ctx;
  const slice = Math.min(NIGHT_BIRD.slice, buffer.duration - 1);
  const offset = 5 + Math.random() * Math.max(1, buffer.duration - slice - 10);
  const gain = ac.createGain();
  const target = VOLUME * NIGHT_BIRD.volume;
  gain.gain.setValueAtTime(0, ac.currentTime);
  gain.gain.linearRampToValueAtTime(target, ac.currentTime + 0.4);
  gain.gain.setValueAtTime(target, ac.currentTime + slice - 0.5);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + slice);
  const source = ac.createBufferSource();
  source.buffer = buffer;
  source.connect(gain).connect(ac.destination);
  source.start(0, offset, slice + 0.1);

  const delay =
    (NIGHT_BIRD.intervalMin + Math.random() * (NIGHT_BIRD.intervalMax - NIGHT_BIRD.intervalMin)) *
    1000;
  birdTimer = setTimeout(() => void scheduleNightBird(), delay);
}

/** 应用声音状态：enabled=false 关闭；enabled=true 时播放对应主题的场景 */
export async function applySound(on: boolean, theme: 'light' | 'dark'): Promise<void> {
  enabled = on;
  if (!on) {
    stopCurrent();
    return;
  }
  if (playing?.scene === theme) return;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') await ctx.resume();
  const scene = SCENES[theme];
  const buffer = await loadBuffer(scene.src);
  if (!enabled || playing?.scene === theme) return; // 加载期间状态变了

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(VOLUME * scene.bedVolume, ctx.currentTime + FADE_S);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.loopStart = scene.loopStart;
  source.loopEnd = Math.min(scene.loopEnd, buffer.duration);
  source.connect(gain).connect(ctx.destination);
  stopCurrent();
  source.start(0, scene.loopStart);
  playing = { source, gain, scene: theme };

  if (theme === 'dark') void scheduleNightBird();
}

/** 切后台时暂停，回前台恢复 */
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) void ctx.suspend();
  else if (enabled) void ctx.resume();
});
