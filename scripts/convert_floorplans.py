#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
우리안과 평면도 PDF -> PNG 변환 스크립트

사용 방법:
    1) PyMuPDF 설치
       pip install pymupdf
    2) 실행 (저장소 루트에서)
       python scripts\\convert_floorplans.py

기본 입력 경로 (네트워크 공유):
    \\\\172.11.1.5\\03 업무용 검사팀\\4.기타\\박승근\\박승근\\평면도\\평면도

다른 경로 사용:
    set FLOORPLAN_INPUT=C:\\어떤\\경로
    python scripts\\convert_floorplans.py

출력:
    public/floorplans/floor-{1..7}.png

특징:
    - 한글 파일명/UNC 네트워크 경로 안전 처리
    - 한 층 변환 실패해도 전체 스크립트는 죽지 않음 (요약 후 종료 코드만 변경)
    - PyMuPDF 사용 (poppler 같은 외부 바이너리 불필요)
"""

import os
import sys


DEFAULT_INPUT = r"\\172.11.1.5\03 업무용 검사팀\4.기타\박승근\박승근\평면도\평면도"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "public", "floorplans"))
FLOORS = [1, 2, 3, 4, 5, 6, 7]
DPI = 150  # 96(스크린) ~ 200(고해상도). 150이면 평면도용으로 적절


def log(level, msg):
    # 한글 콘솔에서도 깨지지 않게 ascii 마커 사용
    print(f"[{level}] {msg}", flush=True)


def convert_one(fitz, src, dst):
    """단일 PDF -> PNG. 성공 시 True, 실패 시 False."""
    if not os.path.exists(src):
        log("WARN", f"not found: {src}")
        return False
    try:
        doc = fitz.open(src)
        try:
            if doc.page_count == 0:
                log("WARN", f"empty PDF: {src}")
                return False
            page = doc[0]
            zoom = DPI / 72.0
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            pix.save(dst)
        finally:
            doc.close()
        log("OK", f"{src}  ->  {dst}")
        return True
    except Exception as e:
        log("ERROR", f"{src}: {e}")
        return False


def main():
    try:
        import fitz  # PyMuPDF
    except ImportError:
        log("ERROR", "PyMuPDF 가 필요합니다. 설치: pip install pymupdf")
        return 1

    input_dir = os.environ.get("FLOORPLAN_INPUT", DEFAULT_INPUT)
    log("INFO", f"input  : {input_dir}")
    log("INFO", f"output : {OUTPUT_DIR}")

    if not os.path.exists(input_dir):
        log("WARN", "입력 경로에 접근할 수 없습니다.")
        log("WARN", " - 네트워크 공유에 로그인되어 있는지 확인하세요.")
        log("WARN", " - 또는 환경변수 FLOORPLAN_INPUT 로 로컬 경로를 지정하세요.")
        # 그래도 빈 출력 폴더는 만들어두고 종료
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        return 1

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    success, failed = [], []
    for n in FLOORS:
        src = os.path.join(input_dir, f"{n}층.pdf")
        dst = os.path.join(OUTPUT_DIR, f"floor-{n}.png")
        if convert_one(fitz, src, dst):
            success.append(n)
        else:
            failed.append(n)

    log("SUMMARY", f"success={success} failed={failed}")
    return 0 if not failed else 2


if __name__ == "__main__":
    sys.exit(main())
