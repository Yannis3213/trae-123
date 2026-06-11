from django.contrib import admin

from .models import (
    Operator,
    VehicleListingApplication,
    Attachment,
    ProcessingRecord,
    AuditNote,
)


@admin.register(Operator)
class OperatorAdmin(admin.ModelAdmin):
    list_display = ('id', 'username', 'display_name', 'role', 'store_name')
    search_fields = ('username', 'display_name')


@admin.register(VehicleListingApplication)
class VehicleListingApplicationAdmin(admin.ModelAdmin):
    list_display = (
        'application_no', 'brand', 'model_name', 'status',
        'applicant', 'evaluator', 'reviewer', 'store_name', 'created_at',
    )
    list_filter = ('status', 'store_name')
    search_fields = ('application_no', 'vin', 'license_plate')


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'application', 'file_name', 'file_type', 'uploaded_by', 'uploaded_at')


@admin.register(ProcessingRecord)
class ProcessingRecordAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'application', 'operator', 'operator_role',
        'action', 'from_status', 'to_status', 'created_at',
    )


@admin.register(AuditNote)
class AuditNoteAdmin(admin.ModelAdmin):
    list_display = ('id', 'application', 'operator', 'operator_role', 'note', 'created_at')
