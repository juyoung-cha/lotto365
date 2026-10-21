const express = require('express');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { scrapeLotto } = require('./scraper_playwright');

const app = express();
const PORT = 3000;

const DATA_FILE = path.join(__dirname, 'data', 'lotto_all.json');

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));

// GCS 버킷 URL (백업용)
const GCS_URL = 'https://storage.googleapis.com/lotto-data-petmind-10422/lotto_all.json';

// [상용화급 무중단 자동 스케줄링 설정]
// 1. 매주 토요일 21:00 ~ 22:00 사이 15분 간격 자동 수집 (동행복권 발표 지연 대비 재시도)
//    스케줄: 매주 토요일 21:00, 21:15, 21:30, 21:45, 22:00 실행
cron.schedule('*/15 21-22 * * 6', async () => {
    console.log(`[${new Date().toLocaleString()}] 🕒 [정기 토요 스케줄] 로또 추첨 결과 동기화 시도...`);
    try {
        const result = await scrapeLotto();
        if (result.updated) {
            console.log(`🎉 [정기 스케줄] 신규 제 ${result.lastRound}회 데이터 동기화 성공! (+${result.addedCount}건)`);
        } else {
            console.log(`✅ [정기 스케줄] 이미 최신 상태 유지 중 (제 ${result.lastRound}회)`);
        }
    } catch (e) {
        console.error('❌ [정기 스케줄] 실행 중 오류:', e.message);
    }
});

// 2. 매주 일요일 오전 09:00 최종 검증 스케줄
cron.schedule('0 9 * * 0', async () => {
    console.log(`[${new Date().toLocaleString()}] 🕒 [일요 백업 스케줄] 최종 데이터 무결성 검증...`);
    try {
        await scrapeLotto();
    } catch (e) {
        console.error('❌ [일요 스케줄] 오류:', e.message);
    }
});

// API 엔드포인트
app.get('/api/lotto', async (req, res) => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const localData = fs.readFileSync(DATA_FILE, 'utf-8');
            res.json(JSON.parse(localData));
        } else {
            console.log('🌐 GCS에서 데이터 시도 중...');
            const response = await fetch(GCS_URL);
            if (!response.ok) {
                throw new Error(`GCS fetch failed: ${response.statusText}`);
            }
            const data = await response.json();
            
            const dir = path.dirname(DATA_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
            
            res.json(data);
        }
    } catch (error) {
        console.error('❌ 데이터 로드 실패:', error);
        res.status(500).json({ error: '데이터를 가져올 수 없습니다.', data: [] });
    }
});

// 수동 수집 트리거 (관리자/프론트엔드 연동)
app.post('/api/trigger-scrape', async (req, res) => {
    try {
        const result = await scrapeLotto();
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, async () => {
    console.log(`🚀 LOTTO 365 서버 실행 중: http://localhost:${PORT}`);
    console.log(`📂 누적 데이터 경로: ${DATA_FILE}`);
    
    // 서버 기동 시 백그라운드에서 최신 회차 동기화 여부 1회 확인
    setTimeout(async () => {
        console.log('🔍 [서버 기동] 데이터 최신성 헬스체크 시작...');
        try {
            await scrapeLotto();
        } catch (e) {
            console.warn('⚠️ [서버 기동] 초기 헬스체크 실패 (무시됨):', e.message);
        }
    }, 2000);
});
