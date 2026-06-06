// SDK 54+ entry point.
// `registerRootComponent` is the Expo equivalent of React Native's
// AppRegistry.registerComponent, but it sets things up correctly for both
// Expo Go and production builds without needing AppEntry.js.
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);

