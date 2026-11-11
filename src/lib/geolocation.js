import { Geolocation } from '@capacitor/geolocation';

export async function getCurrentLocation() {
  try {
    const permissions = await Geolocation.requestPermissions();
    if (permissions.location === 'denied') {
      console.warn('Location permission denied');
      return null;
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });

    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
  } catch (error) {
    console.warn('Geolocation error:', error);
    return null;
  }
}
