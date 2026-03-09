from django.db import models


class CoverRequest(models.Model):
    """Requests from referees to cover games/events."""
    
    TYPE_CHOICES = [
        ('DOA', 'DOA'),
        ('NL', 'National League'),
        ('CLUB', 'Club'),
        ('SCHOOL', 'School'),
    ]
    
    STATUS_CHOICES = [
        ('PENDING_COVER', 'Pending Cover'),
        ('PENDING_APPROVAL', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('COMPLETED', 'Completed'),
    ]
    
    game = models.ForeignKey(
        'games.Game',
        on_delete=models.CASCADE,
        related_name='cover_requests'
    )
    requested_by = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='cover_requests_made'
    )
    request_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    referee_slot = models.ForeignKey(
        'games.RefereeAssignment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cover_requests',
        help_text='The assignment being replaced'
    )
    replaced_by = models.ForeignKey(
        'users.RefereeProfile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cover_assignments',
        help_text='The referee covering the game'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING_COVER'
    )
    approver = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cover_requests_approved'
    )
    reason = models.TextField(blank=True, default='')
    custom_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'cover_requests_cover_request'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Cover request for {self.game} by {self.requested_by}"
