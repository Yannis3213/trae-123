from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('lab_appointment', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='processingrecord',
            name='audit_note',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='processingrecord',
            name='exception_type',
            field=models.CharField(blank=True, choices=[('MATERIAL', '材料问题'), ('PERMISSION', '权限问题'), ('TIMELIMIT', '时限问题'), ('STATUS', '状态问题')], default='', max_length=20),
        ),
        migrations.AddField(
            model_name='processingrecord',
            name='exception_desc',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='processingrecord',
            name='evidence_count',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='processingrecord',
            name='batch_id',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
    ]
