#!/usr/bin/env python3
"""
youtube_capture.py - 터미널에서 쓰는 CLI 버전 (capture_core 재사용)

사용법:
    python3 youtube_capture.py "https://www.youtube.com/watch?v=..."
    python3 youtube_capture.py "URL" --mode summary
    python3 youtube_capture.py "URL" --mode all --out ./jobs/my_video --keep-video

[주의] 개인 검증용 프로토타입. 결과물 배포/공유는 유튜브 이용약관 및
저작권법상 문제가 될 수 있다. README.md 참고.
"""

import argparse
import os
import sys
import uuid

import capture_core
from capture_core import MODES, DEFAULT_MODE, CaptureError

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def build_parser():
    p = argparse.ArgumentParser(
        description="유튜브 영상의 주요 장면을 캡처하고 자막을 매칭합니다 (개인 검증용).",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    p.add_argument("url", help="유튜브 영상 링크")
    p.add_argument(
        "--mode", "-m",
        choices=list(MODES.keys()),
        default=DEFAULT_MODE,
        help="캡처 모드:\n" + "\n".join(
            "  %-8s %s" % (k, v["label"]) for k, v in MODES.items()
        ) + "\n(기본값: %s)" % DEFAULT_MODE,
    )
    p.add_argument("--out", "-o", default=None, help="결과 저장 폴더 (기본: jobs/<랜덤 id>)")
    p.add_argument("--keep-video", action="store_true", help="캡처 후 원본 영상 파일을 지우지 않음")
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)

    outdir = args.out or os.path.join(BASE_DIR, "jobs", uuid.uuid4().hex)
    outdir = os.path.abspath(outdir)

    print("모드   : %s" % MODES[args.mode]["label"])
    print("저장 위치: %s" % outdir)
    print("-" * 50)

    last = {"msg": ""}

    def progress(msg):
        # 같은 줄에 덮어쓰기 (진행률이 계속 바뀌므로)
        if msg != last["msg"]:
            sys.stdout.write("\r\033[K" + msg)
            sys.stdout.flush()
            last["msg"] = msg

    try:
        manifest = capture_core.run_capture(
            args.url, outdir, mode=args.mode,
            progress=progress, keep_video=args.keep_video,
        )
    except CaptureError as e:
        print("\n[오류] %s" % e, file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\n중단되었습니다.", file=sys.stderr)
        return 130

    print("\r\033[K" + "-" * 50)
    print("완료! %d컷 캡처됨" % manifest["count"])
    print("이미지  : %s" % os.path.join(outdir, "images"))
    print("메타데이터: %s" % os.path.join(outdir, "manifest.json"))
    if not manifest["has_captions"]:
        print("(이 영상은 자막이 없어 이미지만 저장되었습니다)")

    job_id = os.path.basename(outdir)
    print("\n웹 뷰어로 보려면: python3 app.py 실행 후")
    print("  http://127.0.0.1:5000/view/%s" % job_id)
    return 0


if __name__ == "__main__":
    sys.exit(main())
