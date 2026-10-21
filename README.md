# 로또 365 프로페셔널 대시보드 (LOTTO 365 Professional)

동행복권 로또 6/45의 역대 전 회차 당첨 데이터를 실시간 자동 수집하고, 8대 통계학적 지표 분석 및 AI 스마트 번호 추출 엔진을 제공하는 상용화급 웹 대시보드입니다.

---

## 🌟 주요 기능

- **실시간 공식 데이터 수집**: 동행복권 최신 규격에 맞춘 고성능 Playwright 수집 엔진 탑재
- **자동 스케줄링**: 매주 토요일 오후 9시(21:00) 정기 자동 수집 및 동기화 (cron 지원)
- **8대 통계학적 지표 자동 산출**: 홀/짝, 고/저, 총합, AC값, 연속번호, 끝자리합, 소수개수, 동일끝수 실시간 연산
- **AI 맞춤형 번호 추출기**: 균형 배분, 핫넘버, 콜드넘버, AC법칙, 순수 랜덤 모드 및 포함/제외 번호 필터링
- **완벽한 반응형 웹 (Cross-Device)**: PC 데스크톱, iPad/태블릿, iPhone/안드로이드 모바일 전 디바이스 뷰포트 최적화

---

## 🚀 빠른 시작

### 1. 의존성 설치

```bash
npm install
```

### 2. 최신 데이터 수동 수집 / 백필

```bash
npm run fetch
```
또는
```bash
node scraper_playwright.js
```

### 3. 대시보드 서버 실행

```bash
node dashboard.js
```
* 브라우저에서 `http://localhost:3000`으로 접속하여 대시보드를 확인합니다.

### 4. 최신 회차 상태 간이 확인

```bash
node check_latest.js
```

---

## 📁 프로젝트 구조

- `dashboard.js`: Express 대시보드 웹 서버 및 정기 cron 스케줄러
- `scraper_playwright.js`: 동행복권 공식 JSON API 기반 최신 데이터 수집 엔진
- `fetch_lotto.js`: 데이터 수집 통합 실행 엔트리 (`npm run fetch`)
- `check_latest.js`: 사이트 최신 회차 및 당첨 결과 빠른 조회 스크립트
- `public/`: 웹 대시보드 프론트엔드 (Vue.js 3 + Tailwind CSS 반응형 UI)
- `data/`: 누적 데이터 저장소 (`lotto_all.json`, `lotto_all.csv`)
- `functions/`: Google Cloud Platform 서버리스 수집 함수 코드

---

## 🛠 기술 스택

- **Frontend**: HTML5, Vue.js 3, Tailwind CSS (반응형 다크 테마)
- **Backend**: Node.js, Express, Playwright, node-cron
- **Storage & Cloud**: JSON/CSV Local Storage, Google Cloud Platform (Functions/Storage)
