import os
from datetime import timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.utils import timezone
from glasses_order.models import (
    UserProfile, GlassesOrder, OptometryRecord, LensOrder,
    OrderRegistration, Attachment, ProcessingRecord, AuditNote, ExceptionReason
)


def run():
    print('开始初始化 seed 数据...')

    User.objects.filter(username__in=['opt1', 'opt2', 'oph1', 'oph2', 'ops1', 'ops2']).delete()
    UserProfile.objects.all().delete()
    GlassesOrder.objects.all().delete()

    opt1 = User.objects.create_user(username='opt1', password='123456')
    UserProfile.objects.create(user=opt1, role=UserProfile.ROLE_OPTOMETRIST, real_name='验光师-王验光')
    opt2 = User.objects.create_user(username='opt2', password='123456')
    UserProfile.objects.create(user=opt2, role=UserProfile.ROLE_OPTOMETRIST, real_name='验光师-李验光')

    oph1 = User.objects.create_user(username='oph1', password='123456')
    UserProfile.objects.create(user=oph1, role=UserProfile.ROLE_OPHTHALMOLOGIST, real_name='眼科医生-张眼科')
    oph2 = User.objects.create_user(username='oph2', password='123456')
    UserProfile.objects.create(user=oph2, role=UserProfile.ROLE_OPHTHALMOLOGIST, real_name='眼科医生-刘眼科')

    ops1 = User.objects.create_user(username='ops1', password='123456')
    UserProfile.objects.create(user=ops1, role=UserProfile.ROLE_OPERATIONS_MANAGER, real_name='运营主管-陈运营')
    ops2 = User.objects.create_user(username='ops2', password='123456')
    UserProfile.objects.create(user=ops2, role=UserProfile.ROLE_OPERATIONS_MANAGER, real_name='运营主管-赵运营')

    print('用户创建完成')

    business_areas = ['东城区业务区', '西城区业务区', '南城区业务区']

    now = timezone.now()

    order1 = GlassesOrder.objects.create(
        order_no='G202606010001',
        customer_name='赵小明',
        customer_phone='13800138001',
        business_area=business_areas[0],
        status=GlassesOrder.STATUS_PENDING_REVIEW,
        version=1,
        submitted_by=opt1,
        current_handler=oph1,
        submitted_at=now - timedelta(days=1),
        review_due_at=now + timedelta(days=2),
    )
    OptometryRecord.objects.create(
        order=order1, optometrist=opt1,
        left_sphere=-3.00, left_cylinder=-0.50, left_axis=180, left_visual_acuity='0.8',
        right_sphere=-2.75, right_cylinder=0, right_axis=0, right_visual_acuity='0.8',
        pd=62.0, exam_notes='双眼近视，配镜舒适',
        is_complete=True
    )
    LensOrder.objects.create(
        order=order1,
        left_lens_type='单光树脂片', left_lens_brand='依视路', left_lens_price=380.00,
        right_lens_type='单光树脂片', right_lens_brand='依视路', right_lens_price=380.00,
        frame_brand='雷朋', frame_model='RB5154', frame_price=580.00,
        total_price=1340.00, supplier='华东光学', is_complete=True
    )
    OrderRegistration.objects.create(
        order=order1,
        sales_person='业务-周业务',
        registered_at=now - timedelta(days=1),
        payment_method='现金', deposit_amount=500,
        delivery_method='门店自取',
        expected_delivery=(now + timedelta(days=7)).date(),
        notes='客户比较急，尽量提前',
        is_complete=True
    )
    ProcessingRecord.objects.create(
        order=order1, action=ProcessingRecord.ACTION_SUBMIT,
        operator=opt1, from_status='', to_status=GlassesOrder.STATUS_PENDING_REVIEW,
        opinion='验光师提交订单，材料齐全', version=1
    )
    Attachment.objects.create(
        order=order1, category=Attachment.CATEGORY_OPTOMETRY,
        file_name='验光处方单_赵小明.pdf', file_path='/fake/path/1.pdf', file_size=102400,
        uploaded_by=opt1, description='电脑验光单扫描件', is_required=True
    )
    Attachment.objects.create(
        order=order1, category=Attachment.CATEGORY_LENS,
        file_name='镜片订购确认单.pdf', file_path='/fake/path/2.pdf', file_size=51200,
        uploaded_by=opt1, description='镜片品牌确认', is_required=True
    )
    Attachment.objects.create(
        order=order1, category=Attachment.CATEGORY_REGISTRATION,
        file_name='订单登记单.pdf', file_path='/fake/path/3.pdf', file_size=204800,
        uploaded_by=opt1, description='订单登记表', is_required=True
    )
    print(f'订单1创建: 待审核 - 正常材料齐全')

    order2 = GlassesOrder.objects.create(
        order_no='G202606010002',
        customer_name='钱小红',
        customer_phone='13800138002',
        business_area=business_areas[1],
        status=GlassesOrder.STATUS_PENDING_REVIEW,
        version=2,
        submitted_by=opt2,
        current_handler=oph1,
        submitted_at=now - timedelta(days=3),
        review_due_at=now - timedelta(hours=6),
        has_defect=True,
        defect_description='验光档案信息不完整'
    )
    OptometryRecord.objects.create(
        order=order2, optometrist=opt2,
        left_sphere=None, left_cylinder=-0.50, left_axis=90, left_visual_acuity='0.6',
        right_sphere=-4.00, right_cylinder=-0.75, right_axis=95, right_visual_acuity='0.7',
        pd=None, exam_notes='左眼度数未填写完全',
        is_complete=False
    )
    LensOrder.objects.create(
        order=order2,
        left_lens_type='抗蓝光镜片', left_lens_brand='蔡司', left_lens_price=680.00,
        right_lens_type='抗蓝光镜片', right_lens_brand='蔡司', right_lens_price=680.00,
        frame_brand='暴龙', frame_model='BL3000', frame_price=480.00,
        total_price=1840.00, supplier='华东光学',
        is_complete=True
    )
    OrderRegistration.objects.create(
        order=order2,
        sales_person='孙业务',
        registered_at=now - timedelta(days=3),
        payment_method='微信', deposit_amount=800,
        delivery_method='快递到付',
        expected_delivery=(now + timedelta(days=10)).date(),
        notes='客户需要抗蓝光',
        is_complete=True
    )
    ProcessingRecord.objects.create(
        order=order2, action=ProcessingRecord.ACTION_SUBMIT,
        operator=opt2, from_status='', to_status=GlassesOrder.STATUS_PENDING_REVIEW,
        opinion='提交，部分材料缺失', version=1
    )
    ExceptionReason.objects.create(
        order=order2, exception_type=ExceptionReason.TYPE_MISSING_OPTOMETRY,
        description='验光档案信息不完整', detected_by=opt2
    )
    Attachment.objects.create(
        order=order2, category=Attachment.CATEGORY_LENS,
        file_name='镜片确认单_钱小红.pdf', file_path='/fake/path/4.pdf', file_size=51200,
        uploaded_by=opt2, description='镜片订购确认'
    )
    print(f'订单2创建: 待审核 - 临期 - 验光缺项')

    order3 = GlassesOrder.objects.create(
        order_no='G202606010003',
        customer_name='孙大伟',
        customer_phone='13800138003',
        business_area=business_areas[0],
        status=GlassesOrder.STATUS_PENDING_REVIEW,
        version=1,
        submitted_by=opt1,
        current_handler=oph2,
        submitted_at=now - timedelta(days=5),
        review_due_at=now - timedelta(days=2),
    )
    OptometryRecord.objects.create(
        order=order3, optometrist=opt1,
        left_sphere=-5.00, left_cylinder=-1.00, left_axis=75, left_visual_acuity='0.5',
        right_sphere=-5.50, right_cylinder=-1.25, right_axis=80, right_visual_acuity='0.5',
        pd=64.0, exam_notes='高度近视，需要定制',
        is_complete=True
    )
    LensOrder.objects.create(
        order=order3,
        left_lens_type='定制高折射率', left_lens_brand='豪雅', left_lens_price=1280.00,
        right_lens_type='定制高折射率', right_lens_brand='豪雅', right_lens_price=1280.00,
        frame_brand='精工', frame_model='SEIKO-T100', frame_price=880.00,
        total_price=3440.00, supplier='精工光学',
        is_complete=True
    )
    OrderRegistration.objects.create(
        order=order3,
        sales_person='周业务',
        registered_at=now - timedelta(days=5),
        payment_method='银行卡', deposit_amount=1500,
        delivery_method='门店自取',
        expected_delivery=(now + timedelta(days=14)).date(),
        notes='',
        is_complete=True
    )
    ProcessingRecord.objects.create(
        order=order3, action=ProcessingRecord.ACTION_SUBMIT,
        operator=opt1, from_status='', to_status=GlassesOrder.STATUS_PENDING_REVIEW,
        opinion='提交，等待审核', version=1
    )
    Attachment.objects.create(
        order=order3, category=Attachment.CATEGORY_OPTOMETRY,
        file_name='验光单_孙大伟.pdf', file_path='/fake/path/5.pdf', file_size=102400,
        uploaded_by=opt1
    )
    Attachment.objects.create(
        order=order3, category=Attachment.CATEGORY_LENS,
        file_name='镜片订单_孙大伟.pdf', file_path='/fake/path/6.pdf', file_size=51200,
        uploaded_by=opt1
    )
    print(f'订单3创建: 待审核 - 逾期')

    order4 = GlassesOrder.objects.create(
        order_no='G202606010004',
        customer_name='李小美',
        customer_phone='13800138004',
        business_area=business_areas[2],
        status=GlassesOrder.STATUS_RETURNED_FOR_CORRECTION,
        version=2,
        submitted_by=opt2,
        current_handler=opt2,
        submitted_at=now - timedelta(days=4),
        review_due_at=now - timedelta(days=1),
        reviewed_by=oph1,
        reviewed_at=now - timedelta(days=1),
        last_opinion='镜片订购单缺失，请补充镜片品牌确认单',
        last_operator=oph1,
        has_defect=True,
        defect_description='镜片订购信息不完整'
    )
    OptometryRecord.objects.create(
        order=order4, optometrist=opt2,
        left_sphere=-2.00, left_cylinder=0, left_axis=0, left_visual_acuity='1.0',
        right_sphere=-1.75, right_cylinder=0, right_axis=0, right_visual_acuity='1.0',
        pd=63.0, exam_notes='轻度近视',
        is_complete=True
    )
    LensOrder.objects.create(
        order=order4,
        left_lens_type='', left_lens_brand='', left_lens_price=None,
        right_lens_type='', right_lens_brand='', right_lens_price=None,
        frame_brand='', frame_model='', frame_price=None,
        total_price=None, supplier='',
        is_complete=False
    )
    OrderRegistration.objects.create(
        order=order4,
        sales_person='郑业务',
        registered_at=now - timedelta(days=4),
        payment_method='微信', deposit_amount=200,
        delivery_method='快递到付',
        expected_delivery=(now + timedelta(days=5)).date(),
        notes='',
        is_complete=True
    )
    ProcessingRecord.objects.create(
        order=order4, action=ProcessingRecord.ACTION_SUBMIT,
        operator=opt2, from_status='', to_status=GlassesOrder.STATUS_PENDING_REVIEW,
        opinion='提交订单', version=1
    )
    ProcessingRecord.objects.create(
        order=order4, action=ProcessingRecord.ACTION_RETURN,
        operator=oph1, from_status=GlassesOrder.STATUS_PENDING_REVIEW,
        to_status=GlassesOrder.STATUS_RETURNED_FOR_CORRECTION,
        opinion='镜片订购单缺失，请补充镜片品牌确认单', version=2
    )
    ExceptionReason.objects.create(
        order=order4, exception_type=ExceptionReason.TYPE_MISSING_LENS,
        description='镜片订购信息不完整', detected_by=oph1
    )
    AuditNote.objects.create(
        order=order4, operator=oph1, note_type='general',
        content='眼科医生退回补正：镜片订购单缺失'
    )
    print(f'订单4创建: 退回补正')

    order5 = GlassesOrder.objects.create(
        order_no='G202606010005',
        customer_name='周建国',
        customer_phone='13800138005',
        business_area=business_areas[1],
        status=GlassesOrder.STATUS_REVIEW_APPROVED,
        version=2,
        submitted_by=opt1,
        current_handler=ops1,
        submitted_at=now - timedelta(days=6),
        review_due_at=now - timedelta(days=4),
        reviewed_by=oph2,
        reviewed_at=now - timedelta(days=4),
        sync_due_at=now - timedelta(days=1),
        last_opinion='审核通过，材料齐全',
        last_operator=oph2
    )
    OptometryRecord.objects.create(
        order=order5, optometrist=opt1,
        left_sphere=-3.50, left_cylinder=-0.75, left_axis=100, left_visual_acuity='0.8',
        right_sphere=-3.25, right_cylinder=-0.50, right_axis=105, right_visual_acuity='0.8',
        pd=62.5, exam_notes='常规配镜',
        is_complete=True
    )
    LensOrder.objects.create(
        order=order5,
        left_lens_type='渐进多焦点', left_lens_brand='依视路', left_lens_price=980.00,
        right_lens_type='渐进多焦点', right_lens_brand='依视路', right_lens_price=980.00,
        frame_brand='夏蒙', frame_model='CH1001', frame_price=1280.00,
        total_price=3240.00, supplier='依视路代理',
        is_complete=True
    )
    OrderRegistration.objects.create(
        order=order5,
        sales_person='孙业务',
        registered_at=now - timedelta(days=6),
        payment_method='银行卡', deposit_amount=1000,
        delivery_method='快递包邮',
        expected_delivery=(now + timedelta(days=3)).date(),
        notes='老客户，VIP待遇',
        is_complete=True
    )
    ProcessingRecord.objects.create(
        order=order5, action=ProcessingRecord.ACTION_SUBMIT,
        operator=opt1, from_status='', to_status=GlassesOrder.STATUS_PENDING_REVIEW,
        opinion='提交', version=1
    )
    ProcessingRecord.objects.create(
        order=order5, action=ProcessingRecord.ACTION_APPROVE,
        operator=oph2, from_status=GlassesOrder.STATUS_PENDING_REVIEW,
        to_status=GlassesOrder.STATUS_REVIEW_APPROVED,
        opinion='审核通过，材料齐全', version=2
    )
    for c in [Attachment.CATEGORY_OPTOMETRY, Attachment.CATEGORY_LENS, Attachment.CATEGORY_REGISTRATION]:
        Attachment.objects.create(
            order=order5, category=c,
            file_name=f'{c}_周建国.pdf', file_path=f'/fake/path/{c}_5.pdf', file_size=50000,
            uploaded_by=opt1, is_required=True
        )
    print(f'订单5创建: 审核通过 - 临期')

    order6 = GlassesOrder.objects.create(
        order_no='G202606010006',
        customer_name='吴秀兰',
        customer_phone='13800138006',
        business_area=business_areas[0],
        status=GlassesOrder.STATUS_REVIEW_APPROVED,
        version=2,
        submitted_by=opt2,
        current_handler=ops2,
        submitted_at=now - timedelta(days=10),
        review_due_at=now - timedelta(days=8),
        reviewed_by=oph1,
        reviewed_at=now - timedelta(days=7),
        sync_due_at=now - timedelta(days=5),
        last_opinion='审核通过',
        last_operator=oph1
    )
    OptometryRecord.objects.create(
        order=order6, optometrist=opt2,
        left_sphere=+2.00, left_cylinder=0, left_axis=0, left_visual_acuity='0.8',
        right_sphere=+2.25, right_cylinder=0, right_axis=0, right_visual_acuity='0.8',
        pd=61.0, exam_notes='老花镜',
        is_complete=True
    )
    LensOrder.objects.create(
        order=order6,
        left_lens_type='老花镜片', left_lens_brand='明月', left_lens_price=180.00,
        right_lens_type='老花镜片', right_lens_brand='明月', right_lens_price=180.00,
        frame_brand='夕阳红', frame_model='XN-888', frame_price=120.00,
        total_price=480.00, supplier='明月镜片',
        is_complete=True
    )
    OrderRegistration.objects.create(
        order=order6,
        sales_person='周业务',
        registered_at=now - timedelta(days=10),
        payment_method='现金', deposit_amount=480,
        delivery_method='门店自取',
        expected_delivery=(now - timedelta(days=2)).date(),
        notes='',
        is_complete=True
    )
    ProcessingRecord.objects.create(
        order=order6, action=ProcessingRecord.ACTION_SUBMIT,
        operator=opt2, from_status='', to_status=GlassesOrder.STATUS_PENDING_REVIEW,
        opinion='提交', version=1
    )
    ProcessingRecord.objects.create(
        order=order6, action=ProcessingRecord.ACTION_APPROVE,
        operator=oph1, from_status=GlassesOrder.STATUS_PENDING_REVIEW,
        to_status=GlassesOrder.STATUS_REVIEW_APPROVED,
        opinion='审核通过', version=2
    )
    for c in [Attachment.CATEGORY_OPTOMETRY, Attachment.CATEGORY_LENS, Attachment.CATEGORY_REGISTRATION]:
        Attachment.objects.create(
            order=order6, category=c,
            file_name=f'{c}_吴秀兰.pdf', file_path=f'/fake/path/{c}_6.pdf', file_size=40000,
            uploaded_by=opt2, is_required=True
        )
    print(f'订单6创建: 审核通过 - 逾期未同步')

    order7 = GlassesOrder.objects.create(
        order_no='G202606010007',
        customer_name='郑丽娟',
        customer_phone='13800138007',
        business_area=business_areas[2],
        status=GlassesOrder.STATUS_SYNCED,
        version=3,
        submitted_by=opt1,
        submitted_at=now - timedelta(days=15),
        reviewed_by=oph1,
        reviewed_at=now - timedelta(days=13),
        synced_by=ops1,
        synced_at=now - timedelta(days=10),
        last_opinion='已同步到总部',
        last_operator=ops1
    )
    OptometryRecord.objects.create(
        order=order7, optometrist=opt1,
        left_sphere=-6.00, left_cylinder=-1.50, left_axis=60, left_visual_acuity='0.6',
        right_sphere=-5.75, right_cylinder=-1.25, right_axis=65, right_visual_acuity='0.7',
        pd=65.0, exam_notes='高度近视散光',
        is_complete=True
    )
    LensOrder.objects.create(
        order=order7,
        left_lens_type='超薄非球面', left_lens_brand='蔡司', left_lens_price=1580.00,
        right_lens_type='超薄非球面', right_lens_brand='蔡司', right_lens_price=1580.00,
        frame_brand='LINDBERG', frame_model='AIR-T12', frame_price=3580.00,
        total_price=6740.00, supplier='蔡司授权店',
        is_complete=True
    )
    OrderRegistration.objects.create(
        order=order7,
        sales_person='郑业务',
        registered_at=now - timedelta(days=15),
        payment_method='银行卡', deposit_amount=3000,
        delivery_method='门店自取',
        expected_delivery=(now - timedelta(days=8)).date(),
        notes='高端客户',
        is_complete=True
    )
    ProcessingRecord.objects.create(
        order=order7, action=ProcessingRecord.ACTION_SUBMIT,
        operator=opt1, from_status='', to_status=GlassesOrder.STATUS_PENDING_REVIEW,
        opinion='提交高端订单', version=1
    )
    ProcessingRecord.objects.create(
        order=order7, action=ProcessingRecord.ACTION_APPROVE,
        operator=oph1, from_status=GlassesOrder.STATUS_PENDING_REVIEW,
        to_status=GlassesOrder.STATUS_REVIEW_APPROVED,
        opinion='审核通过', version=2
    )
    ProcessingRecord.objects.create(
        order=order7, action=ProcessingRecord.ACTION_SYNC,
        operator=ops1, from_status=GlassesOrder.STATUS_REVIEW_APPROVED,
        to_status=GlassesOrder.STATUS_SYNCED,
        opinion='已同步到总部ERP系统', version=3
    )
    for c in [Attachment.CATEGORY_OPTOMETRY, Attachment.CATEGORY_LENS, Attachment.CATEGORY_REGISTRATION]:
        Attachment.objects.create(
            order=order7, category=c,
            file_name=f'{c}_郑丽娟.pdf', file_path=f'/fake/path/{c}_7.pdf', file_size=80000,
            uploaded_by=opt1, is_required=True
        )
    print(f'订单7创建: 已同步 - 完成')

    print('Seed 数据初始化完成！')
    print('账号列表：')
    print('  验光师: opt1 / 123456 (王验光)')
    print('  验光师: opt2 / 123456 (李验光)')
    print('  眼科医生: oph1 / 123456 (张眼科)')
    print('  眼科医生: oph2 / 123456 (刘眼科)')
    print('  运营主管: ops1 / 123456 (陈运营)')
    print('  运营主管: ops2 / 123456 (赵运营)')


if __name__ == '__main__':
    run()
