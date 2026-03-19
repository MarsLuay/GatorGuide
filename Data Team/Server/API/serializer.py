from rest_framework import serializers
from . import models as mdls

# Users serializer

class TranscriptSerializer(serializers.ModelSerializer):
    class Meta:
        model = mdls.Transcript
        fields = ['course_name', 'credit_unit', 'course_GPA']

class PreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = mdls.Preference
        fields = ['budget', 'prefer_climate', 'prefer_location']

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = mdls.User
        fields = '__all__'
    # Manually add the field back using the 'related_name' we set in models.py
    transcript = TranscriptSerializer(read_only=True)
    preference = PreferenceSerializer(read_only=True)

# Schools serializer

# Create this new serializer so we can nest it
class CostOfAttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = mdls.CostOfAttendance
        fields = ['school', 'tuition', 'living_expenses']

class SchoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = mdls.School
        fields = '__all__'
    # Manually add the field back using the 'related_name' we set in models.py
    cost_of_attendance = CostOfAttendanceSerializer(read_only=True)