const UI = {
    queryHistory: [],
    unlockedHints: {},
    solvedCases: {},

    init() {
        this.loadProgress();
        this.bindEvents();
        this.renderSidebar();
        this.renderHints();
        this.updateProgress();
    },

    bindEvents() {
        document.getElementById('btn-run').addEventListener('click', () => this.executeQuery());
        document.getElementById('btn-clear').addEventListener('click', () => this.clearEditor());
        document.getElementById('btn-format').addEventListener('click', () => this.formatSQL());
        document.getElementById('btn-schema').addEventListener('click', () => this.showModal('modal-schema'));
        document.getElementById('btn-history').addEventListener('click', () => this.showModal('modal-history'));
        document.getElementById('btn-hints').addEventListener('click', () => this.showModal('modal-hints'));
        document.getElementById('btn-submit').addEventListener('click', () => this.showModal('modal-submit'));
        document.getElementById('btn-verify').addEventListener('click', () => this.verifyAnswer());

        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const modalId = btn.dataset.close;
                this.hideModal(modalId);
            });
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.hideModal(modal.id);
            });
        });

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn));
        });

        const editor = document.getElementById('sql-editor');
        editor.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.executeQuery();
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = editor.selectionStart;
                const end = editor.selectionEnd;
                editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
                editor.selectionStart = editor.selectionEnd = start + 2;
            }
        });
    },

    renderSidebar() {
        document.getElementById('case-intro').innerHTML = CaseManager.getCaseIntro();
        document.getElementById('case-objectives').innerHTML = CaseManager.getCaseObjectives();
        document.getElementById('db-description').innerHTML = CaseManager.getDbDescription();
    },

    renderSchema() {
        const tableInfo = DatabaseManager.getTableInfo();

        // ER Diagram
        document.getElementById('er-diagram-content').textContent = this.generateERDiagram();

        // Table List
        let tableHtml = '';
        for (const [tableName, columns] of Object.entries(tableInfo)) {
            tableHtml += `<div class="table-schema">
                <div class="table-schema-header">${tableName}</div>
                <div class="table-schema-body">`;
            columns.forEach(col => {
                const constraints = [];
                if (col.pk) constraints.push('PRIMARY KEY');
                if (col.notNull) constraints.push('NOT NULL');
                if (col.defaultValue !== null) constraints.push(`DEFAULT ${col.defaultValue}`);
                tableHtml += `<div class="column-row">
                    <span class="col-name">${col.pk ? '🔑 ' : ''}${col.name}</span>
                    <span class="col-type">${col.type || 'ANY'}</span>
                    <span class="col-constraint">${constraints.join(', ')}</span>
                </div>`;
            });
            tableHtml += `</div></div>`;
        }
        document.getElementById('table-list-content').innerHTML = tableHtml;

        // Constraints
        let constraintHtml = `<div class="table-schema">
            <div class="table-schema-header">外键关系</div>
            <div class="table-schema-body" style="font-size:0.83rem;color:var(--text-secondary);line-height:1.8">
                <p>events.location_id → locations.id</p>
                <p>evidence.found_location_id → locations.id</p>
                <p>evidence.related_person_id → persons.id</p>
                <p>communications.sender_id → persons.id</p>
                <p>communications.receiver_id → persons.id</p>
                <p>financial_records.person_id → persons.id</p>
                <p>alibis.person_id → persons.id</p>
                <p>alibis.witness_id → persons.id</p>
                <p>relationships.person1_id → persons.id</p>
                <p>relationships.person2_id → persons.id</p>
                <p>case_files.victim_id → persons.id</p>
                <p>case_files.crime_location_id → locations.id</p>
                <p>medical_records.person_id → persons.id</p>
                <p>medical_records.doctor_id → persons.id</p>
                <p>surveillance.location_id → locations.id</p>
                <p>surveillance.person_id → persons.id</p>
            </div>
        </div>
        <div class="table-schema" style="margin-top:16px">
            <div class="table-schema-header">CHECK约束</div>
            <div class="table-schema-body" style="font-size:0.83rem;color:var(--text-secondary);line-height:1.8">
                <p>persons.gender IN ('男','女')</p>
                <p>events.event_type IN ('犯罪','目击','活动','通讯','交易')</p>
                <p>evidence.type IN ('物证','书证','电子数据','证人证言','鉴定意见')</p>
                <p>communications.comm_type IN ('电话','短信','邮件','微信')</p>
                <p>financial_records.transaction_type IN ('转入','转出','现金取款','现金存款','购买')</p>
            </div>
        </div>`;
        document.getElementById('constraints-content').innerHTML = constraintHtml;
    },

    generateERDiagram() {
        return `
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│    persons      │       │    locations      │       │   case_files    │
├─────────────────┤       ├──────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)          │       │ id (PK)         │
│ name            │       │ name             │       │ case_id         │
│ gender          │       │ type             │       │ title           │
│ age             │       │ address          │       │ victim_id (FK)  │
│ occupation      │       │ description      │       │ crime_time      │
│ address         │       └────────┬─────────┘       │ crime_location  │
│ phone           │                │                  │ cause_of_death  │
└───────┬─────────┘                │                  └─────────────────┘
        │                          │
        │     ┌────────────────────┼───────────────────────┐
        │     │                    │                        │
        ▼     ▼                    ▼                        ▼
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│    events       │       │    evidence      │       │  surveillance   │
├─────────────────┤       ├──────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)          │       │ id (PK)         │
│ case_id         │       │ case_id          │       │ location_id(FK) │
│ event_time      │       │ type             │       │ capture_time    │
│ location_id(FK) │       │ description      │       │ person_id (FK)  │
│ description     │       │ found_location   │       │ description     │
│ event_type      │       │ related_person   │       │ camera_id       │
└─────────────────┘       │ is_red_herring   │       └─────────────────┘
                          └──────────────────┘
        │
        ├──────────────────────────────────────────────────┐
        │                    │                              │
        ▼                    ▼                              ▼
┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│ communications  │  │financial_records │  │       alibis         │
├─────────────────┤  ├──────────────────┤  ├──────────────────────┤
│ id (PK)         │  │ id (PK)          │  │ id (PK)              │
│ sender_id (FK)  │  │ person_id (FK)   │  │ person_id (FK)       │
│ receiver_id(FK) │  │ transaction_time │  │ case_id              │
│ comm_time       │  │ amount           │  │ alibi_time_start     │
│ comm_type       │  │ transaction_type │  │ alibi_time_end       │
│ duration_min    │  │ counterparty     │  │ alibi_location       │
│ content_summary │  │ description      │  │ witness_id (FK)      │
└─────────────────┘  └──────────────────┘  │ verified             │
                                            └──────────────────────┘
        │                                            │
        ▼                                            ▼
┌─────────────────┐                        ┌──────────────────┐
│ relationships   │                        │ medical_records  │
├─────────────────┤                        ├──────────────────┤
│ id (PK)         │                        │ id (PK)          │
│ person1_id (FK) │                        │ person_id (FK)   │
│ person2_id (FK) │                        │ record_date      │
│ relation_type   │                        │ hospital         │
│ description     │                        │ diagnosis        │
│ since_date      │                        │ prescription     │
└─────────────────┘                        │ doctor_id (FK)   │
                                           └──────────────────┘`;
    },

    executeQuery() {
        const editor = document.getElementById('sql-editor');
        const sql = editor.value.trim();

        if (!sql) {
            this.showStatus('请输入SQL查询语句', 'warning');
            return;
        }

        const startTime = performance.now();

        try {
            const result = DatabaseManager.executeQuery(sql);
            const elapsed = Math.round(performance.now() - startTime);

            this.renderResults(result, elapsed);
            this.addToHistory(sql, true, result.rowCount, elapsed);
            this.showStatus(`查询成功 · ${result.rowCount} 行 · ${elapsed}ms`, 'success');
            this.trackProgress(sql);
        } catch (e) {
            this.renderError(e.message);
            this.addToHistory(sql, false, 0, 0);
            this.showStatus('查询失败', 'error');
        }
    },

    renderResults(result, elapsed) {
        const container = document.getElementById('results-container');
        const info = document.getElementById('results-info');

        if (result.rowCount === 0) {
            container.innerHTML = '<div class="empty-state"><p>查询执行成功，但没有返回任何结果。</p></div>';
            info.textContent = '0 行结果';
            return;
        }

        info.textContent = `${result.rowCount} 行 · ${elapsed}ms`;

        let html = '<table class="result-table"><thead><tr>';
        result.columns.forEach(col => {
            html += `<th>${this.escapeHtml(col)}</th>`;
        });
        html += '</tr></thead><tbody>';

        result.values.forEach(row => {
            html += '<tr>';
            row.forEach(cell => {
                const val = cell === null ? '<em style="color:var(--text-muted)">NULL</em>' : this.escapeHtml(String(cell));
                html += `<td>${val}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    },

    renderError(message) {
        const container = document.getElementById('results-container');
        const parts = message.split('\n');
        const title = parts[0];
        const details = parts.slice(1).join('<br>');

        container.innerHTML = `<div class="error-message">
            <div class="error-title">${this.escapeHtml(title)}</div>
            ${details ? `<div class="error-help">${this.escapeHtml(details).replace(/\n/g, '<br>')}</div>` : ''}
        </div>`;

        document.getElementById('results-info').textContent = '错误';
    },

    showStatus(message, type) {
        const status = document.getElementById('editor-status');
        const colors = { success: 'var(--success)', error: 'var(--danger)', warning: 'var(--warning)' };
        status.style.color = colors[type] || 'var(--text-muted)';
        status.textContent = message;
    },

    addToHistory(sql, success, rowCount, elapsed) {
        this.queryHistory.unshift({
            sql,
            success,
            rowCount,
            elapsed,
            time: new Date().toLocaleTimeString()
        });

        if (this.queryHistory.length > 50) {
            this.queryHistory.pop();
        }

        this.saveProgress();
        this.renderHistory();
    },

    renderHistory() {
        const container = document.getElementById('history-list');

        if (this.queryHistory.length === 0) {
            container.innerHTML = '<div class="history-empty">暂无查询历史</div>';
            return;
        }

        let html = '';
        this.queryHistory.forEach((item, index) => {
            const statusIcon = item.success ? '✓' : '✗';
            const statusColor = item.success ? 'var(--success)' : 'var(--danger)';
            html += `<div class="history-item" data-index="${index}">
                <div class="history-sql"><span style="color:${statusColor}">${statusIcon}</span> ${this.escapeHtml(item.sql)}</div>
                <div class="history-meta">${item.time} · ${item.rowCount} 行 · ${item.elapsed}ms</div>
            </div>`;
        });

        container.innerHTML = html;

        container.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                document.getElementById('sql-editor').value = this.queryHistory[index].sql;
                this.hideModal('modal-history');
            });
        });
    },

    renderHints() {
        const container = document.getElementById('hints-container');
        let html = '';

        for (const [caseId, caseData] of Object.entries(CaseManager.cases)) {
            html += `<div class="hint-case">
                <div class="hint-case-title">${caseData.title} ${this.solvedCases[caseId] ? '✓ 已破解' : ''}</div>`;

            caseData.hints.forEach((hint, index) => {
                const unlocked = this.unlockedHints[caseId] && this.unlockedHints[caseId] >= (index + 1);
                if (unlocked) {
                    html += `<div class="hint-item"><div class="hint-unlocked">提示${index + 1}：${hint.text}</div></div>`;
                } else {
                    html += `<div class="hint-item"><div class="hint-locked">
                        <span>提示 ${index + 1}（${['基础', '进阶', '关键', '终极'][index]}）</span>
                        <button class="unlock-btn" data-case="${caseId}" data-level="${index + 1}">解锁</button>
                    </div></div>`;
                }
            });

            html += '</div>';
        }

        container.innerHTML = html;

        container.querySelectorAll('.unlock-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const caseId = btn.dataset.case;
                const level = parseInt(btn.dataset.level);
                this.unlockHint(caseId, level);
            });
        });
    },

    unlockHint(caseId, level) {
        if (!this.unlockedHints[caseId] || this.unlockedHints[caseId] < level) {
            this.unlockedHints[caseId] = level;
            this.saveProgress();
            this.renderHints();
        }
    },

    verifyAnswer() {
        const caseId = document.getElementById('submit-case').value;
        const killer = document.getElementById('submit-killer').value;
        const evidenceSql = document.getElementById('submit-evidence-sql').value;
        const motive = document.getElementById('submit-motive').value;

        if (!killer.trim()) {
            this.showVerifyResult('请输入凶手姓名', false);
            return;
        }

        const result = CaseManager.verifyAnswer(caseId, killer, evidenceSql, motive);

        const detailsHtml = result.details.map(d => `<p>${d}</p>`).join('');
        const html = `<p><strong>${result.message}</strong></p>${detailsHtml}`;

        this.showVerifyResult(html, result.success);

        if (result.success) {
            this.solvedCases[caseId] = true;
            this.saveProgress();
            this.updateProgress();
            this.renderHints();
        }
    },

    showVerifyResult(html, success) {
        const el = document.getElementById('verify-result');
        el.innerHTML = html;
        el.className = `verify-result ${success ? 'success' : 'failure'}`;
    },

    trackProgress(sql) {
        const upper = sql.toUpperCase();
        const tables = ['PERSONS', 'LOCATIONS', 'EVENTS', 'EVIDENCE', 'COMMUNICATIONS',
                        'FINANCIAL_RECORDS', 'ALIBIS', 'RELATIONSHIPS', 'CASE_FILES',
                        'MEDICAL_RECORDS', 'SURVEILLANCE'];

        if (!this._exploredTables) this._exploredTables = new Set();
        tables.forEach(t => {
            if (upper.includes(t)) this._exploredTables.add(t);
        });

        this.updateProgress();
    },

    updateProgress() {
        const totalTables = 11;
        const exploredCount = this._exploredTables ? this._exploredTables.size : 0;
        const solvedCount = Object.keys(this.solvedCases).length;
        const totalCases = 3;

        const tableProgress = (exploredCount / totalTables) * 40;
        const caseProgress = (solvedCount / totalCases) * 60;
        const total = Math.round(tableProgress + caseProgress);

        document.getElementById('progress-indicator').textContent = `进度: ${total}%`;
    },

    clearEditor() {
        document.getElementById('sql-editor').value = '';
        document.getElementById('editor-status').textContent = '';
    },

    formatSQL() {
        const editor = document.getElementById('sql-editor');
        let sql = editor.value.trim();

        const keywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER BY',
                          'GROUP BY', 'HAVING', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN',
                          'INNER JOIN', 'ON', 'LIMIT', 'OFFSET', 'UNION', 'WITH', 'AS'];

        keywords.forEach(kw => {
            const regex = new RegExp(`\\b${kw}\\b`, 'gi');
            sql = sql.replace(regex, '\n' + kw);
        });

        sql = sql.replace(/^\n/, '').replace(/\n\s*\n/g, '\n');
        editor.value = sql;
    },

    showModal(id) {
        document.getElementById(id).classList.remove('hidden');
        if (id === 'modal-schema') this.renderSchema();
        if (id === 'modal-history') this.renderHistory();
    },

    hideModal(id) {
        document.getElementById(id).classList.add('hidden');
    },

    switchTab(btn) {
        const tabId = btn.dataset.tab;
        btn.parentElement.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const modal = btn.closest('.modal-body');
        modal.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
    },

    saveProgress() {
        const data = {
            queryHistory: this.queryHistory,
            unlockedHints: this.unlockedHints,
            solvedCases: this.solvedCases,
            exploredTables: this._exploredTables ? Array.from(this._exploredTables) : []
        };
        try {
            localStorage.setItem('sql-sleuth-progress', JSON.stringify(data));
        } catch (e) {
            // localStorage not available
        }
    },

    loadProgress() {
        try {
            const data = JSON.parse(localStorage.getItem('sql-sleuth-progress'));
            if (data) {
                this.queryHistory = data.queryHistory || [];
                this.unlockedHints = data.unlockedHints || {};
                this.solvedCases = data.solvedCases || {};
                this._exploredTables = new Set(data.exploredTables || []);
            }
        } catch (e) {
            // no saved data
        }
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};
