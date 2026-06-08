#!/usr/bin/env node
/**
 * 数据初始化脚本 - 用于验证和导出数据库初始化SQL
 * 运行: node scripts/init-db.js
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('SQL侦探 - 数据库初始化验证\n');

    const SQL = await initSqlJs();
    const db = new SQL.Database();

    // Read and execute the database.js to get schema/data
    const dbCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'database.js'), 'utf8');
    eval(dbCode);

    DatabaseManager.db = db;
    DatabaseManager.createSchema();
    DatabaseManager.insertData();

    // Verify
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    console.log('表列表:');
    tables[0].values.forEach(([name]) => {
        const count = db.exec(`SELECT COUNT(*) FROM ${name}`)[0].values[0][0];
        console.log(`  ${name}: ${count} 条记录`);
    });

    const total = tables[0].values.reduce((sum, [name]) => {
        return sum + db.exec(`SELECT COUNT(*) FROM ${name}`)[0].values[0][0];
    }, 0);

    console.log(`\n总记录数: ${total}`);
    console.log(`\n案件概览:`);

    const cases = db.exec("SELECT case_id, title, cause_of_death FROM case_files ORDER BY case_id");
    cases[0].values.forEach(([id, title, cod]) => {
        console.log(`  案件${id}: ${title} (${cod})`);
    });

    // Export as SQL file
    const exportPath = path.join(__dirname, '..', 'assets', 'init.sql');
    const sqlStatements = [];

    // Export schema
    const schemas = db.exec("SELECT sql FROM sqlite_master WHERE type='table' ORDER BY name");
    schemas[0].values.forEach(([sql]) => {
        if (sql) sqlStatements.push(sql + ';');
    });

    // Export data
    tables[0].values.forEach(([tableName]) => {
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
    });

    fs.writeFileSync(exportPath, sqlStatements.join('\n'), 'utf8');
    console.log(`\nSQL导出完成: ${exportPath} (${sqlStatements.length} 条语句)`);

    db.close();
}

main().catch(e => {
    console.error('错误:', e);
    process.exit(1);
});
