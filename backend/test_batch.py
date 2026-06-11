#!/usr/bin/env python3
"""批量处理证据和版本链路完整验证测试 - 含补正原因必填闭环"""
import requests
import sys

BASE_URL = "http://localhost:8107/api"


def p(msg, color=None):
    colors = {
        "red": "\033[91m",
        "green": "\033[92m",
        "yellow": "\033[93m",
        "blue": "\033[94m",
    }
    reset = "\033[0m"
    if color and color in colors:
        print(f"{colors[color]}{msg}{reset}")
    else:
        print(msg)


def switch_role(userId):
    res = requests.post(f"{BASE_URL}/auth/switch-role", json={"userId": userId})
    return res.json()


def get_orders():
    res = requests.get(f"{BASE_URL}/orders")
    return res.json()


def get_order(order_id):
    res = requests.get(f"{BASE_URL}/orders/{order_id}")
    return res.json()


def create_order(data):
    res = requests.post(f"{BASE_URL}/orders", json=data)
    return res.json()


def batch_review(data):
    res = requests.post(f"{BASE_URL}/orders/batch-review", json=data)
    return res.json(), res.status_code


def batch_approve(data):
    res = requests.post(f"{BASE_URL}/orders/batch-approve", json=data)
    return res.json(), res.status_code


def test_scenario_1_batch_review_approve_with_correct_reason():
    """场景1：批量审核通过（补正原因必填 + 写入订单 + 返回结果验证）"""
    p("\n=== 场景1：批量审核通过（补正原因必填） ===", "blue")
    p("1. 切换为登记员张伟，创建2个待审核订单", "yellow")
    switch_role("u1")
    order_ids = []
    for i in range(2):
        new_order = create_order({
            "venueName": "批量补正原因测试馆",
            "courtName": f"补正原因场地{i+1}",
            "reservationDate": "2026-07-15",
            "timeSlot": f"{10+i}:00-{12+i}:00",
            "applicantName": f"补正原因用户{i+1}",
            "applicantPhone": f"1390000{i:02d}1",
            "deadline": "2026-07-11",
            "paymentAmount": 200 + i * 50,
            "paymentMethod": "微信支付",
            "paymentStatus": "已核销",
            "paymentVerification": f"补正原因测试订单XD{i+1} 已支付 核销时间 2026-06-12 15:30",
            "admissionStatus": "待确认",
        })
        order_ids.append(new_order["id"])
        p(f"  创建订单: {new_order['orderNo']} v={new_order['version']}")

    p("\n2. 切换为审核主管李明，批量审核通过（带补正原因）", "yellow")
    switch_role("u2")
    orders = [get_order(oid) for oid in order_ids]
    orders_with_versions = [{"id": o["id"], "version": o["version"]} for o in orders]

    batch_data = {
        "orderIds": order_ids,
        "ordersWithVersions": orders_with_versions,
        "action": "approve",
        "opinion": "批量审核通过，支付凭证齐全",
        "correctReason": "批量审核通过：所有订单支付凭证完整，信息核对无误",
        "paymentAmount": 250,
        "paymentMethod": "微信支付",
        "paymentStatus": "已核销",
        "paymentVerification": "批量统一核销售后凭证 已支付",
        "admissionStatus": "待确认",
        "responsibleNode": "reviewer_batch_approved",
        "auditRemark": "批量审核处理",
    }

    results, code = batch_review(batch_data)

    success_count = sum(1 for r in results if r["success"])
    p(f"\n3. 批量审核结果: 成功={success_count}", "yellow")

    for r in results:
        if r["success"]:
            p(f"  ✓ {r['orderNo']} 成功 - 版本=v{r.get('version')} 补正原因={r.get('correctReason')}", "green")
            updated_order = get_order(r["orderId"])
            assert updated_order["status"] == "under_approval"
            assert updated_order.get("correctReason"), "订单应保存补正原因"
            assert "批量审核通过" in updated_order.get("correctReason", ""), "补正原因应包含批量审核通过"
            assert r.get("correctReason"), "返回结果应包含补正原因"
            p(f"    验证: 状态={updated_order['status']} 补正原因={updated_order.get('correctReason')[:25]}...", "green")

            records = updated_order.get("processingRecords", [])
            approve_records = [rec for rec in records if "review_approve" in rec.get("action", "")]
            if approve_records:
                latest = approve_records[-1]
                assert latest.get("correctReason"), "处理记录应保存补正原因"
                p(f"    处理记录: 补正原因={latest.get('correctReason')[:25]}...", "green")
        else:
            p(f"  ✗ {r['orderNo']} 失败 - {r.get('reason')}", "red")
            return False

    if success_count == 2:
        p("✓ 场景1批量审核通过成功！补正原因已写入订单、处理记录和返回结果", "green")
        return True
    return False


def test_scenario_2_batch_review_fail_missing_correct_reason():
    """场景2：批量审核通过缺少补正原因被拦截"""
    p("\n=== 场景2：批量审核通过 - 缺少补正原因拦截 ===", "blue")
    p("1. 切换为登记员张伟，创建2个订单", "yellow")
    switch_role("u1")
    order_ids = []
    for i in range(2):
        new_order = create_order({
            "venueName": "缺补正原因测试馆",
            "courtName": f"缺补正原因场地{i+1}",
            "reservationDate": "2026-07-16",
            "timeSlot": f"{14+i}:00-{16+i}:00",
            "applicantName": f"缺补正原因用户{i+1}",
            "applicantPhone": f"1380000{i:02d}2",
            "deadline": "2026-07-12",
            "paymentStatus": "已核销",
            "paymentVerification": f"缺补正原因测试 已支付 核销",
            "admissionStatus": "待确认",
        })
        order_ids.append(new_order["id"])

    p("\n2. 切换为审核主管李明，批量审核通过但不传补正原因", "yellow")
    switch_role("u2")
    orders = [get_order(oid) for oid in order_ids]
    orders_with_versions = [{"id": o["id"], "version": o["version"]} for o in orders]

    batch_data = {
        "orderIds": order_ids,
        "ordersWithVersions": orders_with_versions,
        "action": "approve",
        "opinion": "批量审核（故意不填补正原因）",
        "paymentStatus": "已核销",
        "paymentVerification": "测试 已支付 核销",
    }

    results, code = batch_review(batch_data)

    fail_count = sum(1 for r in results if not r["success"])
    p(f"\n3. 批量结果: 失败={fail_count}", "yellow")

    for r in results:
        if not r["success"]:
            p(f"  ✓ {r['orderNo']} 正确拦截 - {r.get('reason')}", "green")
            assert "补正原因" in r.get("reason", ""), "错误原因应该包含'补正原因'"
            assert r.get("responsibleNode") == "batch_review_failed"
            assert r.get("version") is not None, "失败结果也应包含版本号"
        else:
            p(f"  ✗ {r['orderNo']} 不应该成功", "red")
            return False

    p("\n4. 验证失败记录是否持久化了补正原因缺失信息", "yellow")
    sample_order = get_order(order_ids[0])
    records = sample_order.get("processingRecords", [])
    fail_records = [rec for rec in records if "batch" in rec.get("action", "")]
    if fail_records:
        latest_fail = fail_records[-1]
        assert "补正原因" in latest_fail.get("exceptionReason", ""), "失败记录异常原因应包含补正原因"
        p(f"  ✓ 失败记录: 异常原因={latest_fail.get('exceptionReason')} 责任={latest_fail.get('responsibleNode')}", "green")
    p("✓ 场景2缺少补正原因拦截成功！失败记录已持久化", "green")
    return True


def test_scenario_3_batch_review_fail_missing_evidence():
    """场景3：批量审核通过被拦截（缺少支付核销凭证，有补正原因）"""
    p("\n=== 场景3：批量审核 - 缺少证据拦截（有补正原因） ===", "blue")
    switch_role("u1")
    order_ids = []
    for i in range(2):
        new_order = create_order({
            "venueName": "缺证据测试馆",
            "courtName": f"缺证据场地{i+1}",
            "reservationDate": "2026-07-17",
            "timeSlot": f"{14+i}:00-{16+i}:00",
            "applicantName": f"缺证据用户{i+1}",
            "applicantPhone": f"1380000{i:02d}3",
            "deadline": "2026-07-13",
            "paymentStatus": "待核销",
            "admissionStatus": "待确认",
        })
        order_ids.append(new_order["id"])

    switch_role("u2")
    orders = [get_order(oid) for oid in order_ids]
    orders_with_versions = [{"id": o["id"], "version": o["version"]} for o in orders]

    batch_data = {
        "orderIds": order_ids,
        "ordersWithVersions": orders_with_versions,
        "action": "approve",
        "opinion": "批量审核（有补正原因但缺支付核销）",
        "correctReason": "已核对信息，但支付核销凭证缺失",
        "paymentStatus": "待核销",
    }

    results, code = batch_review(batch_data)

    fail_count = sum(1 for r in results if not r["success"])
    for r in results:
        if not r["success"]:
            assert "支付" in r.get("reason", "") or "核销" in r.get("reason", "")
            p(f"  ✓ {r['orderNo']} 正确拦截（支付核销缺失优先于补正原因校验）", "green")
        else:
            p(f"  ✗ 不应该成功", "red")
            return False

    p("✓ 场景3缺少证据拦截成功！", "green")
    return True


def test_scenario_4_batch_reject_with_return_opinion():
    """场景4：批量审核退回（退回意见必填 + 不需要补正原因）"""
    p("\n=== 场景4：批量审核退回 ===", "blue")
    switch_role("u1")
    order_ids = []
    for i in range(2):
        new_order = create_order({
            "venueName": "退回测试馆",
            "courtName": f"退回场地{i+1}",
            "reservationDate": "2026-07-18",
            "timeSlot": f"{9+i}:00-{11+i}:00",
            "applicantName": f"退回用户{i+1}",
            "applicantPhone": f"1370000{i:02d}4",
            "deadline": "2026-07-14",
            "paymentStatus": "待核销",
        })
        order_ids.append(new_order["id"])

    switch_role("u2")
    orders = [get_order(oid) for oid in order_ids]
    orders_with_versions = [{"id": o["id"], "version": o["version"]} for o in orders]

    batch_data = {
        "orderIds": order_ids,
        "ordersWithVersions": orders_with_versions,
        "action": "reject",
        "opinion": "支付凭证不全",
        "returnOpinion": "批量退回：缺少支付核销凭证，请补充后重新提交",
        "exceptionReason": "支付凭证不全",
        "responsibleNode": "registrar_missing_payment",
        "paymentStatus": "待核销",
    }

    results, code = batch_review(batch_data)

    success_count = sum(1 for r in results if r["success"])
    for r in results:
        if r["success"]:
            updated = get_order(r["orderId"])
            assert updated["status"] == "pending_correction"
            assert updated.get("returnOpinion"), "订单应保存退回意见"
            p(f"  ✓ {r['orderNo']} 退回成功 退回意见={updated.get('returnOpinion')[:20]}...", "green")
        else:
            p(f"  ✗ {r['orderNo']} 失败", "red")
            return False

    if success_count == 2:
        p("✓ 场景4批量退回成功！", "green")
        return True
    return False


def test_scenario_5_batch_missing_version():
    """场景5：批量处理缺少版本号拦截"""
    p("\n=== 场景5：缺少版本号拦截 ===", "blue")
    switch_role("u1")
    new_order = create_order({
        "venueName": "缺版本号测试馆",
        "courtName": "缺版本号场地",
        "reservationDate": "2026-07-19",
        "timeSlot": "09:00-11:00",
        "applicantName": "缺版本号用户",
        "applicantPhone": "13600000005",
        "deadline": "2026-07-15",
        "paymentStatus": "已核销",
        "paymentVerification": "已支付 核销",
    })
    order_id = new_order["id"]

    switch_role("u2")
    batch_data = {
        "orderIds": [order_id],
        "action": "approve",
        "opinion": "测试缺少版本号",
        "correctReason": "测试补正原因",
        "paymentStatus": "已核销",
        "paymentVerification": "已支付 核销",
    }

    results, code = batch_review(batch_data)

    if len(results) == 1 and not results[0]["success"]:
        assert "版本号" in results[0].get("reason", "")
        p(f"  ✓ 缺少版本号拦截成功 - {results[0].get('reason')}", "green")
        return True
    p("  ✗ 应该被版本号拦截", "red")
    return False


def test_scenario_6_batch_version_conflict():
    """场景6：批量版本冲突拦截"""
    p("\n=== 场景6：版本冲突拦截 ===", "blue")
    switch_role("u1")
    new_order = create_order({
        "venueName": "版本冲突测试馆",
        "courtName": "版本冲突场地",
        "reservationDate": "2026-07-20",
        "timeSlot": "09:00-11:00",
        "applicantName": "版本冲突用户",
        "applicantPhone": "13600000006",
        "deadline": "2026-07-16",
        "paymentStatus": "已核销",
        "paymentVerification": "已支付 核销",
    })
    order_id = new_order["id"]

    switch_role("u2")
    requests.put(
        f"{BASE_URL}/orders/{order_id}/review",
        json={
            "version": 1,
            "action": "reject",
            "opinion": "退回",
            "returnOpinion": "版本冲突测试退回",
            "exceptionReason": "测试",
            "paymentStatus": "待核销",
        },
    )

    switch_role("u1")
    res2 = requests.put(
        f"{BASE_URL}/orders/{order_id}/correct",
        json={
            "version": 2,
            "correctReason": "已补充支付凭证",
            "paymentStatus": "已核销",
            "paymentVerification": "已支付 核销",
        },
    )
    current_version = res2.json()["version"]

    switch_role("u2")
    batch_data = {
        "orderIds": [order_id],
        "ordersWithVersions": [{"id": order_id, "version": 1}],
        "action": "approve",
        "opinion": "使用旧版本号",
        "correctReason": "测试补正原因",
        "paymentStatus": "已核销",
        "paymentVerification": "已支付 核销",
    }

    results, code = batch_review(batch_data)

    if len(results) == 1 and not results[0]["success"]:
        assert "版本冲突" in results[0].get("reason", "")
        p(f"  ✓ 版本冲突拦截成功 - v1 vs v{current_version}", "green")
        return True
    p("  ✗ 应该被版本冲突拦截", "red")
    return False


def test_scenario_7_batch_reject_missing_return_opinion():
    """场景7：批量退回缺少退回意见拦截"""
    p("\n=== 场景7：缺少退回意见拦截 ===", "blue")
    switch_role("u1")
    new_order = create_order({
        "venueName": "缺退回意见测试馆",
        "courtName": "缺退回意见场地",
        "reservationDate": "2026-07-21",
        "timeSlot": "10:00-12:00",
        "applicantName": "缺退回意见用户",
        "applicantPhone": "13500000007",
        "deadline": "2026-07-17",
        "paymentStatus": "待核销",
    })
    order_id = new_order["id"]

    switch_role("u2")
    batch_data = {
        "orderIds": [order_id],
        "ordersWithVersions": [{"id": order_id, "version": new_order["version"]}],
        "action": "reject",
        "opinion": "不传退回意见",
        "returnOpinion": "",
        "paymentStatus": "待核销",
    }

    results, code = batch_review(batch_data)

    if len(results) == 1 and not results[0]["success"]:
        assert "退回意见" in results[0].get("reason", "")
        p(f"  ✓ 缺少退回意见拦截成功 - {results[0].get('reason')}", "green")
        return True
    p("  ✗ 应该被退回意见拦截", "red")
    return False


def test_scenario_8_batch_approve_return_with_opinion():
    """场景8：批量审批退回"""
    p("\n=== 场景8：批量审批退回 ===", "blue")
    switch_role("u1")
    new_order = create_order({
        "venueName": "审批退回测试馆",
        "courtName": "审批退回场地",
        "reservationDate": "2026-07-22",
        "timeSlot": "14:00-16:00",
        "applicantName": "审批退回用户",
        "applicantPhone": "13400000008",
        "deadline": "2026-07-18",
        "paymentStatus": "已核销",
        "paymentVerification": "审批退回测试 已支付 核销",
        "admissionStatus": "待确认",
    })
    order_id = new_order["id"]

    switch_role("u2")
    order = get_order(order_id)
    requests.put(
        f"{BASE_URL}/orders/{order_id}/review",
        json={
            "version": order["version"],
            "action": "approve",
            "opinion": "审核通过提交复核",
            "correctReason": "审核通过，信息完整",
            "paymentStatus": "已核销",
            "paymentVerification": "审批退回测试 已支付 核销",
        },
    )

    order_after_review = get_order(order_id)

    switch_role("u3")
    batch_data = {
        "orderIds": [order_id],
        "ordersWithVersions": [{"id": order_id, "version": order_after_review["version"]}],
        "action": "return",
        "opinion": "入场确认缺失",
        "returnOpinion": "复核退回：入场确认信息不完整",
        "exceptionReason": "复核时发现入场确认问题",
        "responsibleNode": "approver_returned",
        "admissionStatus": "待确认",
    }

    results, code = batch_approve(batch_data)

    if len(results) == 1 and results[0]["success"]:
        updated = get_order(order_id)
        assert updated["status"] == "pending_review"
        assert updated.get("returnOpinion"), "订单应保存退回意见"
        p(f"  ✓ 审批退回成功 退回意见={updated.get('returnOpinion')[:25]}...", "green")
        return True
    p(f"  ✗ 审批退回失败", "red")
    return False


def test_scenario_9_batch_approve_finalize_with_correct_reason():
    """场景9：批量审批办结（补正原因必填 + correctReason写入订单 + 同步刷新）"""
    p("\n=== 场景9：批量审批办结（补正原因必填） ===", "blue")
    switch_role("u1")
    order_ids = []
    for i in range(2):
        new_order = create_order({
            "venueName": "批量办结补正原因馆",
            "courtName": f"办结补正场地{i+1}",
            "reservationDate": "2026-07-23",
            "timeSlot": f"{15+i}:00-{17+i}:00",
            "applicantName": f"办结补正用户{i+1}",
            "applicantPhone": f"1350000{i:02d}9",
            "deadline": "2026-07-19",
            "paymentAmount": 400 + i * 100,
            "paymentMethod": "支付宝",
            "paymentStatus": "已核销",
            "paymentVerification": f"办结补正订单{i+1} 已支付 核销时间 2026-06-12 14:30",
            "admissionStatus": "待确认",
        })
        order_ids.append(new_order["id"])

    switch_role("u2")
    for oid in order_ids:
        order = get_order(oid)
        requests.put(
            f"{BASE_URL}/orders/{oid}/review",
            json={
                "version": order["version"],
                "action": "approve",
                "opinion": "审核通过提交复核",
                "correctReason": "审核通过补正原因：支付核销信息完整",
                "paymentStatus": "已核销",
                "paymentVerification": f"办结补正订单 已支付 核销",
            },
        )

    orders_after_review = [get_order(oid) for oid in order_ids]

    p("\n2. 切换为复核负责人王芳，批量办结（带补正原因）", "yellow")
    switch_role("u3")
    orders_with_versions = [{"id": o["id"], "version": o["version"]} for o in orders_after_review]

    batch_data = {
        "orderIds": order_ids,
        "ordersWithVersions": orders_with_versions,
        "action": "finalize",
        "opinion": "批量办结，支付和入场均已确认",
        "correctReason": "批量办结补正原因：支付已核销、入场已确认，订单信息完整归档",
        "paymentStatus": "已核销",
        "admissionStatus": "已确认",
        "admissionConfirmation": "入场时间 2026-07-23 准时入场 确认人 张伟",
        "responsibleNode": "approver_batch_finalized",
        "auditRemark": "批量办结归档处理",
    }

    results, code = batch_approve(batch_data)

    success_count = sum(1 for r in results if r["success"])
    p(f"\n3. 批量办结结果: 成功={success_count}", "yellow")

    for r in results:
        if r["success"]:
            p(f"  ✓ {r['orderNo']} 办结成功 - 版本=v{r.get('version')} 补正原因={r.get('correctReason')[:20]}...", "green")
            updated = get_order(r["orderId"])
            assert updated["status"] == "completed"
            assert updated.get("correctReason"), "办结订单应保存补正原因"
            assert "批量办结" in updated.get("correctReason", ""), "补正原因应包含批量办结"
            assert r.get("correctReason"), "返回结果应包含补正原因"

            records = updated.get("processingRecords", [])
            finalize_records = [rec for rec in records if "approve_finalize" in rec.get("action", "")]
            if finalize_records:
                latest = finalize_records[-1]
                assert latest.get("correctReason"), "处理记录应保存补正原因"
                p(f"    处理记录: 补正原因={latest.get('correctReason')[:25]}...", "green")
        else:
            p(f"  ✗ {r['orderNo']} 失败 - {r.get('reason')}", "red")
            return False

    p("\n4. 验证列表/预警同步刷新", "yellow")
    all_orders = get_orders()
    completed = [o for o in all_orders if o["id"] in order_ids]
    for o in completed:
        assert o["status"] == "completed"
        assert o.get("correctReason"), "列表中订单应包含补正原因"
    p(f"  ✓ 列表中{len(completed)}个订单已同步更新，补正原因已展示", "green")

    warnings_res = requests.get(f"{BASE_URL}/orders/warnings")
    warning_data = warnings_res.json()
    for key in ["normal", "approaching", "overdue"]:
        for wo in warning_data.get(key, []):
            assert wo["id"] not in order_ids
    p("  ✓ 预警列表中已无办结订单", "green")

    if success_count == 2:
        p("✓ 场景9批量办结成功！补正原因写入订单+处理记录，列表和预警同步", "green")
        return True
    return False


def test_scenario_10_batch_finalize_missing_correct_reason():
    """场景10：批量审批办结缺少补正原因被拦截"""
    p("\n=== 场景10：批量审批办结 - 缺少补正原因拦截 ===", "blue")
    switch_role("u1")
    new_order = create_order({
        "venueName": "缺补正原因办结馆",
        "courtName": "缺补正原因办结场地",
        "reservationDate": "2026-07-24",
        "timeSlot": "10:00-12:00",
        "applicantName": "缺补正原因办结用户",
        "applicantPhone": "13300000010",
        "deadline": "2026-07-20",
        "paymentStatus": "已核销",
        "paymentVerification": "缺补正原因办结测试 已支付 核销",
        "admissionStatus": "待确认",
    })
    order_id = new_order["id"]

    switch_role("u2")
    order = get_order(order_id)
    requests.put(
        f"{BASE_URL}/orders/{order_id}/review",
        json={
            "version": order["version"],
            "action": "approve",
            "opinion": "审核通过",
            "correctReason": "审核补正原因",
            "paymentStatus": "已核销",
            "paymentVerification": "缺补正原因办结测试 已支付 核销",
        },
    )

    order_after_review = get_order(order_id)

    switch_role("u3")
    batch_data = {
        "orderIds": [order_id],
        "ordersWithVersions": [{"id": order_id, "version": order_after_review["version"]}],
        "action": "finalize",
        "opinion": "批量办结（故意不填补正原因）",
        "paymentStatus": "已核销",
        "admissionStatus": "已确认",
        "admissionConfirmation": "入场确认",
    }

    results, code = batch_approve(batch_data)

    if len(results) == 1 and not results[0]["success"]:
        r = results[0]
        p(f"  ✓ 正确拦截 - {r.get('reason')}", "green")
        assert "补正原因" in r.get("reason", ""), "错误原因应该包含'补正原因'"
        assert r.get("responsibleNode") == "batch_approve_failed"

        sample = get_order(order_id)
        records = sample.get("processingRecords", [])
        fail_records = [rec for rec in records if "batch" in rec.get("action", "")]
        if fail_records:
            latest_fail = fail_records[-1]
            assert "补正原因" in latest_fail.get("exceptionReason", "")
            p(f"  ✓ 失败记录: {latest_fail.get('exceptionReason')}", "green")
        p("✓ 场景10缺少补正原因拦截成功！", "green")
        return True
    p("  ✗ 应该被补正原因必填拦截", "red")
    return False


def run_all_tests():
    p("=" * 60, "blue")
    p("体育场馆订单系统 - 批量处理补正原因必填闭环验证", "blue")
    p("=" * 60, "blue")

    tests = [
        test_scenario_1_batch_review_approve_with_correct_reason,
        test_scenario_2_batch_review_fail_missing_correct_reason,
        test_scenario_3_batch_review_fail_missing_evidence,
        test_scenario_4_batch_reject_with_return_opinion,
        test_scenario_5_batch_missing_version,
        test_scenario_6_batch_version_conflict,
        test_scenario_7_batch_reject_missing_return_opinion,
        test_scenario_8_batch_approve_return_with_opinion,
        test_scenario_9_batch_approve_finalize_with_correct_reason,
        test_scenario_10_batch_finalize_missing_correct_reason,
    ]

    passed = 0
    failed = 0
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            p(f"\n✗ {test.__name__} 异常: {e}", "red")
            import traceback
            traceback.print_exc()
            failed += 1

    p("\n" + "=" * 60, "blue")
    p(f"测试完成：通过 {passed} 个，失败 {failed} 个", "green" if failed == 0 else "red")
    p("=" * 60, "blue")

    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
