import requests
import json
from datetime import datetime, timedelta

BASE_URL = 'http://localhost:8108/api'


from urllib.parse import quote


def headers(role='clerk', name='Tester'):
    return {
        'Content-Type': 'application/json',
        'X-User-Role': role,
        'X-User-Name': quote(name)
    }


def test_normal_flow():
    """测试正常流转流程：创建 → 提交 → 派发 → 办理 → 复核归档"""
    print('\n========== 测试1：正常流转流程 ==========')

    # 1. 外贸登记员创建订单
    create_data = {
        'customer_name': '测试正常客户',
        'product_name': '测试产品A',
        'quantity': 100,
        'amount': 50000,
        'country': 'USA',
        'inquiry_content': '客户需要100套测试产品',
        'priority': 'high',
        'responsible_person': '张登记',
        'due_time': (datetime.now() + timedelta(days=10)).isoformat()
    }
    r = requests.post(f'{BASE_URL}/orders', json=create_data, headers=headers('clerk', '张登记'))
    assert r.status_code == 200, f'创建失败: {r.status_code} {r.text}'
    order = r.json()
    order_id = order['id']
    print(f'✅ 创建订单成功: {order["order_no"]}')
    assert order['status'] == 'pending_dispatch'
    assert order['stage'] == 'inquiry'

    # 2. 提交（登记员→审核主管）
    r = requests.post(f'{BASE_URL}/orders/{order_id}/process', json={
        'version': order['version'],
        'action': 'submit',
        'comment': '客户询盘已完整，提交下一环节'
    }, headers=headers('clerk', '张登记'))
    assert r.status_code == 200, f'提交失败: {r.status_code} {r.text}'
    order = r.json()
    print(f'✅ 提交成功: status={order["status"]}, stage={order["stage"]}')
    assert order['stage'] == 'quote_confirmation'
    assert order['current_handler_role'] == 'supervisor'

    # 3. 补全报价信息
    r = requests.put(f'{BASE_URL}/orders/{order_id}', json={
        'version': order['version'],
        'quote_content': '报价 USD500/套，FOB上海，交期30天',
        'quote_confirmed': True
    }, headers=headers('supervisor', '李主管'))
    assert r.status_code == 200, f'补全报价失败: {r.text}'
    order = r.json()
    print(f'✅ 补全报价信息: v{order["version"]}')

    # 4. 审核主管办理（报价→订单签订）
    r = requests.post(f'{BASE_URL}/orders/{order_id}/process', json={
        'version': order['version'],
        'action': 'process',
        'comment': '报价确认完成，进入订单签订阶段',
        'evidence_provided': True
    }, headers=headers('supervisor', '李主管'))
    assert r.status_code == 200, f'办理失败: {r.status_code} {r.text}'
    order = r.json()
    print(f'✅ 办理成功: stage={order["stage"]}')
    assert order['stage'] == 'order_signing'
    assert order['current_handler_role'] == 'reviewer'

    # 5. 补全订单签订信息
    r = requests.put(f'{BASE_URL}/orders/{order_id}', json={
        'version': order['version'],
        'order_content': '合同号 PO-TEST-001，双方已签字盖章',
        'order_signed': True
    }, headers=headers('reviewer', '王复核'))
    assert r.status_code == 200, f'补全订单失败: {r.text}'
    order = r.json()
    print(f'✅ 补全订单签订信息: v{order["version"]}')

    # 6. 复核负责人复核归档
    r = requests.post(f'{BASE_URL}/orders/{order_id}/process', json={
        'version': order['version'],
        'action': 'review',
        'comment': '全部信息完整，归档',
        'evidence_provided': True
    }, headers=headers('reviewer', '王复核'))
    assert r.status_code == 200, f'复核失败: {r.status_code} {r.text}'
    order = r.json()
    print(f'✅ 复核归档成功: status={order["status"]}, stage={order["stage"]}')
    assert order['status'] == 'closed'
    assert order['stage'] == 'archived'

    print('🎉 正常流转测试通过！')
    return order_id


def test_missing_materials():
    """测试缺材料拦截：报价/订单信息不齐时停在原队列"""
    print('\n========== 测试2：缺材料拦截 ==========')

    # 创建订单
    r = requests.post(f'{BASE_URL}/orders', json={
        'customer_name': '缺材料测试客户',
        'product_name': '测试产品B',
        'quantity': 50,
        'amount': 25000,
        'inquiry_content': '测试缺材料场景',
        'priority': 'medium'
    }, headers=headers('clerk', '张登记'))
    order = r.json()
    order_id = order['id']

    # 先提交到报价确认阶段
    r = requests.post(f'{BASE_URL}/orders/{order_id}/process', json={
        'version': 1, 'action': 'submit', 'comment': '提交'
    }, headers=headers('clerk', '张登记'))
    order = r.json()

    # 尝试办理但报价未确认 → 应失败，停在原队列
    r = requests.post(f'{BASE_URL}/orders/{order_id}/process', json={
        'version': order['version'],
        'action': 'process',
        'comment': '尝试通过',
        'evidence_provided': True
    }, headers=headers('supervisor', '李主管'))
    assert r.status_code == 400, f'缺报价应拦截: {r.status_code}'
    print(f'✅ 缺报价确认拦截成功: {r.json()["detail"]}')

    # 补报价但不确认
    r = requests.put(f'{BASE_URL}/orders/{order_id}', json={
        'version': r.json()['detail'] if False else order['version'],
        'quote_content': '报价内容',
        'quote_confirmed': False
    }, headers=headers('supervisor', '李主管'))
    order = r.json()

    # 再次尝试 → 仍应拦截
    r = requests.post(f'{BASE_URL}/orders/{order_id}/process', json={
        'version': order['version'],
        'action': 'process',
        'evidence_provided': True
    }, headers=headers('supervisor', '李主管'))
    assert r.status_code == 400, '未确认报价应拦截'
    print(f'✅ 报价未确认拦截成功')

    # 再补全报价
    r = requests.put(f'{BASE_URL}/orders/{order_id}', json={
        'version': r.json()['detail'] if False else order['version'],
        'quote_confirmed': True
    }, headers=headers('supervisor', '李主管'))
    order = r.json()

    # 现在通过报价阶段
    r = requests.post(f'{BASE_URL}/orders/{order_id}/process', json={
        'version': order['version'],
        'action': 'process',
        'evidence_provided': True
    }, headers=headers('supervisor', '李主管'))
    assert r.status_code == 200, f'补全后应通过: {r.text}'
    order = r.json()
    print(f'✅ 补全报价后通过，进入订单签订阶段')

    # 尝试复核归档但订单未签 → 拦截
    r = requests.post(f'{BASE_URL}/orders/{order_id}/process', json={
        'version': order['version'],
        'action': 'review',
        'evidence_provided': True
    }, headers=headers('reviewer', '王复核'))
    assert r.status_code == 400, '缺订单签订信息应拦截'
    print(f'✅ 缺订单签订信息拦截成功: {r.json()["detail"]}')

    print('🎉 缺材料拦截测试通过！')
    return order_id


def test_version_conflict():
    """测试版本冲突：旧版本提交被拦截"""
    print('\n========== 测试3：版本冲突 ==========')

    r = requests.post(f'{BASE_URL}/orders', json={
        'customer_name': '版本测试客户',
        'product_name': '版本冲突产品',
        'inquiry_content': '测试版本冲突',
    }, headers=headers('clerk'))
    order = r.json()
    order_id = order['id']

    # 修改订单到v2
    r = requests.put(f'{BASE_URL}/orders/{order_id}', json={
        'version': 1,
        'responsible_person': '修改1'
    }, headers=headers('clerk'))
    assert r.status_code == 200
    v2 = r.json()['version']
    assert v2 == 2, f'应为v2，实际v{v2}'
    print(f'✅ 版本递增正确')

    # 用v1再提交 → 冲突
    r = requests.put(f'{BASE_URL}/orders/{order_id}', json={
        'version': 1,
        'responsible_person': '修改2'
    }, headers=headers('clerk'))
    assert r.status_code == 409, '旧版本应冲突'
    print(f'✅ 旧版本拦截成功: {r.json()["detail"]}')

    print('🎉 版本冲突测试通过！')
    return order_id


def test_permission_denied():
    """测试越权操作拦截"""
    print('\n========== 测试4：越权操作 ==========')

    r = requests.post(f'{BASE_URL}/orders', json={
        'customer_name': '越权测试客户',
        'product_name': '越权产品',
        'inquiry_content': '越权测试',
    }, headers=headers('clerk'))
    order = r.json()
    order_id = order['id']

    # 审核主管尝试创建订单 → 拦截
    r = requests.post(f'{BASE_URL}/orders', json={
        'customer_name': '越权创建',
        'product_name': 'X',
        'inquiry_content': 'test',
    }, headers=headers('supervisor'))
    assert r.status_code == 403, '审核主管不能创建订单'
    print(f'✅ 越权创建拦截成功')

    # 先提交
    r = requests.post(f'{BASE_URL}/orders/{order_id}/process', json={
        'version': 1, 'action': 'submit'
    }, headers=headers('clerk'))
    order = r.json()

    # 复核负责人在报价确认阶段尝试办理 → 拦截
    r = requests.post(f'{BASE_URL}/orders/{order_id}/process', json={
        'version': order['version'],
        'action': 'process',
        'evidence_provided': True
    }, headers=headers('reviewer'))
    assert r.status_code == 403, '角色不对应拦截'
    print(f'✅ 角色不匹配拦截成功: {r.json()["detail"]}')

    print('🎉 越权操作测试通过！')
    return order_id


def test_batch_process():
    """测试批量处理：逐条拦截，成功/失败都写清原因"""
    print('\n========== 测试5：批量处理 ==========')

    # 创建3个订单
    order_ids = []
    for i in range(3):
        r = requests.post(f'{BASE_URL}/orders', json={
            'customer_name': f'批量客户{i+1}',
            'product_name': f'批量产品{i+1}',
            'inquiry_content': f'批量测试{i+1}',
        }, headers=headers('clerk'))
        order_ids.append(r.json()['id'])

    # 订单1正常提交，订单2、3也提交
    for oid in order_ids:
        r = requests.post(f'{BASE_URL}/orders/{oid}/process', json={
            'version': 1, 'action': 'submit'
        }, headers=headers('clerk'))

    # 给订单1补全报价，订单2不补，订单3用错误版本
    items = []
    for i, oid in enumerate(order_ids):
        r = requests.get(f'{BASE_URL}/orders/{oid}', headers=headers('supervisor'))
        v = r.json()['version']
        if i == 0:
            # 先补全报价
            requests.put(f'{BASE_URL}/orders/{oid}', json={
                'version': v, 'quote_content': '完整报价', 'quote_confirmed': True
            }, headers=headers('supervisor'))
            r2 = requests.get(f'{BASE_URL}/orders/{oid}', headers=headers('supervisor'))
            items.append({
                'order_id': oid,
                'version': r2.json()['version'],
                'action': 'process',
                'evidence_provided': True
            })
        elif i == 1:
            items.append({
                'order_id': oid,
                'version': v,
                'action': 'process',
                'evidence_provided': True
            })
        else:
            items.append({
                'order_id': oid,
                'version': 999,  # 错误版本
                'action': 'process',
                'evidence_provided': True
            })

    r = requests.post(f'{BASE_URL}/batch/orders/process', json={
        'items': items,
        'comment': '批量办理测试'
    }, headers=headers('supervisor'))
    assert r.status_code == 200
    result = r.json()
    print(f'✅ 批量处理结果: 总{result["total"]}, 成功{result["success_count"]}, 失败{result["failed_count"]}')

    # 验证：1成功，2失败
    assert result['success_count'] >= 1, f'至少1个成功: {result}'
    assert result['failed_count'] >= 1, f'至少1个失败: {result}'

    for res in result['results']:
        status = '✅成功' if res['success'] else f'❌失败({res["error_code"]})'
        print(f'  {res["order_no"]}: {status} {res["error_message"]}')

    print('🎉 批量处理测试通过！')
    return order_ids


def test_return_and_correct():
    """测试退回补正流程"""
    print('\n========== 测试6：退回补正 ==========')

    r = requests.post(f'{BASE_URL}/orders', json={
        'customer_name': '退回测试客户',
        'product_name': '退回产品',
        'inquiry_content': '退回补正测试',
    }, headers=headers('clerk'))
    order = r.json()
    order_id = order['id']

    # 提交到报价确认
    r = requests.post(f'{BASE_URL}/orders/{order_id}/process', json={
        'version': 1, 'action': 'submit'
    }, headers=headers('clerk'))
    order = r.json()

    # 审核主管退回
    r = requests.post(f'{BASE_URL}/orders/{order_id}/process', json={
        'version': order['version'],
        'action': 'return',
        'comment': '客户询盘信息不完整，请补充详细规格参数'
    }, headers=headers('supervisor'))
    assert r.status_code == 200, f'退回失败: {r.text}'
    order = r.json()
    print(f'✅ 退回成功: stage={order["stage"]}, is_exception={order["is_exception"]}')
    assert order['stage'] == 'inquiry'
    assert order['is_exception'] is True
    assert '退回补正' in order['exception_tags']

    # 登记员补正
    r = requests.post(f'{BASE_URL}/orders/{order_id}/process', json={
        'version': order['version'],
        'action': 'correct',
        'comment': '已补充规格参数：尺寸100x200mm，材质不锈钢304',
        'corrective_action': '补充详细规格参数'
    }, headers=headers('clerk'))
    assert r.status_code == 200, f'补正失败: {r.text}'
    order = r.json()
    print(f'✅ 补正成功: is_exception={order["is_exception"]}')

    print('🎉 退回补正测试通过！')
    return order_id


def test_no_evidence():
    """测试缺少证据时的拦截"""
    print('\n========== 测试7：缺证据拦截 ==========')

    r = requests.post(f'{BASE_URL}/orders', json={
        'customer_name': '证据测试客户',
        'product_name': '证据产品',
        'inquiry_content': '测试证据要求',
    }, headers=headers('clerk'))
    order = r.json()
    order_id = order['id']

    r = requests.post(f'{BASE_URL}/orders/{order_id}/process', json={
        'version': 1, 'action': 'submit'
    }, headers=headers('clerk'))
    order = r.json()

    # 补全报价
    r = requests.put(f'{BASE_URL}/orders/{order_id}', json={
        'version': order['version'],
        'quote_content': '完整报价', 'quote_confirmed': True
    }, headers=headers('supervisor'))
    order = r.json()

    # 办理但不上传证据 → 拦截
    r = requests.post(f'{BASE_URL}/orders/{order_id}/process', json={
        'version': order['version'],
        'action': 'process',
        'evidence_provided': False
    }, headers=headers('supervisor'))
    assert r.status_code == 400, '缺证据应拦截'
    print(f'✅ 缺证据拦截成功: {r.json()["detail"]}')

    print('🎉 缺证据测试通过！')
    return order_id


def test_list_and_filters():
    """测试列表查询和筛选"""
    print('\n========== 测试8：列表查询与筛选 ==========')

    r = requests.get(f'{BASE_URL}/orders', headers=headers('clerk'))
    assert r.status_code == 200
    data = r.json()
    print(f'✅ 查询成功: 共{data["total"]}条, stats={json.dumps(data["stats"], ensure_ascii=False)}')
    assert 'total' in data['stats']
    assert 'pending_dispatch' in data['stats']

    # 按状态筛选
    r = requests.get(f'{BASE_URL}/orders', params={'status': 'processing'}, headers=headers('clerk'))
    data = r.json()
    for item in data['items']:
        assert item['status'] == 'processing', f'状态筛选错误: {item["status"]}'
    print(f'✅ 状态筛选正确: 共{data["total"]}条处理中')

    # 按预警筛选
    r = requests.get(f'{BASE_URL}/orders', params={'warning_level': 'overdue'}, headers=headers('clerk'))
    data = r.json()
    now = datetime.now().isoformat()
    for item in data['items']:
        if item['due_time']:
            assert item['due_time'] < now, f'逾期筛选错误: {item["due_time"]}'
    print(f'✅ 逾期筛选正确: 共{data["total"]}条')

    print('🎉 列表查询测试通过！')


def run_all_tests():
    print('=' * 60)
    print('外贸订单系统接口测试')
    print('=' * 60)

    try:
        test_list_and_filters()
        test_normal_flow()
        test_missing_materials()
        test_version_conflict()
        test_permission_denied()
        test_return_and_correct()
        test_no_evidence()
        test_batch_process()

        print('\n' + '=' * 60)
        print('🎉 所有测试通过！')
        print('=' * 60)
    except AssertionError as e:
        print(f'\n❌ 测试失败: {e}')
        import traceback
        traceback.print_exc()
    except requests.ConnectionError:
        print('\n❌ 无法连接后端服务，请先启动: cd backend && . .venv/bin/activate && python manage.py runserver 0.0.0.0:8108')
    except Exception as e:
        print(f'\n❌ 测试出错: {e}')
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    run_all_tests()
