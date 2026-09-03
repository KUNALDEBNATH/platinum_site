from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Enquiry, Appointment, Feedback
from .permissions import get_user_role

User = get_user_model()


def _role_from_user(user):
    role = get_user_role(user)
    if not role:
        raise serializers.ValidationError("User role information is missing.")
    return role


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = _role_from_user(user)
        token['username'] = user.username
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['role'] = _role_from_user(self.user)
        data['username'] = self.user.username
        return data


class CustomTokenObtainPairSerializer(MyTokenObtainPairSerializer):
    pass


class MyTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        refresh = RefreshToken(attrs['refresh'])
        user_id = refresh.get('user_id') or refresh.get('user')
        if not user_id:
            raise serializers.ValidationError("Refresh token is missing the user identifier.")

        try:
            user = User.objects.select_related('profile').get(pk=user_id)
        except User.DoesNotExist as exc:
            raise serializers.ValidationError("Refresh token user no longer exists.") from exc

        access = refresh.access_token
        access['role'] = _role_from_user(user)
        access['username'] = user.username
        data['access'] = str(access)
        return data


class EnquirySerializer(serializers.ModelSerializer):

    class Meta:
        model = Enquiry
        fields = '__all__'

    def validate_temperature(self, value):
        allowed = ['Hot', 'Warm', 'Cold']
        if value not in allowed:
            raise serializers.ValidationError(
                "Temperature must be Hot, Warm, or Cold."
            )
        return value

    def validate_status(self, value):
        allowed = ['Submitted', 'Draft', 'Closed', 'New Lead']
        if value not in allowed:
            raise serializers.ValidationError(
                "Invalid enquiry status."
            )
        return value


class AppointmentSerializer(serializers.ModelSerializer):

    class Meta:
        model = Appointment
        fields = '__all__'

    def validate_status(self, value):
        allowed = [
            'Scheduled',
            'Pending',
            'Completed'
        ]
        if value not in allowed:
            raise serializers.ValidationError(
                "Invalid appointment status."
            )
        return value


class FeedbackSerializer(serializers.ModelSerializer):

    class Meta:
        model = Feedback
        fields = '__all__'


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'role')


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'password', 'email', 'first_name', 'last_name', 'role')

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            email=validated_data.get('email', ''),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            role=validated_data.get('role', 'sales_executive')
        )
        return user
