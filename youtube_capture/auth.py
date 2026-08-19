"""
auth.py - 공개 URL로 노출할 때 쓰는 비밀번호 인증

Cloudflare Tunnel 등으로 앱을 인터넷에 열면 주소를 아는 누구나 캡처를 돌릴 수
있게 된다. 그러면 모든 유튜브 요청이 이 집 IP에서 나가고, 유튜브가 그 IP를
봇으로 판정하는 순간 정작 본인도 못 쓰게 된다. 그래서 공개 모드에서는 로그인을
강제한다.

비밀번호는 평문으로 저장하지 않는다. scrypt 해시만 .auth.json에 넣는다.
세션 서명키도 같은 파일에 보관해서, 서버를 재시작해도 로그인이 풀리지 않는다.
"""

import json
import math
import os
import secrets
import time

from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, ".auth.json")

# 로그인 실패 제한 (무차별 대입 방어)
MAX_FAILS = 5
LOCKOUT_SECONDS = 15 * 60

# 세션 유지 기간
SESSION_DAYS = 14


# ---------------------------------------------------------------------------
# 설정 파일 입출력
# ---------------------------------------------------------------------------
def load_config():
    if not os.path.exists(CONFIG_PATH):
        return {}
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (ValueError, OSError):
        return {}


def save_config(cfg):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)
    # 본인만 읽을 수 있게 한다
    try:
        os.chmod(CONFIG_PATH, 0o600)
    except OSError:
        pass


def is_configured():
    return bool(load_config().get("password_hash"))


def set_password(password):
    """비밀번호를 설정(또는 변경)한다. 세션 서명키가 없으면 같이 만든다."""
    if not password or len(password) < 8:
        raise ValueError("비밀번호는 8자 이상이어야 합니다.")
    cfg = load_config()
    cfg["password_hash"] = generate_password_hash(password)
    if not cfg.get("secret_key"):
        cfg["secret_key"] = secrets.token_hex(32)
    cfg["updated_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
    save_config(cfg)


def check_password(password):
    h = load_config().get("password_hash")
    if not h:
        return False
    return check_password_hash(h, password or "")


def get_secret_key():
    """세션 서명키. 없으면 만들어서 저장한다 (재시작해도 세션이 유지되도록)."""
    cfg = load_config()
    key = cfg.get("secret_key")
    if not key:
        key = secrets.token_hex(32)
        cfg["secret_key"] = key
        save_config(cfg)
    return key


# ---------------------------------------------------------------------------
# 로그인 시도 제한
# ---------------------------------------------------------------------------
class RateLimiter:
    """IP별 로그인 실패 횟수를 세서 일정 횟수를 넘으면 잠근다 (메모리 보관)."""

    # 실패 후 이 시간 동안 조용하면 기록을 버린다.
    # 공개 주소는 스캐너 봇이 /login을 계속 두드리므로, 정리하지 않으면
    # IP 항목이 무한정 쌓인다.
    FORGET_SECONDS = 60 * 60

    def __init__(self, max_fails=MAX_FAILS, lockout=LOCKOUT_SECONDS):
        self.max_fails = max_fails
        self.lockout = lockout
        self._fails = {}   # ip -> [실패 횟수, 잠금 해제 시각, 마지막 실패 시각]

    def locked_for(self, ip):
        """남은 잠금 시간(초). 잠겨 있지 않으면 0."""
        entry = self._fails.get(ip)
        if not entry:
            return 0

        until = entry[1]
        if until <= 0:
            # 아직 잠기지 않은 상태. 실패 횟수는 그대로 둔다.
            # (여기서 지우면 카운트가 쌓이지 않아 제한이 무력화된다)
            return 0

        remain = until - time.time()
        if remain <= 0:
            self._fails.pop(ip, None)   # 잠금 만료 -> 기록 초기화
            return 0
        # 올림한다. int()로 내림하면 마지막 1초 동안 0(= 잠금 해제)이 되어
        # 호출부의 `if locked:` 검사를 그대로 통과해 버린다.
        return math.ceil(remain)

    def record_fail(self, ip):
        """실패를 기록하고 남은 시도 횟수를 반환한다."""
        self._prune()
        now = time.time()
        entry = self._fails.get(ip) or [0, 0, now]
        entry[0] += 1
        entry[2] = now
        if entry[0] >= self.max_fails:
            entry[1] = now + self.lockout
        self._fails[ip] = entry
        return max(0, self.max_fails - entry[0])

    def reset(self, ip):
        self._fails.pop(ip, None)

    def _prune(self):
        """오래된 기록 정리. 잠금 중인 항목은 남긴다."""
        now = time.time()
        for ip in [k for k, v in self._fails.items()
                   if v[1] <= now and (now - v[2]) > self.FORGET_SECONDS]:
            self._fails.pop(ip, None)


def client_ip(request):
    """
    실제 접속자 IP를 구한다.

    Cloudflare Tunnel 뒤에서는 remote_addr이 항상 127.0.0.1이므로
    CF-Connecting-IP 헤더를 본다. 이 헤더는 Cloudflare가 직접 채우고,
    터널은 localhost로만 연결되므로 외부에서 위조해 넣을 수 없다.
    """
    for header in ("CF-Connecting-IP", "X-Forwarded-For"):
        value = request.headers.get(header)
        if value:
            return value.split(",")[0].strip()
    return request.remote_addr or "?"
