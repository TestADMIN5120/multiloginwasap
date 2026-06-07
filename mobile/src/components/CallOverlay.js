// mobile/src/components/CallOverlay.js
// ---------------------------------------------------------------------------
// Renders the IncomingCallSheet and the active CallScreen as overlays
// that float above the navigation stack. Mounted once at the top of App.js.
// ---------------------------------------------------------------------------

import React from 'react';
import { Modal } from 'react-native';
import IncomingCallSheet from './IncomingCallSheet';
import CallScreen from '../screens/calls/CallScreen';
import { useCall } from '../context/CallContext';

export default function CallOverlay() {
  const { activeCall, incomingCall } = useCall();

  return (
    <>
      {/* Incoming-call sheet renders its own Modal */}
      {incomingCall ? <IncomingCallSheet /> : null}

      {/* Active call: full-screen modal. We never want to dismiss via back gesture,
          only via the explicit hangup button, so onRequestClose is a no-op. */}
      <Modal
        visible={!!activeCall}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {}}
      >
        <CallScreen />
      </Modal>
    </>
  );
}

