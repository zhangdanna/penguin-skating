# -*- coding: utf-8 -*-
"""一企推推乐 — 音频素材生成器（SFX + BGM）

设计原则（与 docs/AUDIO.md 一致）：
  1. 统一音色家族：冰晶（FM 铃）/ 木琴（marimba）/ 雪沙（带通噪声）/ 气泡（上滑正弦）
     全部音效只用这四种材质组合，形成一致的"听觉 Logo"。
  2. 每个音效三层结构：transient（触感 0~15ms）+ body（材质）+ tail（空间/混响）。
  3. 一律 2ms 起音、10~20ms 收尾，杜绝硬切爆音；直流分量强制滤除。
  4. 响度按用途分级归一到目标 RMS，峰值限幅 -1dBFS，避免"某个音效特别吵"。
  5. BGM 用"尾音折回开头"的方式做无缝循环，不靠淡出（淡出会在接缝处留呼吸断层）。

用法：
  python tools/gen-sfx.py            # 生成全部素材到 audio/
  python tools/gen-sfx.py --verify   # 只体检现有素材，不写文件
"""
import os
import struct
import sys
import wave

import numpy as np

SR_SFX = 32000          # 音效采样率：Nyquist 16k，手机扬声器足够，比 48k 省 33% 体积
SR_BGM = 22050          # BGM 采样率：音乐盒基频 + 少量空气感，16k 会明显发闷
RNG = np.random.default_rng(20261028)

AUDIO_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "audio"))

# ---------------------------------------------------------------- 基础工具


def ns(dur, sr=SR_SFX):
    return int(round(dur * sr))


def tt(dur, sr=SR_SFX):
    return np.arange(ns(dur, sr)) / sr


def db(x):
    return 10 ** (x / 20.0)


def fade(x, fin=0.002, fout=0.015, sr=SR_SFX):
    """两端淡入淡出，杜绝硬切爆音"""
    n = len(x)
    ni = min(int(fin * sr), n // 2)
    no = min(int(fout * sr), n // 2)
    if ni > 1:
        x[:ni] *= np.linspace(0.0, 1.0, ni) ** 1.5
    if no > 1:
        x[-no:] *= np.linspace(1.0, 0.0, no) ** 1.2
    return x


def dc_block(x, sr=SR_SFX, fc=28.0):
    """一阶高通，去掉直流与次声（原 collision.wav 的 DC 偏移会让小喇叭"噗"一声）"""
    a = np.exp(-2 * np.pi * fc / sr)
    y = np.empty_like(x)
    prev_x = 0.0
    prev_y = 0.0
    for i in range(len(x)):
        cur = x[i] - prev_x + a * prev_y
        prev_x = x[i]
        prev_y = cur
        y[i] = cur
    return y


def fft_filter(x, sr, lo=None, hi=None, slope=0.35):
    """频域带通/低通/高通，边缘用升余弦软过渡（比硬 mask 干净得多）"""
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1.0 / sr)
    mask = np.ones_like(f)
    if lo:
        mask *= np.clip((f - lo * (1 - slope)) / max(lo * slope, 1e-6), 0.0, 1.0)
    if hi:
        mask *= np.clip((hi * (1 + slope) - f) / max(hi * slope, 1e-6), 0.0, 1.0)
    return np.fft.irfft(X * mask, n)


def noise(dur, sr=SR_SFX):
    return RNG.standard_normal(ns(dur, sr))


def conv(x, h):
    n = len(x) + len(h) - 1
    N = 1 << (n - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, N) * np.fft.rfft(h, N), N)[:n]
    return y


def reverb(x, sr=SR_SFX, rt=0.9, mix=0.22, predelay=0.012, tone=4200):
    """合成 IR 卷积混响：噪声 × 指数衰减，IR 本身低通一遍避免"砂纸味\""""
    n_ir = ns(rt, sr)
    t = np.arange(n_ir) / sr
    ir = RNG.standard_normal(n_ir) * np.exp(-t / (rt / 6.9))
    ir = fft_filter(ir, sr, lo=180, hi=tone)
    pd = ns(predelay, sr)
    if pd > 0:
        ir = np.concatenate([np.zeros(pd), ir])
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    wet = conv(x, ir)[: len(x)]
    # 让混响尾部自然衰减，不拖到下一帧
    wet *= np.linspace(1.0, 0.0, len(wet)) ** 0.6
    return x * (1 - mix) + wet * mix * 2.2


def normalize(x, rms_db=-18.0, peak_db=-1.0):
    """按 RMS 归一到目标响度，再按峰值限幅（软拐点，不用硬 clip）"""
    rms = np.sqrt(np.mean(x ** 2)) + 1e-9
    x = x / rms * db(rms_db)
    peak = np.max(np.abs(x)) + 1e-9
    limit = db(peak_db)
    if peak > limit:
        x = np.tanh(x / limit * 0.9) * limit
    return x


def write_wav(name, x, sr=SR_SFX):
    x = np.clip(x, -1.0, 1.0)
    pcm = (x * 32767).astype("<i2")
    path = os.path.join(AUDIO_DIR, name)
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm.tobytes())
    dur = len(x) / sr
    print(f"  {name:18s} {dur:5.2f}s  {os.path.getsize(path)/1024:6.1f}KB  sr={sr}")
    return path


# ---------------------------------------------------------------- 音色材质


def fm_bell(freq, dur, amp=1.0, ratio=3.47, index=3.2, tau=0.30, tau_m=0.10, sr=SR_SFX):
    """冰晶铃：FM 合成，调制指数快速衰减 → 起音有金属"叮"，尾音是纯正弦"""
    t = tt(dur, sr)
    mod = index * np.exp(-t / tau_m) * np.sin(2 * np.pi * freq * ratio * t)
    x = np.sin(2 * np.pi * freq * t + mod)
    x += 0.18 * np.sin(2 * np.pi * freq * 2.004 * t) * np.exp(-t / (tau * 0.5))
    return x * np.exp(-t / tau) * amp


def marimba(freq, dur, amp=1.0, tau=0.16, sr=SR_SFX):
    """木琴：基频 + 4 倍泛音（木琴特征）+ 极短击打噪声"""
    t = tt(dur, sr)
    x = np.sin(2 * np.pi * freq * t) * np.exp(-t / tau)
    x += 0.30 * np.sin(2 * np.pi * freq * 3.93 * t) * np.exp(-t / (tau * 0.30))
    x += 0.08 * np.sin(2 * np.pi * freq * 9.2 * t) * np.exp(-t / (tau * 0.12))
    click = fft_filter(noise(dur, sr), sr, lo=1800, hi=7000) * np.exp(-t / 0.004) * 0.5
    return (x + click) * amp


def ice_noise(dur, lo, hi, amp=1.0, tau=0.12, sr=SR_SFX):
    """雪/冰面摩擦：带通噪声 + 指数衰减"""
    t = tt(dur, sr)
    x = fft_filter(noise(dur, sr), sr, lo=lo, hi=hi)
    return x * np.exp(-t / tau) * amp


def bubble(f0, f1, dur, amp=1.0, tau=0.10, sr=SR_SFX):
    """气泡：上滑正弦 + 二次谐波，短促圆润"""
    t = tt(dur, sr)
    f = f0 + (f1 - f0) * (1 - np.exp(-t / (dur * 0.35)))
    phase = 2 * np.pi * np.cumsum(f) / sr
    x = np.sin(phase) + 0.22 * np.sin(2 * phase)
    return x * np.exp(-t / tau) * amp


def sweep_noise(dur, bands, amp=1.0, sr=SR_SFX):
    """多段带通噪声交叉淡化 = 滤波器扫频（比逐样本改系数简单且无 zipper 噪声）"""
    t = tt(dur, sr)
    out = np.zeros_like(t)
    n = len(bands)
    for i, (lo, hi, level) in enumerate(bands):
        center = (i + 0.5) / n
        # 每个频段在时间轴上有一个高斯窗，形成"扫过去"的感觉
        win = np.exp(-((t / dur - center) ** 2) / (2 * (0.55 / n) ** 2))
        out += fft_filter(noise(dur, sr), sr, lo=lo, hi=hi) * win * level
    return out * amp


# ---------------------------------------------------------------- 音效设计

def build_tap():
    """UI 点按：木琴高音 + 一点冰晶，80ms 内结束。必须"短、亮、轻"，不能盖过玩法音效"""
    dur = 0.10
    x = marimba(1046.5, dur, 0.9, tau=0.055)          # C6
    x += fm_bell(2093.0, dur, 0.18, ratio=2.0, index=1.4, tau=0.035, tau_m=0.02)  # C7 冰晶点缀
    x = fade(x, 0.001, 0.02)
    return normalize(x, -20.0)


def build_back():
    """返回/关闭：下行两音 A5→E5，明确"退出"语义，比点按更软"""
    dur = 0.20
    x = marimba(880.0, dur, 0.7, tau=0.07)
    tail = marimba(659.3, 0.14, 0.55, tau=0.06)
    off = ns(0.055)
    x[off:off + len(tail)] += tail
    x = fade(x, 0.001, 0.03)
    return normalize(x, -20.0)


def build_slide():
    """企鹅滑行一格：冰刀擦冰面。中高频带通噪声上扫 + 颗粒调制，短促不刺耳"""
    dur = 0.26
    t = tt(dur)
    body = sweep_noise(dur, [(700, 1600, 0.9), (1600, 3400, 1.0), (3400, 6500, 0.55)], 1.0)
    # 颗粒感：8~14Hz 的随机幅度起伏，模拟冰面碎屑
    grit = 0.75 + 0.25 * np.sin(2 * np.pi * 11 * t + RNG.uniform(0, 6.28))
    body *= grit * np.exp(-t / 0.075)
    # 落地"嗒"：极短的木质触感，让移动有终点
    click = marimba(392.0, 0.09, 0.28, tau=0.03)
    x = body * 1.0
    x[-len(click):] += click[: len(click)] * 0.9
    x = fade(x, 0.002, 0.02)
    return normalize(x, -18.0)


def build_push():
    """推冰块：低频"咕"的体感 + 冰面摩擦 + 冰块位移的颗粒。比滑行更重、更长"""
    dur = 0.30
    t = tt(dur)
    # 低频体感：85Hz 下滑到 55Hz
    f = 85 * np.exp(-t / 0.09) + 55
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR_SFX) * np.exp(-t / 0.085) * 0.9
    # 冰块在冰面上滑：中低频噪声，慢衰减
    rub = ice_noise(dur, 500, 2200, 0.55, tau=0.13)
    # 冰块启动的"咯"：两个短脉冲
    ticks = np.zeros_like(t)
    for at, g in ((0.0, 0.35), (0.055, 0.22)):
        i = ns(at)
        seg = marimba(220.0, 0.06, g, tau=0.022)
        ticks[i:i + len(seg)] += seg[: len(ticks) - i]
    x = thump + rub + ticks
    x = fade(x, 0.002, 0.03)
    return normalize(x, -17.0)


def build_bump():
    """撞墙/推不动：撞击噪声爆点 + 冰墙金属短鸣。要有"撞到了"的否定感，不能像奖励音"""
    dur = 0.24
    t = tt(dur)
    hit = fft_filter(noise(dur), sr=SR_SFX, lo=900, hi=6500) * np.exp(-t / 0.020) * 1.0
    body = np.sin(2 * np.pi * 130 * t) * np.exp(-t / 0.045) * 0.7
    # 冰墙共振：2.4k / 3.7k 两个不谐和分音，短衰减
    ring = (np.sin(2 * np.pi * 2430 * t) * 0.20 + np.sin(2 * np.pi * 3710 * t) * 0.12)
    ring *= np.exp(-t / 0.055)
    x = hit + body + ring
    x = fade(x, 0.001, 0.03)
    return normalize(x, -16.5)


def build_star():
    """单颗星亮起：冰晶铃 C6 + 高频 sparkle。三颗星靠 playbackRate 逐颗升高"""
    dur = 0.40
    t = tt(dur)
    x = fm_bell(1046.5, dur, 1.0, ratio=3.0, index=2.4, tau=0.13, tau_m=0.05)
    x += fm_bell(1568.0, dur, 0.45, ratio=2.0, index=1.6, tau=0.10, tau_m=0.04)  # G6
    sparkle = fft_filter(noise(dur), sr=SR_SFX, lo=6000, hi=13000) * np.exp(-t / 0.03) * 0.18
    x = x + sparkle
    x = reverb(x, SR_SFX, rt=0.55, mix=0.16)
    x = fade(x, 0.002, 0.06)
    return normalize(x, -17.0)


def build_win():
    """通关：木琴琶音 C5-E5-G5-C6 上行 + 铃铺底 + 结尾 sparkle。1.9s，要有"完成感"但不吵"""
    dur = 1.9
    x = np.zeros(ns(dur))
    notes = [(523.25, 0.00), (659.25, 0.085), (783.99, 0.17), (1046.50, 0.255)]
    for f, at in notes:
        seg = marimba(f, 0.9, 0.55, tau=0.22)
        i = ns(at)
        x[i:i + len(seg)] += seg[: len(x) - i]
    # 第二遍高八度加花，情绪推上去
    for f, at in [(1046.50, 0.42), (1318.51, 0.50)]:
        seg = fm_bell(f, 0.7, 0.22, ratio=2.0, index=1.2, tau=0.16, tau_m=0.05)
        i = ns(at)
        x[i:i + len(seg)] += seg[: len(x) - i]
    # 铺底和弦（C 大三和弦），慢起音，撑住整段
    t = tt(dur)
    pad = np.zeros_like(t)
    for f, g in ((261.63, 0.30), (329.63, 0.22), (392.00, 0.20)):
        pad += np.sin(2 * np.pi * f * t) * g
    pad *= np.clip(t / 0.18, 0, 1) * np.exp(-np.maximum(t - 0.35, 0) / 0.9)
    x += pad * 0.55
    # 结尾 sparkle
    sp_at = 0.62
    sp = fft_filter(noise(0.8), sr=SR_SFX, lo=7000, hi=14000) * np.exp(-np.arange(ns(0.8)) / SR_SFX / 0.16) * 0.10
    i = ns(sp_at)
    x[i:i + len(sp)] += sp[: len(x) - i]
    x = reverb(x, SR_SFX, rt=1.1, mix=0.24)
    x = fade(x, 0.003, 0.25)
    return normalize(x, -15.0)


def build_fail():
    """失败：下行 A4-F4-D4 柔和三音 + 低频"沉"。要"遗憾"不要"惩罚"，解谜游戏失败很频繁"""
    dur = 1.35
    x = np.zeros(ns(dur))
    for f, at, g in ((440.00, 0.00, 0.60), (349.23, 0.14, 0.55), (293.66, 0.28, 0.50)):
        seg = marimba(f, 1.0, g, tau=0.30)
        # 低通一下，去掉木琴的尖锐击打，变成"闷"的遗憾感
        seg = fft_filter(seg, SR_SFX, lo=120, hi=2600)
        i = ns(at)
        x[i:i + len(seg)] += seg[: len(x) - i]
    t = tt(dur)
    sub = np.sin(2 * np.pi * 73.42 * t) * np.exp(-t / 0.30) * 0.22   # D2
    x += fft_filter(sub, SR_SFX, hi=300)
    x = reverb(x, SR_SFX, rt=0.8, mix=0.18)
    x = fade(x, 0.003, 0.22)
    return normalize(x, -16.0)


def build_undo():
    """退一步：反向滑行（噪声上扫反转）+ 小铃。听感要像"倒带" """
    dur = 0.34
    t = tt(dur)
    rev = sweep_noise(dur, [(500, 1200, 0.6), (1200, 2600, 0.9), (2600, 5200, 1.0)], 1.0)
    rev = rev[::-1].copy() * np.linspace(0.15, 1.0, len(rev)) ** 2   # 反转 + 渐强
    bell = fm_bell(1318.51, 0.20, 0.30, ratio=2.0, index=1.2, tau=0.07, tau_m=0.03)
    x = rev * 0.85
    i = ns(0.13)
    x[i:i + len(bell)] += bell[: len(x) - i]
    x = fade(x, 0.002, 0.03)
    return normalize(x, -18.5)


def build_achievement():
    """成就解锁：三音上行 + 亮 sparkle + 中混响。比单颗星更"隆重"，但要短于通关音"""
    dur = 1.30
    x = np.zeros(ns(dur))
    for f, at in ((783.99, 0.00), (1046.50, 0.10), (1318.51, 0.20)):
        seg = fm_bell(f, 0.9, 0.50, ratio=2.5, index=1.8, tau=0.22, tau_m=0.06)
        i = ns(at)
        x[i:i + len(seg)] += seg[: len(x) - i]
    # 底下垫一层木琴，避免纯铃音太"电子"
    for f, at in ((392.00, 0.02), (523.25, 0.22)):
        seg = marimba(f, 0.8, 0.26, tau=0.20)
        i = ns(at)
        x[i:i + len(seg)] += seg[: len(x) - i]
    x = reverb(x, SR_SFX, rt=1.0, mix=0.22)
    x = fade(x, 0.003, 0.20)
    return normalize(x, -15.5)


def build_revive():
    """复活：气泡上升 + 柔和和弦。要"重新开始"的希望感，不能像通关"""
    dur = 1.05
    x = np.zeros(ns(dur))
    for at, (f0, f1) in ((0.00, (330, 660)), (0.09, (440, 880)), (0.18, (660, 1320))):
        seg = bubble(f0, f1, 0.45, 0.40, tau=0.13)
        i = ns(at)
        x[i:i + len(seg)] += seg[: len(x) - i]
    t = tt(dur)
    pad = (np.sin(2 * np.pi * 523.25 * t) + np.sin(2 * np.pi * 659.25 * t) * 0.7) * 0.14
    pad *= np.clip(t / 0.25, 0, 1) * np.exp(-np.maximum(t - 0.3, 0) / 0.5)
    x += pad
    x = reverb(x, SR_SFX, rt=0.7, mix=0.18)
    x = fade(x, 0.003, 0.15)
    return normalize(x, -16.5)


def build_level_start():
    """关卡开始：两声轻快木琴 + 一记雪风。短、轻，不要抢戏（玩家会连打几十次）"""
    dur = 0.85
    x = np.zeros(ns(dur))
    for f, at, g in ((659.25, 0.00, 0.55), (987.77, 0.09, 0.45)):
        seg = marimba(f, 0.5, g, tau=0.14)
        i = ns(at)
        x[i:i + len(seg)] += seg[: len(x) - i]
    wind = fft_filter(noise(dur), sr=SR_SFX, lo=400, hi=2600) * np.linspace(0.0, 1.0, ns(dur)) ** 1.5
    wind *= np.exp(-np.arange(ns(dur)) / SR_SFX / 0.25) * 0.18
    x += wind
    x = fade(x, 0.003, 0.10)
    return normalize(x, -18.0)


# ---------------------------------------------------------------- BGM

BPM = 90.0
BEAT = 60.0 / BPM          # 0.667s
BAR = BEAT * 4             # 2.667s
BARS = 6
TOTAL = BAR * BARS         # 16s

NOTES = {
    'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77,
    'C6': 1046.50, 'D6': 1174.66, 'E6': 1318.51,
}

# 和声：C - Am - F - G - Am - G，末小节停在 G，回环到 C 是自然的半终止
PROGRESSION = [
    ('C3', ['C4', 'E4', 'G4']),
    ('A3', ['A3', 'C4', 'E4']),
    ('F3', ['F3', 'A3', 'C4']),
    ('G3', ['G3', 'B3', 'D4']),
    ('A3', ['A3', 'C4', 'E4']),
    ('G3', ['G3', 'B3', 'D4']),
]

# 主旋律：稀疏，留白多。每小节 2~3 个音，避免"琶音轰炸"
MELODY = [
    [(0.0, 'E5', 1.5), (1.5, 'G5', 0.9), (2.5, 'E5', 1.0)],
    [(0.0, 'A5', 1.4), (1.5, 'G5', 0.8), (2.5, 'E5', 1.2)],
    [(0.0, 'F5', 1.6), (1.75, 'A5', 0.8), (2.75, 'C6', 1.0)],
    [(0.0, 'D6', 1.4), (1.5, 'B5', 1.0), (2.75, 'G5', 1.0)],
    [(0.0, 'A5', 1.5), (1.5, 'C6', 1.2)],
    [(0.0, 'B5', 1.6), (1.75, 'D6', 0.9), (2.75, 'B5', 1.0)],
]


def add(buf, seg, at, sr):
    """把 seg 叠加到 buf 的 at 秒处；超出结尾的部分折回开头（无缝循环的关键）"""
    i = int(round(at * sr))
    n = len(buf)
    pos = 0
    while pos < len(seg):
        room = n - ((i + pos) % n)
        take = min(room, len(seg) - pos)
        idx = (i + pos) % n
        buf[idx:idx + take] += seg[pos:pos + take]
        pos += take
    return buf


def build_bgm():
    n = ns(TOTAL, SR_BGM)
    buf = np.zeros(n)

    # 1) 铺底 pad：每小节一个和弦，慢起音，长衰减
    for bar, (bass, chord) in enumerate(PROGRESSION):
        start = bar * BAR
        for note in chord:
            f = NOTES[note]
            seg = np.zeros(ns(BAR * 1.25, SR_BGM))
            t = np.arange(len(seg)) / SR_BGM
            # 两个微失谐正弦 → 轻微合唱感，纯正弦太"干"
            wave_ = np.sin(2 * np.pi * f * t) + 0.55 * np.sin(2 * np.pi * f * 1.003 * t)
            env = np.clip(t / 0.35, 0, 1) * np.exp(-t / 1.6)
            seg = fft_filter(wave_ * env, SR_BGM, hi=2200) * 0.11
            add(buf, seg, start, SR_BGM)
        # 低音
        seg = np.zeros(ns(BAR * 1.2, SR_BGM))
        t = np.arange(len(seg)) / SR_BGM
        seg = np.sin(2 * np.pi * NOTES[bass] * t) * np.clip(t / 0.05, 0, 1) * np.exp(-t / 1.3) * 0.26
        add(buf, seg, start, SR_BGM)

    # 2) 主旋律：音乐盒音色（基频 + 2/3 次泛音，快衰减）
    for bar, phrase in enumerate(MELODY):
        for beat, note, length in phrase:
            f = NOTES[note]
            dur = min(length * BEAT * 1.8, 2.2)
            t = tt(dur, SR_BGM)
            seg = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.55)
            seg += 0.30 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t / 0.28)
            seg += 0.12 * np.sin(2 * np.pi * f * 3 * t) * np.exp(-t / 0.16)
            seg += 0.05 * np.sin(2 * np.pi * f * 4.2 * t) * np.exp(-t / 0.08)
            seg *= np.clip(t / 0.006, 0, 1)
            add(buf, seg * 0.20, bar * BAR + beat * BEAT, SR_BGM)

    # 3) 雪沙打击：反拍轻噪声，很轻，只做律动
    for bar in range(BARS):
        for k in (1, 3):
            at = bar * BAR + k * BEAT + BEAT * 0.5
            seg = fft_filter(noise(0.10, SR_BGM), SR_BGM, lo=5000, hi=9500)
            t = tt(0.10, SR_BGM)
            seg *= np.exp(-t / 0.022) * 0.055
            add(buf, seg, at, SR_BGM)

    # 4) 高空冰晶点缀：每 2 小节一颗，制造"空间"
    for bar in (1, 4):
        seg = fm_bell(NOTES['C6'], 1.2, 0.07, ratio=3.0, index=1.6, tau=0.35, tau_m=0.08, sr=SR_BGM)
        add(buf, seg, bar * BAR + BEAT * 2.5, SR_BGM)

    # 5) 混响：IR 尾部折回开头 → 循环接缝处混响连续，不需要淡出
    n_ir = ns(1.4, SR_BGM)
    t = np.arange(n_ir) / SR_BGM
    ir = RNG.standard_normal(n_ir) * np.exp(-t / (1.4 / 6.9))
    ir = fft_filter(ir, SR_BGM, lo=250, hi=5200)
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    wet = conv(buf, ir)
    loop = wet[:n]
    tail = wet[n:]
    # 关键：把超出循环长度的混响尾音加回开头，而不是切掉/淡出
    m = min(len(tail), n)
    loop[:m] += tail[:m]
    buf = buf * 0.75 + loop * 0.42

    buf = dc_block(buf, SR_BGM, 30)
    return normalize(buf, -21.0, -2.5)


# ---------------------------------------------------------------- 体检

CUES = [
    ("ui_tap.wav", build_tap),
    ("ui_back.wav", build_back),
    ("slide.wav", build_slide),
    ("push.wav", build_push),
    ("collision.wav", build_bump),
    ("star.wav", build_star),
    ("win.wav", build_win),
    ("fail.wav", build_fail),
    ("undo.wav", build_undo),
    ("achievement.wav", build_achievement),
    ("revive.wav", build_revive),
    ("level-start.wav", build_level_start),
]


def verify():
    print(f"{'file':18s} {'dur':>6s} {'sr':>6s} {'peak':>6s} {'rms':>6s} {'head':>6s} {'tail':>6s}")
    total = 0
    for name in sorted(os.listdir(AUDIO_DIR)):
        p = os.path.join(AUDIO_DIR, name)
        total += os.path.getsize(p)
        with wave.open(p, "rb") as wf:
            sr = wf.getframerate()
            ch = wf.getnchannels()
            n = wf.getnframes()
            raw = wf.readframes(n)
        v = np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768.0
        if ch == 2:
            v = v[::2]
        peak = np.max(np.abs(v)) if len(v) else 0
        rms = np.sqrt(np.mean(v ** 2)) if len(v) else 0
        head = np.max(np.abs(v[: max(1, int(sr * 0.003))])) if len(v) else 0
        tail = np.max(np.abs(v[-max(1, int(sr * 0.003)):])) if len(v) else 0
        print(f"{name:18s} {len(v)/sr:6.2f} {sr:6d} {peak:6.3f} {rms:6.4f} {head:6.3f} {tail:6.3f}")
    print(f"\naudio/ 总计 {total/1024:.0f}KB")


def main():
    if "--verify" in sys.argv:
        verify()
        return

    os.makedirs(AUDIO_DIR, exist_ok=True)
    print("生成音效：")
    for name, fn in CUES:
        write_wav(name, fn())
    # button.wav 是旧资源名，内容就是点按音，保留一份避免旧引用 404
    write_wav("button.wav", build_tap())
    print("生成背景音乐：")
    write_wav("bgm.wav", build_bgm(), SR_BGM)
    print("\n完成。体检：")
    verify()


if __name__ == "__main__":
    main()
