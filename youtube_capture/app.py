"""
app.py - 유튜브 웹툰 캡처 로컬 웹 서버 (Flask)

실행:
    python3 app.py
    브라우저에서 http://127.0.0.1:5000 접속

[주의] 개인 검증용 로컬 프로토타입이다. 외부에 공개하거나 배포하지 말 것.
자세한 내용은 README.md의 경고 문구 참고.
"""

import argparse
import os
import re
import shutil
import socket
import threading
import uuid

from flask import (
    Flask, abort, jsonify, render_template, request, send_from_directory,
)

import capture_core
from capture_core import MODES, DEFAULT_MODE, CaptureError

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JOBS_DIR = os.path.join(BASE_DIR, "jobs")

app = Flask(__name__)

# 인메모리 작업 상태 저장소.
# 서버를 재시작하면 초기화된다 (jobs/ 폴더의 결과물은 그대로 남는다).
jobs = {}
jobs_lock = threading.Lock()

JOB_ID_RE = re.compile(r"^[0-9a-f]{32}$")
YOUTUBE_RE = re.compile(r"^https?://(www\.|m\.|music\.)?(youtube\.com|youtu\.be)/", re.I)


# ---------------------------------------------------------------------------
# 상태 관리 헬퍼
# ---------------------------------------------------------------------------
def set_status(job_id, status, progress="", error=""):
    with jobs_lock:
        jobs[job_id] = {
            "job_id": job_id,
            "status": status,       # running | done | error
            "progress": progress,
            "error": error,
        }


def get_status(job_id):
    with jobs_lock:
        return dict(jobs[job_id]) if job_id in jobs else None


def safe_job_dir(job_id):
    """job_id 형식을 검증하고 실제 폴더 경로를 반환한다 (경로 탈출 방지)."""
    if not JOB_ID_RE.match(job_id or ""):
        abort(404)
    path = os.path.join(JOBS_DIR, job_id)
    if not os.path.isdir(path):
        abort(404)
    return path


# ---------------------------------------------------------------------------
# 백그라운드 캡처 작업
# ---------------------------------------------------------------------------
def capture_worker(job_id, url, mode):
    outdir = os.path.join(JOBS_DIR, job_id)

    def progress(msg):
        set_status(job_id, "running", msg)

    try:
        capture_core.run_capture(url, outdir, mode=mode, progress=progress)
        set_status(job_id, "done", "완료!")
    except CaptureError as e:
        set_status(job_id, "error", "", str(e))
    except Exception as e:  # 예상 못 한 오류도 화면에 보여준다
        set_status(job_id, "error", "", "예상치 못한 오류: %s" % e)


# ---------------------------------------------------------------------------
# 라우트
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    mode_list = [
        {"key": key, "label": cfg["label"], "max": cfg["max_captures"]}
        for key, cfg in MODES.items()
    ]
    return render_template("index.html", modes=mode_list, default_mode=DEFAULT_MODE)


@app.route("/capture", methods=["POST"])
def capture():
    data = request.get_json(silent=True) or {}
    url = (data.get("url") or "").strip()
    mode = (data.get("mode") or DEFAULT_MODE).strip()

    if not url:
        return jsonify({"error": "유튜브 링크를 입력해 주세요."}), 400
    if not YOUTUBE_RE.match(url):
        return jsonify({"error": "유튜브 링크 형식이 아닙니다."}), 400
    if mode not in MODES:
        mode = DEFAULT_MODE

    job_id = uuid.uuid4().hex
    os.makedirs(os.path.join(JOBS_DIR, job_id), exist_ok=True)
    set_status(job_id, "running", "작업 준비 중...")

    t = threading.Thread(target=capture_worker, args=(job_id, url, mode), daemon=True)
    t.start()

    return jsonify({"job_id": job_id})


@app.route("/status/<job_id>")
def status(job_id):
    state = get_status(job_id)
    if state is None:
        # 서버 재시작 후에도 결과 폴더가 남아 있으면 done으로 취급
        manifest = os.path.join(JOBS_DIR, job_id, "manifest.json")
        if JOB_ID_RE.match(job_id or "") and os.path.exists(manifest):
            return jsonify({"job_id": job_id, "status": "done", "progress": "완료!", "error": ""})
        return jsonify({"error": "존재하지 않는 작업입니다."}), 404
    return jsonify(state)


@app.route("/view/<job_id>")
def view(job_id):
    safe_job_dir(job_id)
    return render_template("viewer.html", job_id=job_id)


@app.route("/jobs/<job_id>/manifest.json")
def manifest(job_id):
    job_dir = safe_job_dir(job_id)
    if not os.path.exists(os.path.join(job_dir, "manifest.json")):
        abort(404)
    return send_from_directory(job_dir, "manifest.json")


@app.route("/jobs/<job_id>/images/<path:filename>")
def job_image(job_id, filename):
    job_dir = safe_job_dir(job_id)
    return send_from_directory(os.path.join(job_dir, "images"), filename)


@app.route("/delete/<job_id>", methods=["POST"])
def delete_job(job_id):
    """다 본 결과물 정리용. jobs/ 폴더가 계속 쌓이는 걸 막는다."""
    job_dir = safe_job_dir(job_id)
    shutil.rmtree(job_dir, ignore_errors=True)
    with jobs_lock:
        jobs.pop(job_id, None)
    return jsonify({"ok": True})


def lan_ip():
    """같은 와이파이의 다른 기기(아이폰 등)가 접속할 때 쓸 IP를 알아낸다."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # 실제로 패킷을 보내진 않는다. 어느 인터페이스가 쓰이는지만 확인한다.
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def main():
    p = argparse.ArgumentParser(description="유튜브 웹툰 캡처 로컬 서버")
    p.add_argument("--lan", action="store_true",
                   help="같은 와이파이의 다른 기기(아이폰 등)에서 접속할 수 있게 개방")
    p.add_argument("--host", default=None, help="바인딩할 주소 (기본: 127.0.0.1)")
    p.add_argument("--port", type=int, default=5000,
                   help="포트 (기본: 5000. 맥에서 AirPlay와 충돌하면 5050 등으로 변경)")
    args = p.parse_args()

    host = args.host or ("0.0.0.0" if args.lan else "127.0.0.1")
    exposed = host not in ("127.0.0.1", "localhost")

    os.makedirs(JOBS_DIR, exist_ok=True)

    print("=" * 62)
    print(" 유튜브 웹툰 캡처 - 로컬 프로토타입")
    print("")
    print("  이 맥에서      : http://127.0.0.1:%d" % args.port)
    if exposed:
        ip = lan_ip()
        if ip:
            print("  같은 와이파이에서: http://%s:%d  <- 아이폰에서 이 주소" % (ip, args.port))
        else:
            print("  같은 와이파이에서: IP를 찾지 못했습니다.")
            print("                    시스템 설정 > Wi-Fi > 세부사항에서 IP 주소를 확인하세요.")
        print("")
        print("  [주의] 지금 이 서버는 같은 네트워크의 모든 기기에 열려 있습니다.")
        print("         카페/회사 같은 공용 와이파이에서는 켜지 마세요.")
        print("         테스트가 끝나면 Ctrl+C로 반드시 종료하세요.")
    print("")
    print(" * 개인 검증용입니다. 캡처 결과를 배포/공유하지 마세요.  (종료: Ctrl+C)")
    print("=" * 62)

    # 외부에 열 때는 debug를 끈다.
    # Werkzeug 디버거가 네트워크에 노출되면 원격 코드 실행 위험이 있다.
    # 백그라운드 캡처 스레드가 죽지 않도록 reloader도 끈다.
    app.run(host=host, port=args.port, debug=not exposed,
            use_reloader=False, threaded=True)


if __name__ == "__main__":
    main()
