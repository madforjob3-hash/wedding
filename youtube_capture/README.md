# 유튜브 웹툰 캡처 (개인용 로컬 프로토타입)

유튜브 링크를 넣으면 영상의 **주요 장면을 캡처**하고 **그 시점의 자막을 매칭**해서,
세로로 쭉 스크롤하며 읽는 **웹툰형 리더**로 보여주는 개인용 로컬 웹앱입니다.

긴 영상을 처음부터 끝까지 보지 않고 빠르게 훑어보기 위한 개인 검증용 도구입니다.

---

## ⚠️ 반드시 먼저 읽어주세요 (법적 주의사항)

이 프로그램은 **개인이 자기 컴퓨터에서, 자기가 보려고 만든 검증용 프로토타입**입니다.

- 유튜브 영상을 다운로드하는 행위는 **유튜브 이용약관(ToS)에서 원칙적으로 금지**되어 있습니다.
  (유튜브가 제공하는 다운로드 기능이나 사전 허락을 받은 경우는 예외)
- 여기서 만들어진 **캡처 이미지와 자막 텍스트는 원저작자의 저작물**입니다.
  이것을 블로그·SNS·커뮤니티에 올리거나, 여러 사람에게 배포하거나,
  유료 서비스·광고 수익이 붙은 서비스로 만드는 것은
  **저작권 침해에 해당할 수 있고 실제 법적 분쟁으로 이어질 수 있습니다.**
- 이 앱은 그래서 **`127.0.0.1`(내 컴퓨터)에만 바인딩**되어 있습니다.
  외부에 공개하거나 서버에 올려서 서비스하지 마세요.
- 캡처 결과(`jobs/` 폴더)는 다 본 뒤 지우는 것을 권장합니다.

> 요약: **혼자 보기용으로만 쓰세요. 배포·공유·수익화는 하지 마세요.**

---

## 설치 (macOS 기준)

### 1단계. Homebrew로 ffmpeg 설치

장면 감지와 프레임 캡처에 `ffmpeg`를 씁니다. pip으로는 설치되지 않으니 brew로 따로 깔아야 합니다.

```bash
# Homebrew가 없다면 먼저 설치
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# ffmpeg 설치
brew install ffmpeg

# 확인 (버전이 출력되면 성공)
ffmpeg -version
```

### 2단계. 파이썬 패키지 설치

```bash
cd youtube_capture

pip3 install --break-system-packages -r requirements.txt
```

> **`--break-system-packages`가 왜 필요한가요?**
> 최신 macOS / Homebrew 파이썬은 시스템 파이썬 환경 보호 정책(PEP 668) 때문에
> 그냥 `pip3 install` 하면 `externally-managed-environment` 오류가 납니다.
> 이 옵션은 그 보호를 잠시 무시하고 설치하라는 뜻입니다.
>
> 시스템을 건드리는 게 찜찜하면 가상환경을 쓰는 쪽이 더 깔끔합니다:
> ```bash
> python3 -m venv .venv
> source .venv/bin/activate
> pip install -r requirements.txt    # 이때는 옵션 불필요
> ```

### 3단계. 서버 실행

```bash
python3 app.py
```

터미널에 주소가 뜨면 브라우저에서 접속하세요:

```
http://127.0.0.1:5000
```

종료는 터미널에서 `Ctrl + C`.

아이폰 등 다른 기기에서 보고 싶으면 `python3 app.py --lan` (아래 참고).

---

## 사용법

1. 브라우저에서 `http://127.0.0.1:5000` 접속
2. 유튜브 링크 붙여넣기
3. 캡처 모드 선택 (기본값: **자세히**)
4. **캡처 시작** 클릭 → 진행 상황이 실시간으로 표시됨
   (`영상 다운로드 중...` → `장면 전환 분석 중...` → `프레임 캡처 중 (12/80)...`)
5. 끝나면 자동으로 뷰어 화면으로 이동 → 세로로 스크롤하며 읽기

영상 길이와 모드에 따라 **수십 초에서 몇 분**까지 걸립니다.
(10분짜리 영상 기준 `자세히` 모드에서 대략 1~3분)

### 캡처 모드

| 모드 | 설명 | 최대 컷 | 자막 사용 |
|------|------|--------|----------|
| **요약** | 핵심 장면만 성기게 | 25컷 | ✕ |
| **자세히** (기본) | 적당히 촘촘하게 | 80컷 | ○ |
| **모두** | 아주 촘촘하게 | 300컷 | ○ |

내부 파라미터 (`capture_core.py`의 `MODES`):

- `scene_threshold` — ffmpeg 장면 전환 감지 민감도. **낮을수록 더 많이 감지**
- `min_gap` — 캡처 시점 간 최소 간격(초). 비슷한 컷이 연달아 나오는 걸 막음
- `max_captures` — 최종 컷 수 상한. 넘으면 **균등 간격으로 솎아냄**
- `use_captions` — 켜면 **자막 문장이 바뀌는 시점**도 캡처 후보에 포함

값을 직접 바꿔서 취향에 맞게 조절해도 됩니다.

---

## 아이폰 등 다른 기기에서 보기 (같은 와이파이)

맥에서 서버를 켜두고, 같은 와이파이에 연결된 아이폰에서 접속하는 방식입니다.

```bash
python3 app.py --lan
```

실행하면 터미널에 아이폰에서 칠 주소가 그대로 찍힙니다:

```
  이 맥에서      : http://127.0.0.1:5000
  같은 와이파이에서: http://192.168.0.12:5000  <- 아이폰에서 이 주소
```

아이폰 사파리 주소창에 그 주소를 입력하면 됩니다.
(사파리에서 "공유 > 홈 화면에 추가"를 하면 앱처럼 전체화면으로 볼 수 있습니다.)

### 주의

- `--lan`은 **같은 네트워크의 모든 기기에 서버를 여는** 옵션입니다.
  집 와이파이에서만 쓰고, **카페·회사·공용 와이파이에서는 켜지 마세요.**
- 테스트가 끝나면 `Ctrl + C`로 반드시 종료하세요.
- 안전을 위해 `--lan`일 때는 Flask 디버그 모드가 자동으로 꺼집니다.
  (디버거가 네트워크에 노출되면 원격 코드 실행 위험이 있습니다.)
- 옵션 없이 `python3 app.py`만 실행하면 예전처럼 `127.0.0.1`에만 열립니다.
- 맥 방화벽이 켜져 있으면 처음에 접속 허용 팝업이 뜹니다. "허용"을 눌러야 합니다.

```bash
python3 app.py --help          # 옵션 전체 보기
python3 app.py                 # 이 맥에서만
python3 app.py --lan           # 같은 와이파이의 다른 기기에서도
python3 app.py --serve         # 상시 운영 (waitress + 로그인 필수)
python3 app.py --set-password  # 로그인 비밀번호 설정/변경
python3 app.py --port 5050     # AirPlay와 포트가 충돌할 때
```

---

## 맥미니를 상시 서버로 쓰고 밖에서 접속하기

맥미니에서 서버를 계속 돌리고, Cloudflare Tunnel로 공개 https 주소를 붙이는
방법입니다. **공유기 포트포워딩도, 고정 IP도 필요 없습니다.** `cloudflared`가
맥미니 안에서 바깥으로 연결을 맺기 때문에, 앱은 계속 `127.0.0.1`에만
바인딩된 채로 있습니다.

```
아이폰 ──https──> Cloudflare ──터널──> 맥미니의 cloudflared ──> 127.0.0.1:5000
```

### 1단계. 비밀번호 설정 (필수)

공개 주소로 여는 이상 로그인 없이 두면 안 됩니다. 설정하지 않으면 `--serve`가
아예 실행을 거부합니다.

```bash
cd youtube_capture
python3 app.py --set-password
```

`.auth.json`에 **scrypt 해시만** 저장되고 비밀번호 원문은 저장되지 않습니다.
이 파일은 `.gitignore`에 들어 있으니 절대 커밋하지 마세요.

### 2단계. 운영 모드로 켜보기

```bash
pip3 install --break-system-packages -r requirements.txt   # waitress 포함
python3 app.py --serve
```

`--serve`는 개발 서버 대신 **waitress**로 띄우고 로그인을 강제합니다.
먼저 맥에서 `http://127.0.0.1:5000`으로 들어가 로그인이 되는지 확인하세요.

### 3단계. Cloudflare Tunnel 연결

Cloudflare 계정과, 그 계정에 등록된 도메인이 하나 필요합니다.

```bash
brew install cloudflared

cloudflared tunnel login                      # 브라우저에서 도메인 선택
cloudflared tunnel create youtube-capture     # TUNNEL_ID 출력됨

# 설정 파일 작성 (예시 파일 참고)
cp deploy/cloudflared-config.example.yml ~/.cloudflared/config.yml
# ~/.cloudflared/config.yml 에서 TUNNEL_ID / 도메인 / 사용자명을 본인 것으로 수정

# 도메인을 터널에 연결
cloudflared tunnel route dns youtube-capture capture.내도메인.com

# 실행해 보기
cloudflared tunnel run youtube-capture
```

이제 아이폰에서 `https://capture.내도메인.com` 으로 접속하면 로그인 화면이
뜹니다. 잘 되면 터널도 상시 실행으로 등록합니다:

```bash
sudo cloudflared service install
```

### 4단계. 재부팅해도 자동 실행 (launchd)

```bash
# 경로를 실제 값으로 채워서 설치
sed -e "s|__DIR__|$(pwd)|g" -e "s|__PYTHON__|$(which python3)|g" \
    deploy/com.local.youtube-capture.plist \
    > ~/Library/LaunchAgents/com.local.youtube-capture.plist

launchctl load -w ~/Library/LaunchAgents/com.local.youtube-capture.plist

# 확인
launchctl list | grep youtube-capture
tail -f jobs/server.log
```

내리거나 다시 올릴 때:

```bash
launchctl unload ~/Library/LaunchAgents/com.local.youtube-capture.plist
launchctl load -w ~/Library/LaunchAgents/com.local.youtube-capture.plist
```

> **launchd는 로그인 셸의 PATH를 물려받지 않습니다.** plist 안에 PATH를 직접
> 박아둔 이유가 이것입니다. 이게 없으면 ffmpeg와 yt-dlp를 못 찾아서
> "필수 프로그램이 설치되어 있지 않습니다" 오류가 납니다.
> 인텔 맥이면 Homebrew 경로가 `/usr/local/bin`입니다.

### 5단계. 맥미니가 잠들지 않게

절전으로 들어가면 서버도 같이 멈춥니다.

```bash
sudo pmset -a sleep 0 disksleep 0
pmset -g | grep -E " sleep| disksleep"   # 확인
```

### 운영하면서 알아둘 것

- **로그인 시도 제한**: 같은 IP에서 5회 틀리면 15분 잠깁니다. 공개 주소는
  스캐너 봇이 `/login`을 계속 두드리므로 이건 있어야 합니다.
- **동시 캡처 2개 제한**: 요청이 몰리면 맥미니가 멈추므로 상한을 걸어뒀습니다.
  `app.py`의 `MAX_CONCURRENT_JOBS`에서 조절합니다.
- **세션은 14일** 유지됩니다. 아이폰에서 매번 로그인하지 않아도 됩니다.
- **로그아웃**은 `/logout`으로 접속하면 됩니다.
- **비밀번호를 잊었으면** 맥미니에서 `python3 app.py --set-password`로 다시
  설정하면 됩니다.
- **결과물이 쌓입니다.** `jobs/` 폴더를 가끔 비우세요. 안 그러면 디스크가 찹니다.
- **터널을 끄면** 외부 접속이 즉시 끊깁니다. 잠시 닫고 싶을 때 가장 확실한
  방법입니다.

### ⚠️ 공개 주소로 열기 전에 다시 한 번

주소를 아는 사람은 누구나 이 서버로 영상을 받게 됩니다. 그러면:

- **모든 유튜브 요청이 집 IP에서 나갑니다.** 유튜브가 그 IP를 봇으로 판정하면
  `Sign in to confirm you're not a bot` 오류가 뜨면서 **본인도 못 쓰게 됩니다.**
- 개인 도구가 사실상 공개 유튜브 다운로드 서비스가 되고, 맨 위에 적은
  이용약관·저작권 문제가 그때부터 현실적인 위험이 됩니다.

**비밀번호를 남에게 알려주지 말고, 주소도 공유하지 마세요.** 본인 기기에서만
쓸 거라면 Cloudflare Tunnel 대신 Tailscale 같은 사설망을 쓰는 쪽이 더
안전합니다 (외부에 아무것도 노출되지 않습니다).

---

## Vercel 같은 곳에는 배포할 수 없나요?

**할 수 없습니다.** 서버리스 환경과 이 앱의 구조가 근본적으로 맞지 않습니다.

- **ffmpeg가 없습니다.** 장면 감지와 프레임 캡처가 전부 ffmpeg에 의존하는데,
  서버리스 런타임에는 ffmpeg 바이너리가 없고 설치할 방법도 없습니다.
- **파일시스템이 사라집니다.** `/tmp` 외에는 쓰기가 안 되고, 그마저 호출이 끝나면
  없어집니다. `jobs/` 폴더에 결과를 쌓아두는 구조가 성립하지 않습니다.
- **백그라운드 스레드가 죽습니다.** 응답을 반환하면 함수가 종료되므로 캡처 작업이
  중단되고, 상태 폴링은 `jobs` 딕셔너리가 빈 다른 인스턴스로 갑니다.
- **실행 시간 제한.** 무료 플랜은 10초입니다. 캡처는 보통 1~3분 걸립니다.

그래서 위처럼 **맥미니를 서버로 쓰고 터널만 붙이는 방식**을 씁니다. 영상 처리는
맥미니가 하고, Cloudflare는 주소와 https만 담당합니다.

---

## 터미널(CLI)로 쓰기

웹 화면 없이 터미널에서만 돌릴 수도 있습니다. 웹 서버와 **같은 로직**(`capture_core.py`)을 씁니다.

```bash
python3 youtube_capture.py "https://www.youtube.com/watch?v=XXXXXXXX"

# 모드 지정
python3 youtube_capture.py "URL" --mode summary

# 저장 위치 지정 + 원본 영상 남기기
python3 youtube_capture.py "URL" --mode all --out ./jobs/my_video --keep-video

# 도움말
python3 youtube_capture.py --help
```

CLI로 만든 결과도 `jobs/` 안에 들어가므로,
`python3 app.py`를 켜고 `http://127.0.0.1:5000/view/<폴더이름>` 으로 열면 웹툰 뷰어로 볼 수 있습니다.

---

## 자막에 대해

- 자막은 **자동 생성 자막 + 수동 자막**을 모두 시도해서 받아옵니다 (`ko` → `ko-KR` → `en` 우선순위).
- **자막이 아예 없는 영상도 많습니다.** 그런 영상은 **캡션 없이 이미지만** 나옵니다. 정상 동작입니다.
- 자동 생성 자막은 오타·띄어쓰기 오류가 섞여 있을 수 있습니다. 유튜브가 만든 그대로를 씁니다.
- `요약` 모드는 애초에 자막을 쓰지 않으므로(`use_captions=False`) 캡션이 표시되지 않습니다.
  자막을 같이 보고 싶으면 `자세히` 또는 `모두` 모드를 쓰세요.

---

## 폴더 구조

```
youtube_capture/
├── app.py                 # Flask 서버 (라우팅, 로그인, 백그라운드 스레드 작업)
├── auth.py                # 비밀번호 해시 + 로그인 시도 제한 (공개 운영용)
├── capture_core.py        # 핵심 로직 (다운로드/장면감지/캡처/자막매칭)
├── youtube_capture.py     # CLI 버전
├── templates/
│   ├── index.html         # 입력 화면
│   ├── viewer.html        # 웹툰형 스크롤 뷰어
│   └── login.html         # 로그인 화면
├── deploy/
│   ├── com.local.youtube-capture.plist   # launchd 자동 실행 설정
│   └── cloudflared-config.example.yml    # Cloudflare Tunnel 설정 예시
├── jobs/                  # 작업 결과 (git에 올라가지 않음)
│   └── <job_id>/
│       ├── images/0000.jpg ...
│       ├── captions.ko.vtt
│       └── manifest.json
├── .auth.json             # 비밀번호 해시 + 세션 키 (git 제외, 커밋 금지)
├── requirements.txt
└── README.md
```

### manifest.json 구조

```json
{
  "mode": "detail",
  "mode_label": "자세히 (최대 80컷)",
  "url": "https://www.youtube.com/watch?v=...",
  "duration": 612.4,
  "count": 47,
  "has_captions": true,
  "frames": [
    {
      "index": 0,
      "timestamp": 12.34,
      "time_label": "00:12",
      "image": "0000.jpg",
      "caption": "해당 시점의 자막 텍스트"
    }
  ]
}
```

---

## 동작 원리

1. **다운로드** — `yt-dlp`로 720p 이하 mp4를 받습니다 (`-f "mp4[height<=720]/mp4/best"`).
   화질을 낮게 잡는 이유는 캡처 용도에는 충분하고 훨씬 빠르기 때문입니다.
2. **자막 다운로드** — `yt-dlp --write-auto-sub --write-sub --convert-subs vtt`
3. **장면 전환 감지** — ffmpeg의 `select='gt(scene,THRESH)',showinfo` 필터를 돌리고,
   stderr로 나오는 `pts_time:` 값을 파싱해서 장면이 바뀌는 시각을 뽑습니다.
4. **후보 병합** — 장면 전환 시각 + 자막 시작 시각을 합치고, `min_gap`보다 붙어 있는 건 버립니다.
5. **다운샘플링** — `max_captures`를 넘으면 균등 간격으로 솎아냅니다.
6. **프레임 캡처** — 각 시각마다 `ffmpeg -ss <시각> -frames:v 1 -q:v 2` 로 jpg 한 장씩.
7. **자막 매칭** — 캡처 시각이 들어가는 자막 구간을 찾고, 없으면 4초 이내 가장 가까운 자막으로 폴백.
8. **원본 영상 삭제** — 캡처가 끝나면 용량 큰 mp4는 지웁니다 (CLI에서 `--keep-video`로 유지 가능).

---

## 문제 해결

**`필수 프로그램이 설치되어 있지 않습니다: ffmpeg`**
→ `brew install ffmpeg` 후 새 터미널을 열고 다시 실행하세요.

**`영상 다운로드에 실패했습니다`**
→ 대부분 `yt-dlp`가 오래된 경우입니다. 유튜브가 자주 바뀌기 때문에 자주 업데이트해야 합니다:
```bash
pip3 install --break-system-packages -U yt-dlp
```
→ 연령 제한·회원 전용·비공개 영상은 받을 수 없습니다.

**`externally-managed-environment` 오류**
→ `pip3 install` 뒤에 `--break-system-packages`를 붙이거나 가상환경(`venv`)을 쓰세요.

**너무 오래 걸려요**
→ 긴 영상은 장면 분석에 시간이 많이 걸립니다. `요약` 모드부터 써보세요.

**컷이 너무 적게/많게 나와요**
→ `capture_core.py`의 `MODES`에서 `scene_threshold`를 조절하세요.
   낮추면(예: 0.22 → 0.15) 더 많이, 높이면 더 적게 잡힙니다.

**자막이 하나도 안 나와요**
→ 그 영상에 자막 자체가 없을 수 있습니다. 유튜브에서 자막 버튼이 있는지 먼저 확인해보세요.
→ `요약` 모드는 자막을 쓰지 않습니다.

**결과가 계속 쌓여서 용량을 먹어요**
→ `jobs/` 폴더 안의 필요 없는 폴더를 지우면 됩니다. (`rm -rf jobs/<job_id>`)

---

## 알려진 한계

- 작업 상태는 **메모리에만** 저장되므로 서버를 재시작하면 진행 중이던 작업은 추적이 끊깁니다.
  (이미 완료된 결과는 `jobs/` 폴더에 남아 있어서 `/view/<job_id>`로 계속 볼 수 있습니다.)
- 동시에 여러 작업을 돌리면 CPU를 많이 먹습니다. 하나씩 돌리는 걸 권장합니다.
- 고정 카메라 영상(강의 등)은 장면 전환이 거의 없어서, 이 경우 균등 간격으로 캡처합니다.
