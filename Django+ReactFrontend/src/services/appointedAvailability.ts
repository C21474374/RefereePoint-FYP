import axiosInstance from "./axiosInstance";

export type AppointedAvailabilityDayCode =
  | "MON"
  | "TUE"
  | "WED"
  | "THU"
  | "FRI"
  | "SAT"
  | "SUN";

export type AppointedAvailabilityDay = {
  day_of_week: AppointedAvailabilityDayCode;
  day_label: string;
  available: boolean;
  start_time: string;
  end_time: string;
  window_start: string;
  window_end: string;
};

export type AppointedAvailabilityResponse = {
  current: AppointedAvailabilityDay[];
  pending: AppointedAvailabilityDay[] | null;
  pending_effective_from: string | null;
  next_effective_month_start: string;
  detail?: string;
};

export const getAppointedAvailability = async () => {
  const response = await axiosInstance.get<AppointedAvailabilityResponse>(
    "/users/me/appointed-availability/"
  );
  return response.data;
};

export const updateAppointedAvailability = async (
  availabilities: AppointedAvailabilityDay[],
  options?: {
    applyNow?: boolean;
  }
) => {
  const response = await axiosInstance.put<AppointedAvailabilityResponse>(
    "/users/me/appointed-availability/",
    {
      availabilities: availabilities.map((item) => ({
        day_of_week: item.day_of_week,
        available: item.available,
        start_time: item.start_time,
        end_time: item.end_time,
      })),
      apply_now: Boolean(options?.applyNow),
    }
  );
  return response.data;
};
