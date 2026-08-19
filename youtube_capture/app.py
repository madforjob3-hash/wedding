"""
app.py - 유튜브 웹툰 캡처 로컬 웹 서버 (Flask)

실행:
    python3 app.py                  # 이 맥에서만 (개발용)
    python3 app.py --lan            # 같은 와이파이의 다른 기기에서도
    python3 app.py --serve          # 상시 운영 (waitress + 로그인 필수)
    python3 app.py --set-password   # 로그인 비밀번호 설정/변경

Cloudflare Tunnel로 공개할 때는 --serve를 쓴다. cloudflared가 같은 맥 안에서
localhost로 붙기 때문에, 이 서버는 계속 127.0.0.1에만 바인딩하면 된다.
공유기 포트를 열 필요가 없다.

[주의] 개인용 도구다. 공개 주소로 열면 캡처 결과의 배포·저작권 문제가
실제 위험이 되므로 README.md의 경고를 반드시 읽을 것.
"""

import argparse
import getpass
import os
import re
import secrets
import shutil
import socket
import sys
import threading
import uuid
from datetime import timedelta

from flask import (
    Flask, abort, jsonify, redirect, render_template, request, session,
    send_from_directory, url_for,
)
from flask.sessions import SecureCookieSessionInterface

import auth
import capture_core
from capture_core import MODES, DEFAULT_MODE, CaptureError

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JOBS_DIR = os.path.join(BASE_DIR, "jobs")

class ProtoAwareSession(SecureCookieSessionInterface):
    """
    요청이 실제로 https로 들어왔을 때만 세션 쿠키에 Secure를 붙인다.

    Secure를 무조건 붙이면 터널 없이 http://127.0.0.1 로 접속해 볼 때
    브라우저가 쿠키를 버려서 로그인이 무한 반복된다. 반대로 터널을 통한
    외부 접속은 Cloudflare가 https를 강제하므로 항상 Secure가 붙는다.
    (ProxyFix가 X-Forwarded-Proto를 반영해 주므로 판별이 가능하다)
    """

    def get_cookie_secure(self, app):
        return bool(request.is_secure)


app = Flask(__name__)
app.session_interface = ProtoAwareSession()
app.secret_key = secrets.token_hex(16)   # main()에서 영구 키로 덮어쓴다

# 로그인을 요구할지 여부. main()에서 결정한다.
AUTH_REQUIRED = False

# 동시에 돌릴 수 있는 캡처 수.
# 공개 주소로 열어두면 여러 요청이 한꺼번에 들어와 맥이 멈출 수 있다.
MAX_CONCURRENT_JOBS = 2

limiter = auth.RateLimiter()

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
# 로그인
# ---------------------------------------------------------------------------
def wants_json(path):
    """브라우저 화면이 아니라 fetch로 부르는 경로인지."""
    return path.startswith(("/capture", "/status/", "/delete/")) or path.endswith(".json")


@app.before_request
def require_login():
    if not AUTH_REQUIRED:
        return None
    if request.endpoint in ("login", "static"):
        return None
    if session.get("authed"):
        return None
    if wants_json(request.path):
        return jsonify({"error": "로그인이 필요합니다. 새로고침 후 다시 로그인하세요."}), 401
    return redirect(url_for("login", next=request.path))


@app.route("/login", methods=["GET", "POST"])
def login():
    if not AUTH_REQUIRED:
        return redirect(url_for("index"))

    ip = auth.client_ip(request)
    locked = limiter.locked_for(ip)

    if request.method == "POST":
        if locked:
            return render_template(
                "login.html", locked=True,
                error="시도 횟수를 초과했습니다. %d분 뒤에 다시 시도하세요." % ((locked // 60) + 1),
            ), 429

        if auth.check_password(request.form.get("password", "")):
            limiter.reset(ip)
            session.permanent = True
            session["authed"] = True

            # 오픈 리다이렉트 방지: 내부 경로로만 보낸다
            nxt = request.args.get("next") or "/"
            if not nxt.startswith("/") or nxt.startswith("//"):
                nxt = "/"
            return redirect(nxt)

        left = limiter.record_fail(ip)
        app.logger.warning("로그인 실패 (ip=%s, 남은 시도=%d)", ip, left)

        # 이번 시도로 잠겼다면 바로 알려준다
        locked = limiter.locked_for(ip)
        if locked:
            return render_template(
                "login.html", locked=True,
                error="시도 횟수를 초과했습니다. %d분 뒤에 다시 시도하세요." % ((locked // 60) + 1),
            ), 429

        return render_template(
            "login.html", locked=False,
            error="비밀번호가 틀렸습니다. (남은 시도 %d회)" % left,
        ), 401

    return render_template("login.html", locked=bool(locked),
                           error="시도 횟수를 초과했습니다. 잠시 뒤에 다시 시도하세요." if locked else None)


@app.route("/logout", methods=["GET", "POST"])
def logout():
    session.clear()
    return redirect(url_for("login"))


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

    with jobs_lock:
        running = sum(1 for j in jobs.values() if j["status"] == "running")
    if running >= MAX_CONCURRENT_JOBS:
        return jsonify({
            "error": "이미 %d개의 캡처가 돌고 있습니다. 끝난 뒤에 다시 시도하세요." % running
        }), 429

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


def do_set_password():
    """대화형으로 비밀번호를 설정한다."""
    print("공개 접속용 비밀번호를 설정합니다. (8자 이상)")
    pw1 = getpass.getpass("새 비밀번호: ")
    pw2 = getpass.getpass("한 번 더 입력: ")
    if pw1 != pw2:
        print("두 입력이 다릅니다.", file=sys.stderr)
        return 1
    try:
        auth.set_password(pw1)
    except ValueError as e:
        print(str(e), file=sys.stderr)
        return 1
    print("설정했습니다 -> %s" % auth.CONFIG_PATH)
    print("이 파일에는 해시만 저장되며, 비밀번호 원문은 저장되지 않습니다.")
    return 0


def main():
    p = argparse.ArgumentParser(description="유튜브 웹툰 캡처 서버")
    p.add_argument("--set-password", action="store_true",
                   help="공개 접속용 비밀번호를 설정/변경하고 종료")
    p.add_argument("--serve", action="store_true",
                   help="상시 운영 모드. waitress로 띄우고 로그인을 강제한다 "
                        "(Cloudflare Tunnel 뒤에서 쓰는 모드)")
    p.add_argument("--lan", action="store_true",
                   help="같은 와이파이의 다른 기기(아이폰 등)에서 접속할 수 있게 개방")
    p.add_argument("--host", default=None, help="바인딩할 주소 (기본: 127.0.0.1)")
    p.add_argument("--port", type=int, default=5000,
                   help="포트 (기본: 5000. 맥에서 AirPlay와 충돌하면 5050 등으로 변경)")
    args = p.parse_args()

    if args.set_password:
        return do_set_password()

    global AUTH_REQUIRED
    host = args.host or ("0.0.0.0" if args.lan else "127.0.0.1")
    lan_exposed = host not in ("127.0.0.1", "localhost")

    # --serve는 터널을 통해 인터넷에 열리는 모드다. 바인딩은 localhost지만
    # 실질적으로 공개이므로 로그인을 반드시 요구한다.
    public = args.serve
    AUTH_REQUIRED = public or lan_exposed or auth.is_configured()

    if AUTH_REQUIRED and not auth.is_configured():
        print("먼저 비밀번호를 설정해야 합니다:", file=sys.stderr)
        print("    python3 app.py --set-password", file=sys.stderr)
        return 1

    app.config.update(
        SECRET_KEY=auth.get_secret_key(),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        # SESSION_COOKIE_SECURE는 ProtoAwareSession이 요청별로 판단한다
        PERMANENT_SESSION_LIFETIME=timedelta(days=auth.SESSION_DAYS),
    )

    os.makedirs(JOBS_DIR, exist_ok=True)

    print("=" * 62)
    print(" 유튜브 웹툰 캡처")
    print("")
    print("  이 맥에서      : http://127.0.0.1:%d" % args.port)
    if lan_exposed:
        ip = lan_ip()
        if ip:
            print("  같은 와이파이에서: http://%s:%d" % (ip, args.port))
        else:
            print("  같은 와이파이에서: IP를 찾지 못했습니다.")
            print("                    시스템 설정 > Wi-Fi > 세부사항에서 확인하세요.")
    print("  로그인         : %s" % ("필요함" if AUTH_REQUIRED else "없음 (이 맥에서만 접속 가능)"))
    print("")
    if public:
        print("  [공개 모드] cloudflared가 이 주소로 붙습니다.")
        print("              공유기 포트를 열 필요는 없습니다.")
        print("              터널을 끄면 외부 접속도 같이 끊깁니다.")
    elif lan_exposed:
        print("  [주의] 같은 네트워크의 모든 기기에 열려 있습니다.")
        print("         공용 와이파이에서는 켜지 마세요.")
    print("")
    print(" * 캡처 결과를 배포/공유하지 마세요.  (종료: Ctrl+C)")
    print("=" * 62)

    if args.serve:
        try:
            from waitress import serve as waitress_serve
        except ImportError:
            print("waitress가 필요합니다: "
                  "pip3 install --break-system-packages waitress", file=sys.stderr)
            return 1

        # waitress는 기본적으로 X-Forwarded-* 헤더를 지워버린다
        # (clear_untrusted_proxy_headers 기본값 True). 그대로 두면 터널을 통해
        # https로 들어온 요청도 http로 보여서 세션 쿠키에 Secure가 붙지 않는다.
        # cloudflared는 항상 localhost에서 붙으므로 그 주소만 신뢰한다.
        #
        # 캡처가 오래 걸리므로 스레드를 넉넉히, 타임아웃은 길게 잡는다.
        waitress_serve(
            app, host=host, port=args.port,
            threads=8, channel_timeout=600, ident="youtube-capture",
            trusted_proxy="127.0.0.1",
            trusted_proxy_count=1,
            trusted_proxy_headers={"x-forwarded-for", "x-forwarded-proto",
                                   "x-forwarded-host"},
        )
        return 0

    # 외부에 열릴 때는 debug를 끈다.
    # Werkzeug 디버거가 노출되면 원격 코드 실행 위험이 있다.
    app.run(host=host, port=args.port, debug=not lan_exposed,
            use_reloader=False, threaded=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
