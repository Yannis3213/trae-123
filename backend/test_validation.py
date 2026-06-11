#!/usr/bin/env python3
"""
体育场馆订单系统 - 证据化办理链路完整验证
覆盖场景：正常流转、缺材料拦截、逾期拦截、退回补正、状态冲突、批量处理
"""
import requests
import json
import sys

BASE_URL = "http://localhost:8107/api"

def p(msg, color=""):
    colors = {"green": "\033[32m", "red": "\033[31m", "yellow": "\033[33m", "blue": "\033[34m"}
    reset = "\033[0m"
    print(f"{colors.get(color, '')}{msg}{reset}")

def switch_role(user_id):
    res = requests.post(f"{BASE_URL}/auth/switch-role", json={"userId": user_id})
    data = res.json()
    return data["data"]

def get_orders(status=None):
    params = {"status": status} if status else {}
    res = requests.get(f"{BASE_URL}/orders", params=params)
    return res.json()

def get_order(order_id):
    res = requests.get(f"{BASE_URL}/orders/{order_id}")
    return res.json()

def correct_order(order_id, data):
    res = requests.put(f"{BASE_URL}/orders/{order_id}/correct", json=data)
    return res.json(), res.status_code

def review_order(order_id, data):
    res = requests.put(f"{BASE_URL}/orders/{order_id}/review", json=data)
    return res.json(), res.status_code

def approve_order(order_id, data):
    res = requests.put(f"{BASE_URL}/orders/{order_id}/approve", json=data)
    return res.json(), res.status_code

def batch_review(data):
    res = requests.post(f"{BASE_URL}/orders/batch-review", json=data)
    return res.json(), res.status_code

def batch_approve(data):
    res = requests.post(f"{BASE_URL}/orders/batch-approve", json=data)
    return res.json(), res.status_code

def test_1_normal_flow():
    """场景1：正常流转 - 登记员补正 → 审核主管审核 → 复核负责人办结"""
    p("\n=== 场景1：正常流转 ===", "blue")
    
    # 先查找一个待补正的订单，如果没有就创建一个
    p("1.0 查找或创建一个待补正的订单", "yellow")
    switch_role("u1")
    orders = get_orders()
    pending_correction_order = next((o for o in orders if o["status"] == "pending_correction" and o["currentHandler"] == "u1"), None)
    
    if not pending_correction_order:
        # 创建一个新订单，然后让审核主管退回，制造一个待补正订单
        p("创建测试订单...", "yellow")
        new_order_data = {
            "venueName": "测试体育馆",
            "courtName": "测试场地B",
            "reservationDate": "2026-06-25",
            "timeSlot": "14:00-16:00",
            "applicantName": "测试用户B",
            "applicantPhone": "13900008888",
            "deadline": "2026-06-20",  # 未来日期，不会逾期
            "paymentAmount": 250,
            "paymentMethod": "支付宝",
            "paymentStatus": "待核销",
            "paymentVerification": None,
            "admissionStatus": "待确认",
            "admissionConfirmation": None
        }
        res = requests.post(f"{BASE_URL}/orders", json=new_order_data)
        new_order = res.json()
        test_order_id = new_order["id"]
        
        # 切换到审核主管退回订单
        switch_role("u2")
        return_data = {
            "version": new_order["version"],
            "action": "reject",
            "opinion": "缺少支付凭证，请补充",
            "paymentStatus": "待核销",
            "paymentVerification": None,
            "admissionStatus": "待确认",
            "exceptionReason": "支付凭证不全",
            "responsibleNode": "registrar_missing_payment"
        }
        res2, _ = review_order(test_order_id, return_data)
        pending_correction_order = res2
    else:
        # 如果现有的待补正订单逾期了，也创建一个新的
        if pending_correction_order["warningLevel"] == "overdue":
            p("现有待补正订单已逾期，创建新的测试订单...", "yellow")
            new_order_data = {
                "venueName": "测试体育馆",
                "courtName": "测试场地C",
                "reservationDate": "2026-06-26",
                "timeSlot": "10:00-12:00",
                "applicantName": "测试用户C",
                "applicantPhone": "13900007777",
                "deadline": "2026-06-22",  # 未来日期
                "paymentAmount": 300,
                "paymentMethod": "微信支付",
                "paymentStatus": "待核销",
                "paymentVerification": None,
                "admissionStatus": "待确认",
                "admissionConfirmation": None
            }
            res = requests.post(f"{BASE_URL}/orders", json=new_order_data)
            new_order = res.json()
            test_order_id = new_order["id"]
            
            switch_role("u2")
            return_data = {
                "version": new_order["version"],
                "action": "reject",
                "opinion": "缺少支付凭证，请补充完整",
                "paymentStatus": "待核销",
                "paymentVerification": None,
                "admissionStatus": "待确认",
                "exceptionReason": "支付凭证不全",
                "responsibleNode": "registrar_missing_payment"
            }
            res2, _ = review_order(test_order_id, return_data)
            pending_correction_order = res2
    
    test_order_id = pending_correction_order["id"]
    p(f"使用测试订单：{pending_correction_order['orderNo']} ID={test_order_id}", "yellow")
    
    # 1. 登记员补正
    p("\n1.1 切换为登记员张伟", "yellow")
    switch_role("u1")
    
    order = get_order(test_order_id)
    p(f"补正前：状态={order['status']} 版本={order['version']} 支付状态={order['paymentStatus']}")
    
    p("1.2 提交补正（补充支付核销凭证）", "yellow")
    correct_data = {
        "version": order["version"],
        "correctReason": "已补充支付凭证，支付宝250元已核销",
        "paymentAmount": 250,
        "paymentMethod": "支付宝",
        "paymentStatus": "已核销",
        "paymentVerification": f"订单号XD{order['orderNo'][2:]} 已支付 核销时间 2026-06-12 16:30 凭证号ALI202606120002",
        "exceptionReason": None,
        "responsibleNode": None,
        "auditRemark": "补正完成，支付凭证已齐全"
    }
    result, code = correct_order(test_order_id, correct_data)
    
    if code == 200:
        p(f"✓ 补正成功：新状态={result['status']} 新版本={result['version']}", "green")
        assert result["status"] == "pending_review", "状态应该变为待审核"
        assert result["paymentStatus"] == "已核销", "支付状态应该更新"
    else:
        p(f"✗ 补正失败：{result.get('message')}", "red")
        return False
    
    # 2. 审核主管审核通过
    p("\n2.1 切换为审核主管李明", "yellow")
    switch_role("u2")
    
    order = get_order(test_order_id)
    p(f"审核前：状态={order['status']} 支付状态={order['paymentStatus']}")
    
    p("2.2 提交审核通过", "yellow")
    review_data = {
        "version": order["version"],
        "action": "approve",
        "opinion": "支付凭证齐全，同意提交复核",
        "paymentAmount": 250,
        "paymentMethod": "支付宝",
        "paymentStatus": "已核销",
        "paymentVerification": f"订单号XD{order['orderNo'][2:]} 已支付 核销时间 2026-06-12 16:30 凭证号ALI202606120002",
        "admissionStatus": "待确认",
        "responsibleNode": "reviewer_approved",
        "auditRemark": "审核通过，支付已核实"
    }
    result, code = review_order(test_order_id, review_data)
    
    if code == 200:
        p(f"✓ 审核通过：新状态={result['status']} 新版本={result['version']} 处理人={result['currentHandlerRole']}", "green")
        assert result["status"] == "under_approval", "状态应该变为复核中"
        assert result["currentHandlerRole"] == "approver", "应该流转给复核负责人"
    else:
        p(f"✗ 审核失败：{result.get('message')}", "red")
        return False
    
    # 3. 复核负责人办结归档
    p("\n3.1 切换为复核负责人王芳", "yellow")
    switch_role("u3")
    
    order = get_order(test_order_id)
    p(f"复核前：状态={order['status']} 入场状态={order['admissionStatus']}")
    
    p("3.2 提交复核办结（补充入场确认）", "yellow")
    approve_data = {
        "version": order["version"],
        "action": "finalize",
        "opinion": "支付和入场均已确认，同意办结归档",
        "paymentAmount": 250,
        "paymentMethod": "支付宝",
        "paymentStatus": "已核销",
        "paymentVerification": f"订单号XD{order['orderNo'][2:]} 已支付 核销时间 2026-06-12 16:30 凭证号ALI202606120002",
        "admissionStatus": "已确认",
        "admissionConfirmation": "入场时间 2026-06-25 13:55 确认人 张伟",
        "responsibleNode": "approver_finalized",
        "auditRemark": "订单完整归档，支付和入场均已核实"
    }
    result, code = approve_order(test_order_id, approve_data)
    
    if code == 200:
        p(f"✓ 办结成功：新状态={result['status']} 入场状态={result['admissionStatus']}", "green")
        assert result["status"] == "completed", "状态应该变为办结"
        assert result["admissionStatus"] == "已确认", "入场状态应该已确认"
    else:
        p(f"✗ 办结失败：{result.get('message')}", "red")
        return False
    
    p("\n✓ 场景1正常流转全部通过！", "green")
    return True

def test_2_missing_evidence():
    """场景2：缺材料拦截 - 审核时缺少支付核销凭证"""
    p("\n=== 场景2：缺材料拦截 ===", "blue")
    
    p("1. 先创建一个新的待审核订单（支付状态故意设为待核销）", "yellow")
    switch_role("u1")
    
    # 创建一个新订单，支付状态为待核销
    new_order_data = {
        "venueName": "测试体育馆",
        "courtName": "测试场地",
        "reservationDate": "2026-06-20",
        "timeSlot": "09:00-11:00",
        "applicantName": "测试用户",
        "applicantPhone": "13900009999",
        "deadline": "2026-06-22",
        "paymentAmount": 300,
        "paymentMethod": "微信支付",
        "paymentStatus": "待核销",
        "paymentVerification": None,
        "admissionStatus": "待确认",
        "admissionConfirmation": None
    }
    res = requests.post(f"{BASE_URL}/orders", json=new_order_data)
    new_order = res.json()
    test_order_id = new_order["id"]
    p(f"创建测试订单：{new_order['orderNo']} ID={test_order_id} 支付状态={new_order['paymentStatus']}")
    
    p("2. 切换为审核主管李明", "yellow")
    switch_role("u2")
    
    order = get_order(test_order_id)
    p(f"审核前：订单={order['orderNo']} 状态={order['status']} 支付状态={order['paymentStatus']}")
    
    p("3. 故意缺少支付核销凭证，尝试审核通过", "yellow")
    review_data = {
        "version": order["version"],
        "action": "approve",
        "opinion": "材料齐全，同意上报",
        "paymentStatus": "待核销",
        "paymentVerification": None,
        "admissionStatus": "待确认"
    }
    result, code = review_order(test_order_id, review_data)
    
    if code == 400 and "支付" in result.get("message", ""):
        p(f"✓ 正确拦截：{result['message']}", "green")
        return True
    elif code == 200:
        p("✗ 错误：缺少支付凭证应该被拦截但未拦截！", "red")
        return False
    else:
        p(f"✗ 预期400错误但得到 {code}: {result.get('message')}", "red")
        return False

def test_3_overdue_block():
    """场景3：逾期拦截 - 逾期订单不能直接审核通过，只能退回补正"""
    p("\n=== 场景3：逾期拦截 ===", "blue")
    
    p("1. 切换为审核主管李明", "yellow")
    switch_role("u2")
    
    # 查找一个逾期订单
    orders = get_orders()
    overdue_order = next((o for o in orders if o["status"] == "overdue"), None)
    if not overdue_order:
        p("没有逾期订单，跳过此测试", "yellow")
        return True
    
    p(f"处理前：订单={overdue_order['orderNo']} 状态={overdue_order['status']} 预警级别={overdue_order['warningLevel']} 处理人={overdue_order['currentHandler']}")
    
    p("2. 尝试直接审核通过逾期订单（应被拦截）", "yellow")
    review_data = {
        "version": overdue_order["version"],
        "action": "approve",
        "opinion": "同意上报",
        "paymentStatus": "已核销",
        "paymentVerification": "测试支付已核实",
        "admissionStatus": "待确认"
    }
    result, code = review_order(overdue_order["id"], review_data)
    
    if code == 409 and "逾期" in result.get("message", ""):
        p(f"✓ 正确拦截（审核通过被拒绝）：{result['message']}", "green")
    else:
        p(f"✗ 应该拦截逾期审核通过但未拦截：{code} {result.get('message')}", "red")
        return False
    
    p("3. 尝试退回补正逾期订单（应允许）", "yellow")
    review_data2 = {
        "version": overdue_order["version"],
        "action": "reject",
        "opinion": "已逾期，退回重新设置截止日期",
        "paymentStatus": "待核销",
        "paymentVerification": None,
        "admissionStatus": "待确认",
        "exceptionReason": "逾期未处理，需重新提交",
        "responsibleNode": "reviewer_rejected"
    }
    result2, code2 = review_order(overdue_order["id"], review_data2)
    
    if code2 == 200:
        p(f"✓ 退回补正成功：新状态={result2['status']}", "green")
        return True
    else:
        p(f"✗ 逾期订单退回补正失败：{code2} {result2.get('message')}", "red")
        return False

def test_4_version_conflict():
    """场景4：版本冲突 - 旧版本提交应该被拦截"""
    p("\n=== 场景4：版本冲突 ===", "blue")
    
    p("1. 切换为审核主管李明", "yellow")
    switch_role("u2")
    
    # 查找一个待审核的订单
    orders = get_orders()
    pending_order = next((o for o in orders if o["status"] == "pending_review" and o["currentHandler"] == "u2" and o["paymentStatus"] == "已核销"), None)
    if not pending_order:
        pending_order = next((o for o in orders if o["status"] == "under_review" and o["currentHandler"] == "u2" and o["paymentStatus"] == "已核销"), None)
    
    if not pending_order:
        p("没有待审核的订单，跳过此测试", "yellow")
        return True
    
    test_id = pending_order["id"]
    p(f"测试订单：{pending_order['orderNo']} 当前版本：{pending_order['version']}")
    
    p("2. 使用旧版本号提交审核", "yellow")
    review_data = {
        "version": 0,  # 故意使用旧版本
        "action": "approve",
        "opinion": "同意上报",
        "paymentStatus": "已核销",
        "paymentVerification": pending_order.get("paymentVerification") or "已支付",
        "admissionStatus": "待确认"
    }
    result, code = review_order(test_id, review_data)
    
    if code == 409 and "版本冲突" in result.get("message", ""):
        p(f"✓ 正确拦截：{result['message']}", "green")
        return True
    else:
        p(f"✗ 应该拦截版本冲突但未拦截：{code} {result.get('message')}", "red")
        return False

def test_5_role_permission():
    """场景5：越权操作 - 非当前角色操作应该被拦截"""
    p("\n=== 场景5：越权操作 ===", "blue")
    
    p("1. 切换为登记员张伟（登记员不能审核）", "yellow")
    switch_role("u1")
    
    # 查找一个待审核的订单
    orders = get_orders()
    pending_order = next((o for o in orders if o["status"] in ["pending_review", "under_review"]), None)
    
    if not pending_order:
        p("没有待审核的订单，跳过此测试", "yellow")
        return True
    
    test_id = pending_order["id"]
    p(f"尝试以登记员身份审核订单 {pending_order['orderNo']}")
    
    p("2. 登记员尝试审核（越权）", "yellow")
    review_data = {
        "version": pending_order["version"],
        "action": "approve",
        "opinion": "同意上报",
        "paymentStatus": "已核销",
        "paymentVerification": "测试",
        "admissionStatus": "待确认"
    }
    result, code = review_order(test_id, review_data)
    
    if code == 403 and "审核主管" in result.get("message", ""):
        p(f"✓ 正确拦截：{result['message']}", "green")
        return True
    else:
        p(f"✗ 应该拦截越权操作但未拦截：{code} {result.get('message')}", "red")
        return False

def test_6_batch_processing():
    """场景6：批量处理 - 批量审核和批量复核"""
    p("\n=== 场景6：批量处理 ===", "blue")
    
    p("1. 切换为审核主管李明", "yellow")
    switch_role("u2")
    
    orders = get_orders(status="pending_review")
    pending_ids = [o["id"] for o in orders if o["paymentStatus"] == "已核销"]
    p(f"待审核且支付已核销的订单：{len(pending_ids)}个")
    
    if len(pending_ids) < 1:
        p("没有符合条件的待审核订单，跳过批量审核", "yellow")
        return True
    
    p("2. 批量审核（应部分成功部分失败）", "yellow")
    batch_data = {
        "orderIds": pending_ids + ["o5"],  # 包含一个逾期订单
        "action": "approve",
        "opinion": "批量审核通过",
        "paymentStatus": "已核销",
        "paymentVerification": "批量审核，支付已核实",
        "admissionStatus": "待确认",
        "auditRemark": "批量审核"
    }
    results, code = batch_review(batch_data)
    
    if code == 200:
        success_count = sum(1 for r in results if r["success"])
        fail_count = len(results) - success_count
        p(f"✓ 批量处理完成：成功{success_count} 失败{fail_count}", "green")
        for r in results:
            if r["success"]:
                p(f"  ✓ {r['orderNo']} 成功", "green")
            else:
                p(f"  ✗ {r['orderNo']} 失败：{r.get('reason')}", "red")
        assert fail_count >= 1, "应该至少有一个失败（逾期订单）"
        return True
    else:
        p(f"✗ 批量处理失败：{results.get('message')}", "red")
        return False

def test_7_missing_opinion():
    """场景7：缺失意见 - 审核/复核意见不能为空"""
    p("\n=== 场景7：缺失意见拦截 ===", "blue")
    
    p("1. 切换为审核主管李明", "yellow")
    switch_role("u2")
    
    # 查找一个待审核且支付已核销的订单
    orders = get_orders()
    pending_order = next((o for o in orders if o["status"] in ["pending_review", "under_review"] and o["currentHandler"] == "u2" and o["paymentStatus"] == "已核销"), None)
    
    if not pending_order:
        p("没有符合条件的待审核订单，跳过此测试", "yellow")
        return True
    
    test_id = pending_order["id"]
    p(f"测试订单：{pending_order['orderNo']}")
    
    p("2. 审核意见为空，应该被拦截", "yellow")
    review_data = {
        "version": pending_order["version"],
        "action": "approve",
        "opinion": "",  # 空意见
        "paymentStatus": "已核销",
        "paymentVerification": pending_order.get("paymentVerification") or "已支付",
        "admissionStatus": "待确认"
    }
    result, code = review_order(test_id, review_data)
    
    if code == 400 and "意见" in result.get("message", ""):
        p(f"✓ 正确拦截：{result['message']}", "green")
        return True
    else:
        p(f"✗ 应该拦截空意见但未拦截：{code} {result.get('message')}", "red")
        return False

def main():
    p("=" * 60, "blue")
    p("体育场馆订单系统 - 证据化办理链路完整验证", "blue")
    p("=" * 60, "blue")
    
    tests = [
        ("场景1：正常流转", test_1_normal_flow),
        ("场景2：缺材料拦截", test_2_missing_evidence),
        ("场景3：逾期拦截", test_3_overdue_block),
        ("场景4：版本冲突", test_4_version_conflict),
        ("场景5：越权操作", test_5_role_permission),
        ("场景6：批量处理", test_6_batch_processing),
        ("场景7：缺失意见", test_7_missing_opinion),
    ]
    
    passed = 0
    failed = 0
    
    for name, test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            p(f"✗ {name} 异常：{e}", "red")
            import traceback
            traceback.print_exc()
            failed += 1
    
    p("\n" + "=" * 60, "blue")
    p(f"测试完成：通过 {passed} 个，失败 {failed} 个", "green" if failed == 0 else "red")
    p("=" * 60, "blue")
    
    return failed == 0

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
