const CaseManager = {
    cases: {
        case1: {
            id: 'case1',
            title: '翡翠庄园谋杀案',
            killer: '林美玲',
            motive: '遗产',
            motiveKeywords: ['遗产', '钱', '财产', '继承', '保险'],
            evidenceChain: [
                { description: '林美玲搜索氰化物信息', table: 'evidence', condition: "related_person_id = 4 AND description LIKE '%氰化%'" },
                { description: '林美玲购买氰化钾', table: 'financial_records', condition: "person_id = 4 AND description LIKE '%氰化%'" },
                { description: '林美玲独自去厨房', table: 'surveillance', condition: "person_id = 4 AND description LIKE '%厨房%'" },
                { description: '茶水由林美玲端给死者', table: 'evidence', condition: "description LIKE '%林美玲%茶%'" },
                { description: '遗嘱修改为动机', table: 'communications', condition: "sender_id = 4 AND content_summary LIKE '%自有办法%'" }
            ],
            hints: [
                { level: 1, text: '注意案发当晚谁有机会接触死者的饮品。' },
                { level: 2, text: '查看financial_records表，看看谁在案发前购买了可疑物品。' },
                { level: 3, text: '林美玲的手机搜索记录和购物记录值得关注。时间线：3月13日购买 → 3月14日得知遗嘱 → 3月15日作案。' },
                { level: 4, text: '关键SQL: SELECT * FROM financial_records WHERE person_id = 4 AND transaction_time LIKE \'2024-03-13%\'; 再结合 surveillance 表中厨房的监控。' }
            ]
        },
        case2: {
            id: 'case2',
            title: '码头仓库毒杀案',
            killer: '周小燕',
            motive: '灭口',
            motiveKeywords: ['灭口', '挪用', '公款', '威胁', '顶罪', '举报'],
            evidenceChain: [
                { description: '周小燕购买农药', table: 'financial_records', condition: "person_id = 10 AND description LIKE '%农药%'" },
                { description: '农药瓶上周小燕的指纹', table: 'evidence', condition: "description LIKE '%周小燕%' AND type = '物证'" },
                { description: '周小燕的不在场证明不成立', table: 'alibis', condition: "person_id = 10 AND verified = 0" },
                { description: '张德海威胁周小燕', table: 'communications', condition: "sender_id = 8 AND receiver_id = 10 AND content_summary LIKE '%少管闲事%'" },
                { description: '监控中身材相似人影', table: 'surveillance', condition: "description LIKE '%模糊人影%' AND capture_time LIKE '2024-03-18 19:55%'" }
            ],
            hints: [
                { level: 1, text: '凶手的动机可能与公司财务问题有关。' },
                { level: 2, text: '查看communications表中张德海与同事的威胁性对话。' },
                { level: 3, text: '周小燕发现了张德海的秘密，但张德海威胁要让她顶罪。农药瓶上的指纹是关键物证。' },
                { level: 4, text: '关键SQL: SELECT * FROM evidence WHERE case_id = 2 AND description LIKE \'%指纹%\'; 结合 financial_records 中周小燕购买农药的记录。' }
            ]
        },
        case3: {
            id: 'case3',
            title: '医院连环投毒案',
            killer: '钱进',
            motive: '赌债',
            motiveKeywords: ['赌', '赌博', '赌债', '钱', '缺钱', '债务'],
            evidenceChain: [
                { description: '钱进深夜进入药房', table: 'surveillance', condition: "person_id = 16 AND description LIKE '%药房%'" },
                { description: '钱进储物柜有毒物', table: 'evidence', condition: "related_person_id = 16 AND description LIKE '%氯化钾%'" },
                { description: '钱进赌博欠债', table: 'financial_records', condition: "person_id = 16 AND description LIKE '%赌博%'" },
                { description: '郑小梅目击证言', table: 'evidence', condition: "related_person_id = 17 AND description LIKE '%钱进%病房%'" },
                { description: '钱进进入病房的监控', table: 'surveillance', condition: "person_id = 16 AND description LIKE '%内科病房%'" }
            ],
            hints: [
                { level: 1, text: '两起死亡有什么共同点？谁能同时接触到两位受害者的药物？' },
                { level: 2, text: '查看surveillance表中药房和病房的深夜监控记录。' },
                { level: 3, text: '钱进有严重的赌博问题，需要大量现金。注意他在药房的异常出入时间与两位患者出事时间的关联。' },
                { level: 4, text: '关键SQL: SELECT * FROM surveillance WHERE person_id = 16 ORDER BY capture_time; 再查看 financial_records WHERE person_id = 16 了解动机。' }
            ]
        }
    },

    verifyAnswer(caseId, killerName, evidenceSql, motive) {
        const caseData = this.cases[caseId];
        if (!caseData) {
            return { success: false, message: '无效的案件编号。' };
        }

        const result = {
            success: false,
            killerCorrect: false,
            evidenceValid: false,
            motiveCorrect: false,
            details: []
        };

        // 1. Verify killer name
        const normalizedKiller = killerName.trim();
        if (normalizedKiller === caseData.killer) {
            result.killerCorrect = true;
            result.details.push('✓ 凶手身份正确');
        } else {
            result.details.push(`✗ 凶手身份错误 —— "${normalizedKiller}" 不是本案凶手`);
        }

        // 2. Verify evidence SQL
        if (evidenceSql && evidenceSql.trim()) {
            try {
                const queryResult = DatabaseManager.executeQuery(evidenceSql);
                if (queryResult.rowCount > 0) {
                    const evidencePoints = this._evaluateEvidence(caseId, evidenceSql, queryResult);
                    if (evidencePoints >= 2) {
                        result.evidenceValid = true;
                        result.details.push(`✓ 证据SQL有效（关联了${evidencePoints}个关键证据点）`);
                    } else if (evidencePoints === 1) {
                        result.details.push('△ 证据SQL部分有效，但证据链不完整，需要更多关键证据');
                    } else {
                        result.details.push('✗ 证据SQL未能揭示与凶手相关的关键证据');
                    }
                } else {
                    result.details.push('✗ 证据SQL执行成功但无返回结果');
                }
            } catch (e) {
                result.details.push(`✗ 证据SQL执行错误: ${e.message}`);
            }
        } else {
            result.details.push('✗ 未提供证据SQL');
        }

        // 3. Verify motive
        if (motive && motive.trim()) {
            const motiveText = motive.trim().toLowerCase();
            const hasMotiveKeyword = caseData.motiveKeywords.some(kw => motiveText.includes(kw));
            if (hasMotiveKeyword) {
                result.motiveCorrect = true;
                result.details.push('✓ 作案动机分析正确');
            } else {
                result.details.push('✗ 作案动机分析不够准确');
            }
        } else {
            result.details.push('✗ 未提供作案动机');
        }

        // Overall result
        result.success = result.killerCorrect && result.evidenceValid && result.motiveCorrect;

        if (result.success) {
            result.message = `恭喜！你成功破解了「${caseData.title}」！\n凶手确实是${caseData.killer}，你的推理逻辑严密，证据链完整。`;
        } else if (result.killerCorrect && (result.evidenceValid || result.motiveCorrect)) {
            result.message = `接近真相了！凶手判断正确，但还需要完善证据链或动机分析。`;
        } else if (result.killerCorrect) {
            result.message = `凶手判断正确，但缺乏有力的证据支撑和动机分析。继续调查！`;
        } else {
            result.message = `推理方向有误。建议重新审视线索，注意区分真线索和伪线索。`;
        }

        return result;
    },

    _evaluateEvidence(caseId, sql, queryResult) {
        const caseData = this.cases[caseId];
        let points = 0;
        const sqlUpper = sql.toUpperCase();
        const resultStr = JSON.stringify(queryResult.values).toLowerCase();

        for (const chain of caseData.evidenceChain) {
            const tableMentioned = sqlUpper.includes(chain.table.toUpperCase());
            let conditionHints = chain.condition.toLowerCase().split(/AND|OR/).map(s => s.trim());

            let conditionMatched = false;
            for (const hint of conditionHints) {
                const likeMatch = hint.match(/like\s+'%(.+)%'/);
                if (likeMatch && resultStr.includes(likeMatch[1].toLowerCase())) {
                    conditionMatched = true;
                    break;
                }
                const eqMatch = hint.match(/(\w+)\s*=\s*(\d+)/);
                if (eqMatch) {
                    const personId = eqMatch[2];
                    if (sqlUpper.includes(eqMatch[1].toUpperCase()) || resultStr.includes(personId)) {
                        conditionMatched = true;
                        break;
                    }
                }
            }

            if (tableMentioned || conditionMatched) {
                points++;
            }
        }

        return points;
    },

    getCaseIntro() {
        return `<p><strong>翠城市</strong>在一周之内发生了三起离奇死亡案件。作为数据分析侦探，你需要通过SQL查询数据库中的各类记录，抽丝剥茧，找出每起案件的真凶。</p>
        <p>警告：三起案件之间可能存在<strong>交叉干扰</strong>，部分线索是<strong>伪造的</strong>，不要轻信表面证据。</p>`;
    },

    getCaseObjectives() {
        return `<ol>
            <li><strong>案件一</strong>：翡翠庄园富豪陈雅琴之死 —— 找出谁在她的饮品中下毒</li>
            <li><strong>案件二</strong>：码头仓库主管张德海中毒 —— 谁在仓库内设下陷阱</li>
            <li><strong>案件三</strong>：医院两名患者连续死亡 —— 揪出篡改药物的内鬼</li>
        </ol>
        <p style="margin-top:10px;color:var(--warning)">每个案件需要提交：凶手姓名 + 关键证据SQL + 作案动机</p>`;
    },

    getDbDescription() {
        return `<p>数据库包含11张表：人员、地点、事件、证据、通讯记录、财务记录、不在场证明、人物关系、案件档案、医疗记录、监控录像。</p>
        <p>数据涵盖三起案件的所有线索，共计<strong>约150条记录</strong>。注意交叉验证不同表之间的信息。</p>`;
    }
};
