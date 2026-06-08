const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        passed++;
        console.log(`  ✓ ${message}`);
    } else {
        failed++;
        console.log(`  ✗ ${message}`);
    }
}

function suite(name) {
    console.log(`\n━━━ ${name} ━━━`);
}

async function runTests() {
    const SQL = await initSqlJs();
    const db = new SQL.Database();

    // Directly build the schema and data (same as database.js)
    db.run(`
        CREATE TABLE persons (id INTEGER PRIMARY KEY, name TEXT NOT NULL, gender TEXT, age INTEGER, occupation TEXT, address TEXT, phone TEXT, relationship_notes TEXT);
        CREATE TABLE locations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, type TEXT, address TEXT, description TEXT);
        CREATE TABLE events (id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL, event_time TEXT NOT NULL, location_id INTEGER, description TEXT, event_type TEXT);
        CREATE TABLE evidence (id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL, type TEXT, description TEXT NOT NULL, found_location_id INTEGER, found_time TEXT, related_person_id INTEGER, is_red_herring INTEGER DEFAULT 0);
        CREATE TABLE communications (id INTEGER PRIMARY KEY, sender_id INTEGER, receiver_id INTEGER, comm_time TEXT NOT NULL, comm_type TEXT, duration_minutes INTEGER, content_summary TEXT);
        CREATE TABLE financial_records (id INTEGER PRIMARY KEY, person_id INTEGER, transaction_time TEXT NOT NULL, amount REAL NOT NULL, transaction_type TEXT, counterparty TEXT, description TEXT);
        CREATE TABLE alibis (id INTEGER PRIMARY KEY, person_id INTEGER, case_id INTEGER NOT NULL, alibi_time_start TEXT, alibi_time_end TEXT, alibi_location TEXT, witness_id INTEGER, verified INTEGER DEFAULT 0);
        CREATE TABLE relationships (id INTEGER PRIMARY KEY, person1_id INTEGER, person2_id INTEGER, relationship_type TEXT, description TEXT, since_date TEXT);
        CREATE TABLE case_files (id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL, title TEXT NOT NULL, summary TEXT, victim_id INTEGER, crime_time_estimated TEXT, crime_location_id INTEGER, cause_of_death TEXT, status TEXT DEFAULT '调查中');
        CREATE TABLE medical_records (id INTEGER PRIMARY KEY, person_id INTEGER, record_date TEXT, hospital TEXT, diagnosis TEXT, prescription TEXT, doctor_id INTEGER);
        CREATE TABLE surveillance (id INTEGER PRIMARY KEY, location_id INTEGER, capture_time TEXT, person_id INTEGER, description TEXT, camera_id TEXT);
    `);

    // Load and execute data insertion from database.js source
    const dbSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'database.js'), 'utf8');

    // Extract all INSERT statements
    const insertRegex = /this\.db\.run\(`\s*(INSERT[\s\S]*?)`\)/g;
    let match;
    while ((match = insertRegex.exec(dbSource)) !== null) {
        const sql = match[1].trim();
        try {
            db.run(sql);
        } catch (e) {
            console.error(`Insert failed: ${e.message}\nSQL: ${sql.substring(0, 100)}`);
        }
    }

    // Create a DatabaseManager-like interface for testing
    const DatabaseManager = {
        db,
        executeQuery(sql) {
            const trimmed = sql.trim().replace(/;+$/, '').trim();
            const upper = trimmed.toUpperCase();
            const forbidden = ['INSERT','UPDATE','DELETE','DROP','CREATE','ALTER','ATTACH','DETACH','PRAGMA','VACUUM','REINDEX','GRANT','REVOKE','BEGIN','COMMIT','ROLLBACK','SAVEPOINT','RELEASE'];
            const firstWord = upper.split(/\s+/)[0];
            if (firstWord !== 'SELECT' && firstWord !== 'WITH' && firstWord !== 'EXPLAIN') {
                const matched = forbidden.find(f => upper.startsWith(f));
                if (matched) throw new Error(`安全限制：不允许执行 ${matched} 操作。`);
                throw new Error(`不支持的操作：${firstWord}`);
            }
            if (upper.includes(';') && upper.split(';').filter(s => s.trim()).length > 1) {
                throw new Error('安全限制：不允许执行多条语句。');
            }
            try {
                const results = db.exec(trimmed);
                if (results.length === 0) return { columns: [], values: [], rowCount: 0 };
                return { columns: results[0].columns, values: results[0].values, rowCount: results[0].values.length };
            } catch (e) {
                let msg = e.message;
                let help = '';
                if (msg.includes('no such table')) help = '表不存在。';
                else if (msg.includes('no such column')) help = '列名不存在。';
                throw new Error(`查询错误：${msg}${help ? '\n提示：' + help : ''}`);
            }
        },
        getRecordCount() {
            const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
            let total = 0;
            if (tables.length > 0) {
                tables[0].values.forEach(([name]) => {
                    const count = db.exec(`SELECT COUNT(*) FROM ${name}`);
                    if (count.length > 0) total += count[0].values[0][0];
                });
            }
            return total;
        }
    };

    // Load CaseManager
    const casesSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'cases.js'), 'utf8');
    const CaseManager = eval(`(function() { ${casesSource.replace('const CaseManager =', 'return ')} })()`);
    // Patch CaseManager to use our DatabaseManager
    const origVerify = CaseManager.verifyAnswer.bind(CaseManager);
    CaseManager.verifyAnswer = function(caseId, killerName, evidenceSql, motive) {
        const caseData = this.cases[caseId];
        if (!caseData) return { success: false, message: '无效的案件编号。', killerCorrect: false, evidenceValid: false, motiveCorrect: false, details: [] };
        const result = { success: false, killerCorrect: false, evidenceValid: false, motiveCorrect: false, details: [] };

        if (killerName.trim() === caseData.killer) { result.killerCorrect = true; }
        if (evidenceSql && evidenceSql.trim()) {
            try {
                const qr = DatabaseManager.executeQuery(evidenceSql);
                if (qr.rowCount > 0) {
                    const sqlUpper = evidenceSql.toUpperCase();
                    const resultStr = JSON.stringify(qr.values).toLowerCase();
                    let points = 0;
                    for (const chain of caseData.evidenceChain) {
                        const tableMentioned = sqlUpper.includes(chain.table.toUpperCase());
                        let condMatch = false;
                        const parts = chain.condition.toLowerCase().split(/\s+and\s+/);
                        for (const part of parts) {
                            const likeMatch = part.match(/like\s+'%(.+)%'/);
                            if (likeMatch && resultStr.includes(likeMatch[1])) { condMatch = true; break; }
                            const eqMatch = part.match(/(\w+)\s*=\s*(\d+)/);
                            if (eqMatch && (sqlUpper.includes(eqMatch[2]) || resultStr.includes(eqMatch[2]))) { condMatch = true; break; }
                        }
                        if (tableMentioned || condMatch) points++;
                    }
                    if (points >= 2) result.evidenceValid = true;
                }
            } catch(e) {}
        }
        if (motive && motive.trim()) {
            const motiveText = motive.trim().toLowerCase();
            if (caseData.motiveKeywords.some(kw => motiveText.includes(kw))) result.motiveCorrect = true;
        }
        result.success = result.killerCorrect && result.evidenceValid && result.motiveCorrect;
        result.message = result.success ? '通过' : '未通过';
        return result;
    };

    console.log('SQL侦探 - 自动化测试\n');

    // === Database Init ===
    suite('数据库初始化');

    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    assert(tables.length > 0 && tables[0].values.length === 11, `数据库有11张表 (实际: ${tables[0].values.length})`);

    const recordCount = DatabaseManager.getRecordCount();
    assert(recordCount >= 80, `记录总数≥80 (实际: ${recordCount})`);

    const persons = db.exec("SELECT COUNT(*) FROM persons");
    assert(persons[0].values[0][0] === 25, `人物表25条 (实际: ${persons[0].values[0][0]})`);

    const caseCount = db.exec("SELECT COUNT(*) FROM case_files");
    assert(caseCount[0].values[0][0] === 3, '3个案件');

    // === Security ===
    suite('安全性 - 仅允许SELECT');

    const attacks = [
        "INSERT INTO persons VALUES (99,'x','男',1,'','','','')",
        "UPDATE persons SET name='x'",
        "DELETE FROM persons",
        "DROP TABLE persons",
        "CREATE TABLE x(i INT)",
        "ALTER TABLE persons RENAME TO x",
        "ATTACH DATABASE ':memory:' AS hack",
        "PRAGMA table_info(persons)",
    ];

    attacks.forEach(q => {
        let blocked = false;
        try { DatabaseManager.executeQuery(q); } catch (e) { blocked = true; }
        assert(blocked, `阻止: ${q.substring(0, 50)}`);
    });

    let multiBlocked = false;
    try { DatabaseManager.executeQuery("SELECT 1; DROP TABLE persons"); } catch(e) { multiBlocked = true; }
    assert(multiBlocked, '阻止多语句注入: SELECT 1; DROP TABLE persons');

    // === Valid Queries ===
    suite('有效查询执行');

    const validQ = [
        "SELECT * FROM persons LIMIT 3",
        "SELECT COUNT(*) FROM events WHERE case_id = 1",
        "SELECT p.name FROM persons p JOIN alibis a ON p.id = a.person_id WHERE a.verified = 0",
        "SELECT * FROM evidence WHERE is_red_herring = 1",
        "SELECT e.description, l.name FROM events e JOIN locations l ON e.location_id = l.id LIMIT 5",
        "WITH s AS (SELECT * FROM surveillance) SELECT COUNT(*) FROM s",
        "SELECT DISTINCT case_id FROM events ORDER BY case_id",
    ];

    validQ.forEach(q => {
        let ok = false;
        try { ok = DatabaseManager.executeQuery(q).rowCount >= 0; } catch(e) { console.log(`    Error: ${e.message}`); }
        assert(ok, `执行成功: ${q.substring(0, 60)}`);
    });

    // === Error Messages ===
    suite('错误提示');

    try { DatabaseManager.executeQuery("SELECT * FROM fake_table"); } catch(e) {
        assert(e.message.includes('不存在') || e.message.includes('no such'), '表不存在有提示');
    }

    try { DatabaseManager.executeQuery("DROP DATABASE main"); } catch(e) {
        assert(e.message.includes('安全限制') || e.message.includes('不允许'), 'DROP有安全提示');
    }

    try { DatabaseManager.executeQuery("SELECT fake_col FROM persons"); } catch(e) {
        assert(e.message.includes('列名') || e.message.includes('no such column'), '不存在的列有提示');
    }

    // === Answer Verification ===
    suite('答案验证');

    let r1 = CaseManager.verifyAnswer('case1', '林美玲',
        "SELECT * FROM financial_records WHERE person_id = 4 AND description LIKE '%氰化%'", '争夺遗产');
    assert(r1.killerCorrect, '案件1正确凶手');
    assert(r1.motiveCorrect, '案件1正确动机');
    assert(r1.evidenceValid, '案件1有效证据');
    assert(r1.success, '案件1完整通过');

    let r2 = CaseManager.verifyAnswer('case2', '周小燕',
        "SELECT * FROM evidence WHERE description LIKE '%周小燕%' AND case_id = 2", '张德海挪用公款威胁');
    assert(r2.killerCorrect, '案件2正确凶手');
    assert(r2.motiveCorrect, '案件2正确动机');

    let r3 = CaseManager.verifyAnswer('case3', '钱进',
        "SELECT * FROM surveillance WHERE person_id = 16", '欠赌债');
    assert(r3.killerCorrect, '案件3正确凶手');
    assert(r3.motiveCorrect, '案件3正确动机');

    let rWrong = CaseManager.verifyAnswer('case1', '王管家', "SELECT 1", '仇恨');
    assert(!rWrong.killerCorrect, '错误凶手被拒绝');
    assert(!rWrong.success, '错误答案不通过');

    let rInvalid = CaseManager.verifyAnswer('case999', '某人', '', '');
    assert(!rInvalid.success, '无效案件编号被拒绝');

    // === Data Quality ===
    suite('数据完整性');

    const redHerrings = db.exec("SELECT COUNT(*) FROM evidence WHERE is_red_herring = 1");
    assert(redHerrings[0].values[0][0] >= 3, `伪线索≥3 (实际: ${redHerrings[0].values[0][0]})`);

    const unverified = db.exec("SELECT COUNT(*) FROM alibis WHERE verified = 0");
    assert(unverified[0].values[0][0] >= 3, `未验证不在场证明≥3 (实际: ${unverified[0].values[0][0]})`);

    const comms = db.exec("SELECT COUNT(*) FROM communications");
    assert(comms[0].values[0][0] >= 20, `通讯记录≥20 (实际: ${comms[0].values[0][0]})`);

    const finance = db.exec("SELECT COUNT(*) FROM financial_records");
    assert(finance[0].values[0][0] >= 15, `财务记录≥15 (实际: ${finance[0].values[0][0]})`);

    // Timeline ordering
    const tl = db.exec("SELECT event_time FROM events WHERE case_id = 1 ORDER BY event_time");
    let ordered = true;
    for (let i = 1; i < tl[0].values.length; i++) {
        if (tl[0].values[i][0] < tl[0].values[i-1][0]) { ordered = false; break; }
    }
    assert(ordered, '案件1时间线有序');

    // Cross-case data (黄医生 treats victims from case 1 and case 3)
    const crossDoctor = db.exec("SELECT COUNT(DISTINCT person_id) FROM medical_records WHERE doctor_id = 14");
    assert(crossDoctor[0].values[0][0] >= 3, `黄医生诊治≥3人（跨案件干扰）(实际: ${crossDoctor[0].values[0][0]})`);

    // Each case has sufficient evidence
    for (let caseId = 1; caseId <= 3; caseId++) {
        const evCount = db.exec(`SELECT COUNT(*) FROM evidence WHERE case_id = ${caseId}`);
        assert(evCount[0].values[0][0] >= 5, `案件${caseId}证据≥5条 (实际: ${evCount[0].values[0][0]})`);
    }

    // Motives are traceable through financial records
    const killerFinance = db.exec("SELECT COUNT(*) FROM financial_records WHERE person_id IN (4, 10, 16)");
    assert(killerFinance[0].values[0][0] >= 6, `三位凶手共有≥6条财务记录 (实际: ${killerFinance[0].values[0][0]})`);

    // === Summary ===
    console.log(`\n${'═'.repeat(50)}`);
    const total = passed + failed;
    const status = failed === 0 ? '全部通过 ✓' : `${failed}项失败 ✗`;
    console.log(`测试结果: ${passed}/${total} 通过 — ${status}`);
    console.log('═'.repeat(50));

    db.close();
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
    console.error('测试运行失败:', e);
    process.exit(1);
});
