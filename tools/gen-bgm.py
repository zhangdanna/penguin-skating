# -*- coding: utf-8 -*-
"""生成循环背景音乐 audio/bgm.wav

- 16 秒无缝循环，音乐盒音色 + 柔和铺底
- 16kHz / 单声道 / 16bit，体积约 500KB，可直接被 wx.createInnerAudioContext 播放
- 有正式授权音乐后，把 mp3 放到 audio/bgm.mp3 即可自动优先使用（见 audio-manager.js）
"""
import os
import struct
import wave

import numpy as np

SR = 16000
BPM = 120
BEAT = 60.0 / BPM          # 0.5s
BAR = BEAT * 4             # 2s
BARS = 8
TOTAL = BAR * BARS         # 16s

# 音名 → 频率（十二平均律，A4=440）
NOTES = {
    'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77,
    'C6': 1046.50,
}

# 和声进行：C - Am - F - G，重复两遍
PROGRESSION = [
    ('C3',  ['C5', 'E5', 'G5', 'E5']),
    ('A3',  ['A4', 'C5', 'E5', 'C5']),
    ('F3',  ['F4', 'A4', 'C5', 'A4']),
    ('G3',  ['G4', 'B4', 'D5', 'B4']),
    ('C3',  ['C5', 'E5', 'G5', 'C6']),
    ('A3',  ['A4', 'C5', 'E5', 'A5']),
    ('F3',  ['F4', 'A4', 'C5', 'F5']),
    ('G3',  ['G4', 'B4', 'D5', 'G5']),
]

n_samples = int(SR * TOTAL)
buf = np.zeros(n_samples, dtype=np.float64)


def add_tone(freq, start, dur, amp, decay, harmonics=(1.0, 0.32, 0.12, 0.05)):
    """叠加一个带谐波的音符（音乐盒/钢片琴质感）"""
    i0 = int(start * SR)
    i1 = min(n_samples, int((start + dur) * SR))
    if i1 <= i0:
        return

    t = np.arange(i1 - i0) / SR
    env = np.exp(-t * decay)
    # 5ms 起音，避免爆音
    attack = int(0.005 * SR)
    if attack > 1 and len(env) > attack:
        env[:attack] *= np.linspace(0.0, 1.0, attack)

    wave_data = np.zeros_like(t)
    for k, gain in enumerate(harmonics, start=1):
        wave_data += gain * np.sin(2 * np.pi * freq * k * t)

    buf[i0:i1] += wave_data * env * amp


# ---------- 主旋律（每小节 4 个八分音符） ----------
for bar_index, (bass, arp) in enumerate(PROGRESSION):
    bar_start = bar_index * BAR

    # 低音铺底
    add_tone(NOTES[bass], bar_start, BAR * 1.1, 0.20, 1.1, harmonics=(1.0, 0.5, 0.2))

    # 琶音
    for i, note in enumerate(arp):
        offset = bar_start + i * BEAT
        # 第 2、4 拍稍弱，做出律动
        amp = 0.26 if i % 2 == 0 else 0.20
        add_tone(NOTES[note], offset, BEAT * 2.2, amp, 2.6)

# ---------- 高音点缀 ----------
sparkle = [(1.5, 'C6'), (5.5, 'G5'), (9.5, 'A5'), (13.5, 'C6')]
for start, note in sparkle:
    add_tone(NOTES[note], start, 1.6, 0.10, 4.0)

# ---------- 简易延迟混响 ----------
# 注意：必须先 copy 再叠加，in-place 与自身重叠会得到不确定结果
for delay, gain in ((0.125, 0.18), (0.25, 0.10)):
    d = int(delay * SR)
    buf[d:] += buf[:-d].copy() * gain

# ---------- 归一化 + 收尾 ----------
peak = np.max(np.abs(buf))
if peak > 0:
    buf = buf / peak * 0.62          # 约 -4 dBFS，留出余量

# 末尾 8ms 淡出，保证循环接缝无爆音
fade = int(0.008 * SR)
buf[-fade:] *= np.linspace(1.0, 0.0, fade)

pcm = np.clip(buf * 32767, -32768, 32767).astype('<i2')

out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "audio")
os.makedirs(out_dir, exist_ok=True)
out = os.path.abspath(os.path.join(out_dir, "bgm.wav"))

with wave.open(out, "wb") as wf:
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(SR)
    wf.writeframes(pcm.tobytes())

print("saved:", out, os.path.getsize(out), "bytes,", TOTAL, "s loop")
