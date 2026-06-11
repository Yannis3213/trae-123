import os

from starlette.requests import Request
from starlette.responses import JSONResponse, FileResponse
from starlette.routing import Route

from . import service, validator

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")


def _json_response(data=None, message="success", code=0, total=None, status_code=200):
    body = {"code": code, "message": message, "data": data}
    if total is not None:
        body["total"] = total
    return JSONResponse(body, status_code=status_code)


# ── Users ──

async def list_users(request: Request):
    users = service.get_all_users()
    return _json_response(data=users)


# ── Repair Orders ──

async def list_repair_orders(request: Request):
    status = request.query_params.get("status")
    handler_role = request.query_params.get("handler_role")
    handler_id = request.query_params.get("handler_id")
    created_by = request.query_params.get("created_by")
    keyword = request.query_params.get("keyword")
    deadline_group = request.query_params.get("deadline_group")
    category = request.query_params.get("category")
    enterprise_name = request.query_params.get("enterprise_name")
    page = int(request.query_params.get("page", "1"))
    page_size = int(request.query_params.get("page_size", "20"))
    orders, total = service.list_repair_orders(
        status=status, handler_role=handler_role, handler_id=handler_id,
        created_by=created_by, keyword=keyword, deadline_group=deadline_group,
        category=category, enterprise_name=enterprise_name,
        page=page, page_size=page_size,
    )
    return _json_response(data=orders, total=total)


async def get_repair_order(request: Request):
    order_id = request.path_params["id"]
    try:
        order = service.get_repair_order_detail(order_id)
        return _json_response(data=order)
    except validator.ValidationError as e:
        return _json_response(message=e.message, code=1, status_code=404)


async def create_repair_order(request: Request):
    body = await request.json()
    try:
        submit_now = body.get("submit_now", False)
        if submit_now:
            order = service.create_and_submit_repair_order(body)
        else:
            order = service.create_repair_order(body)
        return _json_response(data=order, status_code=201)
    except validator.ValidationError as e:
        return _json_response(message=e.message, code=1, status_code=400)


async def update_repair_order(request: Request):
    order_id = request.path_params["id"]
    body = await request.json()
    try:
        order = service.update_repair_order(order_id, body)
        return _json_response(data=order)
    except validator.ValidationError as e:
        return _json_response(message=e.message, code=1, status_code=400)


# ── Status Transition Actions ──

async def submit_repair_order(request: Request):
    order_id = request.path_params["id"]
    body = await request.json()
    try:
        order = service.submit_repair_order(order_id, body)
        return _json_response(data=order)
    except validator.ValidationError as e:
        return _json_response(message=e.message, code=1, status_code=400)


async def process_repair_order(request: Request):
    order_id = request.path_params["id"]
    body = await request.json()
    try:
        order = service.process_repair_order(order_id, body)
        return _json_response(data=order)
    except validator.ValidationError as e:
        return _json_response(message=e.message, code=1, status_code=400)


async def verify_repair_order(request: Request):
    order_id = request.path_params["id"]
    body = await request.json()
    try:
        order = service.verify_repair_order(order_id, body)
        return _json_response(data=order)
    except validator.ValidationError as e:
        return _json_response(message=e.message, code=1, status_code=400)


async def review_repair_order(request: Request):
    order_id = request.path_params["id"]
    body = await request.json()
    try:
        order = service.review_repair_order(order_id, body)
        return _json_response(data=order)
    except validator.ValidationError as e:
        return _json_response(message=e.message, code=1, status_code=400)


async def archive_repair_order(request: Request):
    order_id = request.path_params["id"]
    body = await request.json()
    try:
        order = service.archive_repair_order(order_id, body)
        return _json_response(data=order)
    except validator.ValidationError as e:
        return _json_response(message=e.message, code=1, status_code=400)


async def return_repair_order(request: Request):
    order_id = request.path_params["id"]
    body = await request.json()
    try:
        order = service.return_repair_order(order_id, body)
        return _json_response(data=order)
    except validator.ValidationError as e:
        return _json_response(message=e.message, code=1, status_code=400)


async def resubmit_repair_order(request: Request):
    order_id = request.path_params["id"]
    body = await request.json()
    try:
        order = service.resubmit_repair_order(order_id, body)
        return _json_response(data=order)
    except validator.ValidationError as e:
        return _json_response(message=e.message, code=1, status_code=400)


# ── Batch Operations ──

async def batch_advance(request: Request):
    body = await request.json()
    items = body.get("items", [])
    results = service.batch_advance(items)
    return _json_response(data=results)


async def batch_return(request: Request):
    body = await request.json()
    items = body.get("items", [])
    results = service.batch_return(items)
    return _json_response(data=results)


# ── Warnings ──

async def get_warnings(request: Request):
    warnings = service.get_warnings()
    return _json_response(data=warnings)


# ── Ledger ──

async def get_ledger(request: Request):
    status = request.query_params.get("status")
    handler_role = request.query_params.get("handler_role")
    keyword = request.query_params.get("keyword")
    deadline_group = request.query_params.get("deadline_group")
    category = request.query_params.get("category")
    enterprise_name = request.query_params.get("enterprise_name")
    page = int(request.query_params.get("page", "1"))
    page_size = int(request.query_params.get("page_size", "20"))
    orders, total = service.get_ledger(
        status=status, handler_role=handler_role, keyword=keyword,
        deadline_group=deadline_group,
        category=category, enterprise_name=enterprise_name,
        page=page, page_size=page_size,
    )
    return _json_response(data=orders, total=total)


# ── Attachments ──

async def upload_attachment(request: Request):
    form = await request.form()
    repair_id = form.get("repair_id")
    uploaded_by = form.get("uploaded_by")
    file = form.get("file")
    if not file or not repair_id:
        return _json_response(message="缺少必要参数: repair_id 或 file", code=1, status_code=400)
    order_dir = os.path.join(UPLOAD_DIR, repair_id)
    os.makedirs(order_dir, exist_ok=True)
    file_path = os.path.join(order_dir, file.filename)
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    attachment = service.upload_attachment({
        "repair_id": repair_id,
        "file_name": file.filename,
        "file_path": file_path,
        "file_size": len(content),
        "uploaded_by": uploaded_by or "",
    })
    return _json_response(data=attachment, status_code=201)


async def download_attachment(request: Request):
    attachment_id = request.path_params["id"]
    attachment = service.get_attachment_by_id(attachment_id)
    if not attachment:
        return _json_response(message="附件不存在", code=1, status_code=404)
    file_path = attachment["file_path"]
    if not os.path.exists(file_path):
        return _json_response(message="文件不存在", code=1, status_code=404)
    return FileResponse(file_path, filename=attachment["file_name"])


# ── Processing Records ──

async def get_processing_records(request: Request):
    order_id = request.path_params["id"]
    records = service.get_processing_records(order_id)
    return _json_response(data=records)


# ── Exception Reasons ──

async def get_exception_reasons(request: Request):
    order_id = request.path_params["id"]
    reasons = service.get_exception_reasons_for_order(order_id)
    return _json_response(data=reasons)


# ── Routes ──

routes = [
    Route("/api/users", list_users),

    Route("/api/repairs", list_repair_orders),
    Route("/api/repairs", create_repair_order, methods=["POST"]),
    Route("/api/repairs/warnings", get_warnings),
    Route("/api/repairs/batch/advance", batch_advance, methods=["POST"]),
    Route("/api/repairs/batch/return", batch_return, methods=["POST"]),
    Route("/api/repairs/{id}", get_repair_order),
    Route("/api/repairs/{id}", update_repair_order, methods=["PUT"]),
    Route("/api/repairs/{id}/submit", submit_repair_order, methods=["POST"]),
    Route("/api/repairs/{id}/process", process_repair_order, methods=["POST"]),
    Route("/api/repairs/{id}/verify", verify_repair_order, methods=["POST"]),
    Route("/api/repairs/{id}/review", review_repair_order, methods=["POST"]),
    Route("/api/repairs/{id}/archive", archive_repair_order, methods=["POST"]),
    Route("/api/repairs/{id}/return", return_repair_order, methods=["POST"]),
    Route("/api/repairs/{id}/resubmit", resubmit_repair_order, methods=["POST"]),
    Route("/api/repairs/{id}/records", get_processing_records),
    Route("/api/repairs/{id}/exceptions", get_exception_reasons),

    Route("/api/ledger", get_ledger),

    Route("/api/attachments", upload_attachment, methods=["POST"]),
    Route("/api/attachments/{id}", download_attachment),
]
