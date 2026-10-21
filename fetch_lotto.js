/**
 * 동행복권 로또 6/45 누적 당첨 기록 수집기 메인 엔트리
 * 최신 동행복권 공식 규격 Playwright 스크래퍼 구동
 */

const { scrapeLotto } = require('./scraper_playwright');

async function main() {
    console.log('==================================================');
    console.log('🎱 LOTTO 365 Professional 데이터 수집기');
    console.log('==================================================');
    
    try {
        const result = await scrapeLotto();
        console.log('==================================================');
        if (result.updated) {
            console.log(`🎉 데이터 수집 완료! (최신 회차: 제 ${result.lastRound}회, 신규 추가: ${result.addedCount || 0}건)`);
        } else {
            console.log(`✅ 최신 상태 유지 중 (현재 마지막 회차: 제 ${result.lastRound}회)`);
        }
        console.log('==================================================');
    } catch (err) {
        console.error('❌ 수집 실패:', err);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main };
