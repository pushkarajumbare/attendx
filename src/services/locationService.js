import * as Location from 'expo-location';
import { getDistanceInMeters, detectFakeGps } from '../utils/helpers';

// Cache permission status so we only request once per app session
let _locationPermissionGranted = false;

export async function requestLocationPermission() {
  if (_locationPermissionGranted) return true;
  const { status } = await Location.requestForegroundPermissionsAsync();
  _locationPermissionGranted = status === 'granted';
  return _locationPermissionGranted;
}

export async function getCurrentLocation() {
  const hasPermission = await requestLocationPermission();
  if (!hasPermission) {
    throw new Error('Location permission denied');
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  if (detectFakeGps(location)) {
    throw new Error('Suspicious location detected. Disable mock location apps.');
  }

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    timestamp: location.timestamp,
  };
}

export function validateLocationProximity(studentLocation, teacherLocation, radiusMeters) {
  const distance = getDistanceInMeters(
    studentLocation.latitude,
    studentLocation.longitude,
    teacherLocation.latitude,
    teacherLocation.longitude
  );

  return {
    valid: distance <= radiusMeters,
    distance: Math.round(distance),
    radiusMeters,
  };
}

export async function watchLocation(callback) {
  const hasPermission = await requestLocationPermission();
  if (!hasPermission) return null;

  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 5,
      timeInterval: 5000,
    },
    (location) => {
      if (!detectFakeGps(location)) {
        callback({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
        });
      }
    }
  );
}
