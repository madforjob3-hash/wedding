"""
capture_core.py
유튜브 영상 다운로드 -> 장면 전환 감지 -> 프레임 캡처 -> 자막 매칭 핵심 로직.

app.py(Flask 서버)와 youtube_capture.py(CLI) 양쪽에서 재사용한다.

[주의] 이 코드는 개인이 영상을 빠르게 훑어보기 위한 개인 검증용 프로토타입이다.
여기서 만들어진 캡처 이미지/자막을 재배포하거나 유료 서비스로 만드는 것은
유튜브 이용약관 및 저작권법상 문제가 될 수 있다. README.md의 경고 참고.

필요 외부 도구:
  - yt-dlp (pip)
  - ffmpeg / ffprobe (brew install ffmpeg)
"""

import json
import os
import re
import shutil
import subprocess

# ---------------------------------------------------------------------------
# 캡처 모드 정의
# ---------------------------------------------------------------------------
# scene_threshold : ffmpeg scene 필터 민감도 (낮을수록 더 많이 감지)
# min_gap         : 캡처 시점 간 최소 간격(초). 중복 컷 방지
# max_captures    : 최종 캡처 수 상한. 초과하면 균등 간격으로 다운샘플링
# use_captions    : True면 자막 문장이 바뀌는 시점도 캡처 후보에 포함
MODES = {
    "summary": dict(scene_threshold=0.35, min_gap=8.0, max_captures=25, use_captions=False, label="요약 (핵심만, 최대 25컷)"),
    "detail":  dict(scene_threshold=0.22, min_gap=3.0, max_captures=80, use_captions=True,  label="자세히 (최대 80컷)"),
    "all":     dict(scene_threshold=0.12, min_gap=1.0, max_captures=300, use_captions=True, label="모두 (촘촘하게, 최대 300컷)"),
}

DEFAULT_MODE = "detail"

# 자막 언어 우선순위 (앞에 있을수록 우선)
SUB_LANG_PRIORITY = ["ko", "ko-KR", "en"]


class CaptureError(RuntimeError):
    """다운로드/캡처 과정에서 발생한 사용자에게 보여줄 만한 오류."""


# ---------------------------------------------------------------------------
# 외부 도구 확인
# ---------------------------------------------------------------------------
def _which(name):
    return shutil.which(name)


def check_dependencies():
    """yt-dlp / ffmpeg 설치 여부를 확인하고, 없으면 CaptureError를 던진다."""
    missing = []
    if not _which("yt-dlp"):
        missing.append("yt-dlp (pip3 install --break-system-packages yt-dlp)")
    if not _which("ffmpeg"):
        missing.append("ffmpeg (brew install ffmpeg)")
    if missing:
        raise CaptureError("필수 프로그램이 설치되어 있지 않습니다: " + ", ".join(missing))


def _run(cmd, capture_stderr=True):
    """subprocess 실행 헬퍼. (returncode, stdout, stderr) 반환."""
    proc = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE if capture_stderr else None,
        text=True,
        errors="replace",
    )
    return proc.returncode, proc.stdout or "", proc.stderr or ""


# ---------------------------------------------------------------------------
# 1) 영상 다운로드
# ---------------------------------------------------------------------------
def download_video(url, outdir):
    """yt-dlp로 mp4를 내려받아 파일 경로를 반환한다."""
    os.makedirs(outdir, exist_ok=True)
    out_tmpl = os.path.join(outdir, "video.%(ext)s")
    cmd = [
        "yt-dlp",
        "-f", "mp4[height<=720]/mp4/best",
        "--merge-output-format", "mp4",
        "--no-playlist",
        "-o", out_tmpl,
        url,
    ]
    code, _, err = _run(cmd)
    if code != 0:
        raise CaptureError("영상 다운로드에 실패했습니다.\n" + _tail(err))

    for name in sorted(os.listdir(outdir)):
        if name.startswith("video.") and not name.endswith(".vtt"):
            path = os.path.join(outdir, name)
            if os.path.getsize(path) > 0:
                return path
    raise CaptureError("영상 파일을 찾지 못했습니다. (다운로드는 됐지만 파일이 비어 있음)")


# ---------------------------------------------------------------------------
# 2) 자막 다운로드
# ---------------------------------------------------------------------------
def download_captions(url, outdir):
    """
    자동 생성 + 수동 자막을 vtt로 내려받는다.
    자막이 아예 없는 영상도 많으므로 실패해도 예외를 던지지 않고 None을 반환한다.
    """
    os.makedirs(outdir, exist_ok=True)
    out_tmpl = os.path.join(outdir, "captions.%(ext)s")
    cmd = [
        "yt-dlp",
        "--skip-download",
        "--write-auto-sub",
        "--write-sub",
        "--sub-lang", "ko,ko-KR,en",
        "--convert-subs", "vtt",
        "--no-playlist",
        "-o", out_tmpl,
        url,
    ]
    _run(cmd)  # 자막이 없으면 실패해도 그냥 넘어간다

    candidates = [
        os.path.join(outdir, n)
        for n in os.listdir(outdir)
        if n.startswith("captions.") and n.endswith(".vtt")
    ]
    if not candidates:
        return None
    return _pick_caption_file(candidates)


def _pick_caption_file(paths):
    """ko > ko-KR > en 순으로 자막 파일을 고른다."""
    def rank(path):
        name = os.path.basename(path)
        for i, lang in enumerate(SUB_LANG_PRIORITY):
            if name == "captions.%s.vtt" % lang:
                return i
        for i, lang in enumerate(SUB_LANG_PRIORITY):
            if ".%s." % lang in name:
                return len(SUB_LANG_PRIORITY) + i
        return 99
    return sorted(paths, key=rank)[0]


# ---------------------------------------------------------------------------
# 3) VTT 파싱
# ---------------------------------------------------------------------------
_TS_LINE = re.compile(
    r"(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}|\d{1,2}:\d{2}[.,]\d{1,3})\s*-->\s*"
    r"(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}|\d{1,2}:\d{2}[.,]\d{1,3})"
)
_TAG = re.compile(r"<[^>]+>")            # <c>, <00:00:01.000> 같은 인라인 태그
_CUE_NUM = re.compile(r"^\d+$")


def _vtt_time_to_sec(text):
    text = text.replace(",", ".")
    parts = text.split(":")
    if len(parts) == 3:
        h, m, s = parts
    elif len(parts) == 2:
        h, m, s = "0", parts[0], parts[1]
    else:
        return 0.0
    try:
        return int(h) * 3600 + int(m) * 60 + float(s)
    except ValueError:
        return 0.0


def parse_vtt(vtt_path):
    """
    vtt 파일을 [{start, end, text}, ...] 로 파싱한다.
    - 인라인 타이밍 태그 제거
    - 연속으로 같은 텍스트가 반복되면(자동 자막의 롤업 현상) 제거
    """
    if not vtt_path or not os.path.exists(vtt_path):
        return []

    with open(vtt_path, "r", encoding="utf-8", errors="replace") as f:
        lines = f.read().splitlines()

    cues = []
    i = 0
    while i < len(lines):
        m = _TS_LINE.search(lines[i])
        if not m:
            i += 1
            continue
        start = _vtt_time_to_sec(m.group(1))
        end = _vtt_time_to_sec(m.group(2))

        i += 1
        buf = []
        while i < len(lines) and lines[i].strip() != "" and not _TS_LINE.search(lines[i]):
            raw = lines[i].strip()
            if not _CUE_NUM.match(raw):
                buf.append(_TAG.sub("", raw))
            i += 1

        text = " ".join(x for x in (s.strip() for s in buf) if x)
        text = re.sub(r"\s+", " ", text).strip()
        if text:
            cues.append({"start": start, "end": end, "text": text})

    # 연속 중복 텍스트 제거 (뒤 큐가 앞 큐를 그대로 포함하는 경우도 병합)
    deduped = []
    for cue in cues:
        if deduped:
            prev = deduped[-1]
            if cue["text"] == prev["text"]:
                prev["end"] = max(prev["end"], cue["end"])
                continue
            if cue["text"].startswith(prev["text"]) and len(prev["text"]) > 4:
                prev["text"] = cue["text"]
                prev["end"] = max(prev["end"], cue["end"])
                continue
        deduped.append(dict(cue))
    return deduped


# ---------------------------------------------------------------------------
# 4) 장면 전환 감지
# ---------------------------------------------------------------------------
_PTS_TIME = re.compile(r"pts_time:([0-9.]+)")


def detect_scene_timestamps(video_path, threshold):
    """
    ffmpeg scene 필터로 장면 전환 시각(초) 리스트를 뽑는다.
    showinfo 필터가 stderr로 뿌리는 pts_time 값을 파싱한다.
    """
    cmd = [
        "ffmpeg", "-hide_banner", "-nostats",
        "-i", video_path,
        "-vf", "select='gt(scene,%s)',showinfo" % threshold,
        "-an", "-f", "null", "-",
    ]
    code, _, err = _run(cmd)
    times = sorted({round(float(v), 2) for v in _PTS_TIME.findall(err)})
    if not times and code != 0:
        raise CaptureError("장면 감지에 실패했습니다 (ffmpeg 오류).\n" + _tail(err))
    return times


def get_duration(video_path):
    """ffprobe로 영상 길이(초)를 구한다. 실패하면 0.0."""
    if not _which("ffprobe"):
        return 0.0
    code, out, _ = _run([
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        video_path,
    ])
    if code != 0:
        return 0.0
    try:
        return float(out.strip())
    except ValueError:
        return 0.0


def fallback_timestamps(duration, min_gap, max_captures):
    """장면 전환이 하나도 안 잡힌 영상(고정 카메라 강의 등)을 위한 균등 간격 캡처."""
    if duration <= 0:
        return [0.0]
    step = max(min_gap, duration / max(max_captures, 1))
    times, t = [], 0.0
    while t < duration:
        times.append(round(t, 2))
        t += step
    return times or [0.0]


# ---------------------------------------------------------------------------
# 5) 타임스탬프 병합 / 다운샘플링
# ---------------------------------------------------------------------------
def merge_timestamps(scene_times, caption_times, min_gap):
    """장면 시각 + 자막 시각을 합치고, min_gap 이하로 붙어 있는 것은 버린다."""
    merged = sorted(set(list(scene_times or []) + list(caption_times or [])))
    result = []
    for t in merged:
        if t < 0:
            continue
        if not result or (t - result[-1]) >= min_gap:
            result.append(round(t, 2))
    return result


def downsample(times, max_count):
    """max_count를 넘으면 균등 간격으로 솎아낸다."""
    n = len(times)
    if max_count <= 0 or n <= max_count:
        return list(times)
    step = n / float(max_count)
    return [times[min(int(i * step), n - 1)] for i in range(max_count)]


# ---------------------------------------------------------------------------
# 6) 프레임 캡처
# ---------------------------------------------------------------------------
def capture_frame(video_path, ts, out_path):
    """지정한 시각의 프레임 1장을 jpg로 저장한다. 성공 여부 반환."""
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    cmd = [
        "ffmpeg", "-hide_banner", "-nostats", "-loglevel", "error", "-y",
        "-ss", "%.2f" % float(ts),
        "-i", video_path,
        "-frames:v", "1",
        "-q:v", "2",
        out_path,
    ]
    code, _, _ = _run(cmd)
    return code == 0 and os.path.exists(out_path) and os.path.getsize(out_path) > 0


# ---------------------------------------------------------------------------
# 7) 자막 매칭 / 시간 포맷
# ---------------------------------------------------------------------------
def find_caption_for(ts, captions, window=4.0):
    """
    ts 시각에 해당하는 자막 텍스트를 찾는다.
    1) ts가 자막 구간 안에 들어가면 그 자막
    2) 아니면 window(초) 안에서 가장 가까운 자막
    3) 그것도 없으면 빈 문자열
    """
    if not captions:
        return ""

    for cue in captions:
        if cue["start"] <= ts <= cue["end"]:
            return cue["text"]

    best, best_dist = None, None
    for cue in captions:
        if ts < cue["start"]:
            dist = cue["start"] - ts
        else:
            dist = ts - cue["end"]
        if best_dist is None or dist < best_dist:
            best, best_dist = cue, dist

    if best is not None and best_dist is not None and best_dist <= window:
        return best["text"]
    return ""


def fmt_time(sec):
    """초 -> mm:ss (1시간 넘으면 h:mm:ss)"""
    sec = int(max(0, round(float(sec))))
    h, rem = divmod(sec, 3600)
    m, s = divmod(rem, 60)
    if h:
        return "%d:%02d:%02d" % (h, m, s)
    return "%02d:%02d" % (m, s)


def _tail(text, lines=8):
    """오류 메시지에서 마지막 몇 줄만 뽑아 보여준다."""
    kept = [l for l in (text or "").splitlines() if l.strip()][-lines:]
    return "\n".join(kept)


# ---------------------------------------------------------------------------
# 8) 전체 파이프라인
# ---------------------------------------------------------------------------
def run_capture(url, outdir, mode=DEFAULT_MODE, progress=None, keep_video=False):
    """
    URL 하나를 받아 캡처까지 끝내고 manifest(dict)를 반환한다.

    outdir 안에 만들어지는 것들:
      video.mp4        원본 영상 (keep_video=False면 마지막에 삭제)
      captions.*.vtt   자막
      images/000.jpg   캡처 이미지
      manifest.json    결과 메타데이터

    progress: progress("진행 상황 텍스트") 형태로 호출되는 콜백 (없으면 무시)
    """
    def say(msg):
        if progress:
            progress(msg)

    if mode not in MODES:
        mode = DEFAULT_MODE
    cfg = MODES[mode]

    check_dependencies()
    os.makedirs(outdir, exist_ok=True)
    images_dir = os.path.join(outdir, "images")
    os.makedirs(images_dir, exist_ok=True)

    say("영상 다운로드 중...")
    video_path = download_video(url, outdir)

    captions = []
    caption_times = []
    if cfg["use_captions"]:
        say("자막 다운로드 중...")
        vtt_path = download_captions(url, outdir)
        captions = parse_vtt(vtt_path)
        # 자막 문장이 바뀌는 시점 = 캡처 후보
        caption_times = [c["start"] for c in captions]
        if not captions:
            say("자막이 없는 영상입니다. 이미지만 캡처합니다...")

    say("장면 전환 분석 중... (영상이 길면 시간이 걸립니다)")
    scene_times = detect_scene_timestamps(video_path, cfg["scene_threshold"])

    duration = get_duration(video_path)
    if not scene_times and not caption_times:
        say("장면 전환이 감지되지 않아 균등 간격으로 캡처합니다...")
        scene_times = fallback_timestamps(duration, cfg["min_gap"], cfg["max_captures"])

    times = merge_timestamps(scene_times, caption_times, cfg["min_gap"])
    times = downsample(times, cfg["max_captures"])
    if not times:
        times = [0.0]

    total = len(times)
    frames = []
    for i, ts in enumerate(times):
        say("프레임 캡처 중 (%d/%d)..." % (i + 1, total))
        filename = "%04d.jpg" % i
        out_path = os.path.join(images_dir, filename)
        if not capture_frame(video_path, ts, out_path):
            continue
        frames.append({
            "index": len(frames),
            "timestamp": round(float(ts), 2),
            "time_label": fmt_time(ts),
            "image": filename,
            "caption": find_caption_for(ts, captions) if captions else "",
        })

    if not frames:
        raise CaptureError("캡처된 프레임이 없습니다. 영상이 너무 짧거나 ffmpeg가 프레임을 읽지 못했습니다.")

    manifest = {
        "mode": mode,
        "mode_label": cfg["label"],
        "url": url,
        "duration": round(duration, 2),
        "count": len(frames),
        "has_captions": bool(captions),
        "frames": frames,
    }

    say("결과 정리 중...")
    with open(os.path.join(outdir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    if not keep_video:
        # 원본 영상은 용량이 크니 캡처가 끝나면 지운다
        try:
            os.remove(video_path)
        except OSError:
            pass

    return manifest
