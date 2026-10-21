const { chromium } = require('playwright');

async function checkLatest() {
    console.log('🔍 동행복권 최신 회차 확인 중...');
    let browser = null;
    try {
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        await page.goto('https://www.dhlottery.co.kr/lt645/result', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        // 최신 회차 정보 API 호출
        const data = await page.evaluate(async () => {
            const select = document.querySelector('#srchStrLtEpsd');
            let latestRound = null;
            if (select && select.options && select.options.length > 1) {
                const nums = Array.from(select.options)
                    .map(o => parseInt(o.value, 10))
                    .filter(n => !isNaN(n) && n > 0);
                if (nums.length > 0) latestRound = Math.max(...nums);
            }
            if (!latestRound) return null;

            const res = await fetch(`/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=${latestRound}&_=${Date.now()}`, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json, text/javascript, */*; q=0.01'
                }
            });
            if (!res.ok) return null;
            return await res.json();
        });

        if (data && data.data && data.data.list && data.data.list.length > 0) {
            const item = data.data.list[0];
            const dateStr = item.ltRflYmd ? `${item.ltRflYmd.substring(0,4)}-${item.ltRflYmd.substring(4,6)}-${item.ltRflYmd.substring(6,8)}` : '';
            console.log(`✅ 사이트 기준 최신 회차: 제 ${item.ltEpsd}회`);
            console.log(`📅 추첨일: ${dateStr}`);
            console.log(`🎱 당첨 번호: [${item.tm1WnNo}, ${item.tm2WnNo}, ${item.tm3WnNo}, ${item.tm4WnNo}, ${item.tm5WnNo}, ${item.tm6WnNo}] + 보너스 [${item.bnsWnNo}]`);
            console.log(`💰 1등 1인 당첨금: ${(item.rnk1WnAmt || 0).toLocaleString()}원 (${item.rnk1WnNope}명)`);
        } else {
            console.warn('⚠️ 최신 회차 데이터 응답 없음');
        }

    } catch (e) {
        console.error('❌ 확인 실패:', e.message);
    } finally {
        if (browser) await browser.close();
    }
}

if (require.main === module) {
    checkLatest();
}

module.exports = { checkLatest };
