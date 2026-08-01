export const fetchAbsoluteTime = async (): Promise<Date> => {
  try {
    const response = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC', {
      cache: 'no-store'
    });
    if (response.ok) {
      const data = await response.json();
      return new Date(data.utc_datetime);
    }
  } catch (error) {
    // Fallback if API fails
  }
  return new Date();
};
