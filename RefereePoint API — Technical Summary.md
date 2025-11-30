# **RefereePoint API — Technical Summary**



This API is built with Django REST Framework and handles all referee-related operations for games, cover requests, and events. It mainly works with the Game, CoverRequest, Event, EventParticipation, and RefereeProfile models. Most endpoints use custom @action routes to provide extra logic.



#### 1\. GameViewSet



Handles all game operations — listing, filtering, referee assignment, cancellations, and cover requests.



**List** (GET /games/)



Returns only upcoming games.

Filters available: category, competition, and date.



**Upcoming** (GET /games/upcoming/)



All games from today onwards (does not check time).



**My Upcoming** (GET /games/my\_upcoming/?referee\_id= )



Upcoming games where a specific referee is assigned.



**Past** (GET /games/past/)



All games before today.



**My Past** (GET /games/my\_past/?referee\_id= )



Past games assigned to a referee.



**My Games** (GET /games/my\_games/?referee\_id= )



**All games** (past + future) involving a referee.



**Take Game** (POST /games/<id>/take/)



Assigns a referee to the first free slot (crew chief → umpire1 → umpire2).

Prevents duplicate assignments.



**Cancel Referee** (POST /games/<id>/cancel\_referee/)



Removes a referee from a game only if the competition allows cancellations.



**Request Cover** (POST /games/<id>/request\_cover/)



Creates a pending cover request for an assigned referee.



#### 2\. CoverRequestViewSet



Handles management of cover requests.



**Accept Cover Request** (POST /cover\_requests/<id>/accept/)



Replaces the requesting referee with a new referee in the correct slot.

Updates request status → accepted.



#### 3\. EventViewSet



Manages event signup, conflict checks, waitlists, and participant lists.



**Join Event** (POST /events/<id>/join/)



**Rules enforced:**



* No game conflicts during the event dates.



* No overlapping confirmed events.



* If event is full then referee is added to waitlist.



* Otherwise is confirmed.



**Leave Event** (POST /events/<id>/leave/)



Removes referee from the event.

If they were confirmed → first waitlisted referee is promoted.



**Participants** (GET /events/<id>/participants/)



Returns all confirmed + waitlisted participants.



#### 4\. Quick Endpoint Summary

#### Games



/games/ — upcoming games + filters



/games/upcoming/



/games/my\_upcoming/



/games/past/



/games/my\_past/



/games/my\_games/



/games/<id>/take/



/games/<id>/cancel\_referee/



/games/<id>/request\_cover/



#### Cover Requests



/cover\_requests/<id>/accept/



#### Events



/events/<id>/join/



/events/<id>/leave/



/events/<id>/participants/

