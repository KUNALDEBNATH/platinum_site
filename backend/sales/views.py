from django.db.models import Count
from django.http import JsonResponse
from django.contrib.admin.models import LogEntry
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Enquiry, Appointment, Feedback
from .permissions import (
    IsAdmin,
    IsDirector,
    IsManager,
    IsManagerOrDirector,
    IsSalesExecutive,
    get_user_role,
)
from .serializers import (
    AppointmentSerializer,
    EnquirySerializer,
    FeedbackSerializer,
    CustomTokenObtainPairSerializer,
    UserRegistrationSerializer,
)


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


def home(request):
    return JsonResponse({
        "message": "Sales CRM backend is running"
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    role = get_user_role(request.user)
    if not role:
        return Response(
            {"detail": "User role information is missing."},
            status=status.HTTP_403_FORBIDDEN
        )
    return Response({
        "username": request.user.username,
        "role": role,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsDirector])
def get_enquiries(request):
    enquiries = Enquiry.objects.all().order_by('-id')
    serializer = EnquirySerializer(enquiries, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsSalesExecutive])
def create_enquiry(request):
    from .services import reset_chatbot_instance

    data = request.data.copy()
    incoming_id = data.get('id')
    if not incoming_id:
        return Response(
            {"id": ["This field is required."]},
            status=status.HTTP_400_BAD_REQUEST
        )

    data['enquiry_id'] = incoming_id
    serializer = EnquirySerializer(data=data)
    if serializer.is_valid():
        serializer.save()
        reset_chatbot_instance()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsManagerOrDirector])
def get_appointments(request):
    appointments = Appointment.objects.all().order_by('-id')
    serializer = AppointmentSerializer(appointments, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsManager])
def create_appointment(request):
    from .services import reset_chatbot_instance

    data = request.data.copy()
    incoming_id = data.get('id')
    if not incoming_id:
        return Response(
            {"id": ["This field is required."]},
            status=status.HTTP_400_BAD_REQUEST
        )

    data['appointment_id'] = incoming_id
    serializer = AppointmentSerializer(data=data)
    if serializer.is_valid():
        serializer.save()
        reset_chatbot_instance()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsDirector])
def get_feedback(request):
    feedback_records = Feedback.objects.all().order_by('-id')
    serializer = FeedbackSerializer(feedback_records, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsSalesExecutive])
def create_feedback(request):
    from .services import reset_chatbot_instance

    data = request.data.copy()
    incoming_id = data.get('id')
    if not incoming_id:
        return Response(
            {"id": ["This field is required."]},
            status=status.HTTP_400_BAD_REQUEST
        )

    data['feedback_id'] = incoming_id
    serializer = FeedbackSerializer(data=data)
    if serializer.is_valid():
        serializer.save()
        reset_chatbot_instance()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsDirector])
def get_revenue_report(request):
    total_enquiries = Enquiry.objects.count()
    total_appointments = Appointment.objects.count()
    total_feedback = Feedback.objects.count()

    conversion_rate = 0
    if total_enquiries > 0:
        conversion_rate = round((total_appointments / total_enquiries) * 100, 2)

    temp_breakdown = list(
        Enquiry.objects.values('temperature').annotate(count=Count('id')).order_by('-count')
    )
    source_breakdown = list(
        Enquiry.objects.values('source').annotate(count=Count('id')).order_by('-count')
    )

    return Response({
        'total_enquiries': total_enquiries,
        'total_appointments': total_appointments,
        'total_feedback': total_feedback,
        'conversion_rate_percent': conversion_rate,
        'temperature_breakdown': temp_breakdown,
        'source_breakdown': source_breakdown,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def get_audit_logs(request):
    entries = LogEntry.objects.select_related('user').order_by('-action_time')[:100]
    logs = []
    for entry in entries:
        logs.append({
            'timestamp': entry.action_time.strftime('%Y-%m-%d %H:%M:%S'),
            'user': entry.user.username if entry.user else None,
            'action_flag': entry.get_action_flag_display()
            if hasattr(entry, 'get_action_flag_display')
            else entry.action_flag,
            'object': entry.object_repr,
            'change_message': entry.change_message,
        })
    return Response(logs)


@api_view(['POST'])
@permission_classes([AllowAny])
def chat_api(request):
    from .services import process_chat_query

    query = request.data.get('query')

    if not query:
        return Response(
            {"error": "Missing 'query' in request body."},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not isinstance(query, str):
        return Response(
            {"error": "Query must be a string."},
            status=status.HTTP_400_BAD_REQUEST
        )

    query = query.strip()
    if not query:
        return Response(
            {"error": "Query cannot be empty or whitespace only."},
            status=status.HTTP_400_BAD_REQUEST
        )

    max_query_length = 500
    if len(query) > max_query_length:
        return Response(
            {"error": f"Query exceeds maximum length of {max_query_length} characters."},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        response_data = process_chat_query(query)
        if response_data.get("status") != "success":
            return Response(
                {"error": response_data.get("message", "Chatbot processing failed.")},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({
            "answer": response_data["response"],
            "intent": response_data["intent"],
            "elapsed": response_data["latency"]
        }, status=status.HTTP_200_OK)

    except Exception as exc:
        print(f"Chat error: {exc}")
        return Response(
            {"error": "An unexpected error occurred while processing your request."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def health_api(request):
    try:
        from .services import get_chatbot_instance, is_llm_enabled

        instance = get_chatbot_instance()

        try:
            import test as chatbot_test_module
            llm_ready = getattr(chatbot_test_module, "_llm_ready", False)
        except Exception:
            llm_ready = False

        return Response({
            "status": "ok",
            "chatbot_ready": instance is not None,
            "llm_enabled": is_llm_enabled(),
            "llm_ready": llm_ready
        }, status=status.HTTP_200_OK)

    except Exception as exc:
        return Response({
            "status": "error",
            "chatbot_ready": False,
            "message": str(exc)
        }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def suggestions_api(request):
    suggestions = [
        "Show all enquiries",
        "Who gave bad feedback?",
        "All cancelled appointments",
        "Show ENQ001 full details",
        "Returning customers",
        "Customers from Chennai",
        "Who hasn't taken a test ride?",
        "Show me new leads",
        "What's Divya's feedback?",
        "Is Arjun's appointment confirmed?",
        "What car did Sneha enquire about?",
        "Show good feedback customers",
        "All completed appointments",
        "Payment type breakdown",
    ]

    return Response({"suggestions": suggestions}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def reset_chat_api(request):
    try:
        from .services import get_chatbot_instance

        instance = get_chatbot_instance()

        if instance and hasattr(instance, 'history'):
            instance.history.clear()

        return Response({"status": "ok"}, status=status.HTTP_200_OK)

    except Exception as exc:
        return Response(
            {"error": str(exc)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsDirector])
def director_dashboard_api(request):
    return Response({
        "message": "Director access granted",
        "total_enquiries": Enquiry.objects.count(),
        "total_appointments": Appointment.objects.count(),
        "total_feedback": Feedback.objects.count(),
    })


class UserRegistrationView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
