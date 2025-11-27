from rest_framework import viewsets
from ..serializers import EventSerializer
from games.models import Event


# EVENT VIEW SET
class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all().order_by('start_date')
    serializer_class = EventSerializer

    # Optional: auto-assign uploaded_by (no auth now, but ready for later)
    def perform_create(self, serializer):
        serializer.save(uploaded_by=None)
