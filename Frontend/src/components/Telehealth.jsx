import { useEffect, useRef } from 'react';
import { TwilioVideo } from 'twilio-video';
import { useTranslation } from 'react-i18next';

function Telehealth({ patientId, token, onClose }) {
  const { t } = useTranslation();
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();

  useEffect(() => {
    const setupTelehealth = async () => {
      try {
        const room = await TwilioVideo.connect(token, { room: `patient-${patientId}` });
        room.localParticipant.videoTracks.forEach(track => {
          localVideoRef.current.srcObject = track.mediaStream;
        });
        room.participants.forEach(participant => {
          participant.videoTracks.forEach(track => {
            remoteVideoRef.current.srcObject = track.mediaStream;
          });
        });
        room.on('disconnected', () => {
          localVideoRef.current.srcObject = null;
          remoteVideoRef.current.srcObject = null;
        });
      } catch (error) {
        console.error('Telehealth error:', error);
      }
    };
    setupTelehealth();

    return () => {
      TwilioVideo.disconnect(); // Clean up on unmount
    };
  }, [patientId, token]);

  return (
    <div className="telehealth-container bg-gray-800 p-6 rounded-lg shadow-2xl">
      <h3 className="font-bold text-2xl mb-4 text-white">{t('telehealthFor')} {patientId}</h3>
      <div className="flex flex-col space-y-4">
        <video ref={localVideoRef} autoPlay muted className="w-full h-48 rounded-lg" />
        <video ref={remoteVideoRef} autoPlay className="w-full h-48 rounded-lg" />
        <button onClick={onClose} className="btn btn-error text-white mt-4">
          {t('close')}
        </button>
      </div>
    </div>
  );
}

export default Telehealth;
