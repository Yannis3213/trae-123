#!/usr/bin/env python3
"""批量处理证据和版本链路完整验证测试"""
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


def test_scenario_1_batch_review_success():
    """场景1：批量审核通过（含证据字段和版本校验+返回结果验证）"""
    p("\n=== 场景1：批量审核通过 ===", "blue")
    p("1. 切换为登记员张伟，创建2个待审核订单", "yellow")
    switch_role("u1")
    order_ids = []
    for i in range(2):
        new_order = create_order({
            "venueName": "批量测试体育馆",
            "courtName": f"测试场地{i+1}",
            "reservationDate": "2026-07-05",
            "timeSlot": f"{10+i}:00-{12+i}:00",
            "applicantName": f"批量测试用户{i+1}",
            "applicantPhone": f"1390000{i:02d}0",
            "deadline": "2026-07-01",
            "paymentAmount": 200 + i * 50,
            "paymentMethod": "微信支付",
            "paymentStatus": "已核销",
            "paymentVerification": f"批量测试订单XD{i+1} 已支付 核销时间 2026-06-12 15:30 凭证号WX2026061200{i+1:02d}",
            "admissionStatus": "待确认",
        })
        order_ids.append(new_order["id"])
        p(f"  创建订单: {new_order['orderNo']} ID={new_order['id']} v={new_order['version']}")

    p("\n2. 切换为审核主管李明，执行批量审核通过", "yellow")
    switch_role("u2")
    orders = [get_order(oid) for oid in order_ids]
    orders_with_versions = [{"id": o["id"], "version": o["version"]} for o in orders]

    batch_data = {
        "orderIds": order_ids,
        "ordersWithVersions": orders_with_versions,
        "action": "approve",
        "opinion": "批量审核通过，支付凭证齐全",
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
            p(f"  ✓ {r['orderNo']} 成功 - 版本=v{r.get('version')} 支付={r.get('paymentStatus')} 责任={r.get('responsibleNode')}", "green")
            updated_order = get_order(r["orderId"])
            assert updated_order["status"] == "under_approval", f"状态应该是复核中"
            assert r.get("version") == updated_order["version"], "返回版本应和数据库一致"
            assert r.get("returnOpinion") is None, "审核通过不应有退回意见"
            p(f"    验证: 状态={updated_order['status']} 版本=v{updated_order['version']}", "green")
        else:
            p(f"  ✗ {r['orderNo']} 失败 - {r.get('reason')}", "red")
            return False

    if success_count == 2:
        p("✓ 场景1批量审核通过全部成功！返回结果含版本号和证据快照", "green")
        return True
    return False


def test_scenario_2_batch_review_fail_missing_evidence():
    """场景2：批量审核通过被拦截（缺少支付核销凭证）+ 失败记录持久化验证"""
    p("\n=== 场景2：批量审核 - 缺少证据拦截 ===", "blue")
    p("1. 切换为登记员张伟，创建2个支付待核销的订单", "yellow")
    switch_role("u1")
    order_ids = []
    for i in range(2):
        new_order = create_order({
            "venueName": "缺证据测试馆",
            "courtName": f"缺证据场地{i+1}",
            "reservationDate": "2026-07-06",
            "timeSlot": f"{14+i}:00-{16+i}:00",
            "applicantName": f"缺证据用户{i+1}",
            "applicantPhone": f"1380000{i:02d}0",
            "deadline": "2026-07-02",
            "paymentAmount": 300 + i * 50,
            "paymentMethod": "支付宝",
            "paymentStatus": "待核销",
            "admissionStatus": "待确认",
        })
        order_ids.append(new_order["id"])

    p("\n2. 切换为审核主管李明，尝试批量审核通过（故意不填支付核销）", "yellow")
    switch_role("u2")
    orders = [get_order(oid) for oid in order_ids]
    orders_with_versions = [{"id": o["id"], "version": o["version"]} for o in orders]

    batch_data = {
        "orderIds": order_ids,
        "ordersWithVersions": orders_with_versions,
        "action": "approve",
        "opinion": "批量审核（故意缺支付核销）",
        "paymentStatus": "待核销",
    }

    results, code = batch_review(batch_data)

    fail_count = sum(1 for r in results if not r["success"])
    p(f"\n3. 批量结果: 失败={fail_count}", "yellow")

    for r in results:
        if not r["success"]:
            p(f"  ✓ {r['orderNo']} 正确拦截 - {r.get('reason')}", "green")
            assert "支付" in r.get("reason", "") or "核销" in r.get("reason", ""), "错误原因应该和支付相关"
            assert r.get("exceptionReason"), "失败结果应该包含异常原因"
            assert r.get("responsibleNode") == "batch_review_failed", f"责任节点应该是batch_review_failed"
            assert r.get("version") is not None, "失败结果也应包含版本号"
        else:
            p(f"  ✗ {r['orderNo']} 不应该成功", "red")
            return False

    p("\n4. 验证处理记录是否保存了失败原因和证据快照", "yellow")
    sample_order = get_order(order_ids[0])
    records = sample_order.get("processingRecords", [])
    fail_records = [rec for rec in records if "batch" in rec.get("action", "")]
    if fail_records:
        latest_fail = fail_records[-1]
        p(f"  找到失败处理记录: action={latest_fail['action']}", "green")
        p(f"    失败原因: {latest_fail.get('exceptionReason')}", "yellow")
        p(f"    责任节点: {latest_fail.get('responsibleNode')}", "yellow")
        p(f"    证据快照: 支付状态={latest_fail.get('paymentStatus')}", "yellow")
        p(f"    退回意见: {latest_fail.get('returnOpinion')}", "yellow")
        assert latest_fail.get("responsibleNode") == "batch_review_failed"
        return True
    p("  ✗ 未找到失败处理记录", "red")
    return False


def test_scenario_3_batch_reject_with_evidence():
    """场景3：批量审核退回（退回意见必填 + 写入订单returnOpinion + 返回结果含退回意见）"""
    p("\n=== 场景3：批量审核退回 ===", "blue")
    p("1. 切换为登记员张伟，创建2个待审核订单", "yellow")
    switch_role("u1")
    order_ids = []
    for i in range(2):
        new_order = create_order({
            "venueName": "批量退回测试馆",
            "courtName": f"退回场地{i+1}",
            "reservationDate": "2026-07-07",
            "timeSlot": f"{9+i}:00-{11+i}:00",
            "applicantName": f"退回测试用户{i+1}",
            "applicantPhone": f"1370000{i:02d}0",
            "deadline": "2026-07-03",
            "paymentStatus": "待核销",
            "admissionStatus": "待确认",
        })
        order_ids.append(new_order["id"])

    p("\n2. 切换为审核主管李明，批量退回（带退回意见）", "yellow")
    switch_role("u2")
    orders = [get_order(oid) for oid in order_ids]
    orders_with_versions = [{"id": o["id"], "version": o["version"]} for o in orders]

    batch_data = {
        "orderIds": order_ids,
        "ordersWithVersions": orders_with_versions,
        "action": "reject",
        "opinion": "支付凭证不全，需要补充支付核销信息",
        "returnOpinion": "批量退回：所有订单均缺少支付核销凭证，请补充完整后重新提交",
        "exceptionReason": "支付凭证不全",
        "responsibleNode": "registrar_missing_payment",
        "paymentStatus": "待核销",
        "auditRemark": "批量退回，统一补正支付信息",
    }

    results, code = batch_review(batch_data)

    success_count = sum(1 for r in results if r["success"])
    p(f"\n3. 批量退回结果: 成功={success_count}", "yellow")

    for r in results:
        if r["success"]:
            p(f"  ✓ {r['orderNo']} 退回成功 - 版本=v{r.get('version')}", "green")
            updated_order = get_order(r["orderId"])
            assert updated_order["status"] == "pending_correction", f"状态应该是待补正"
            assert updated_order["currentHandlerRole"] == "registrar", "应该退回给登记员"
            assert updated_order.get("returnOpinion"), "订单应保存退回意见"
            assert "支付" in updated_order.get("returnOpinion", "") or "核销" in updated_order.get("returnOpinion", ""), "退回意见应包含支付/核销"
            p(f"    验证: 状态={updated_order['status']} 退回意见={updated_order.get('returnOpinion')[:20]}...", "green")
            assert r.get("returnOpinion"), "返回结果应包含退回意见"
            assert r.get("version") is not None, "返回结果应包含版本号"
            assert r.get("responsibleNode"), "返回结果应包含责任节点"
        else:
            p(f"  ✗ {r['orderNo']} 失败 - {r.get('reason')}", "red")
            return False

    if success_count == 2:
        p("✓ 场景3批量退回成功！退回意见已写入订单returnOpinion和处理记录", "green")
        return True
    return False


def test_scenario_4_batch_missing_version():
    """场景4：批量处理缺少版本号拦截（版本号必传强校验）"""
    p("\n=== 场景4：批量处理 - 缺少版本号拦截 ===", "blue")
    p("1. 切换为登记员张伟，创建1个订单", "yellow")
    switch_role("u1")
    new_order = create_order({
        "venueName": "缺版本号测试馆",
        "courtName": "缺版本号场地",
        "reservationDate": "2026-07-08",
        "timeSlot": "09:00-11:00",
        "applicantName": "缺版本号用户",
        "applicantPhone": "13600000001",
        "deadline": "2026-07-04",
        "paymentStatus": "已核销",
        "paymentVerification": "已支付 核销 缺版本号测试",
    })
    order_id = new_order["id"]
    p(f"  创建订单: {new_order['orderNo']} v={new_order['version']}")

    p("\n2. 切换为审核主管李明，不传ordersWithVersions", "yellow")
    switch_role("u2")
    batch_data = {
        "orderIds": [order_id],
        "action": "approve",
        "opinion": "测试缺少版本号",
        "paymentStatus": "已核销",
        "paymentVerification": "已支付 核销",
    }

    results, code = batch_review(batch_data)

    if len(results) == 1 and not results[0]["success"]:
        r = results[0]
        p(f"  ✓ 正确拦截 - {r.get('reason')}", "green")
        assert "版本号" in r.get("reason", ""), "错误原因应该包含'版本号'"
        assert r.get("responsibleNode") == "batch_review_failed", "责任节点应该是batch_review_failed"
        assert r.get("version") is not None, "失败结果应包含当前版本号"
        p(f"  ✓ 返回当前版本=v{r.get('version')} 责任节点={r.get('responsibleNode')}", "green")
        p("✓ 场景4缺少版本号拦截成功！", "green")
        return True
    else:
        p(f"  ✗ 应该被版本号必传拦截", "red")
        return False


def test_scenario_5_batch_version_conflict():
    """场景5：批量处理版本冲突拦截"""
    p("\n=== 场景5：批量版本冲突拦截 ===", "blue")
    p("1. 切换为登记员张伟，创建1个订单", "yellow")
    switch_role("u1")
    new_order = create_order({
        "venueName": "版本冲突测试馆",
        "courtName": "版本冲突场地",
        "reservationDate": "2026-07-09",
        "timeSlot": "09:00-11:00",
        "applicantName": "版本冲突用户",
        "applicantPhone": "13600000001",
        "deadline": "2026-07-05",
        "paymentAmount": 500,
        "paymentMethod": "微信支付",
        "paymentStatus": "已核销",
        "paymentVerification": "订单已支付核销，用于版本冲突测试",
    })
    order_id = new_order["id"]
    p(f"  创建订单: {new_order['orderNo']} v={new_order['version']}")

    p("\n2. 先单独审核退回，修改版本号", "yellow")
    switch_role("u2")
    res = requests.put(
        f"{BASE_URL}/orders/{order_id}/review",
        json={
            "version": 1,
            "action": "reject",
            "opinion": "先退回制造版本变化",
            "returnOpinion": "版本冲突测试前置退回",
            "exceptionReason": "版本冲突测试前置操作",
            "paymentStatus": "待核销",
        },
    )
    order_after_reject = res.json()
    p(f"  退回后版本: v{order_after_reject['version']}")

    p("\n3. 补正回到待审核状态", "yellow")
    switch_role("u1")
    res2 = requests.put(
        f"{BASE_URL}/orders/{order_id}/correct",
        json={
            "version": order_after_reject["version"],
            "correctReason": "已补充支付凭证",
            "paymentAmount": 500,
            "paymentMethod": "微信支付",
            "paymentStatus": "已核销",
            "paymentVerification": "订单已支付核销，版本冲突测试补正",
        },
    )
    order_after_correct = res2.json()
    current_version = order_after_correct["version"]
    p(f"  补正后版本: v{current_version}")

    p(f"\n4. 使用旧版本号 v1 执行批量审核（故意用旧版本）", "yellow")
    switch_role("u2")
    batch_data = {
        "orderIds": [order_id],
        "ordersWithVersions": [{"id": order_id, "version": 1}],
        "action": "approve",
        "opinion": "使用旧版本号测试",
        "paymentStatus": "已核销",
        "paymentVerification": "测试支付 已核销",
    }

    results, code = batch_review(batch_data)

    if len(results) == 1 and not results[0]["success"]:
        r = results[0]
        p(f"  ✓ 正确拦截 - {r.get('reason')}", "green")
        assert "版本冲突" in r.get("reason", ""), "错误原因应该包含'版本冲突'"
        assert f"v{current_version}" in r.get("reason", ""), f"应显示当前版本v{current_version}"
        p(f"  ✓ 返回: 版本=v{r.get('version')} 责任={r.get('responsibleNode')}", "green")
        p("✓ 场景5版本冲突拦截成功！", "green")
        return True
    else:
        p(f"  ✗ 应该被版本冲突拦截", "red")
        return False


def test_scenario_6_batch_reject_missing_return_opinion():
    """场景6：批量退回缺少退回意见拦截"""
    p("\n=== 场景6：批量退回 - 缺少退回意见拦截 ===", "blue")
    p("1. 切换为登记员张伟，创建1个订单", "yellow")
    switch_role("u1")
    new_order = create_order({
        "venueName": "缺退回意见测试馆",
        "courtName": "缺退回意见场地",
        "reservationDate": "2026-07-10",
        "timeSlot": "10:00-12:00",
        "applicantName": "缺退回意见用户",
        "applicantPhone": "13500000001",
        "deadline": "2026-07-06",
        "paymentStatus": "待核销",
    })
    order_id = new_order["id"]
    p(f"  创建订单: {new_order['orderNo']} v={new_order['version']}")

    p("\n2. 切换为审核主管李明，批量退回但不传退回意见", "yellow")
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
        r = results[0]
        p(f"  ✓ 正确拦截 - {r.get('reason')}", "green")
        assert "退回意见" in r.get("reason", ""), "错误原因应该包含'退回意见'"
        assert r.get("responsibleNode") == "batch_review_failed"
        p(f"  ✓ 责任节点={r.get('responsibleNode')} 版本=v{r.get('version')}", "green")
        p("✓ 场景6缺少退回意见拦截成功！", "green")
        return True
    else:
        p(f"  ✗ 应该被退回意见必填拦截", "red")
        return False


def test_scenario_7_batch_approve_return_with_opinion():
    """场景7：批量审批退回（复核负责人退回到审核主管，含退回意见持久化验证）"""
    p("\n=== 场景7：批量审批退回 ===", "blue")
    p("1. 创建订单并流转到复核中", "yellow")
    switch_role("u1")
    new_order = create_order({
        "venueName": "审批退回测试馆",
        "courtName": "审批退回场地",
        "reservationDate": "2026-07-11",
        "timeSlot": "14:00-16:00",
        "applicantName": "审批退回用户",
        "applicantPhone": "13400000001",
        "deadline": "2026-07-07",
        "paymentAmount": 600,
        "paymentMethod": "微信支付",
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
            "paymentStatus": "已核销",
            "paymentVerification": "审批退回测试 已支付 核销",
        },
    )

    order_after_review = get_order(order_id)
    p(f"  订单状态: {order_after_review['status']} v={order_after_review['version']}")

    p("\n2. 切换为复核负责人王芳，批量退回", "yellow")
    switch_role("u3")
    batch_data = {
        "orderIds": [order_id],
        "ordersWithVersions": [{"id": order_id, "version": order_after_review["version"]}],
        "action": "return",
        "opinion": "入场确认信息缺失，退回重新审核",
        "returnOpinion": "复核退回：入场确认信息不完整，请审核主管重新确认入场状态后退回补正",
        "exceptionReason": "复核时发现入场确认问题",
        "responsibleNode": "approver_returned",
        "admissionStatus": "待确认",
        "auditRemark": "批量审批退回处理",
    }

    results, code = batch_approve(batch_data)

    if len(results) == 1 and results[0]["success"]:
        r = results[0]
        p(f"  ✓ 退回成功 - 版本=v{r.get('version')} 退回意见={r.get('returnOpinion')[:30]}...", "green")
        updated = get_order(order_id)
        assert updated["status"] == "pending_review", "应该退回到待审核"
        assert updated["currentHandlerRole"] == "reviewer", "应该退回给审核主管"
        assert updated.get("returnOpinion"), "订单应保存退回意见"
        assert "入场" in updated.get("returnOpinion", ""), "退回意见应包含入场相关"
        assert r.get("returnOpinion"), "返回结果应包含退回意见"
        assert r.get("version") is not None, "返回结果应包含版本号"
        p(f"    验证: 状态={updated['status']} returnOpinion={updated.get('returnOpinion')[:25]}...", "green")

        p("\n3. 验证处理记录退回意见持久化", "yellow")
        records = updated.get("processingRecords", [])
        return_records = [rec for rec in records if "approve_return" in rec.get("action", "")]
        if return_records:
            latest = return_records[-1]
            assert latest.get("returnOpinion"), "处理记录应保存退回意见"
            assert latest.get("responsibleNode") == "approver_returned"
            p(f"  ✓ 处理记录: 退回意见={latest.get('returnOpinion')[:25]}... 责任={latest.get('responsibleNode')}", "green")
        p("✓ 场景7批量审批退回成功！退回意见已持久化到订单和处理记录", "green")
        return True
    else:
        p(f"  ✗ 退回失败 - {results[0].get('reason') if results else 'no results'}", "red")
        return False


def test_scenario_8_batch_approve_finalize():
    """场景8：批量审批办结（入场确认校验 + 同步刷新验证）"""
    p("\n=== 场景8：批量审批办结 ===", "blue")
    p("1. 创建订单并流转到复核中状态", "yellow")
    switch_role("u1")
    order_ids = []
    for i in range(2):
        new_order = create_order({
            "venueName": "批量办结测试馆",
            "courtName": f"办结场地{i+1}",
            "reservationDate": "2026-07-12",
            "timeSlot": f"{15+i}:00-{17+i}:00",
            "applicantName": f"办结用户{i+1}",
            "applicantPhone": f"1350000{i:02d}0",
            "deadline": "2026-07-08",
            "paymentAmount": 400 + i * 100,
            "paymentMethod": "支付宝",
            "paymentStatus": "已核销",
            "paymentVerification": f"批量办结订单{i+1} 已支付 核销时间 2026-06-12 14:30",
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
                "paymentStatus": "已核销",
                "paymentVerification": f"批量办结订单 已支付 核销",
            },
        )

    orders_after_review = [get_order(oid) for oid in order_ids]

    p("\n2. 切换为复核负责人王芳，批量办结（含入场确认）", "yellow")
    switch_role("u3")
    orders_with_versions = [{"id": o["id"], "version": o["version"]} for o in orders_after_review]

    batch_data = {
        "orderIds": order_ids,
        "ordersWithVersions": orders_with_versions,
        "action": "finalize",
        "opinion": "批量办结，支付和入场均已确认",
        "paymentStatus": "已核销",
        "admissionStatus": "已确认",
        "admissionConfirmation": "入场时间 2026-07-12 准时入场 确认人 张伟",
        "responsibleNode": "approver_batch_finalized",
        "auditRemark": "批量办结归档处理",
    }

    results, code = batch_approve(batch_data)

    success_count = sum(1 for r in results if r["success"])
    p(f"\n3. 批量办结结果: 成功={success_count}", "yellow")

    for r in results:
        if r["success"]:
            p(f"  ✓ {r['orderNo']} 办结成功 - 版本=v{r.get('version')} 入场={r.get('admissionStatus')}", "green")
            updated = get_order(r["orderId"])
            assert updated["status"] == "completed", "状态应该是办结"
            assert updated["admissionStatus"] == "已确认", "入场状态应该是已确认"
            assert updated.get("returnOpinion") is None, "办结订单不应有退回意见"
        else:
            p(f"  ✗ {r['orderNo']} 失败 - {r.get('reason')}", "red")
            return False

    p("\n4. 验证列表/预警同步刷新", "yellow")
    all_orders = get_orders()
    completed_orders = [o for o in all_orders if o["id"] in order_ids]
    for o in completed_orders:
        assert o["status"] == "completed", f"列表中订单{o['orderNo']}应该是办结"
        assert o["warningLevel"] == "normal", f"办结订单应该是正常预警"
    p(f"  ✓ 列表中{len(completed_orders)}个订单已同步更新为办结状态", "green")

    warnings_res = requests.get(f"{BASE_URL}/orders/warnings")
    warning_data = warnings_res.json()
    for key in ["normal", "approaching", "overdue"]:
        for wo in warning_data.get(key, []):
            assert wo["id"] not in order_ids, f"办结订单不应出现在预警列表{key}中"
    p("  ✓ 预警列表中已无办结订单", "green")

    if success_count == 2:
        p("✓ 场景8批量办结成功！列表和预警数据已同步刷新", "green")
        return True
    return False


def run_all_tests():
    p("=" * 60, "blue")
    p("体育场馆订单系统 - 批量退回与版本强校验闭环验证", "blue")
    p("=" * 60, "blue")

    tests = [
        test_scenario_1_batch_review_success,
        test_scenario_2_batch_review_fail_missing_evidence,
        test_scenario_3_batch_reject_with_evidence,
        test_scenario_4_batch_missing_version,
        test_scenario_5_batch_version_conflict,
        test_scenario_6_batch_reject_missing_return_opinion,
        test_scenario_7_batch_approve_return_with_opinion,
        test_scenario_8_batch_approve_finalize,
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
