(async function() {
    try {
        await DatabaseManager.init();
        UI.init();

        const recordCount = DatabaseManager.getRecordCount();
        console.log(`SQL侦探数据库初始化完成，共 ${recordCount} 条记录`);

        document.getElementById('loading-overlay').classList.add('hidden');
    } catch (e) {
        console.error('初始化失败:', e);
        document.querySelector('.loading-content p').textContent = '初始化失败: ' + e.message;
        document.querySelector('.loading-content p').style.color = '#ff4757';
    }
})();
