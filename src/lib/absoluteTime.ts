export const fetchAbsoluteTime = async (): Promise<Date> => {
  try {
    // Primary: timeapi.io (more stable than worldtimeapi)
    const response = await fetch('https://timeapi.io/api/Time/current/zone?timeZone=UTC', {
      cache: 'no-store'
    });
    if (response.ok) {
      const data = await response.json();
      return new Date(data.dateTime);
    }
  } catch (error) {
    // Fallback if API fails
  }
  return new Date();
};
