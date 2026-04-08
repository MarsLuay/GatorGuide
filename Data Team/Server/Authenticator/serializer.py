from rest_framework import serializers
from . import models as mdls

# Users token serializer
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = mdls.User
        fields = '__all__'