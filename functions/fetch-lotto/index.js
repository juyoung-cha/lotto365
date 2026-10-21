const functions = require('@google-cloud/functions-framework');
const { Storage } = require('@google-cloud/storage');
const puppeteer = require('puppeteer');

const BUCKET_NAME = 'lotto-data-petmind-10422';
const FILE_NAME = 'lotto_all.json';
const storage = new Storage();
const bucket = storage.bucket(BUCKET_NAME);

function formatDate(ymdStr) {
    if (!ymdStr) return '';
    const str = String(ymdStr).replace(/[^0-9]/g, '');
    if (str.length === 8) {
        return `${str.substring(0, 4)}-${str.substring(4, 6)}-${str.substring(6, 8)}`;
    }
    return ymdStr;
}

functions.http('fetchLotto', async (req, res) => {
    console.log('🚀 로또 데이터 수집 시작 (Cloud Function)');

    let browser = null;
    try {
        // 1. GCS에서 기존 데이터 로드
        const file = bucket.file(FILE_NAME);
        const [exists] = await file.exists();
        let currentData = { data: [], meta: { totalRounds: 0, firstRound: 1, lastRound: 0, lastUpdate: '' } };

        if (exists) {
            const [content] = await file.download();
            currentData = JSON.parse(content.toString('utf-8'));
            console.log(`📂 기존 데이터 로드 완료 (최신 회차: ${currentData.meta.lastRound})`);
        } else {
            console.log('📂 기존 데이터 없음, 새로 생성 예정');
        }

        const lastRound = currentData.meta.lastRound || (currentData.data.length > 0 ? currentData.data[currentData.data.length - 1].round : 0);

        // 2. Puppeteer 실행
        browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: 'new'
        });
        const page = await browser.newPage();

        await page.goto('https://www.dhlottery.co.kr/lt645/result', { waitUntil: 'domcontentloaded', timeout: 30000 });

        // 최신 회차 번호 추출
        const latestRound = await page.evaluate(() => {
            const select = document.querySelector('#srchStrLtEpsd');
            if (select && select.options && select.options.length > 1) {
                const nums = Array.from(select.options)
                    .map(o => parseInt(o.value, 10))
                    .filter(n => !isNaN(n) && n > 0);
                if (nums.length > 0) return Math.max(...nums);
            }
            return null;
        });

        console.log(`🔥 사이트 최신 회차: ${latestRound}`);

        if (!latestRound || latestRound <= lastRound) {
            console.log('✅ 이미 최신 데이터입니다.');
            res.status(200).send(`Already up to date (lastRound: ${lastRound})`);
            return;
        }

        let addedCount = 0;
        for (let r = lastRound + 1; r <= latestRound; r++) {
            const data = await page.evaluate(async (targetRound) => {
                try {
                    const response = await fetch(`/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=${targetRound}&_=${Date.now()}`, {
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest',
                            'Accept': 'application/json, text/javascript, */*; q=0.01'
                        }
                    });
                    if (!response.ok) return null;
                    return await response.json();
                } catch (e) {
                    return null;
                }
            }, r);

            if (data && data.data && data.data.list && data.data.list.length > 0) {
                const item = data.data.list.find(l => l.ltEpsd === r) || data.data.list[0];
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

                const existingIdx = currentData.data.findIndex(d => d.round === r);
                if (existingIdx >= 0) currentData.data[existingIdx] = roundObj;
                else currentData.data.push(roundObj);

                addedCount++;
            }
        }

        // 3. 데이터 병합 및 저장
        currentData.data.sort((a, b) => a.round - b.round);
        currentData.meta.lastRound = currentData.data[currentData.data.length - 1].round;
        currentData.meta.firstRound = currentData.data[0].round;
        currentData.meta.lastUpdate = new Date().toISOString();
        currentData.meta.totalRounds = currentData.data.length;

        // GCS 업로드
        await file.save(JSON.stringify(currentData, null, 2), {
            contentType: 'application/json',
            resumable: false
        });
        try {
            await file.makePublic();
        } catch (e) {
            console.warn('GCS makePublic warning:', e.message);
        }

        console.log(`✅ ${latestRound}회차까지 업데이트 완료 (신규 ${addedCount}건)`);
        res.status(200).send(`Updated to round ${latestRound} (+${addedCount})`);

    } catch (error) {
        console.error('❌ 에러 발생:', error);
        res.status(500).send(error.message);
    } finally {
        if (browser) await browser.close();
    }
});
