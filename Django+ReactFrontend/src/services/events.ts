import axiosInstance from "./axiosInstance";

export type EventReferee = {
  id: number;
  user_id: number;
  name: string;
  grade: string;
};

export type EventItem = {
  id: number;
  start_date: string;
  end_date: string;
  venue: number | null;
  venue_name: string | null;
  created_by: number | null;
  created_by_name: string | null;
  description: string;
  fee_per_game: string | null;
  contact_information: string;
  referees_required: number;
  joined_referees_count: number;
  slots_left: number | null;
  current_user_joined: boolean;
  can_manage: boolean;
  joined_referees: EventReferee[];
};

export type EventVenueOption = {
  id: number;
  name: string;
};

export type EventPayload = {
  start_date: string;
  end_date: string;
  venue: number | null;
  description?: string;
  fee_per_game?: string | null;
  contact_information?: string;
  referees_required: number;
};

export const getUpcomingEvents = async () => {
  const response = await axiosInstance.get<EventItem[]>("/events/?upcoming=true");
  return response.data;
};

export const joinEvent = async (id: number) => {
  const response = await axiosInstance.post<EventItem>(`/events/${id}/join/`);
  return response.data;
};

export const leaveEvent = async (id: number) => {
  const response = await axiosInstance.post<EventItem>(`/events/${id}/leave/`);
  return response.data;
};

export const createEvent = async (payload: EventPayload) => {
  const response = await axiosInstance.post<EventItem>("/events/create/", payload);
  return response.data;
};

export const updateEvent = async (id: number, payload: Partial<EventPayload>) => {
  const response = await axiosInstance.patch<EventItem>(`/events/${id}/update/`, payload);
  return response.data;
};

export const deleteEvent = async (id: number) => {
  await axiosInstance.delete(`/events/${id}/delete/`);
};

export const getEventVenueOptions = async () => {
  const response = await axiosInstance.get<EventVenueOption[]>("/venues/venues/");
  return response.data;
};
