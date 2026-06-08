#!/usr/bin/env node
/**
 * 数据初始化脚本 - 验证数据库并导出初始化SQL
 * 运行: node scripts/init-db.js
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('SQL侦探 - 数据库初始化验证\n');

    const SQL = await initSqlJs();
    const db = new SQL.Database();

    const dbSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'database.js'), 'utf8');

    // Extract CREATE TABLE block from createSchema()
    const schemaMatch = dbSource.match(/createSchema\(\)\s*\{[\s\S]*?this\.db\.run\(`([\s\S]*?)`\)/);
    if (!schemaMatch) {
        console.error('无法从 database.js 中提取 schema');
        process.exit(1);
    }
    const schemaSql = schemaMatch[1].trim();
    db.run(schemaSql);
    console.log('✓ Schema 创建成功');

    // Extract all INSERT blocks from insertData()
    const insertRegex = /this\.db\.run\(`\s*(INSERT[\s\S]*?)`\)/g;
    let match;
    let insertCount = 0;
    while ((match = insertRegex.exec(dbSource)) !== null) {
        const sql = match[1].trim();
        try {
            db.run(sql);
            insertCount++;
        } catch (e) {
            console.error(`✗ INSERT 失败: ${e.message}`);
            console.error(`  SQL片段: ${sql.substring(0, 80)}...`);
            process.exit(1);
        }
    }
    console.log(`✓ 数据插入成功 (${insertCount} 个 INSERT 块)`);

    // Verify tables and counts
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    if (!tables.length || tables[0].values.length !== 11) {
        console.error(`✗ 表数量不正确: 期望 11, 实际 ${tables[0]?.values.length || 0}`);
        process.exit(1);
    }

    console.log('\n表列表:');
    let total = 0;
    tables[0].values.forEach(([name]) => {
        const count = db.exec(`SELECT COUNT(*) FROM ${name}`)[0].values[0][0];
        total += count;
        console.log(`  ${name}: ${count} 条记录`);
    });

    console.log(`\n总记录数: ${total}`);

    if (total < 80) {
        console.error(`✗ 记录总数不足: 期望 ≥80, 实际 ${total}`);
        process.exit(1);
    }
    console.log('✓ 记录数量验证通过');

    // Verify cases
    console.log('\n案件概览:');
    const cases = db.exec("SELECT case_id, title, cause_of_death FROM case_files ORDER BY case_id");
    cases[0].values.forEach(([id, title, cod]) => {
        console.log(`  案件${id}: ${title} (${cod})`);
    });

    // Verify evidence chains exist
    const redHerrings = db.exec("SELECT COUNT(*) FROM evidence WHERE is_red_herring = 1")[0].values[0][0];
    console.log(`\n伪线索数量: ${redHerrings}`);
    if (redHerrings < 3) {
        console.error('✗ 伪线索不足3条');
        process.exit(1);
    }
    console.log('✓ 伪线索验证通过');

    // Export as SQL file
    const assetsDir = path.join(__dirname, '..', 'assets');
    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
    }

    const exportPath = path.join(assetsDir, 'init.sql');
    const sqlStatements = [];

    sqlStatements.push('-- SQL侦探 数据库初始化脚本');
    sqlStatements.push(`-- 生成时间: ${new Date().toISOString()}`);
    sqlStatements.push(`-- 记录总数: ${total}`);
    sqlStatements.push('');

    // Export schema
    const schemas = db.exec("SELECT sql FROM sqlite_master WHERE type='table' ORDER BY name");
    schemas[0].values.forEach(([sql]) => {
        if (sql) sqlStatements.push(sql + ';');
    });
    sqlStatements.push('');

    // Export data
    tables[0].values.forEach(([tableName]) => {
        sqlStatements.push(`-- ${tableName}`);
        const rows = db.exec(`SELECT * FROM ${tableName}`);
        if (rows.length > 0) {
            const cols = rows[0].columns.join(', ');
            rows[0].values.forEach(row => {
                const vals = row.map(v => {
                    if (v === null) return 'NULL';
                    if (typeof v === 'number') return v;
                    return `'${String(v).replace(/'/g, "''")}'`;
                }).join(', ');
                sqlStatements.push(`INSERT INTO ${tableName} (${cols}) VALUES (${vals});`);
            });
        }
        sqlStatements.push('');
    });

    fs.writeFileSync(exportPath, sqlStatements.join('\n'), 'utf8');
    console.log(`\n✓ SQL导出完成: ${exportPath} (${sqlStatements.length} 行)`);

    db.close();
    console.log('\n全部验证通过 ✓');
}

main().catch(e => {
    console.error('错误:', e.message);
    process.exit(1);
});
