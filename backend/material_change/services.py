from django.utils import timezone
from django.db import transaction, models
from django.contrib.auth.models import User
from .models import (
    UserProfile, MaterialChangeOrder, ProcessingRecord,
    ExceptionRecord, BOMChangeRecord, MaterialSubstituteRecord,
    PilotVerifyRecord, AuditRemark, STATUS_CHOICES
)

STATUS_FLOW = {
    'draft': {
        'next': 'bom_pending',
        'required_roles': ['registrar'],
        'action': 'submit',
        'action_display': '提交',
    },
    'returned': {
        'next': 'resubmitted',
        'required_roles': ['registrar'],
        'action': 'resubmit',
        'action_display': '重新提交',
    },
    'resubmitted': {
        'next': 'bom_pending',
        'required_roles': ['registrar'],
        'action': 'confirm_resubmit',
        'action_display': '确认重新提交',
    },
    'bom_pending': {
        'next': 'bom_confirmed',
        'required_roles': ['material_officer'],
        'action': 'confirm_bom',
        'action_display': '确认BOM变更',
        'evidence_field': 'bom_evidence_ready',
    },
    'bom_confirmed': {
        'next': 'substitute_pending',
        'required_roles': ['material_officer'],
        'action': 'to_substitute',
        'action_display': '进入物料替代核对',
    },
    'substitute_pending': {
        'next': 'substitute_checked',
        'required_roles': ['quality_engineer'],
        'action': 'check_substitute',
        'action_display': '核对物料替代',
        'evidence_field': 'substitute_evidence_ready',
    },
    'substitute_checked': {
        'next': 'pilot_pending',
        'required_roles': ['quality_engineer'],
        'action': 'to_pilot',
        'action_display': '进入试产验证',
    },
    'pilot_pending': {
        'next': 'pilot_passed',
        'required_roles': ['quality_engineer'],
        'action': 'verify_pilot',
        'action_display': '完成试产验证',
        'evidence_field': 'pilot_evidence_ready',
    },
    'pilot_passed': {
        'next': 'audit_pending',
        'required_roles': ['quality_engineer'],
        'action': 'to_audit',
        'action_display': '提交主管审核',
    },
    'audit_pending': {
        'next': 'audit_passed',
        'required_roles': ['auditor'],
        'action': 'audit_pass',
        'action_display': '主管审核通过',
    },
    'audit_passed': {
        'next': 'pm_review_pending',
        'required_roles': ['auditor'],
        'action': 'to_pm_review',
        'action_display': '提交生产经理复核',
    },
    'pm_review_pending': {
        'next': 'pm_review_passed',
        'required_roles': ['production_manager'],
        'action': 'pm_review_pass',
        'action_display': '生产经理复核通过',
    },
    'pm_review_passed': {
        'next': 'factory_review_pending',
        'required_roles': ['production_manager'],
        'action': 'to_factory_review',
        'action_display': '提交工厂复核',
    },
    'factory_review_pending': {
        'next': 'archived',
        'required_roles': ['factory_reviewer'],
        'action': 'factory_review_pass',
        'action_display': '工厂复核归档',
    },
}

RETURNABLE_STATUSES = [
    'bom_pending', 'bom_confirmed', 'substitute_pending', 'substitute_checked',
    'pilot_pending', 'pilot_passed', 'audit_pending', 'audit_passed',
    'pm_review_pending', 'pm_review_passed', 'factory_review_pending'
]

RETURN_ROLES = {
    'bom_pending': ['registrar', 'auditor', 'production_manager', 'factory_reviewer'],
    'bom_confirmed': ['registrar', 'auditor', 'production_manager', 'factory_reviewer'],
    'substitute_pending': ['registrar', 'material_officer', 'auditor', 'production_manager', 'factory_reviewer'],
    'substitute_checked': ['registrar', 'material_officer', 'auditor', 'production_manager', 'factory_reviewer'],
    'pilot_pending': ['registrar', 'material_officer', 'auditor', 'production_manager', 'factory_reviewer'],
    'pilot_passed': ['registrar', 'material_officer', 'auditor', 'production_manager', 'factory_reviewer'],
    'audit_pending': ['registrar', 'production_manager', 'factory_reviewer'],
    'audit_passed': ['registrar', 'production_manager', 'factory_reviewer'],
    'pm_review_pending': ['registrar', 'auditor', 'factory_reviewer'],
    'pm_review_passed': ['registrar', 'auditor', 'factory_reviewer'],
    'factory_review_pending': ['registrar', 'auditor', 'production_manager'],
}


class OrderService:
    @staticmethod
    def get_user_profile(user):
        if not user or not user.is_authenticated:
            return None
        try:
            return user.profile
        except UserProfile.DoesNotExist:
            return None

    @staticmethod
    def can_view_order(profile, order):
        if not profile:
            return False
        role = profile.role
        if role in ['auditor', 'production_manager', 'factory_reviewer']:
            return True
        if role == 'registrar':
            return order.created_by_id == profile.id or order.status in ['draft', 'returned', 'resubmitted']
        if role == 'material_officer':
            return order.status in ['bom_pending', 'bom_confirmed', 'substitute_pending', 'substitute_checked',
                                    'pilot_pending', 'pilot_passed', 'audit_pending']
        if role == 'quality_engineer':
            return order.status in ['substitute_pending', 'substitute_checked', 'pilot_pending', 'pilot_passed',
                                    'audit_pending', 'audit_passed', 'pm_review_pending']
        return False

    @staticmethod
    def can_act_on_order(profile, order, action):
        if not profile:
            return False, '用户未登录或无角色信息'
        status = order.status
        flow = STATUS_FLOW.get(status)
        if action == 'return':
            if status not in RETURNABLE_STATUSES:
                return False, '当前状态不可退回'
            roles = RETURN_ROLES.get(status, [])
            if profile.role not in roles:
                return False, '当前角色无退回权限'
            return True, ''
        if action == 'correct':
            if status not in ['returned', 'draft']:
                return False, '只有退回或草稿状态可补正'
            if profile.role != 'registrar':
                return False, '只有登记员可补正'
            return True, ''
        if not flow:
            return False, '当前状态无可用操作'
        if flow.get('action') != action:
            return False, '操作与当前状态不匹配'
        if profile.role not in flow.get('required_roles', []):
            return False, '当前角色无此操作权限'
        if order.current_handler_id and order.current_handler_id != profile.id:
            return False, '当前处理人不是你，请先认领'
        return True, ''

    @staticmethod
    def validate_evidence(order, action):
        flow = STATUS_FLOW.get(order.status)
        if not flow:
            return True, ''
        evidence_field = flow.get('evidence_field')
        if not evidence_field:
            return True, ''
        if not getattr(order, evidence_field, False):
            action_display = flow.get('action_display', '此操作')
            return False, f'缺少{action_display}所需的证据材料'
        return True, ''

    @staticmethod
    def validate_version(order, expected_version):
        if expected_version is None:
            return True, ''
        if order.version != expected_version:
            return False, f'版本冲突：当前版本为{order.version}，你提交的是版本{expected_version}，请刷新后重试'
        return True, ''

    @staticmethod
    def get_next_handler(profile, next_status):
        next_flow = STATUS_FLOW.get(next_status)
        if not next_flow:
            return None
        required_roles = next_flow.get('required_roles', [])
        if not required_roles:
            return None
        next_profile = UserProfile.objects.filter(role=required_roles[0]).first()
        return next_profile

    @staticmethod
    @transaction.atomic
    def process_action(order_id, profile, action, data=None, expected_version=None):
        data = data or {}
        try:
            order = MaterialChangeOrder.objects.select_for_update().get(id=order_id)
        except MaterialChangeOrder.DoesNotExist:
            return {'success': False, 'message': '物料变更单不存在', 'code': 'NOT_FOUND'}

        version_ok, version_msg = OrderService.validate_version(order, expected_version)
        if not version_ok:
            return {'success': False, 'message': version_msg, 'code': 'VERSION_CONFLICT'}

        can_act, act_msg = OrderService.can_act_on_order(profile, order, action)
        if not can_act:
            return {'success': False, 'message': act_msg, 'code': 'PERMISSION_DENIED'}

        if action == 'return':
            return OrderService._do_return(order, profile, data)
        if action == 'correct':
            return OrderService._do_correct(order, profile, data)

        evidence_ok, evidence_msg = OrderService.validate_evidence(order, action)
        if not evidence_ok:
            OrderService._record_exception(order, 'MISSING_EVIDENCE', '缺材料', evidence_msg, profile)
            return {'success': False, 'message': evidence_msg, 'code': 'MISSING_EVIDENCE'}

        flow = STATUS_FLOW.get(order.status)
        next_status = flow.get('next')
        from_status = order.status
        action_display = flow.get('action_display')

        order.status = next_status
        order.version += 1
        order.updated_at = timezone.now()

        if from_status == 'draft' and next_status == 'bom_pending':
            order.submit_time = timezone.now()
        if from_status == 'returned' and next_status == 'resubmitted':
            order.submit_time = timezone.now()

        next_handler = OrderService.get_next_handler(profile, next_status)
        if next_handler:
            order.current_handler = next_handler

        if next_status == 'archived':
            order.last_approve_time = timezone.now()

        order.save()
        order.update_warn_status()
        order.save(update_fields=['warn_status'])

        ProcessingRecord.objects.create(
            order=order,
            operator=profile,
            action=action,
            action_display=action_display,
            from_status=from_status,
            to_status=next_status,
            comment=data.get('comment', ''),
            version=order.version,
        )

        from_status_display = dict(STATUS_CHOICES).get(from_status, from_status)
        to_status_display = dict(STATUS_CHOICES).get(next_status, next_status)
        OrderService._record_audit(
            order, profile,
            f'{action_display}：从【{from_status_display}】推进到【{to_status_display}】，备注：{data.get("comment", "")}',
            'status_change'
        )

        return {'success': True, 'message': f'{action_display}成功', 'order_id': order.id, 'new_status': next_status}

    @staticmethod
    def _do_return(order, profile, data):
        from_status = order.status
        return_reason = data.get('return_reason', '')
        order.status = 'returned'
        order.return_reason = return_reason
        order.version += 1
        order.current_handler = order.created_by
        order.updated_at = timezone.now()
        order.save()

        ProcessingRecord.objects.create(
            order=order,
            operator=profile,
            action='return',
            action_display='退回',
            from_status=from_status,
            to_status='returned',
            comment=return_reason,
            version=order.version,
        )

        OrderService._record_exception(order, 'RETURNED', '退回补正', f'从{order.get_status_display()}退回，原因：{return_reason}', order.created_by)

        from_status_display = dict(STATUS_CHOICES).get(from_status, from_status)
        OrderService._record_audit(
            order, profile,
            f'退回：从【{from_status_display}】退回到【已退回】，退回原因：{return_reason}，备注：{data.get("comment", "")}',
            'return'
        )

        return {'success': True, 'message': '退回成功', 'order_id': order.id, 'new_status': 'returned'}

    @staticmethod
    def _do_correct(order, profile, data):
        from_status = order.status
        correction_reason = data.get('correction_reason', '')
        order.correction_reason = correction_reason

        title = data.get('title')
        if title:
            order.title = title
        old_material_code = data.get('old_material_code')
        if old_material_code is not None:
            order.old_material_code = old_material_code
        old_material_name = data.get('old_material_name')
        if old_material_name is not None:
            order.old_material_name = old_material_name
        old_material_spec = data.get('old_material_spec')
        if old_material_spec is not None:
            order.old_material_spec = old_material_spec
        new_material_code = data.get('new_material_code')
        if new_material_code is not None:
            order.new_material_code = new_material_code
        new_material_name = data.get('new_material_name')
        if new_material_name is not None:
            order.new_material_name = new_material_name
        new_material_spec = data.get('new_material_spec')
        if new_material_spec is not None:
            order.new_material_spec = new_material_spec
        change_reason = data.get('change_reason')
        if change_reason is not None:
            order.change_reason = change_reason
        change_description = data.get('change_description')
        if change_description is not None:
            order.change_description = change_description

        bom_evidence = data.get('bom_evidence_ready')
        if bom_evidence is not None:
            order.bom_evidence_ready = bom_evidence
        substitute_evidence = data.get('substitute_evidence_ready')
        if substitute_evidence is not None:
            order.substitute_evidence_ready = substitute_evidence
        pilot_evidence = data.get('pilot_evidence_ready')
        if pilot_evidence is not None:
            order.pilot_evidence_ready = pilot_evidence

        deadline = data.get('deadline')
        if deadline:
            order.deadline = deadline

        order.version += 1
        order.updated_at = timezone.now()
        order.save()
        order.update_warn_status()
        order.save(update_fields=['warn_status'])

        ProcessingRecord.objects.create(
            order=order,
            operator=profile,
            action='correct',
            action_display='补正修改',
            from_status=from_status,
            to_status=from_status,
            comment=correction_reason,
            version=order.version,
        )

        from_status_display = dict(STATUS_CHOICES).get(from_status, from_status)
        OrderService._record_audit(
            order, profile,
            f'补正修改：【{from_status_display}】状态下补正，补正原因：{correction_reason}',
            'correction'
        )

        return {'success': True, 'message': '补正成功', 'order_id': order.id}

    @staticmethod
    @transaction.atomic
    def create_order(profile, data):
        if not profile or profile.role != 'registrar':
            return {'success': False, 'message': '只有登记员可以创建物料变更单', 'code': 'PERMISSION_DENIED'}

        import datetime
        now = timezone.now()
        date_str = now.strftime('%Y%m%d')
        count = MaterialChangeOrder.objects.filter(order_no__startswith=f'MCO{date_str}').count()
        order_no = f'MCO{date_str}{count + 1:04d}'

        order = MaterialChangeOrder.objects.create(
            order_no=order_no,
            title=data.get('title', ''),
            change_type=data.get('change_type', 'bom_change'),
            urgency=data.get('urgency', 'normal'),
            old_material_code=data.get('old_material_code', ''),
            old_material_name=data.get('old_material_name', ''),
            old_material_spec=data.get('old_material_spec', ''),
            new_material_code=data.get('new_material_code', ''),
            new_material_name=data.get('new_material_name', ''),
            new_material_spec=data.get('new_material_spec', ''),
            bom_reference=data.get('bom_reference', ''),
            product_model=data.get('product_model', ''),
            change_reason=data.get('change_reason', ''),
            change_description=data.get('change_description', ''),
            deadline=data.get('deadline'),
            created_by=profile,
            current_handler=profile,
        )

        ProcessingRecord.objects.create(
            order=order,
            operator=profile,
            action='create',
            action_display='创建',
            from_status='',
            to_status='draft',
            comment='创建物料变更单',
            version=1,
        )

        OrderService._record_audit(
            order, profile,
            f'创建物料变更单，单号：{order_no}，标题：{order.title}',
            'create'
        )

        return {'success': True, 'message': '创建成功', 'order_id': order.id, 'order_no': order_no}

    @staticmethod
    def _record_exception(order, exception_code, exception_type, description, responsible=None):
        exception = ExceptionRecord.objects.create(
            order=order,
            exception_type=exception_type,
            exception_code=exception_code,
            description=description,
            responsible_user=responsible,
            responsible_role=responsible.role if responsible else '',
        )
        return exception

    @staticmethod
    def _record_audit(order, operator, content, remark_type='general'):
        AuditRemark.objects.create(
            order=order,
            operator=operator,
            content=content,
            remark_type=remark_type,
        )

    @staticmethod
    def update_all_warn_status():
        now = timezone.now()
        orders = MaterialChangeOrder.objects.exclude(status__in=['archived', 'draft', 'returned'])
        updated = 0
        for order in orders:
            old_warn = order.warn_status
            order.update_warn_status()
            if order.warn_status != old_warn:
                order.save(update_fields=['warn_status'])
                updated += 1
                if order.warn_status == 'overdue':
                    responsible = order.current_handler
                    OrderService._record_exception(
                        order, 'OVERDUE', '超时逾期',
                        f'节点超时，当前处理人：{responsible.real_name if responsible else "未指定"}',
                        responsible
                    )
        return updated

    @staticmethod
    def batch_process(order_ids, profile, action, data=None, expected_versions=None):
        data = data or {}
        expected_versions = expected_versions or {}
        results = []
        for i, oid in enumerate(order_ids):
            expected_v = expected_versions.get(oid) if isinstance(expected_versions, dict) else None
            try:
                result = OrderService.process_action(oid, profile, action, data, expected_v)
                results.append({
                    'order_id': oid,
                    'success': result.get('success', False),
                    'message': result.get('message', ''),
                    'code': result.get('code', ''),
                })
            except Exception as e:
                results.append({
                    'order_id': oid,
                    'success': False,
                    'message': str(e),
                    'code': 'SYSTEM_ERROR',
                })
        return results

    @staticmethod
    def list_orders(profile, filters=None):
        filters = filters or {}
        qs = MaterialChangeOrder.objects.all()

        role = profile.role if profile else ''

        if role == 'registrar':
            qs = qs.filter(models.Q(created_by=profile) | models.Q(status__in=['draft', 'returned', 'resubmitted']))
        elif role == 'material_officer':
            qs = qs.filter(status__in=['bom_pending', 'bom_confirmed', 'substitute_pending', 'substitute_checked',
                                       'pilot_pending', 'pilot_passed', 'audit_pending'])
        elif role == 'quality_engineer':
            qs = qs.filter(status__in=['substitute_pending', 'substitute_checked', 'pilot_pending', 'pilot_passed',
                                       'audit_pending', 'audit_passed', 'pm_review_pending'])
        elif role in ['auditor', 'production_manager', 'factory_reviewer']:
            pass
        else:
            qs = qs.none()

        if filters.get('status'):
            qs = qs.filter(status=filters['status'])
        if filters.get('warn_status'):
            qs = qs.filter(warn_status=filters['warn_status'])
        if filters.get('change_type'):
            qs = qs.filter(change_type=filters['change_type'])
        if filters.get('urgency'):
            qs = qs.filter(urgency=filters['urgency'])
        if filters.get('keyword'):
            kw = filters['keyword']
            qs = qs.filter(
                models.Q(order_no__icontains=kw)
                | models.Q(title__icontains=kw)
                | models.Q(old_material_code__icontains=kw)
                | models.Q(new_material_code__icontains=kw)
                | models.Q(old_material_name__icontains=kw)
                | models.Q(new_material_name__icontains=kw)
            )
        if filters.get('mine', False):
            qs = qs.filter(current_handler=profile)

        return qs

    @staticmethod
    def get_statistics(profile):
        orders = OrderService.list_orders(profile)
        total = orders.count()
        status_stats = {}
        for s, _ in STATUS_CHOICES:
            cnt = orders.filter(status=s).count()
            if cnt > 0:
                status_stats[s] = cnt

        warn_normal = orders.filter(warn_status='normal').count()
        warn_near = orders.filter(warn_status='near_deadline').count()
        warn_overdue = orders.filter(warn_status='overdue').count()

        return {
            'total': total,
            'by_status': status_stats,
            'warn_normal': warn_normal,
            'warn_near_deadline': warn_near,
            'warn_overdue': warn_overdue,
        }

    @staticmethod
    def save_evidence(order_id, profile, evidence_type, data):
        try:
            order = MaterialChangeOrder.objects.get(id=order_id)
        except MaterialChangeOrder.DoesNotExist:
            return {'success': False, 'message': '物料变更单不存在', 'code': 'NOT_FOUND'}

        if evidence_type == 'bom':
            if profile.role != 'material_officer':
                return {'success': False, 'message': '只有物料员可操作BOM证据', 'code': 'PERMISSION_DENIED'}
            BOMChangeRecord.objects.create(
                order=order,
                bom_no=data.get('bom_no', ''),
                bom_version=data.get('bom_version', ''),
                change_items=data.get('change_items', ''),
                confirmed_by=profile,
                evidence_url=data.get('evidence_url', ''),
                remark=data.get('remark', ''),
            )
            order.bom_evidence_ready = True
            order.save()
            return {'success': True, 'message': 'BOM证据已保存'}

        elif evidence_type == 'substitute':
            if profile.role != 'quality_engineer':
                return {'success': False, 'message': '只有品质工程师可操作替代证据', 'code': 'PERMISSION_DENIED'}
            MaterialSubstituteRecord.objects.create(
                order=order,
                substitute_plan=data.get('substitute_plan', ''),
                substitute_result=data.get('substitute_result', ''),
                checked_by=profile,
                evidence_url=data.get('evidence_url', ''),
                remark=data.get('remark', ''),
            )
            order.substitute_evidence_ready = True
            order.save()
            return {'success': True, 'message': '物料替代证据已保存'}

        elif evidence_type == 'pilot':
            if profile.role != 'quality_engineer':
                return {'success': False, 'message': '只有品质工程师可操作试产证据', 'code': 'PERMISSION_DENIED'}
            PilotVerifyRecord.objects.create(
                order=order,
                pilot_plan=data.get('pilot_plan', ''),
                pilot_result=data.get('pilot_result', ''),
                pilot_quantity=data.get('pilot_quantity', 0),
                pass_rate=data.get('pass_rate', 0.0),
                verified_by=profile,
                evidence_url=data.get('evidence_url', ''),
                remark=data.get('remark', ''),
            )
            order.pilot_evidence_ready = True
            order.save()
            return {'success': True, 'message': '试产验证证据已保存'}

        return {'success': False, 'message': '未知证据类型', 'code': 'INVALID_TYPE'}
