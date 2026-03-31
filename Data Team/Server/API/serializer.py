from rest_framework import serializers
from . import models as mdls

# Users serializer

class TranscriptSerializer(serializers.ModelSerializer):
    class Meta:
        model = mdls.Transcript
        fields = ["course_name", "credit_unit", "course_GPA"]

class PreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = mdls.Preference
        fields = ["budget", "prefer_climate", "prefer_location"]

class UserSerializer(serializers.ModelSerializer):
    transcript = TranscriptSerializer(required=False, allow_null=True)
    preference = PreferenceSerializer(required=False, allow_null=True)

    class Meta:
        model = mdls.User
        fields = [
            "user_id",
            "overall_GPA",
            "test_score",
            "english_proficiency",
            "personal_statement",
            "transcript",
            "preference",
        ]

    def create(self, validated_data):
        transcript_data = validated_data.pop("transcript", None)
        preference_data = validated_data.pop("preference", None)

        user = mdls.User.objects.create(**validated_data)

        if transcript_data:
            mdls.Transcript.objects.create(user=user, **transcript_data)
        if preference_data:
            mdls.Preference.objects.create(user=user, **preference_data)

        return mdls.User.objects.select_related("transcript", "preference").get(pk=user.pk)

    def update(self, instance, validated_data):
        transcript_data = validated_data.pop("transcript", None)
        preference_data = validated_data.pop("preference", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if transcript_data is not None:
            transcript, _ = mdls.Transcript.objects.get_or_create(user=instance)
            for attr, value in transcript_data.items():
                setattr(transcript, attr, value)
            transcript.save()

        if preference_data is not None:
            preference, _ = mdls.Preference.objects.get_or_create(user=instance)
            for attr, value in preference_data.items():
                setattr(preference, attr, value)
            preference.save()

        return mdls.User.objects.select_related("transcript", "preference").get(pk=instance.pk)

# Schools serializer

class CostOfAttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = mdls.CostOfAttendance
        fields = ["tuition", "living_expenses"]

class SchoolSerializer(serializers.ModelSerializer):
    cost_of_attendance = CostOfAttendanceSerializer(required=False, allow_null=True)

    class Meta:
        model = mdls.School
        fields = [
            "name",
            "school_type",
            "address",
            "city",
            "state",
            "zipcode",
            "school_id",
            "test_scores_required",
            "english_proficiency_required",
            "number_of_students",
            "staff_student_rate",
            "gar",
            "climate",
            "courses_and_classes",
            "deadline_dates",
            "scholarship_info",
            "school_url",
            "cost_of_attendance",
        ]

    def create(self, validated_data):
        cost_data = validated_data.pop("cost_of_attendance", None)
        school = mdls.School.objects.create(**validated_data)

        if cost_data:
            mdls.CostOfAttendance.objects.create(school=school, **cost_data)

        return mdls.School.objects.select_related("cost_of_attendance").get(pk=school.pk)

    def update(self, instance, validated_data):
        cost_data = validated_data.pop("cost_of_attendance", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if cost_data is not None:
            cost_of_attendance, _ = mdls.CostOfAttendance.objects.get_or_create(school=instance)
            for attr, value in cost_data.items():
                setattr(cost_of_attendance, attr, value)
            cost_of_attendance.save()

        return mdls.School.objects.select_related("cost_of_attendance").get(pk=instance.pk)
