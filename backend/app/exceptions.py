from __future__ import annotations

from typing import Any, Optional

from litestar.exceptions import HTTPException


class BusinessException(HTTPException):
    error_code: str
    detail_msg: str

    def __init__(
        self,
        detail: str,
        status_code: int = 400,
        error_code: str = "business_error",
        extra: Optional[dict[str, Any]] = None,
    ):
        super().__init__(detail=detail, status_code=status_code, extra=extra or {})
        self.error_code = error_code
        self.detail_msg = detail


class UnauthorizedAdvanceError(BusinessException):
    def __init__(self, detail: str = "越权推进：当前角色无此操作权限"):
        super().__init__(
            detail=detail,
            status_code=403,
            error_code="unauthorized_advance",
        )


class StatusConflictError(BusinessException):
    def __init__(self, detail: str = "状态冲突：当前状态不允许此操作"):
        super().__init__(
            detail=detail,
            status_code=409,
            error_code="status_conflict",
        )


class VersionConflictError(BusinessException):
    def __init__(self, detail: str = "版本冲突：数据已被更新，请刷新后重试"):
        super().__init__(
            detail=detail,
            status_code=409,
            error_code="version_conflict",
        )


class MissingMaterialsError(BusinessException):
    def __init__(self, detail: str = "资料缺失：必填证据不齐全"):
        super().__init__(
            detail=detail,
            status_code=400,
            error_code="missing_materials",
        )


class OverdueError(BusinessException):
    def __init__(self, detail: str = "逾期拦截：单据已逾期，需先处理逾期异常"):
        super().__init__(
            detail=detail,
            status_code=409,
            error_code="overdue",
        )


class NotCurrentHandlerError(BusinessException):
    def __init__(self, detail: str = "非当前处理人：该单据当前不由您处理"):
        super().__init__(
            detail=detail,
            status_code=403,
            error_code="not_current_handler",
        )
