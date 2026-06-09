from django.contrib import admin
from .models import (
    UserProfile, GlassesOrder, OptometryRecord, LensOrder,
    OrderRegistration, Attachment, ProcessingRecord, AuditNote, ExceptionReason
)


class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'real_name', 'role', 'created_at')
    list_filter = ('role',)


class OptometryRecordInline(admin.StackedInline):
    model = OptometryRecord
    can_delete = False


class LensOrderInline(admin.StackedInline):
    model = LensOrder
    can_delete = False


class OrderRegistrationInline(admin.StackedInline):
    model = OrderRegistration
    can_delete = False


class AttachmentInline(admin.TabularInline):
    model = Attachment
    extra = 0


class ProcessingRecordInline(admin.TabularInline):
    model = ProcessingRecord
    extra = 0
    readonly_fields = ('created_at',)


class AuditNoteInline(admin.TabularInline):
    model = AuditNote
    extra = 0
    readonly_fields = ('created_at',)


class ExceptionReasonInline(admin.TabularInline):
    model = ExceptionReason
    extra = 0
    readonly_fields = ('created_at',)


class GlassesOrderAdmin(admin.ModelAdmin):
    list_display = ('order_no', 'customer_name', 'status', 'business_area', 'current_handler', 'created_at')
    list_filter = ('status', 'business_area')
    search_fields = ('order_no', 'customer_name', 'customer_phone')
    inlines = [
        OptometryRecordInline, LensOrderInline, OrderRegistrationInline,
        AttachmentInline, ProcessingRecordInline, AuditNoteInline, ExceptionReasonInline
    ]


admin.site.register(UserProfile, UserProfileAdmin)
admin.site.register(GlassesOrder, GlassesOrderAdmin)
