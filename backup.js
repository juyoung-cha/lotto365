const fs = require('fs');
const path = require('path');

function createBackup() {
    const dataDir = path.join(__dirname, 'data');
    const backupDir = path.join(dataDir, 'backup');

    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, ''); // HHMMSS
    const timestamp = `${dateStr}_${timeStr}`;

    const filesToBackup = [
        'lotto_all.json',
        'lotto_all.csv'
    ];

    let currentLastRound = 'unknown';
    const jsonPath = path.join(dataDir, 'lotto_all.json');
    if (fs.existsSync(jsonPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
            if (data.meta && data.meta.lastRound) {
                currentLastRound = String(data.meta.lastRound);
            }
        } catch (e) {}
    }

    console.log('==================================================');
    console.log(`📦 LOTTO 365 데이터 스냅샷 백업 시작 (최신: ${currentLastRound}회)`);
    console.log('==================================================');

    const backupResults = [];

    filesToBackup.forEach(fileName => {
        const src = path.join(dataDir, fileName);
        if (fs.existsSync(src)) {
            const ext = path.extname(fileName);
            const base = path.basename(fileName, ext);
            const destName = `${base}_R${currentLastRound}_${timestamp}${ext}`;
            const dest = path.join(backupDir, destName);
            
            fs.copyFileSync(src, dest);
            const stats = fs.statSync(dest);
            const sizeKB = (stats.size / 1024).toFixed(1);

            backupResults.push({ file: destName, size: `${sizeKB} KB` });
            console.log(`✅ [${ext.toUpperCase().replace('.', '')}] ${destName} (${sizeKB} KB) 저장 완료`);
        }
    });

    console.log('==================================================');
    console.log(`🎉 백업 저장소 경로: ${backupDir}`);
    console.log('==================================================');

    return {
        backupDir,
        timestamp,
        lastRound: currentLastRound,
        files: backupResults
    };
}

if (require.main === module) {
    createBackup();
}

module.exports = { createBackup };
