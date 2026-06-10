from django.contrib import admin
from .models import (
    UserProfile, MaterialChangeOrder, Attachment, ProcessingRecord,
    AuditRemark, ExceptionRecord, BOMChangeRecord,
    MaterialSubstituteRecord, PilotVerifyRecord
)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['real_name', 'role', 'department', 'user']
    list_filter = ['role']


@admin.register(MaterialChangeOrder)
class MaterialChangeOrderAdmin(admin.ModelAdmin):
    list_display = ['order_no', 'title', 'status', 'change_type', 'urgency', 'warn_status', 'created_at']
    list_filter = ['status', 'change_type', 'urgency', 'warn_status']
    search_fields = ['order_no', 'title', 'old_material_code', 'new_material_code']


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = ['file_name', 'order', 'category', 'created_at']


@admin.register(ProcessingRecord)
class ProcessingRecordAdmin(admin.ModelAdmin):
    list_display = ['order', 'operator', 'action_display', 'created_at']


@admin.register(AuditRemark)
class AuditRemarkAdmin(admin.ModelAdmin):
    list_display = ['order', 'operator', 'remark_type', 'created_at']


@admin.register(ExceptionRecord)
class ExceptionRecordAdmin(admin.ModelAdmin):
    list_display = ['order', 'exception_type', 'exception_code', 'resolved', 'created_at']


@admin.register(BOMChangeRecord)
class BOMChangeRecordAdmin(admin.ModelAdmin):
    list_display = ['order', 'bom_no', 'confirmed_by', 'confirmed_at']


@admin.register(MaterialSubstituteRecord)
class MaterialSubstituteRecordAdmin(admin.ModelAdmin):
    list_display = ['order', 'checked_by', 'checked_at']


@admin.register(PilotVerifyRecord)
class PilotVerifyRecordAdmin(admin.ModelAdmin):
    list_display = ['order', 'verified_by', 'verified_at', 'pass_rate']
