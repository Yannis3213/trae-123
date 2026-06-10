from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.CreateModel(
            name='UserProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(choices=[('registrar', '物料变更登记员'), ('material_officer', '物料员'), ('quality_engineer', '品质工程师'), ('auditor', '物料变更审核主管'), ('production_manager', '生产经理'), ('factory_reviewer', '电子元器件工厂复核负责人')], max_length=32)),
                ('real_name', models.CharField(max_length=64)),
                ('department', models.CharField(blank=True, default='', max_length=64)),
                ('phone', models.CharField(blank=True, default='', max_length=32)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='profile', to='auth.user')),
            ],
            options={
                'db_table': 'user_profile',
            },
        ),
        migrations.CreateModel(
            name='MaterialChangeOrder',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('order_no', models.CharField(db_index=True, max_length=32, unique=True)),
                ('title', models.CharField(max_length=256)),
                ('change_type', models.CharField(choices=[('bom_change', 'BOM变更'), ('material_substitute', '物料替代'), ('pilot_verify', '试产验证')], default='bom_change', max_length=32)),
                ('urgency', models.CharField(choices=[('normal', '正常'), ('urgent', '紧急'), ('critical', '特急')], default='normal', max_length=16)),
                ('status', models.CharField(choices=[('draft', '待提交'), ('returned', '已退回'), ('resubmitted', '重新提交'), ('bom_pending', 'BOM待确认'), ('bom_confirmed', 'BOM已确认'), ('substitute_pending', '替代待核对'), ('substitute_checked', '替代已核对'), ('pilot_pending', '待试产验证'), ('pilot_passed', '试产已通过'), ('audit_pending', '待主管审核'), ('audit_passed', '主管审核通过'), ('pm_review_pending', '待生产经理复核'), ('pm_review_passed', '生产经理复核通过'), ('factory_review_pending', '待工厂复核'), ('archived', '已归档')], default='draft', max_length=32)),
                ('version', models.IntegerField(default=1)),
                ('old_material_code', models.CharField(max_length=128)),
                ('old_material_name', models.CharField(max_length=256)),
                ('old_material_spec', models.CharField(blank=True, default='', max_length=512)),
                ('new_material_code', models.CharField(blank=True, default='', max_length=128)),
                ('new_material_name', models.CharField(blank=True, default='', max_length=256)),
                ('new_material_spec', models.CharField(blank=True, default='', max_length=512)),
                ('bom_reference', models.CharField(blank=True, default='', max_length=256)),
                ('product_model', models.CharField(blank=True, default='', max_length=128)),
                ('change_reason', models.TextField(blank=True, default='')),
                ('change_description', models.TextField(blank=True, default='')),
                ('submit_time', models.DateTimeField(blank=True, null=True)),
                ('deadline', models.DateTimeField(blank=True, null=True)),
                ('last_approve_time', models.DateTimeField(blank=True, null=True)),
                ('bom_evidence_ready', models.BooleanField(default=False)),
                ('substitute_evidence_ready', models.BooleanField(default=False)),
                ('pilot_evidence_ready', models.BooleanField(default=False)),
                ('return_reason', models.TextField(blank=True, default='')),
                ('correction_reason', models.TextField(blank=True, default='')),
                ('warn_status', models.CharField(choices=[('normal', '正常'), ('near_deadline', '临期'), ('overdue', '逾期')], default='normal', max_length=16)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_orders', to='material_change.userprofile')),
                ('current_handler', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='handling_orders', to='material_change.userprofile')),
            ],
            options={
                'db_table': 'material_change_order',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='Attachment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file_name', models.CharField(max_length=256)),
                ('file_url', models.CharField(max_length=512)),
                ('file_type', models.CharField(blank=True, default='', max_length=64)),
                ('file_size', models.IntegerField(default=0)),
                ('category', models.CharField(blank=True, default='', max_length=32)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='attachments', to='material_change.materialchangeorder')),
                ('uploaded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='material_change.userprofile')),
            ],
            options={
                'db_table': 'attachment',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='ProcessingRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(max_length=64)),
                ('action_display', models.CharField(max_length=128)),
                ('from_status', models.CharField(blank=True, default='', max_length=32)),
                ('to_status', models.CharField(blank=True, default='', max_length=32)),
                ('comment', models.TextField(blank=True, default='')),
                ('version', models.IntegerField(default=1)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('operator', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='material_change.userprofile')),
                ('order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='processing_records', to='material_change.materialchangeorder')),
            ],
            options={
                'db_table': 'processing_record',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='AuditRemark',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('content', models.TextField()),
                ('remark_type', models.CharField(default='general', max_length=32)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('operator', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='material_change.userprofile')),
                ('order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='audit_remarks', to='material_change.materialchangeorder')),
            ],
            options={
                'db_table': 'audit_remark',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='ExceptionRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('exception_type', models.CharField(max_length=64)),
                ('exception_code', models.CharField(max_length=32)),
                ('description', models.TextField()),
                ('responsible_role', models.CharField(blank=True, default='', max_length=32)),
                ('resolved', models.BooleanField(default=False)),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='exception_records', to='material_change.materialchangeorder')),
                ('responsible_user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='material_change.userprofile')),
            ],
            options={
                'db_table': 'exception_record',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='BOMChangeRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('bom_no', models.CharField(max_length=128)),
                ('bom_version', models.CharField(blank=True, default='', max_length=32)),
                ('change_items', models.TextField(blank=True, default='')),
                ('evidence_url', models.CharField(blank=True, default='', max_length=512)),
                ('remark', models.TextField(blank=True, default='')),
                ('confirmed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('confirmed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='material_change.userprofile')),
                ('order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='bom_change_records', to='material_change.materialchangeorder')),
            ],
            options={
                'db_table': 'bom_change_record',
            },
        ),
        migrations.CreateModel(
            name='MaterialSubstituteRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('substitute_plan', models.TextField(blank=True, default='')),
                ('substitute_result', models.TextField(blank=True, default='')),
                ('evidence_url', models.CharField(blank=True, default='', max_length=512)),
                ('remark', models.TextField(blank=True, default='')),
                ('checked_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('checked_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='material_change.userprofile')),
                ('order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='substitute_records', to='material_change.materialchangeorder')),
            ],
            options={
                'db_table': 'material_substitute_record',
            },
        ),
        migrations.CreateModel(
            name='PilotVerifyRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('pilot_plan', models.TextField(blank=True, default='')),
                ('pilot_result', models.TextField(blank=True, default='')),
                ('pilot_quantity', models.IntegerField(default=0)),
                ('pass_rate', models.FloatField(default=0.0)),
                ('evidence_url', models.CharField(blank=True, default='', max_length=512)),
                ('remark', models.TextField(blank=True, default='')),
                ('verified_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='pilot_records', to='material_change.materialchangeorder')),
                ('verified_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='material_change.userprofile')),
            ],
            options={
                'db_table': 'pilot_verify_record',
            },
        ),
    ]
