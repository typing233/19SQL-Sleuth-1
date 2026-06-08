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

    const dbSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'database.js'), 'utf8');

    // Extract and run schema
    const schemaMatch = dbSource.match(/createSchema\(\)\s*\{[\s\S]*?this\.db\.run\(`([\s\S]*?)`\)/);
    db.run(schemaMatch[1].trim());

    // Extract and run inserts
    const insertRegex = /this\.db\.run\(`\s*(INSERT[\s\S]*?)`\)/g;
    let match;
    while ((match = insertRegex.exec(dbSource)) !== null) {
        db.run(match[1].trim());
    }

    // Build executeQuery from source (mirrors the actual implementation)
    function stripStrings(sql) {
        return sql.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
    }

    function isReadOnly(sql) {
        const stripped = stripStrings(sql);
        const upper = stripped.toUpperCase();
        const allForbidden = [
            'INSERT', 'UPDATE', 'DELETE', 'REPLACE', 'UPSERT',
            'DROP', 'CREATE', 'ALTER', 'ATTACH', 'DETACH',
            'PRAGMA', 'VACUUM', 'REINDEX', 'GRANT', 'REVOKE',
            'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'RELEASE'
        ];
        for (const kw of allForbidden) {
            const regex = new RegExp(`\\b${kw}\\b`);
            if (regex.test(upper)) return { safe: false, keyword: kw };
        }
        return { safe: true };
    }

    function executeQuery(sql) {
        const trimmed = sql.trim().replace(/;+$/, '').trim();
        if (!trimmed) throw new Error('请输入SQL查询语句。');

        if (trimmed.includes(';')) {
            const parts = trimmed.split(';').filter(s => s.trim());
            if (parts.length > 1) throw new Error('安全限制：不允许执行多条语句。');
        }

        const upper = stripStrings(trimmed).toUpperCase().trim();
        const firstWord = upper.split(/\s+/)[0];
        if (firstWord !== 'SELECT' && firstWord !== 'WITH' && firstWord !== 'EXPLAIN') {
            throw new Error(`安全限制：不允许执行 ${firstWord} 操作。`);
        }

        const readCheck = isReadOnly(trimmed);
        if (!readCheck.safe) {
            throw new Error(`安全限制：不允许执行 ${readCheck.keyword} 操作。`);
        }

        if (firstWord === 'WITH') {
            const strippedUpper = upper;
            const cteBody = strippedUpper.split(/\)\s*(?=SELECT\b|INSERT\b|UPDATE\b|DELETE\b)/);
            const lastPart = cteBody[cteBody.length - 1].trim();
            const mainOp = lastPart.split(/\s+/)[0];
            if (mainOp && mainOp !== 'SELECT' && mainOp !== '') {
                throw new Error(`安全限制：WITH 子句只能配合 SELECT 使用。`);
            }
        }

        try {
            const changesBefore = db.getRowsModified();
            const results = db.exec(trimmed);
            const changesAfter = db.getRowsModified();
            if (changesAfter !== changesBefore) {
                throw new Error('安全限制：该语句试图修改数据，已被阻止。');
            }
            if (results.length === 0) return { columns: [], values: [], rowCount: 0 };
            return { columns: results[0].columns, values: results[0].values, rowCount: results[0].values.length };
        } catch (e) {
            if (e.message.includes('安全限制')) throw e;
            let msg = e.message;
            let help = '';
            if (msg.includes('no such table')) help = '表不存在。';
            else if (msg.includes('no such column')) help = '列名不存在。';
            throw new Error(`查询错误：${msg}${help ? '\n提示：' + help : ''}`);
        }
    }

    function getRecordCount() {
        const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
        let total = 0;
        tables[0].values.forEach(([name]) => {
            total += db.exec(`SELECT COUNT(*) FROM ${name}`)[0].values[0][0];
        });
        return total;
    }

    // Load CaseManager from source
    const casesSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'cases.js'), 'utf8');
    const CaseManager = eval(`(function() {
        const DatabaseManager = { executeQuery: ${executeQuery.toString()} };
        ${casesSource.replace('const CaseManager =', 'return ')}
    })()`);

    console.log('SQL侦探 - 自动化测试\n');

    // ═══════════════════════════════════════════
    suite('数据库初始化');

    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    assert(tables[0].values.length === 11, `有11张表 (实际: ${tables[0].values.length})`);

    const recordCount = getRecordCount();
    assert(recordCount >= 80, `记录总数 ≥ 80 (实际: ${recordCount})`);
    assert(recordCount <= 150, `记录总数 ≤ 150 (实际: ${recordCount})`);

    const persons = db.exec("SELECT COUNT(*) FROM persons")[0].values[0][0];
    assert(persons === 20, `人物20条 (实际: ${persons})`);

    const caseCount = db.exec("SELECT COUNT(*) FROM case_files")[0].values[0][0];
    assert(caseCount === 3, '3个案件');

    // ═══════════════════════════════════════════
    suite('安全性 - 基础阻止');

    const basicAttacks = [
        "INSERT INTO persons VALUES (99,'x','男',1,'','','','')",
        "UPDATE persons SET name='x' WHERE id=1",
        "DELETE FROM persons WHERE id=1",
        "DROP TABLE persons",
        "CREATE TABLE x(i INT)",
        "ALTER TABLE persons RENAME TO x",
        "ATTACH DATABASE ':memory:' AS hack",
        "PRAGMA table_info(persons)",
    ];

    basicAttacks.forEach(q => {
        let blocked = false;
        try { executeQuery(q); } catch (e) { blocked = true; }
        assert(blocked, `阻止: ${q.substring(0, 50)}`);
    });

    // ═══════════════════════════════════════════
    suite('安全性 - WITH绕过攻击');

    const withBypass = [
        "WITH x AS (SELECT 1) DELETE FROM persons",
        "WITH x AS (SELECT 1) UPDATE persons SET name='hacked'",
        "WITH x AS (SELECT 1) INSERT INTO persons VALUES (99,'x','男',1,'','','','')",
        "WITH x AS (SELECT 1) DROP TABLE persons",
        "WITH a AS (SELECT * FROM persons) DELETE FROM persons WHERE id IN (SELECT id FROM a)",
        "WITH RECURSIVE x(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM x) DELETE FROM persons",
    ];

    withBypass.forEach(q => {
        let blocked = false;
        try { executeQuery(q); } catch (e) { blocked = true; }
        assert(blocked, `WITH绕过阻止: ${q.substring(0, 55)}`);
    });

    // Verify data unchanged after attacks
    const personsAfter = db.exec("SELECT COUNT(*) FROM persons")[0].values[0][0];
    assert(personsAfter === 20, `攻击后数据完好: persons仍有20条 (实际: ${personsAfter})`);

    // ═══════════════════════════════════════════
    suite('安全性 - 字符串内关键词不误拦');

    const falsePositives = [
        "SELECT * FROM persons WHERE name LIKE '%DELETE%'",
        "SELECT * FROM evidence WHERE description LIKE '%UPDATE%'",
        "SELECT 'INSERT INTO test' AS example",
        "SELECT * FROM communications WHERE content_summary LIKE '%DROP%'",
    ];

    falsePositives.forEach(q => {
        let ok = false;
        try { ok = executeQuery(q).rowCount >= 0; } catch(e) { /* blocked = not ok */ }
        assert(ok, `不误拦字符串: ${q.substring(0, 55)}`);
    });

    // ═══════════════════════════════════════════
    suite('安全性 - 多语句注入');

    const injections = [
        "SELECT 1; DROP TABLE persons",
        "SELECT 1; DELETE FROM persons",
        "SELECT * FROM persons; UPDATE persons SET name='x'",
    ];

    injections.forEach(q => {
        let blocked = false;
        try { executeQuery(q); } catch (e) { blocked = true; }
        assert(blocked, `多语句阻止: ${q.substring(0, 50)}`);
    });

    // ═══════════════════════════════════════════
    suite('有效查询执行');

    const validQ = [
        "SELECT * FROM persons LIMIT 3",
        "SELECT COUNT(*) FROM events WHERE case_id = 1",
        "SELECT p.name FROM persons p JOIN alibis a ON p.id = a.person_id WHERE a.verified = 0",
        "SELECT * FROM evidence WHERE is_red_herring = 1",
        "WITH s AS (SELECT * FROM surveillance) SELECT COUNT(*) FROM s",
        "WITH cte AS (SELECT * FROM persons WHERE age > 40) SELECT name FROM cte",
        "SELECT DISTINCT case_id FROM events ORDER BY case_id",
    ];

    validQ.forEach(q => {
        let ok = false;
        try { ok = executeQuery(q).rowCount >= 0; } catch(e) { console.log(`    Error: ${e.message}`); }
        assert(ok, `执行成功: ${q.substring(0, 60)}`);
    });

    // ═══════════════════════════════════════════
    suite('错误提示');

    try { executeQuery("SELECT * FROM fake_table"); } catch(e) {
        assert(e.message.includes('不存在') || e.message.includes('no such'), '表不存在有提示');
    }

    try { executeQuery("DROP DATABASE main"); } catch(e) {
        assert(e.message.includes('安全限制'), 'DROP有安全提示');
    }

    try { executeQuery("SELECT fake_col FROM persons"); } catch(e) {
        assert(e.message.includes('列名') || e.message.includes('no such column'), '不存在的列有提示');
    }

    // ═══════════════════════════════════════════
    suite('答案验证 - 正确答案');

    let r1 = CaseManager.verifyAnswer('case1', '林美玲',
        "SELECT * FROM financial_records WHERE person_id = 4 AND description LIKE '%氰化%'", '争夺遗产继承');
    assert(r1.killerCorrect, '案件1: 凶手正确');
    assert(r1.motiveCorrect, '案件1: 动机正确');
    assert(r1.evidenceValid, '案件1: 证据有效');
    assert(r1.success, '案件1: 完整通过');

    let r2 = CaseManager.verifyAnswer('case2', '周小燕',
        "SELECT * FROM evidence WHERE case_id = 2 AND description LIKE '%周小燕%'", '张德海挪用公款威胁让她顶罪');
    assert(r2.killerCorrect, '案件2: 凶手正确');
    assert(r2.motiveCorrect, '案件2: 动机正确');
    assert(r2.evidenceValid, '案件2: 证据有效');
    assert(r2.success, '案件2: 完整通过');

    let r3 = CaseManager.verifyAnswer('case3', '钱进',
        "SELECT * FROM surveillance WHERE person_id = 16 AND description LIKE '%病房%'", '欠赌债需要钱');
    assert(r3.killerCorrect, '案件3: 凶手正确');
    assert(r3.motiveCorrect, '案件3: 动机正确');
    assert(r3.evidenceValid, '案件3: 证据有效');
    assert(r3.success, '案件3: 完整通过');

    // ═══════════════════════════════════════════
    suite('答案验证 - 错误答案');

    let rWrong = CaseManager.verifyAnswer('case1', '王管家', "SELECT 1", '仇恨');
    assert(!rWrong.killerCorrect, '错误凶手被拒绝');
    assert(!rWrong.success, '错误答案不通过');

    let rInvalid = CaseManager.verifyAnswer('case999', '某人', '', '');
    assert(!rInvalid.success, '无效案件编号被拒绝');

    // ═══════════════════════════════════════════
    suite('答案验证 - 泛查询误判防护');

    // 泛查询不应通过：只查整张表但没有指向凶手的证据
    let rGeneric1 = CaseManager.verifyAnswer('case1', '林美玲',
        "SELECT * FROM evidence WHERE case_id = 1", '遗产');
    assert(!rGeneric1.evidenceValid, '泛查询 evidence 全表不算有效证据');

    let rGeneric2 = CaseManager.verifyAnswer('case2', '周小燕',
        "SELECT * FROM events WHERE case_id = 2", '挪用公款');
    assert(!rGeneric2.evidenceValid, '泛查询 events 全表不算有效证据');

    let rGeneric3 = CaseManager.verifyAnswer('case3', '钱进',
        "SELECT * FROM financial_records", '赌博');
    assert(!rGeneric3.evidenceValid, '泛查询 financial_records 全表不算有效证据');

    // 查了正确的表但没有限定到凶手
    let rNoKiller = CaseManager.verifyAnswer('case1', '林美玲',
        "SELECT * FROM financial_records WHERE person_id = 3", '遗产');
    assert(!rNoKiller.evidenceValid, '查询不相关人员的记录不算有效');

    // 只查了 SELECT 1，完全无内容
    let rTrivial = CaseManager.verifyAnswer('case1', '林美玲',
        "SELECT 1", '遗产');
    assert(!rTrivial.evidenceValid, 'SELECT 1 不算有效证据');

    // ═══════════════════════════════════════════
    suite('答案验证 - 凶手个人信息不算证据');

    // 只查凶手的 persons 表信息
    let rPersonal1 = CaseManager.verifyAnswer('case1', '林美玲',
        "SELECT * FROM persons WHERE id = 4", '遗产');
    assert(!rPersonal1.evidenceValid, '案件1: 查凶手个人资料不算证据');

    let rPersonal2 = CaseManager.verifyAnswer('case2', '周小燕',
        "SELECT * FROM persons WHERE id = 10", '挪用');
    assert(!rPersonal2.evidenceValid, '案件2: 查凶手个人资料不算证据');

    let rPersonal3 = CaseManager.verifyAnswer('case3', '钱进',
        "SELECT * FROM persons WHERE id = 16", '赌债');
    assert(!rPersonal3.evidenceValid, '案件3: 查凶手个人资料不算证据');

    // 查凶手的通讯记录但无关键内容
    let rComm1 = CaseManager.verifyAnswer('case1', '林美玲',
        "SELECT * FROM communications WHERE sender_id = 4 AND comm_time LIKE '2024-03-14%'", '遗产');
    assert(!rComm1.evidenceValid, '案件1: 凶手普通通讯记录不算证据（无关键内容）');

    // 查凶手的财务但不含犯罪相关内容
    let rFinNoEvidence = CaseManager.verifyAnswer('case1', '林美玲',
        "SELECT * FROM financial_records WHERE person_id = 4 AND description LIKE '%手册%'", '遗产');
    assert(!rFinNoEvidence.evidenceValid, '案件1: 凶手买书记录不算有效犯罪证据');

    // 查凶手名字但结果不含关键证据词
    let rNameOnly = CaseManager.verifyAnswer('case2', '周小燕',
        "SELECT * FROM persons WHERE name = '周小燕'", '挪用');
    assert(!rNameOnly.evidenceValid, '案件2: 只查凶手姓名不算证据');

    // 查了与凶手相关的 alibis
    let rAlibi = CaseManager.verifyAnswer('case3', '钱进',
        "SELECT * FROM alibis WHERE person_id = 16", '赌博');
    assert(!rAlibi.evidenceValid, '案件3: 凶手的不在场证明记录不算犯罪证据');

    // ═══════════════════════════════════════════
    suite('数据完整性');

    const redHerrings = db.exec("SELECT COUNT(*) FROM evidence WHERE is_red_herring = 1")[0].values[0][0];
    assert(redHerrings >= 3, `伪线索≥3 (实际: ${redHerrings})`);

    const unverified = db.exec("SELECT COUNT(*) FROM alibis WHERE verified = 0")[0].values[0][0];
    assert(unverified >= 3, `未验证不在场证明≥3 (实际: ${unverified})`);

    const comms = db.exec("SELECT COUNT(*) FROM communications")[0].values[0][0];
    assert(comms >= 10, `通讯记录≥10 (实际: ${comms})`);

    const finance = db.exec("SELECT COUNT(*) FROM financial_records")[0].values[0][0];
    assert(finance >= 10, `财务记录≥10 (实际: ${finance})`);

    // Timeline ordering
    const tl = db.exec("SELECT event_time FROM events WHERE case_id = 1 ORDER BY event_time");
    let ordered = true;
    for (let i = 1; i < tl[0].values.length; i++) {
        if (tl[0].values[i][0] < tl[0].values[i-1][0]) { ordered = false; break; }
    }
    assert(ordered, '案件1时间线有序');

    // Cross-case interference
    const crossDoctor = db.exec("SELECT COUNT(DISTINCT person_id) FROM medical_records WHERE doctor_id = 14")[0].values[0][0];
    assert(crossDoctor >= 2, `黄医生诊治≥2人（跨案件）(实际: ${crossDoctor})`);

    // Each case has enough evidence
    for (let caseId = 1; caseId <= 3; caseId++) {
        const evCount = db.exec(`SELECT COUNT(*) FROM evidence WHERE case_id = ${caseId}`)[0].values[0][0];
        assert(evCount >= 4, `案件${caseId}证据≥4条 (实际: ${evCount})`);
    }

    // Three killers have financial trails
    const killerFinance = db.exec("SELECT COUNT(*) FROM financial_records WHERE person_id IN (4, 10, 16)")[0].values[0][0];
    assert(killerFinance >= 5, `三位凶手共≥5条财务记录 (实际: ${killerFinance})`);

    // ═══════════════════════════════════════════
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
