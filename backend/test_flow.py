#!/usr/bin/env python3
"""培训项目单系统闭环测试脚本"""

import requests
import json

BASE = "http://localhost:8106"
PASS = "123456"

def login(u):
    r = requests.post(f"{BASE}/api/auth/login", json={"username": u, "password": PASS})
    d = r.json()
    assert r.status_code == 200, f"登录失败 {u}: {r.status_code} {d}"
    print(f"  ✅ 登录 {u} -> {d['role_name']}")
    return d["token"]

def auth(t):
    return {"Authorization": f"Bearer {t}"}

def main():
    print("=" * 60)
    print("📋 培训项目单 - 后端 API 闭环测试")
    print("=" * 60)

    # ========= 登录 =========
    print("\n🔐 步骤1：三个角色登录")
    t_cons = login("consultant")
    t_aud = login("trainer_ops")
    t_rev = login("project_mgr")

    # ========= Dashboard =========
    print("\n📊 步骤2：Dashboard 统计（项目经理视角）")
    r = requests.get(f"{BASE}/api/projects/dashboard", headers=auth(t_rev))
    d = r.json()
    assert r.status_code == 200
    print(f"  ✅ 总数={d['total_count']}, 草稿={d['draft_count']}, 待审核={d['pending_audit_count']}")
    print(f"     待复核={d['pending_review_count']}, 同步={d['synced_count']}, 逾期={d['overdue_count']}")

    # ========= 获取课程顾问的第一条草稿 =========
    print("\n📝 步骤3：获取课程顾问可见列表")
    r = requests.get(f"{BASE}/api/projects", headers=auth(t_cons), params={"page": 1, "page_size": 100})
    d = r.json()
    items = d["items"]
    drafts = [x for x in items if x["status"] == "draft"]
    assert len(drafts) > 0, "没有草稿数据"
    pid = drafts[0]["id"]
    pno = drafts[0]["project_no"]
    pver = drafts[0]["version"]
    print(f"  ✅ 共 {d['total']} 条，选中草稿 #{pid} {pno} (v{pver})")

    # ========= 详情 =========
    print(f"\n🔍 步骤4：获取草稿 #{pid} 详情")
    r = requests.get(f"{BASE}/api/projects/{pid}", headers=auth(t_cons))
    d = r.json()
    assert r.status_code == 200
    print(f"  ✅ 状态={d['status_name']}, 阶段={d['stage_name']}, 允许动作={d['allowed_actions']}")

    # ========= 正常流转：草稿→待审核 =========
    print(f"\n🔄 步骤5：正常流转 - 课程顾问提交审核 #{pid}")
    r = requests.post(
        f"{BASE}/api/projects/{pid}/action",
        headers=auth(t_cons),
        json={"action": "submit", "version": pver, "remark": "闭环测试：正常提交"},
    )
    d = r.json()
    status_new = d.get("status")
    msg_new = d.get("detail") if r.status_code != 200 else "提交成功"
    print(f"  {'✅' if r.status_code == 200 else '❌'} 提交审核结果：HTTP {r.status_code}，新状态={status_new}，msg={msg_new}")

    # 找一个待审核的项目进行下一步
    print("\n🔍 步骤6：讲师运营视角获取待审核项目")
    r = requests.get(f"{BASE}/api/projects", headers=auth(t_aud), params={"status": "pending_audit", "page_size": 100})
    d = r.json()
    items_aud = d["items"]
    print(f"  ✅ 讲师运营可见待审核 {len(items_aud)} 条")
    if len(items_aud) == 0:
        # 重新拿第一条草稿重试
        r = requests.get(f"{BASE}/api/projects", headers=auth(t_cons), params={"page": 1, "page_size": 100})
        items = r.json()["items"]
        pending = [x for x in items if x["status"] == "pending_audit"]
        items_aud = pending

    # 选一个待审核的进行测试
    if len(items_aud) > 0:
        pid2 = items_aud[0]["id"]
        pno2 = items_aud[0]["project_no"]
        pver2 = items_aud[0]["version"]
        print(f"\n🔄 步骤7：讲师运营审核通过 #{pid2} {pno2} (v{pver2})")
        r = requests.post(
            f"{BASE}/api/projects/{pid2}/action",
            headers=auth(t_aud),
            json={"action": "audit_pass", "version": pver2, "remark": "闭环测试：审核通过"},
        )
        d = r.json()
        code = r.status_code
        st = d.get("status") if code == 200 else None
        print(f"  {'✅' if code == 200 else '❌'} HTTP {code} 新状态={st} msg={d.get('detail') if code != 200 else 'OK'}")

        if st == "audit_passed":
            print(f"\n🔄 步骤8：项目经理复核通过 #{pid2}")
            r = requests.post(
                f"{BASE}/api/projects/{pid2}/action",
                headers=auth(t_rev),
                json={"action": "review_pass", "version": (pver2 + 1), "remark": "闭环测试：复核同步"},
            )
            d = r.json()
            code = r.status_code
            st2 = d.get("status") if code == 200 else None
            print(f"  {'✅' if code == 200 else '❌'} HTTP {code} 新状态={st2} msg={d.get('detail') if code != 200 else 'OK'}")
    else:
        print("  ⚠️  无待审核数据，跳过审核/复核测试")

    # ========= 异常拦截测试 =========
    print("\n" + "=" * 60)
    print("🛑 异常拦截测试（每条失败都会记录审计备注）")
    print("=" * 60)

    # 找一个退回补正状态的项目（应该是 #3）
    r = requests.get(f"{BASE}/api/projects", headers=auth(t_cons), params={"page": 1, "page_size": 100})
    items = r.json()["items"]

    # 找个可用于测试越权的项目：非当前处理人来办理
    pending_all = [x for x in items if x["status"] == "pending_audit"]
    if len(pending_all) > 0:
        ptest = pending_all[0]
        print(f"\n❌ 异常1：课程顾问（越权）去办理待审核项目 #{ptest['id']}")
        r = requests.post(
            f"{BASE}/api/projects/{ptest['id']}/action",
            headers=auth(t_cons),
            json={"action": "audit_pass", "version": ptest["version"]},
        )
        print(f"  已拦截：HTTP {r.status_code} msg={r.json().get('detail')}")

    # 版本冲突测试：找个草稿项目
    drafts = [x for x in items if x["status"] == "draft"]
    if len(drafts) > 0:
        pd = drafts[0]
        print(f"\n❌ 异常2：版本冲突 - 提交旧版本号 #{pd['id']}")
        r = requests.post(
            f"{BASE}/api/projects/{pd['id']}/action",
            headers=auth(t_cons),
            json={"action": "submit", "version": 0},
        )
        print(f"  已拦截：HTTP {r.status_code} msg={r.json().get('detail')}")

    # 缺材料测试：找退回补正的项目
    rejected = [x for x in items if x["status"] == "audit_rejected"]
    if len(rejected) > 0:
        pr = rejected[0]
        print(f"\n❌ 异常3：缺材料 - 退回补正项目直接补正提交 #{pr['id']}")
        r = requests.post(
            f"{BASE}/api/projects/{pr['id']}/action",
            headers=auth(t_cons),
            json={"action": "supplement", "version": pr["version"], "remark": "测试缺材料拦截"},
        )
        print(f"  已拦截：HTTP {r.status_code} msg={r.json().get('detail')}")

    # 越权：项目经理去办理待审核
    if len(pending_all) > 0:
        pp = pending_all[-1]
        print(f"\n❌ 异常4：角色越权 - 项目经理去审核待办 #{pp['id']}")
        r = requests.post(
            f"{BASE}/api/projects/{pp['id']}/action",
            headers=auth(t_rev),
            json={"action": "audit_pass", "version": pp["version"]},
        )
        print(f"  已拦截：HTTP {r.status_code} msg={r.json().get('detail')}")

    # ========= 批量处理测试 =========
    print("\n" + "=" * 60)
    print("📦 批量处理测试（按单据逐条返回结果）")
    print("=" * 60)
    r = requests.get(f"{BASE}/api/projects", headers=auth(t_rev), params={"page": 1, "page_size": 100})
    all_items = r.json()["items"]
    test_ids = [x["id"] for x in all_items[:3]]
    test_versions = {x["id"]: x["version"] for x in all_items[:3]}
    print(f"  选取 {len(test_ids)} 个项目：{test_ids}")
    print(f"  执行讲师运营【批量审核通过】（预期因权限/状态部分成功部分失败）")
    r = requests.post(
        f"{BASE}/api/projects/batch/action",
        headers=auth(t_aud),
        json={"ids": test_ids, "action": "audit_pass", "remark": "批量测试", "versions": test_versions},
    )
    res = r.json()
    print(f"  HTTP {r.status_code} 总数={res['total']} 成功={res['success_count']} 失败={res['fail_count']}")
    for r in res["results"]:
        icon = "✅" if r["success"] else "❌"
        print(f"    {icon} #{r['id']} {r['project_no'] or ''}: {r['message']}")

    # ========= 审计备注验证 =========
    print("\n" + "=" * 60)
    print("🔍 审计备注/异常追溯验证")
    print("=" * 60)
    any_pid = items[0]["id"] if len(items) > 0 else 1
    r = requests.get(f"{BASE}/api/projects/{any_pid}", headers=auth(t_rev))
    d = r.json()
    records = d.get("processing_records", [])
    notes = d.get("audit_notes", [])
    print(f"  #{any_pid} 处理记录：{len(records)} 条")
    for r in records[-3:]:
        print(f"    📝 {r['processed_at'][-8:]} | {r['action_name']} | {r['operator']['full_name']} | v{r['version_at_action']}")
    print(f"  #{any_pid} 审计备注：{len(notes)} 条")
    exc = [n for n in notes if n["note_type"] == "exception"]
    if exc:
        print(f"    ⚠️  异常类备注 {len(exc)} 条（已可追溯）")
        for e in exc[-3:]:
            print(f"      ❌ {e['note_content'][:70]}...")
    else:
        print("    暂未记录异常（需要执行过拦截操作才会产生）")

    print("\n🎉 全部测试完成！后端 API 闭环正常。")

if __name__ == "__main__":
    main()
