const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { createBackup } = require('./backup');

const DATA_JSON = path.join(__dirname, 'data', 'lotto_all.json');
const DATA_CSV = path.join(__dirname, 'data', 'lotto_all.csv');

/**
 * 날짜 형식 변환 (YYYYMMDD -> YYYY-MM-DD)
 */
function formatDate(ymdStr) {
    if (!ymdStr) return '';
    const str = String(ymdStr).replace(/[^0-9]/g, '');
    if (str.length === 8) {
        return `${str.substring(0, 4)}-${str.substring(4, 6)}-${str.substring(6, 8)}`;
    }
    return ymdStr;
}

/**
 * JSON 데이터를 CSV 형식으로 변환하여 저장
 */
function saveCSV(dataList) {
    const header = '회차,추첨일,번호1,번호2,번호3,번호4,번호5,번호6,보너스,1등상금(1인),1등당첨자수,1등총상금,총판매금액\n';
    const rows = dataList.map(item => {
        return [
            item.round,
            item.date,
            item.num1,
            item.num2,
            item.num3,
            item.num4,
            item.num5,
            item.num6,
            item.bonus,
            item.firstPrize || 0,
            item.firstWinners || 0,
            item.firstTotalPrize || 0,
            item.totalSales || 0
        ].join(',');
    }).join('\n');

    // Excel 한글 깨짐 방지용 BOM (\uFEFF) 추가
    fs.writeFileSync(DATA_CSV, '\uFEFF' + header + rows, 'utf-8');
    console.log(`📄 CSV 백업 파일 저장 완료: ${DATA_CSV} (총 ${dataList.length}건)`);
}

/**
 * 동행복권 최신 당첨 결과 수집 메인 함수
 */
async function scrapeLotto() {
    console.log(`[${new Date().toLocaleString()}] 🚀 동행복권 6/45 수집 프로세스 시작...`);

    let currentData = { data: [], meta: { totalRounds: 0, firstRound: 1, lastRound: 0, lastUpdate: '' } };
    if (fs.existsSync(DATA_JSON)) {
        try {
            currentData = JSON.parse(fs.readFileSync(DATA_JSON, 'utf-8'));
        } catch (e) {
            console.error('⚠️ 기존 JSON 파싱 실패, 새로 초기화합니다.', e);
        }
    }

    const lastRound = currentData.meta.lastRound || (currentData.data.length > 0 ? currentData.data[currentData.data.length - 1].round : 0);
    console.log(`📂 현재 저장된 마지막 회차: ${lastRound}회`);

    let browser = null;
    let updated = false;
    let addedCount = 0;

    try {
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        console.log('🌐 동행복권 결과 페이지 세션 연결 중...');
        await page.goto('https://www.dhlottery.co.kr/lt645/result', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        await page.waitForTimeout(1000);

        // 사이트 기준 최신 회차 번호 추출
        const latestOnSite = await page.evaluate(() => {
            const select = document.querySelector('#srchStrLtEpsd, #srchEndLtEpsd');
            if (select && select.options && select.options.length > 1) {
                // option 중 가장 큰 숫자 찾기
                const nums = Array.from(select.options)
                    .map(o => parseInt(o.value, 10))
                    .filter(n => !isNaN(n) && n > 0);
                if (nums.length > 0) return Math.max(...nums);
            }
            return null;
        });

        console.log(`🔎 공식 사이트 최신 회차: ${latestOnSite || '미확인'}회`);

        if (!latestOnSite) {
            throw new Error('사이트에서 최신 회차 번호를 감지하지 못했습니다.');
        }

        if (latestOnSite <= lastRound) {
            console.log(`✅ 이미 최신 회차(${lastRound}회)까지 모두 동기화되어 있습니다.`);
            return { updated: false, lastRound, message: 'Already up to date' };
        }

        const startRound = lastRound + 1;
        console.log(`📥 공백 회차 동기화 시작: ${startRound}회 ~ ${latestOnSite}회 (총 ${latestOnSite - startRound + 1}회차 수집 예정)`);

        for (let r = startRound; r <= latestOnSite; r++) {
            const apiRes = await page.evaluate(async (targetRound) => {
                try {
                    const res = await fetch(`/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=${targetRound}&_=${Date.now()}`, {
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest',
                            'Accept': 'application/json, text/javascript, */*; q=0.01'
                        }
                    });
                    if (!res.ok) return null;
                    return await res.json();
                } catch (e) {
                    return null;
                }
            }, r);

            if (apiRes && apiRes.data && apiRes.data.list && apiRes.data.list.length > 0) {
                const item = apiRes.data.list.find(l => l.ltEpsd === r) || apiRes.data.list[0];
                const roundObj = {
                    round: item.ltEpsd,
                    date: formatDate(item.ltRflYmd),
                    num1: item.tm1WnNo,
                    num2: item.tm2WnNo,
                    num3: item.tm3WnNo,
                    num4: item.tm4WnNo,
                    num5: item.tm5WnNo,
                    num6: item.tm6WnNo,
                    bonus: item.bnsWnNo,
                    firstPrize: item.rnk1WnAmt || 0,
                    firstWinners: item.rnk1WnNope || 0,
                    firstTotalPrize: item.rnk1SumWnAmt || 0,
                    totalSales: item.totSellAmt || 0
                };

                // 기존 중복 방지 후 추가
                const existingIdx = currentData.data.findIndex(d => d.round === r);
                if (existingIdx >= 0) {
                    currentData.data[existingIdx] = roundObj;
                } else {
                    currentData.data.push(roundObj);
                }

                addedCount++;
                updated = true;
                console.log(`  [${addedCount}/${latestOnSite - startRound + 1}] ✅ 제 ${r}회 (${roundObj.date}) 수집 완료: [${roundObj.num1}, ${roundObj.num2}, ${roundObj.num3}, ${roundObj.num4}, ${roundObj.num5}, ${roundObj.num6} + ${roundObj.bonus}]`);
            } else {
                console.warn(`  ⚠️ 제 ${r}회 수집 응답 없음`);
            }

            // 부하 방지용 미세 딜레이
            await page.waitForTimeout(200);
        }

        if (updated) {
            // 정렬 및 메타데이터 업데이트
            currentData.data.sort((a, b) => a.round - b.round);
            currentData.meta = {
                totalRounds: currentData.data.length,
                firstRound: currentData.data.length > 0 ? currentData.data[0].round : 1,
                lastRound: currentData.data.length > 0 ? currentData.data[currentData.data.length - 1].round : 0,
                lastUpdate: new Date().toISOString()
            };

            // JSON 저장
            const dataDir = path.dirname(DATA_JSON);
            if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
            fs.writeFileSync(DATA_JSON, JSON.stringify(currentData, null, 2), 'utf-8');
            console.log(`💾 JSON 데이터 저장 완료: ${DATA_JSON} (최종 회차: ${currentData.meta.lastRound}회)`);

            // CSV 저장
            saveCSV(currentData.data);

            // 자동 스냅샷 백업 생성
            createBackup();
        }

    } catch (err) {
        console.error('❌ 로또 데이터 수집 중 오류 발생:', err.message);
    } finally {
        if (browser) await browser.close();
    }

    return {
        updated,
        lastRound: currentData.meta.lastRound,
        addedCount
    };
}

if (require.main === module) {
    scrapeLotto();
}

module.exports = { scrapeLotto, formatDate };
