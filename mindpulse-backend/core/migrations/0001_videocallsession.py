from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='VideoCallSession',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('appointment_id', models.CharField(blank=True, max_length=100)),
                ('patient_id', models.CharField(max_length=100)),
                ('doctor_id', models.CharField(max_length=100)),
                ('room_name', models.CharField(max_length=255, unique=True)),
                ('meeting_url', models.URLField(blank=True, max_length=500)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('active', 'Active'), ('ended', 'Ended')], default='pending', max_length=20)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('ended_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'ordering': ('-created_at',)},
        ),
    ]