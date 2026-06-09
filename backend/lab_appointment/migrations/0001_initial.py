from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='User',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('username', models.CharField(max_length=50, unique=True)),
                ('name', models.CharField(max_length=50)),
                ('role', models.CharField(choices=[('TA', '实验助教'), ('ADMIN', '实验室管理员'), ('DEAN', '学院负责人')], max_length=20)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={'db_table': 'user'},
        ),
        migrations.CreateModel(
            name='LabAppointment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('order_no', models.CharField(max_length=50, unique=True)),
                ('title', models.CharField(max_length=200)),
                ('experiment_name', models.CharField(max_length=200)),
                ('experiment_room', models.CharField(default='', max_length=100)),
                ('experiment_date', models.DateField(blank=True, null=True)),
                ('student_count', models.IntegerField(default=0)),
                ('course_name', models.CharField(default='', max_length=200)),
                ('teacher_name', models.CharField(default='', max_length=100)),
                ('materials_requested', models.TextField(blank=True, default='')),
                ('safety_confirmed', models.BooleanField(default=False)),
                ('safety_note', models.TextField(blank=True, default='')),
                ('priority', models.CharField(choices=[('LOW', '低'), ('NORMAL', '中'), ('HIGH', '高'), ('URGENT', '紧急')], default='NORMAL', max_length=20)),
                ('status', models.CharField(choices=[('DRAFT', '草稿'), ('PENDING', '待复核'), ('ARCHIVED', '已归档'), ('RETURNED', '退回补正')], default='DRAFT', max_length=20)),
                ('deadline', models.DateTimeField(blank=True, null=True)),
                ('version', models.IntegerField(default=1)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('current_handler', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='handling_orders', to='lab_appointment.user')),
                ('owner', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='owned_orders', to='lab_appointment.user')),
            ],
            options={'db_table': 'lab_appointment', 'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='Attachment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file_name', models.CharField(max_length=200)),
                ('file_type', models.CharField(max_length=50)),
                ('evidence_type', models.CharField(default='', max_length=50)),
                ('description', models.CharField(default='', max_length=200)),
                ('uploaded_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='attachments', to='lab_appointment.labappointment')),
                ('uploaded_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='lab_appointment.user')),
            ],
            options={'db_table': 'attachment'},
        ),
        migrations.CreateModel(
            name='ProcessingRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(max_length=50)),
                ('from_status', models.CharField(choices=[('DRAFT', '草稿'), ('PENDING', '待复核'), ('ARCHIVED', '已归档'), ('RETURNED', '退回补正')], max_length=20)),
                ('to_status', models.CharField(choices=[('DRAFT', '草稿'), ('PENDING', '待复核'), ('ARCHIVED', '已归档'), ('RETURNED', '退回补正')], max_length=20)),
                ('comment', models.TextField(blank=True, default='')),
                ('opinion', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('actor', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='lab_appointment.user')),
                ('order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='records', to='lab_appointment.labappointment')),
            ],
            options={'db_table': 'processing_record'},
        ),
        migrations.CreateModel(
            name='AuditNote',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('content', models.TextField()),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('author', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='lab_appointment.user')),
                ('order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='audit_notes', to='lab_appointment.labappointment')),
            ],
            options={'db_table': 'audit_note'},
        ),
        migrations.CreateModel(
            name='ExceptionReason',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('exception_type', models.CharField(choices=[('MATERIAL', '材料问题'), ('PERMISSION', '权限问题'), ('TIMELIMIT', '时限问题'), ('STATUS', '状态问题')], max_length=20)),
                ('description', models.TextField()),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('resolved', models.BooleanField(default=False)),
                ('order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='exceptions', to='lab_appointment.labappointment')),
                ('reporter', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='lab_appointment.user')),
            ],
            options={'db_table': 'exception_reason'},
        ),
    ]
