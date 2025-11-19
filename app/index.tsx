import { Redirect } from 'expo-router';
import React from 'react';

/**
 * This component is the primary entry point (the "/" route) for your app.
 * Its sole purpose is to redirect the user to the main application screen
 * (the tabs) once the app finishes loading and initial setup is complete.
 */
export default function Index() {
  // 🎯 Redirect to the default screen inside your (tabs) group.
  // The path '/(tabs)/inventory' will resolve to the file app/(tabs)/inventory.tsx
  return <Redirect href="/login" />;
}