# 디바이스 인증 / 암호화 가이드

## 개요

전략 인사이트 사이트는 공개(public) 저장소이지만, 데이터 파일은 **AES-GCM 256 + PBKDF2-SHA256 (600,000 iter)** 으로 암호화되어 있습니다.

비밀번호(기본: `0714`)를 모르면 카카오톡 링크로 받은 인사이트를 열람할 수 없습니다.

- 인증된 디바이스는 `localStorage` 에 유도 키가 저장되어 **이후 자동 로그인**
- 다른 디바이스/브라우저에서는 다시 비밀번호 입력 필요
- 시크릿 모드 / 캐시 초기화 시 인증 다시 필요

## 사용자 흐름

1. 카카오톡 알림톡 링크 클릭 (`.../insight.html?file=data/IT/2026-06-02.html`)
2. 인증되지 않은 디바이스 → `login.html` 로 자동 이동
3. PIN `0714` 입력 → 검증 성공 시 원래 URL 로 복귀
4. 다음부터는 그 디바이스에서 인증 페이지를 건너뜀

## 일일 워크플로우 (Power Automate)

Power Automate 측은 **그대로 두면 됩니다.** 매일 평문 HTML 을 `data/{부서}/YYYY-MM-DD.html` 로 push 만 하세요.

- push 발생 → GitHub Actions(`Auto-encrypt data files`) 가 자동 실행
- 워크플로우가 `tools/encrypt.py --all` 로 평문 파일을 암호화
- 결과를 봇 계정으로 커밋 (`[skip ci]` 포함하여 무한 루프 방지)

## 수동 암호화 (로컬)

```bash
pip install cryptography
python tools/encrypt.py --check          # 현재 상태 확인
python tools/encrypt.py --all            # data/ 전체 암호화
python tools/encrypt.py data/IT/2026-06-02.html  # 특정 파일만
```

비밀번호를 바꾸려면 환경변수로:

```bash
INSIGHT_PASSWORD='새비밀번호' python tools/encrypt.py --all
```

## 비밀번호 변경 절차

비밀번호를 `0714` 외 다른 값으로 바꾸려면:

1. 새 솔트/센티넬 생성 (Node.js 스크립트로 한 번 만들면 됨)
2. `tools/auth-config.json` 의 `saltB64` 교체
3. `data/.verify.json` 교체 (새 비밀번호로 `"DSI_OK"` 를 암호화한 결과)
4. 기존 데이터 파일 전부 재암호화 (`--all`)
5. 모든 사용자가 다시 로그인 필요 → 안내 공지

## GitHub Actions 비밀번호 설정 (선택)

기본값 `0714` 가 워크플로우에 하드코딩되어 별도 설정 없이 동작합니다.
다른 비밀번호로 바꾸고 싶으면 저장소 Settings → Secrets → Actions 에서
`INSIGHT_PASSWORD` 시크릿을 등록하세요.

## 보안 모델과 한계

- 공개 저장소이므로 누구나 암호화 파일을 받아 **오프라인 무차별 대입** 시도 가능
- `0714` 처럼 4 자리 PIN 은 PBKDF2 가 있어도 시간 들이면 뚫림
- 회사 컴플라이언스 관점에서 "기술적 접근 통제" 요건은 충족
- 더 강한 보안이 필요하면 비밀번호를 길게 (8 자 이상) 변경 권장

## 파일 구조

```
├── login.html                      # 비밀번호 입력 페이지
├── insight.html                    # 상세 페이지 (가드 + 복호화)
├── index.html                      # 메인 페이지 (가드)
├── assets/js/auth.js               # 인증/복호화 라이브러리
├── tools/auth-config.json          # 공개 솔트/파라미터
├── tools/encrypt.py                # 로컬 암호화 스크립트
├── data/.verify.json               # 비밀번호 검증용 센티넬 (암호화된 "DSI_OK")
├── data/{부서}/YYYY-MM-DD.html     # 암호화된 인사이트 본문
└── .github/workflows/encrypt.yml   # push 시 자동 암호화
```
