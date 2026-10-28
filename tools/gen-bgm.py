# -*- coding: utf-8 -*-
"""生成循环背景音乐 audio/bgm.wav

⚠️ 已被 tools/gen-sfx.py 取代（2026-10-28）。

原版是 16kHz / 16s / 8ms 淡出收尾，接缝处有明显"呼吸断层"，且采样率比音效低一半，
听感像隔了一层棉被。现在的 BGM 由 gen-sfx.py 的 build_bgm() 生成：
22.05kHz / 16s / 尾音折回开头（真无缝）/ 90BPM 6 小节。

保留这个文件只为不破坏老的肌肉记忆，执行它会转调 gen-sfx.py。
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = os.path.join(HERE, "gen-sfx.py")

if __name__ == "__main__":
    print("[deprecated] gen-bgm.py 已并入 gen-sfx.py，转调中…\n")
    sys.exit(subprocess.call([sys.executable, TARGET] + sys.argv[1:]))
