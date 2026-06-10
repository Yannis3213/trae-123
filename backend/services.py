from datetime import datetime, timedelta
from typing import List, Optional, Tuple, Dict
from sqlalchemy.orm import Session

from models import (
    TransportOrder, User, Attachment, ProcessingRecord,
    AuditNote, ExceptionReason
)
from schemas import (
    TransportOrderCreate, TransportOrderUpdate, OrderActionRequest,
    BatchActionRequest, BatchResultItem, BatchActionResponse,
    AttachmentCreate, TransportOrderListOut, WarningGroup, WarningResponse
)


class OrderService:
    def __init__(self, db: Session):
        self.db = db

    def _get_required_evidence(self, status: str) -> List[str]:
        if status == TransportOrder.STATUS_PENDING_CORRECTION:
            return [Attachment.TYPE_CONSIGNMENT]
        elif status == TransportOrder.STATUS_UNDER_REVIEW:
            return [Attachment.TYPE_DISPATCH]
        elif status == TransportOrder.STATUS_COMPLETED:
            return [Attachment.TYPE_RECEIPT]
        return []

    def _get_role_for_status(self, status: str) -> Optional[str]:
        if status == TransportOrder.STATUS_PENDING_CORRECTION:
            return User.ROLE_CUSTOMER_SERVICE
        elif status == TransportOrder.STATUS_UNDER_REVIEW:
            return User.ROLE_DISPATCH_SUPERVISOR
        elif status == TransportOrder.STATUS_COMPLETED:
            return None
        return None

    def _get_allowed_roles_for_action(self, status: str, action: str) -> List[str]:
        if status == TransportOrder.STATUS_COMPLETED:
            return []
        if status == TransportOrder.STATUS_PENDING_CORRECTION:
            return [User.ROLE_CUSTOMER_SERVICE]
        if status == TransportOrder.STATUS_UNDER_REVIEW:
            if action == "退回补正":
                return [User.ROLE_DISPATCH_SUPERVISOR, User.ROLE_OPERATIONS_MANAGER]
            if action in ["通过", "提交", "办结归档"]:
                return [User.ROLE_DISPATCH_SUPERVISOR, User.ROLE_OPERATIONS_MANAGER]
            if action == "核验":
                return [User.ROLE_DISPATCH_SUPERVISOR, User.ROLE_OPERATIONS_MANAGER]
            return [User.ROLE_DISPATCH_SUPERVISOR]
        return []

    def _can_edit_fields_in_status(self, status: str, role: str) -> bool:
        if status == TransportOrder.STATUS_PENDING_CORRECTION and role == User.ROLE_CUSTOMER_SERVICE:
            return True
        if status == TransportOrder.STATUS_UNDER_REVIEW and role == User.ROLE_DISPATCH_SUPERVISOR:
            return True
        return False

    def _get_handler_by_role(self, role: str) -> str:
        user = self.db.query(User).filter(User.role == role).first()
        if user:
            return user.full_name
        fallback = {
            User.ROLE_CUSTOMER_SERVICE: "张客服",
            User.ROLE_DISPATCH_SUPERVISOR: "李调度",
            User.ROLE_OPERATIONS_MANAGER: "王运营",
        }
        return fallback.get(role, "未知")

    def _get_next_handler(self, current_status: str) -> str:
        if current_status == TransportOrder.STATUS_PENDING_CORRECTION:
            return self._get_handler_by_role(User.ROLE_DISPATCH_SUPERVISOR)
        elif current_status == TransportOrder.STATUS_UNDER_REVIEW:
            return self._get_handler_by_role(User.ROLE_OPERATIONS_MANAGER)
        return "已办结"

    def _get_next_status(self, current_status: str) -> str:
        if current_status == TransportOrder.STATUS_PENDING_CORRECTION:
            return TransportOrder.STATUS_UNDER_REVIEW
        elif current_status == TransportOrder.STATUS_UNDER_REVIEW:
            return TransportOrder.STATUS_COMPLETED
        return current_status

    def _check_overdue(self, order: TransportOrder) -> bool:
        return datetime.utcnow() > order.deadline

    def _add_exception(
        self, order_id: int, category: str, reason: str, reported_by: str
    ) -> ExceptionReason:
        exc = ExceptionReason(
            order_id=order_id,
            category=category,
            reason=reason,
            reported_by=reported_by
        )
        self.db.add(exc)
        return exc

    def _add_processing_record(
        self,
        order_id: int,
        action: str,
        operator: str,
        operator_role: str,
        previous_status: Optional[str],
        new_status: Optional[str],
        remark: Optional[str] = None,
        evidence_summary: Optional[str] = None
    ) -> ProcessingRecord:
        record = ProcessingRecord(
            order_id=order_id,
            action=action,
            operator=operator,
            operator_role=operator_role,
            previous_status=previous_status,
            new_status=new_status,
            remark=remark,
            evidence_summary=evidence_summary
        )
        self.db.add(record)
        return record

    def _add_attachment(
        self, order_id: int, att_data: AttachmentCreate, uploaded_by: str
    ) -> Attachment:
        att = Attachment(
            order_id=order_id,
            file_name=att_data.file_name,
            file_type=att_data.file_type,
            description=att_data.description,
            uploaded_by=uploaded_by
        )
        self.db.add(att)
        return att

    def list_orders(
        self,
        status: Optional[str] = None,
        responsible_person: Optional[str] = None,
        priority: Optional[str] = None,
        deadline_from: Optional[datetime] = None,
        deadline_to: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 20,
        current_user: Optional[User] = None
    ) -> Tuple[List[TransportOrder], int]:
        query = self.db.query(TransportOrder)

        if status:
            query = query.filter(TransportOrder.status == status)
        if responsible_person:
            query = query.filter(TransportOrder.responsible_person == responsible_person)
        if priority:
            query = query.filter(TransportOrder.priority == priority)
        if deadline_from:
            query = query.filter(TransportOrder.deadline >= deadline_from)
        if deadline_to:
            query = query.filter(TransportOrder.deadline <= deadline_to)

        total = query.count()
        items = query.order_by(TransportOrder.updated_at.desc()) \
            .offset((page - 1) * page_size).limit(page_size).all()

        for item in items:
            item.is_overdue = self._check_overdue(item)

        return items, total

    def get_order(self, order_id: int) -> Optional[TransportOrder]:
        order = self.db.query(TransportOrder).filter(TransportOrder.id == order_id).first()
        if order:
            order.is_overdue = self._check_overdue(order)
        return order

    def create_order(
        self, data: TransportOrderCreate, current_user: User
    ) -> TransportOrder:
        order = TransportOrder(
            order_no=data.order_no,
            status=TransportOrder.STATUS_PENDING_CORRECTION,
            priority=data.priority,
            responsible_person=data.responsible_person,
            deadline=data.deadline,
            current_handler="客服专员",
            consignor_name=data.consignor_name,
            consignor_contact=data.consignor_contact,
            consignor_phone=data.consignor_phone,
            consignee_name=data.consignee_name,
            consignee_contact=data.consignee_contact,
            consignee_phone=data.consignee_phone,
            cargo_name=data.cargo_name,
            cargo_weight=data.cargo_weight,
            cargo_volume=data.cargo_volume,
            cargo_quantity=data.cargo_quantity,
            departure=data.departure,
            destination=data.destination,
            transport_requirements=data.transport_requirements,
            vehicle_plate=data.vehicle_plate,
            vehicle_type=data.vehicle_type,
            driver_name=data.driver_name,
            driver_phone=data.driver_phone,
            dispatch_time=data.dispatch_time,
            estimated_arrival=data.estimated_arrival,
            receipt_signer=data.receipt_signer,
            receipt_time=data.receipt_time,
            receipt_status=data.receipt_status,
            receipt_remark=data.receipt_remark,
            version=1
        )
        self.db.add(order)
        self.db.flush()

        self._add_processing_record(
            order_id=order.id,
            action=ProcessingRecord.ACTION_SUBMIT,
            operator=current_user.full_name,
            operator_role=current_user.role,
            previous_status=None,
            new_status=TransportOrder.STATUS_PENDING_CORRECTION,
            remark="创建运输订单",
            evidence_summary="订单初始化"
        )

        self.db.commit()
        self.db.refresh(order)
        return order

    def update_order(
        self, order_id: int, data: TransportOrderUpdate, current_user: User
    ) -> Tuple[Optional[TransportOrder], Optional[str]]:
        order = self.get_order(order_id)
        if not order:
            return None, "订单不存在"

        if not self._can_edit_fields_in_status(order.status, current_user.role):
            self._add_exception(
                order_id=order.id,
                category=ExceptionReason.CATEGORY_PERMISSION,
                reason=f"角色{current_user.role}无权在状态「{order.status}」下修改订单字段",
                reported_by=current_user.full_name
            )
            self.db.commit()
            return None, f"权限问题：当前角色「{current_user.role}」无权修改状态为「{order.status}」的订单字段"

        if order.current_handler != current_user.full_name:
            self._add_exception(
                order_id=order.id,
                category=ExceptionReason.CATEGORY_PERMISSION,
                reason=f"当前处理人应为{order.current_handler}，实际为{current_user.full_name}",
                reported_by=current_user.full_name
            )
            self.db.commit()
            return None, f"权限问题：当前处理人应为「{order.current_handler}」"

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(order, field, value)

        order.version += 1
        order.updated_at = datetime.utcnow()

        self._add_processing_record(
            order_id=order.id,
            action=ProcessingRecord.ACTION_UPDATE,
            operator=current_user.full_name,
            operator_role=current_user.role,
            previous_status=order.status,
            new_status=order.status,
            remark="更新订单信息",
            evidence_summary=f"修改字段: {', '.join(update_data.keys())}"
        )

        self.db.commit()
        self.db.refresh(order)
        return order, None

    def process_order(
        self, order_id: int, data: OrderActionRequest, current_user: User
    ) -> Tuple[Optional[TransportOrder], Optional[str]]:
        order = self.get_order(order_id)
        if not order:
            return None, "订单不存在"

        if data.expected_version is not None and data.expected_version != order.version:
            self._add_exception(
                order_id=order.id,
                category=ExceptionReason.CATEGORY_STATUS,
                reason=f"版本冲突：期望版本{data.expected_version}，当前版本{order.version}",
                reported_by=current_user.full_name
            )
            self.db.commit()
            return None, f"状态问题：版本冲突，当前版本为{order.version}，请刷新后重试"

        allowed_roles = self._get_allowed_roles_for_action(order.status, data.action)
        if current_user.role not in allowed_roles:
            self._add_exception(
                order_id=order.id,
                category=ExceptionReason.CATEGORY_PERMISSION,
                reason=f"角色{current_user.role}无权在状态「{order.status}」下执行「{data.action}」操作",
                reported_by=current_user.full_name
            )
            self.db.commit()
            return None, f"权限问题：当前角色「{current_user.role}」无权在状态「{order.status}」下执行「{data.action}」"

        if order.status != TransportOrder.STATUS_COMPLETED and order.current_handler != current_user.full_name:
            self._add_exception(
                order_id=order.id,
                category=ExceptionReason.CATEGORY_PERMISSION,
                reason=f"当前处理人应为{order.current_handler}，实际操作人{current_user.full_name}",
                reported_by=current_user.full_name
            )
            self.db.commit()
            return None, f"权限问题：当前处理人应为「{order.current_handler}」，请移交后再操作"

        is_overdue = self._check_overdue(order)
        if is_overdue:
            order.is_overdue = True
            order.overdue_reason = f"截止时间{order.deadline.strftime('%Y-%m-%d %H:%M')}已过"
            self._add_exception(
                order_id=order.id,
                category=ExceptionReason.CATEGORY_DEADLINE,
                reason=f"订单已逾期，截止时间为{order.deadline.strftime('%Y-%m-%d %H:%M')}",
                reported_by=current_user.full_name
            )

        if data.action in ["通过", "提交", "办结归档"]:
            required_evidence = self._get_required_evidence(order.status)
            existing_types = set(a.file_type for a in order.attachments)
            submitted_types = set(a.file_type for a in (data.evidence_files or []))
            all_types = existing_types | submitted_types

            missing = [e for e in required_evidence if e not in all_types]
            if missing:
                self._add_exception(
                    order_id=order.id,
                    category=ExceptionReason.CATEGORY_MATERIAL,
                    reason=f"缺少必要证据材料: {', '.join(missing)}",
                    reported_by=current_user.full_name
                )
                self.db.commit()
                return None, f"材料问题：缺少必要证据「{', '.join(missing)}」，请补充后再提交"

        if data.evidence_files:
            for att_data in data.evidence_files:
                self._add_attachment(order.id, att_data, current_user.full_name)

        prev_status = order.status

        if data.action == "退回补正":
            if order.status == TransportOrder.STATUS_COMPLETED:
                return None, "状态问题：已办结订单不可退回"
            order.status = TransportOrder.STATUS_PENDING_CORRECTION
            order.current_handler = self._get_handler_by_role(User.ROLE_CUSTOMER_SERVICE)
            order.version += 1
            self._add_processing_record(
                order_id=order.id,
                action=ProcessingRecord.ACTION_REJECT,
                operator=current_user.full_name,
                operator_role=current_user.role,
                previous_status=prev_status,
                new_status=order.status,
                remark=data.remark or "退回补正",
                evidence_summary="退回至待补正状态"
            )
        elif data.action in ["通过", "提交", "办结归档"]:
            if order.status == TransportOrder.STATUS_COMPLETED:
                self._add_exception(
                    order_id=order.id,
                    category=ExceptionReason.CATEGORY_STATUS,
                    reason="重复提交：订单已办结",
                    reported_by=current_user.full_name
                )
                self.db.commit()
                return None, "状态问题：订单已办结，不可重复提交"

            new_status = self._get_next_status(order.status)
            next_handler = self._get_next_handler(order.status)
            order.status = new_status
            order.current_handler = next_handler
            order.version += 1

            action_map = {
                TransportOrder.STATUS_UNDER_REVIEW: ProcessingRecord.ACTION_REVIEW,
                TransportOrder.STATUS_COMPLETED: ProcessingRecord.ACTION_COMPLETE
            }
            action_name = action_map.get(new_status, ProcessingRecord.ACTION_APPROVE)

            self._add_processing_record(
                order_id=order.id,
                action=action_name,
                operator=current_user.full_name,
                operator_role=current_user.role,
                previous_status=prev_status,
                new_status=new_status,
                remark=data.remark,
                evidence_summary=f"提交证据类型: {', '.join(a.file_type for a in (data.evidence_files or [])) or '无'}"
            )
        elif data.action == "核验":
            self._add_processing_record(
                order_id=order.id,
                action=ProcessingRecord.ACTION_REVIEW,
                operator=current_user.full_name,
                operator_role=current_user.role,
                previous_status=prev_status,
                new_status=prev_status,
                remark=data.remark,
                evidence_summary="核验证据，不改变状态"
            )
        else:
            return None, f"状态问题：不支持的操作类型「{data.action}」"

        order.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(order)
        return order, None

    def batch_process(
        self, data: BatchActionRequest, current_user: User
    ) -> BatchActionResponse:
        results: List[BatchResultItem] = []
        total_success = 0
        total_failed = 0

        for order_id in data.order_ids:
            order = self.get_order(order_id)
            order_no = order.order_no if order else f"ID:{order_id}"

            expected_version = None
            if data.expected_versions:
                expected_version = data.expected_versions.get(str(order_id))

            action_req = OrderActionRequest(
                action=data.action,
                remark=data.remark,
                evidence_files=None,
                expected_version=expected_version
            )

            result_order, error = self.process_order(order_id, action_req, current_user)

            if result_order:
                results.append(BatchResultItem(
                    order_id=order_id,
                    order_no=order_no,
                    success=True,
                    message=f"操作成功，状态变更为「{result_order.status}」"
                ))
                total_success += 1
            else:
                results.append(BatchResultItem(
                    order_id=order_id,
                    order_no=order_no,
                    success=False,
                    message=error or "未知错误"
                ))
                total_failed += 1

        return BatchActionResponse(
            results=results,
            total_success=total_success,
            total_failed=total_failed
        )

    def add_audit_note(
        self, order_id: int, note: str, current_user: User
    ) -> Optional[AuditNote]:
        order = self.get_order(order_id)
        if not order:
            return None
        audit = AuditNote(
            order_id=order_id,
            note=note,
            noted_by=current_user.full_name
        )
        self.db.add(audit)
        self.db.commit()
        self.db.refresh(audit)
        return audit

    def add_exception(
        self, order_id: int, category: str, reason: str, current_user: User
    ) -> Optional[ExceptionReason]:
        order = self.get_order(order_id)
        if not order:
            return None
        exc = self._add_exception(order_id, category, reason, current_user.full_name)
        self.db.commit()
        self.db.refresh(exc)
        return exc

    def get_warnings(self, current_user: Optional[User] = None) -> WarningResponse:
        now = datetime.utcnow()
        approaching_threshold = now + timedelta(days=3)

        all_orders = self.db.query(TransportOrder).all()

        normal_orders = []
        approaching_orders = []
        overdue_orders = []

        for o in all_orders:
            is_overdue = self._check_overdue(o)
            o.is_overdue = is_overdue
            if is_overdue:
                overdue_orders.append(o)
            elif o.deadline <= approaching_threshold:
                approaching_orders.append(o)
            else:
                normal_orders.append(o)

        def to_list_out(orders: List[TransportOrder]) -> List[TransportOrderListOut]:
            return [
                TransportOrderListOut(
                    id=o.id, order_no=o.order_no, status=o.status,
                    priority=o.priority, responsible_person=o.responsible_person,
                    deadline=o.deadline, current_handler=o.current_handler,
                    is_overdue=o.is_overdue, consignor_name=o.consignor_name,
                    consignee_name=o.consignee_name, cargo_name=o.cargo_name,
                    version=o.version
                )
                for o in orders
            ]

        return WarningResponse(
            normal=WarningGroup(
                group="正常",
                orders=to_list_out(normal_orders),
                count=len(normal_orders)
            ),
            approaching=WarningGroup(
                group="临期",
                orders=to_list_out(approaching_orders),
                count=len(approaching_orders)
            ),
            overdue=WarningGroup(
                group="逾期",
                orders=to_list_out(overdue_orders),
                count=len(overdue_orders)
            )
        )
