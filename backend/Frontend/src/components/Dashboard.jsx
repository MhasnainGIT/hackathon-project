import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, TimeScale, Title, Tooltip, Legend } from 'chart.js';
import 'chartjs-adapter-date-fns';
import chartjsPluginZoom from 'chartjs-plugin-zoom';
import axios from 'axios';
import Chatbot from './Chatbot';
import { D3Chart } from './D3Chart';
import Plotly from 'plotly.js-dist';
import { useTranslation } from '../../node_modules/react-i18next';
import { useSpeechRecognition } from 'react-speech-recognition';
import Modal from 'react-modal';
import { TwilioVideo } from 'twilio-video';
import debounce from 'lodash/debounce';

ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Title, Tooltip, Legend, chartjsPluginZoom);

Modal.setAppElement('#root');

const socket = io('http://localhost:5000', {
  transports: ['websocket'],
  cors: { origin: 'http://localhost:3000' },
  withCredentials: true, // Ensure credentials are included for CORS
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

function Dashboard({ token }) {
  const { t, i18n } = useTranslation();
  const [patientsData, setPatientsData] = useState({
    patient1: [],
    patient2: [],
    patient3: [],
  });
  const [alerts, setAlerts] = useState([]);
  const [seriousAlerts, setSeriousAlerts] = useState([]);
  const [newPatientId, setNewPatientId] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isTelehealthOpen, setIsTelehealthOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [thresholds, setThresholds] = useState({
    patient1: { heartRate: 120, spO2: 92 },
    patient2: { heartRate: 120, spO2: 92 },
    patient3: { heartRate: 120, spO2: 92 },
  });
  const [patientScores, setPatientScores] = useState({
    patient1: 100,
    patient2: 100,
    patient3: 100,
  });
  const [leaderboard, setLeaderboard] = useState([]);
  const [healthForecast, setHealthForecast] = useState({});
  const [availableScheme, setAvailableScheme] = useState({});
  const [topDoctors, setTopDoctors] = useState({});
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImage, setNewPostImage] = useState(null);
  const [isCommunityOpen, setIsCommunityOpen] = useState(false);
  const [communityMessages, setCommunityMessages] = useState({
    Global: { general: [], emergencies: [] },
    Local_India: { general: [], emergencies: [] },
  });
  const [selectedChannel, setSelectedChannel] = useState('general');
  const [newMessage, setNewMessage] = useState('');
  const [likedPosts, setLikedPosts] = useState({}); // Track user likes
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState('doc1'); // Default user, can be dynamic based on token
  const navigate = useNavigate();
  const alarmSound = useRef(null); // Initialize as null to handle unmounting
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const plotlyChartRef = useRef(null);
  const { transcript, resetTranscript, listening, browserSupportsSpeechRecognition } = useSpeechRecognition();

  const latestVitalsForSelected = selectedPatient ? patientsData[selectedPatient]?.[patientsData[selectedPatient].length - 1] || {} : {};

  // Debounced fetch function to reduce API calls
  const debouncedFetch = useCallback(debounce((url, callback) => {
    axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
      withCredentials: true, // Ensure credentials are included for CORS
    }).then(response => {
      callback(response.data);
    }).catch(error => {
      console.error(`Error fetching ${url}:`, error);
      setError(`Error fetching ${url}: ${error.message || 'Server responded with 404'}`);
      // Fallback data for posts, communities, and doctors
      if (url.includes('/api/community/Global/posts') || url.includes('/api/community/Local_India/posts')) {
        callback([
          { id: 'post1', author: 'Dr. Rajesh Kumar', content: 'New insights on heart health management', imageUrl: 'http://localhost:3000/images/1-heart-health.jpg', likes: {}, comments: ['Great post!', 'Very informative'], timestamp: new Date().toISOString(), sharedTo: ['Global'] },
          { id: 'post2', author: 'Dr. Emily Davis', content: 'Pediatric care tips for flu season', imageUrl: 'http://localhost:3000/images/4-pediatric-care.jpg', likes: {}, comments: ['Helpful!', 'Thanks for sharing'], timestamp: new Date().toISOString(), sharedTo: ['Global'] },
          { id: 'post3', author: 'Dr. Kumar', content: 'Neurology updates for stroke prevention', imageUrl: 'http://localhost:3000/images/2-neurology.jpg', likes: {}, comments: ['Useful info!', 'Great work'], timestamp: new Date().toISOString(), sharedTo: ['Local_India'] },
          { id: 'post4', author: 'Dr. Patel', content: 'Nutrition tips for better health', imageUrl: 'http://localhost:3000/images/3-nutrition-tips.jpg', likes: {}, comments: ['Very helpful!', 'Thanks'], timestamp: new Date().toISOString(), sharedTo: ['Local_India'] },
        ]);
      } else if (url.includes('/api/community')) {
        callback({
          'Global': { type: 'Global', location: null, name: 'Global Community', members: ['Dr. Rajesh', 'Dr. Emily', 'Dr. Alice', 'doc1'], posts: [], channels: {"general": [], "emergencies": []}, messages: {"general": [], "emergencies": []} },
          'Local_India': { type: 'Local', location: 'India', name: 'India Community', members: ['Dr. Kumar', 'Dr. Patel', 'Dr. Sharma', 'doc1'], posts: [], channels: {"general": [], "emergencies": []}, messages: {"general": [], "emergencies": []} },
        });
      } else if (url.includes('/api/community/top-doctors')) {
        callback({
          India: [{ username: 'Dr. Kumar', experienceYears: 15, specialties: ['Cardiology'], rating: 4.8, image: 'http://localhost:3000/images/1-heart-health.jpg', status: 'Disconnected' }],
          USA: [{ username: 'Dr. Smith', experienceYears: 18, specialties: ['Oncology'], rating: 4.9, image: 'https://via.placeholder.com/100.png?text=Dr.+Smith', status: 'Disconnected' }],
          UK: [{ username: 'Dr. Brown', experienceYears: 14, specialties: ['Pediatrics'], rating: 4.7, image: 'https://via.placeholder.com/100.png?text=Dr.+Brown', status: 'Disconnected' }],
        });
      } else if (url.includes('/api/community/messages')) {
        const communityId = url.includes('Global') ? 'Global' : 'Local_India';
        const channel = url.includes('general') ? 'general' : 'emergencies';
        callback({
          [communityId]: { messages: { [channel]: [] } },
        });
      }
    });
  }, 300), [token]);

  const fetchData = useCallback((url, callback) => {
    debouncedFetch(url, callback);
  }, [debouncedFetch]);

  const fetchCommunity = useCallback(async (type, location) => {
    setIsLoading(true);
    try {
      const response = await axios.get(`http://localhost:5000/api/community?type=${type}&location=${location || ''}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
        withCredentials: true,
      });
      setSelectedCommunity(response.data || {});
      const communityKey = `${type}${location ? `_${location}` : ''}`;
      fetchData(`http://localhost:5000/api/community/${communityKey}/messages/${selectedChannel}`, (messages) => {
        setCommunityMessages(prev => ({
          ...prev,
          [communityKey]: {
            ...prev[communityKey],
            [selectedChannel]: Array.isArray(messages) ? messages : (messages.messages && Array.isArray(messages.messages[selectedChannel])) ? messages.messages[selectedChannel] : [],
          },
        }));
      });
      fetchData(`http://localhost:5000/api/community/${communityKey}/posts`, (postsData) => {
        setPosts(postsData || []);
      });
    } catch (error) {
      console.error('Error fetching community:', error);
      setError(`Error fetching community: ${error.message}`);
      setSelectedCommunity({
        type,
        location,
        name: `${type} Community${location ? ` - ${location}` : ''}`,
        members: type === 'Global' ? ['Dr. Rajesh', 'Dr. Emily', 'Dr. Alice', 'doc1'] : ['Dr. Kumar', 'Dr. Patel', 'Dr. Sharma', 'doc1'],
        posts: [],
        channels: { general: [], emergencies: [] },
        messages: { general: [], emergencies: [] },
      });
      setCommunityMessages(prev => ({
        ...prev,
        [`${type}${location ? `_${location}` : ''}`]: { general: [], emergencies: [] },
      }));
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  }, [token, selectedChannel, fetchData]);

  const fetchPosts = useCallback(() => {
    fetchData('http://localhost:5000/api/community/Global/posts', (globalPosts) => {
      fetchData('http://localhost:5000/api/community/Local_India/posts', (localPosts) => {
        setPosts([...(globalPosts || []), ...(localPosts || [])].filter((post, index, self) => 
          index === self.findIndex((p) => p.id === post.id)
        ));
      });
    });
  }, [fetchData]);

  const fetchPatients = useCallback(() => {
    fetchData('http://localhost:5000/api/patients', (data) => {
      const initialData = {};
      data.forEach(v => {
        initialData[v.patientId] = initialData[v.patientId] || [];
        initialData[v.patientId].push(v);
      });
      setPatientsData(initialData);
    });
  }, [fetchData]);

  const fetchTopDoctors = useCallback(() => {
    fetchData('http://localhost:5000/api/community/top-doctors', (doctors) => {
      // Ensure topDoctors is an object with arrays of doctors
      if (doctors && typeof doctors === 'object' && !Array.isArray(doctors)) {
        setTopDoctors(doctors);
      } else {
        setTopDoctors({
          India: [{ username: 'Dr. Kumar', experienceYears: 15, specialties: ['Cardiology'], rating: 4.8, image: 'http://localhost:3000/images/1-heart-health.jpg', status: 'Disconnected' }],
          USA: [{ username: 'Dr. Smith', experienceYears: 18, specialties: ['Oncology'], rating: 4.9, image: 'https://via.placeholder.com/100.png?text=Dr.+Smith', status: 'Disconnected' }],
          UK: [{ username: 'Dr. Brown', experienceYears: 14, specialties: ['Pediatrics'], rating: 4.7, image: 'https://via.placeholder.com/100.png?text=Dr.+Brown', status: 'Disconnected' }],
        });
      }
    });
  }, [fetchData]);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    let mounted = true;

    fetchPatients();
    fetchPosts();
    fetchCommunity('Global', null);
    fetchCommunity('Local', 'India');
    fetchTopDoctors();

    // Initialize audio only if not already initialized
    if (!alarmSound.current) {
      alarmSound.current = new Audio('https://www.myinstants.com/media/sounds/alarm-clock-short-32064.mp3');
    }

    const handleConnect = () => {
      console.log('New client connected to backend on port 5000');
      socket.emit('requestInitialData', { user: currentUser });
      // Fetch initial data for all communities when a client connects
      fetchCommunity('Global', null);
      fetchCommunity('Local', 'India');
    };
    const handleDisconnect = () => {
      console.log('Disconnected from backend, attempting to reconnect...');
      socket.connect();
    };
    const handleConnectError = (error) => {
      console.error('Socket.IO connection error:', error.message);
      if (error.message.includes('failed')) {
        console.warn('Retrying WebSocket connection in 2 seconds...');
        setTimeout(() => socket.connect(), 2000);
      }
    };
    const handleVitalsUpdate = (vitals) => {
      if (mounted) {
        setPatientsData(prev => ({
          ...prev,
          [vitals.patientId]: [...(prev[vitals.patientId] || []).slice(-10), vitals],
        }));
        const patientThresholds = thresholds[vitals.patientId] || { heartRate: 120, spO2: 92 };
        if (vitals.heartRate > patientThresholds.heartRate || vitals.spO2 < patientThresholds.spO2 || vitals.anomalyScore > 0.7 || vitals.prediction === 'Critical') {
          setAlerts(prev => [...prev, `${vitals.patientId}: ${vitals.prediction} - ${new Date().toLocaleTimeString()}`].slice(-5));
          updateUserScore(currentUser, -10);
        }
      }
    };

    const handleSeriousAlarm = (data) => {
      if (mounted && alarmSound.current) {
        try {
          alarmSound.current.loop = true; // Ensure loop
          alarmSound.current.play().catch(err => {
            console.error('Audio play failed:', err);
            setError(`Audio play failed: ${err.message}`);
          });
        } catch (err) {
          console.error('Audio initialization failed:', err);
          setError(`Audio initialization failed: ${err.message}`);
        }
      }
    };

    const handlePatientRemoved = (patientId) => {
      if (mounted) {
        setPatientsData(prev => {
          const newData = { ...prev };
          delete newData[patientId];
          if (selectedPatient === patientId) setSelectedPatient(Object.keys(newData)[0] || null);
          return newData;
        });
      }
    };

    const handleLeaderboardUpdate = (data) => {
      if (mounted) setLeaderboard(data.slice(0, 5));
    };

    const handleNewPost = (data) => {
      if (mounted) setPosts(prev => [data.post, ...prev].slice(0, 10));
    };

    const handlePostUpdated = (data) => {
      if (mounted) setPosts(prev => prev.map(p => p.id === data.postId ? { ...p, likes: data.likes, comments: data.comments } : p));
    };

    const handleConnectionUpdate = (data) => {
      console.log(`New connection: ${data.from} connected with ${data.to}`);
      if (mounted) {
        setTopDoctors(prev => {
          const updatedDoctors = { ...prev };
          for (let region in updatedDoctors) {
            updatedDoctors[region] = (Array.isArray(updatedDoctors[region]) ? updatedDoctors[region] : []).map(doc => 
              doc.username === data.to ? { ...doc, status: data.status } : doc
            );
          }
          return updatedDoctors;
        });
      }
    };

    const handleCommunityMessage = (data) => {
      if (mounted) {
        const communityKey = data.communityId;
        setCommunityMessages(prev => ({
          ...prev,
          [communityKey]: {
            ...prev[communityKey],
            [data.channel]: Array.isArray(prev[communityKey]?.[data.channel]) ? [...prev[communityKey][data.channel], data.message] : [data.message],
          },
        }));
      }
    };

    const handleSwitchToPrivateCommunity = (data) => {
      if (mounted && data.user === currentUser) {
        fetchCommunity('Local', 'India');
        setSelectedCommunity(community_collection.find_one({"type": "Local", "location": "India"}));
        setSelectedChannel('general'); // Default to general chat in private community
      }
    };

    const handleInitialData = (data) => {
      if (mounted) {
        setPosts(data.posts || []);
        setCommunityMessages(data.messages || {
          Global: { general: [], emergencies: [] },
          Local_India: { general: [], emergencies: [] },
        });
      }
    };

    const handleError = (data) => {
      if (mounted) setError(data.message || 'An error occurred');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('vitalsUpdate', handleVitalsUpdate);
    socket.on('seriousAlarm', handleSeriousAlarm);
    socket.on('patientRemoved', handlePatientRemoved);
    socket.on('leaderboardUpdate', handleLeaderboardUpdate);
    socket.on('newPost', handleNewPost);
    socket.on('postUpdated', handlePostUpdated);
    socket.on('connectionUpdate', handleConnectionUpdate);
    socket.on('communityMessage', handleCommunityMessage);
    socket.on('switchToPrivateCommunity', handleSwitchToPrivateCommunity);
    socket.on('initialData', handleInitialData);
    socket.on('error', handleError);

    return () => {
      mounted = false;
      if (alarmSound.current) {
        alarmSound.current.pause();
        alarmSound.current = null; // Clean up audio to prevent memory leaks
      }
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('vitalsUpdate', handleVitalsUpdate);
      socket.off('seriousAlarm', handleSeriousAlarm);
      socket.off('patientRemoved', handlePatientRemoved);
      socket.off('leaderboardUpdate', handleLeaderboardUpdate);
      socket.off('newPost', handleNewPost);
      socket.off('postUpdated', handlePostUpdated);
      socket.off('connectionUpdate', handleConnectionUpdate);
      socket.off('communityMessage', handleCommunityMessage);
      socket.off('switchToPrivateCommunity', handleSwitchToPrivateCommunity);
      socket.off('initialData', handleInitialData);
      socket.off('error', handleError);
      socket.disconnect();
    };
  }, [token, navigate, fetchCommunity, fetchPosts, fetchPatients, fetchTopDoctors, currentUser]);

  const handleAddPatient = (patientId = newPatientId.trim()) => {
    if (patientId && /^[a-zA-Z0-9-]+$/.test(patientId)) { // Basic validation
      setIsLoading(true);
      socket.emit('addPatient', { patientId });
      setNewPatientId('');
      setIsLoading(false);
    } else {
      setError('Invalid patient ID. Use alphanumeric characters and hyphens only.');
    }
  };

  const handleRemovePatient = (patientId) => {
    setIsLoading(true);
    socket.emit('removePatient', { patientId });
    setIsLoading(false);
  };

  const handleSetThresholds = (patientId, newThresholds) => {
    setIsLoading(true);
    const parsedThresholds = { heartRate: parseInt(newThresholds.heartRate) || 120, spO2: parseInt(newThresholds.spO2) || 92 };
    if (parsedThresholds.heartRate < 0 || parsedThresholds.spO2 < 0 || parsedThresholds.heartRate > 200 || parsedThresholds.spO2 > 100) {
      setError('Invalid threshold values. Heart rate must be 0-200, SpO2 must be 0-100.');
      setIsLoading(false);
      return;
    }
    socket.emit('setThreshold', { patientId, thresholds: parsedThresholds });
    setThresholds(prev => ({ ...prev, [patientId]: parsedThresholds }));
    setIsLoading(false);
  };

  const handleDetails = async (patientId) => {
    setIsLoading(true);
    try {
      const response = await axios.get(`http://localhost:5000/api/patients/${patientId}/vitals`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
        withCredentials: true,
      });
      alert(`${t('detailsFor')} ${patientId}:\n${JSON.stringify(response.data, null, 2)}`);
      setSelectedPatient(patientId);
    } catch (error) {
      console.error('Error fetching vitals:', error);
      setError(`Error fetching vitals for ${patientId}: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMailAutomation = (patientId, vitals) => {
    console.log(`Sending notifications for ${patientId}`);
    alert(`${t('notificationsSent')} ${patientId} ${t('withVitals')} ${t('heartRate')} ${vitals.heartRate}, ${t('spO2')} ${vitals.spO2}`);
    socket.emit('notifyTeam', { patientId, vitals });
  };

  const updateUserScore = async (username, points) => {
    socket.emit('updateScore', { username, points });
    setPatientScores(prev => ({ ...prev, [username]: Math.max((prev[username] || 100) + points, 0) }));
  };

  const handleCreatePost = async () => {
    if (newPostContent.trim() || newPostImage) {
      setIsLoading(true);
      const newPost = {
        id: `post${Date.now()}`,
        author: currentUser,
        content: newPostContent,
        imageUrl: newPostImage ? URL.createObjectURL(newPostImage) : null,
        likes: { [currentUser]: false },
        comments: [],
        timestamp: new Date().toISOString(),
        sharedTo: [selectedCommunity?.type === 'Global' ? 'Global' : 'Local_India'], // Default to current community
      };
      try {
        await socket.emit('createPost', {
          author: currentUser,
          content: newPostContent,
          imageUrl: newPostImage ? URL.createObjectURL(newPostImage) : null,
          communityId: selectedCommunity?.type === 'Global' ? 'Global' : 'Local_India',
        });
        setPosts(prev => [newPost, ...prev].slice(0, 10));
        setNewPostContent('');
        setNewPostImage(null);
      } catch (error) {
        console.error('Error creating post:', error);
        setError(`Error creating post: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleLikePost = async (postId) => {
    if (!likedPosts[postId]) {
      setIsLoading(true);
      try {
        const post = posts.find(p => p.id === postId);
        if (post && !post.likes[currentUser]) {
          socket.emit('likePost', { postId, user: currentUser });
          setLikedPosts(prev => ({ ...prev, [postId]: true }));
          setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: { ...p.likes, [currentUser]: true } } : p));
        }
      } catch (error) {
        console.error('Error liking post:', error);
        setError(`Error liking post: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCommentPost = async (postId, comment) => {
    if (comment.trim()) {
      setIsLoading(true);
      try {
        socket.emit('commentPost', { postId, user: currentUser, comment });
      } catch (error) {
        console.error('Error commenting on post:', error);
        setError(`Error commenting on post: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleAddComment = (postId) => {
    const comment = prompt(t('enterComment'));
    if (comment) {
      handleCommentPost(postId, comment);
    }
  };

  const handleSharePost = (postId, community) => {
    setIsLoading(true);
    try {
      const post = posts.find(p => p.id === postId);
      if (post) {
        const communityId = community === 'Global' ? 'Global' : 'Local_India';
        socket.emit('createPost', {
          author: post.author,
          content: post.content,
          imageUrl: post.imageUrl,
          communityId,
          sharedTo: [...post.sharedTo, communityId],
        });
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, sharedTo: [...p.sharedTo, communityId] } : p));
        alert(`${t('postSharedTo')} ${community} Community`);
      }
    } catch (error) {
      console.error('Error sharing post:', error);
      setError(`Error sharing post: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectDoctor = async (doctorUsername) => {
    setIsLoading(true);
    try {
      socket.emit('connectDoctor', { from: currentUser, to: doctorUsername });
    } catch (error) {
      console.error('Error connecting to doctor:', error);
      setError(`Error connecting to ${doctorUsername}: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnectDoctor = async (doctorUsername) => {
    setIsLoading(true);
    try {
      socket.emit('disconnectDoctor', { from: currentUser, to: doctorUsername });
    } catch (error) {
      console.error('Error disconnecting from doctor:', error);
      setError(`Error disconnecting from ${doctorUsername}: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const setupTelehealth = async () => {
    try {
      setIsLoading(true);
      const room = await TwilioVideo.connect(token, { room: `patient-${selectedPatient}` });
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
      setError(`Telehealth error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedPatient(null);
  };

  const handleSendMessage = (communityKey, channel) => {
    if (newMessage.trim()) {
      setIsLoading(true);
      const message = {
        id: Date.now(),
        author: currentUser,
        content: newMessage,
        timestamp: new Date().toISOString(),
      };
      try {
        socket.emit('communityMessage', { communityId: communityKey, channel, message });
        setCommunityMessages(prev => ({
          ...prev,
          [communityKey]: {
            ...prev[communityKey],
            [channel]: [...(prev[communityKey]?.[channel] || []), message],
          },
        }));
        setNewMessage('');
      } catch (error) {
        console.error('Error sending message:', error);
        setError(`Error sending message: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const renderChart = (patientId, data) => {
    if (!data || data.length === 0) return <div className="text-gray-400">No data available</div>;
    const chartData = {
      labels: data.map(v => new Date(v.timestamp)),
      datasets: [
        {
          label: t('heartRate') + ' (bpm)',
          data: data.map(v => v.heartRate),
          borderColor: '#EF4444',
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          fill: true,
          tension: 0.1,
        },
        {
          label: t('spO2') + ' (%)',
          data: data.map(v => v.spO2),
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          fill: true,
          tension: 0.1,
        },
      ],
    };
    return (
      <Line
        data={chartData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { type: 'time', title: { display: true, text: t('time'), color: '#D1D5DB' }, time: { unit: 'minute', tooltipFormat: 'HH:mm' } },
            y: { title: { display: true, text: t('value'), color: '#D1D5DB' }, beginAtZero: true, suggestedMin: 0, suggestedMax: 150 },
          },
          plugins: {
            legend: { position: 'top', labels: { color: '#D1D5DB', font: { family: 'Inter' } } },
            title: { display: true, text: `${t('vitalsFor')} ${patientId}`, color: '#D1D5DB', font: { family: 'Inter' } },
            tooltip: { mode: 'index', intersect: false, callbacks: { label: (context) => `${context.dataset.label}: ${context.raw}` } },
            zoom: {
              pan: { enabled: true, mode: 'x' },
              zoom: { enabled: true, mode: 'x', speed: 0.1 },
            },
          },
          interaction: { mode: 'nearest', intersect: false },
        }}
      />
    );
  };

  const getConditionColor = (prediction, isVerySerious) => {
    if (isVerySerious) return 'bg-red-600';
    return prediction === 'Critical' ? 'bg-red-500' : prediction === 'Moderate' ? 'bg-yellow-500' : 'bg-green-500';
  };

  useEffect(() => {
    if (Object.keys(patientsData).length > 0 && plotlyChartRef.current) {
      const trace1 = {
        x: Object.values(patientsData).flat().map(v => new Date(v.timestamp)),
        y: Object.values(patientsData).flat().map(v => v.heartRate),
        type: 'scatter',
        mode: 'lines',
        name: t('heartRate'),
        line: { color: '#EF4444' },
      };
      const trace2 = {
        x: Object.values(patientsData).flat().map(v => new Date(v.timestamp)),
        y: Object.values(patientsData).flat().map(v => v.spO2),
        type: 'scatter',
        mode: 'lines',
        name: t('spO2'),
        line: { color: '#3B82F6' },
      };
      const layout = {
        title: t('advancedAnalytics'),
        xaxis: { title: t('time'), showgrid: false, color: '#D1D5DB' },
        yaxis: { title: t('value'), showgrid: false, color: '#D1D5DB' },
        plot_bgcolor: '#1f2937',
        paper_bgcolor: '#1f2937',
        font: { color: '#D1D5DB', family: 'Inter' },
      };
      Plotly.newPlot(plotlyChartRef.current, [trace1, trace2], layout, { displayModeBar: false, showLegend: false });
    }
  }, [patientsData, t]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 flex font-sans">
      {error && (
        <div className="alert alert-error p-3 rounded-lg shadow-md mb-4 bg-red-900 text-red-300 fixed top-4 left-1/2 transform -translate-x-1/2">
          <span className="font-medium">{error}</span>
          <button
            onClick={() => setError('')}
            className="ml-2 text-red-200 hover:text-red-100"
          >
            ×
          </button>
        </div>
      )}
      <div className="w-72 bg-gray-800 p-4 h-screen fixed shadow-lg rounded-r-xl border-r border-gray-700">
        <h2 className="text-2xl font-bold mb-6 text-white text-center font-inter">HealthSync AI</h2>
        <nav className="space-y-3">
          <button
            onClick={() => setSelectedCommunity(null)}
            className={`w-full text-left px-3 py-2 rounded-md hover:bg-gray-700 transition-colors ${!selectedCommunity ? 'bg-blue-600 text-white' : 'text-gray-300'} font-medium`}
          >
            {t('patients')}
          </button>
          <div>
            <button
              onClick={() => setIsCommunityOpen(!isCommunityOpen)}
              className={`w-full text-left px-3 py-2 rounded-md hover:bg-gray-700 transition-colors ${isCommunityOpen ? 'bg-blue-600 text-white' : 'text-gray-300'} font-medium`}
            >
              {t('community')} {isCommunityOpen ? '▲' : '▼'}
            </button>
            {isCommunityOpen && (
              <div className="ml-4 space-y-2">
                <button
                  onClick={() => fetchCommunity('Global', null)}
                  className={`w-full text-left px-3 py-2 rounded-md hover:bg-gray-700 transition-colors ${selectedCommunity?.type === 'Global' ? 'bg-blue-600 text-white' : 'text-gray-300'} font-medium`}
                >
                  {t('globalCommunityServer')}
                </button>
                <button
                  onClick={() => fetchCommunity('Local', 'India')}
                  className={`w-full text-left px-3 py-2 rounded-md hover:bg-gray-700 transition-colors ${selectedCommunity?.type === 'Local' ? 'bg-blue-600 text-white' : 'text-gray-300'} font-medium`}
                >
                  {t('privateCommunityServer')}
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => { setSelectedCommunity('topDoctors'); fetchTopDoctors(); }}
            className={`w-full text-left px-3 py-2 rounded-md hover:bg-gray-700 transition-colors ${selectedCommunity === 'topDoctors' ? 'bg-blue-600 text-white' : 'text-gray-300'} font-medium`}
          >
            {t('topDoctors')}
          </button>
          <button
            onClick={() => setSelectedCommunity('socialFeed')}
            className={`w-full text-left px-3 py-2 rounded-md hover:bg-gray-700 transition-colors ${selectedCommunity === 'socialFeed' ? 'bg-blue-600 text-white' : 'text-gray-300'} font-medium`}
          >
            {t('socialFeed')}
          </button>
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors font-medium"
          >
            {t('logout')}
          </button>
        </nav>
      </div>

      <div className="flex-1 ml-72 p-6">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <span className="loading loading-spinner loading-lg text-gray-400"></span>
          </div>
        ) : selectedCommunity ? (
          <div className="card bg-gray-800 p-4 rounded-lg shadow-2xl border border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-white">
              {selectedCommunity === 'socialFeed' ? t('socialFeed') : selectedCommunity?.type === 'Global' ? t('globalCommunityServer') : selectedCommunity?.type === 'Local' ? t('privateCommunityServer') : t('topDoctors')} - {selectedCommunity?.name || 'Top Doctors'}
            </h2>
            {selectedCommunity === 'socialFeed' && (
              <div className="mt-4">
                <h3 className="text-lg font-medium mb-2 text-gray-200">{t('posts')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {posts.map((post) => (
                    <div key={post.id} className="bg-gray-700 p-4 rounded-lg shadow-md border border-gray-600">
                      <p className="text-gray-200 font-medium"><strong>{post.author}</strong>: {post.content}</p>
                      {post.imageUrl && <img src={post.imageUrl} alt={post.content} className="mt-2 w-full rounded-lg h-48 object-cover" onError={(e) => { e.target.src = 'http://localhost:3000/images/default-post.jpg'; }} />}
                      <div className="mt-2 flex justify-between text-gray-400">
                        <button 
                          onClick={() => handleLikePost(post.id)} 
                          className={`btn btn-sm ${likedPosts[post.id] ? 'btn-success' : 'btn-blue'} text-white hover:${likedPosts[post.id] ? 'bg-green-700' : 'bg-blue-700'}`}
                          disabled={likedPosts[post.id]}
                        >
                          {likedPosts[post.id] ? 'Liked' : t('like')} ({Object.values(post.likes).filter(Boolean).length})
                        </button>
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            placeholder={t('addComment')}
                            onKeyPress={(e) => e.key === 'Enter' && handleCommentPost(post.id, e.target.value)}
                            className="input input-sm w-3/4 bg-gray-600 text-gray-200 border-gray-500 rounded"
                          />
                          <button
                            onClick={() => handleAddComment(post.id)}
                            className="btn btn-sm btn-blue text-white hover:bg-blue-700"
                          >
                            {t('comment')}
                          </button>
                        </div>
                      </div>
                      <ul className="mt-2 list-disc pl-5 text-gray-400">
                        {post.comments.map((comment, idx) => (
                          <li key={idx}>{comment}</li>
                        ))}
                      </ul>
                      <div className="mt-2">
                        <button className="btn btn-sm btn-gray mr-2">{t('share')}</button>
                        <select
                          onChange={(e) => handleSharePost(post.id, e.target.value)}
                          className="select select-bordered max-w-xs bg-gray-600 text-gray-200 border-gray-500 rounded text-sm"
                        >
                          <option value="" disabled selected>{t('selectCommunity')}</option>
                          <option value="Global">{t('globalCommunityServer')}</option>
                          <option value="Local">{t('privateCommunityServer')}</option>
                        </select>
                      </div>
                      <p className="text-sm text-gray-400 mt-2">{new Date(post.timestamp).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <input
                    type="text"
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder={t('newPost')}
                    className="input input-bordered w-full mb-2 bg-gray-700 text-gray-200 border-gray-600 rounded text-sm"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setNewPostImage(e.target.files[0])}
                    className="file-input file-input-bordered w-full mb-2 bg-gray-700 text-gray-200 border-gray-600 rounded text-sm"
                  />
                  <button
                    onClick={handleCreatePost}
                    className={`btn btn-blue w-full ${isLoading ? 'loading' : ''} text-white text-sm`}
                    disabled={isLoading || !newPostContent.trim()}
                  >
                    {t('post')}
                  </button>
                </div>
              </div>
            )}
            {selectedCommunity?.type && (
              <div className="mt-4 flex">
                <div className="w-1/4 bg-gray-700 p-4 rounded-l-lg border-r border-gray-600">
                  <h3 className="text-lg font-medium mb-2 text-gray-200">{t('members')} ({selectedCommunity.members?.length || 0})</h3>
                  <ul className="list-disc pl-5 text-gray-300">
                    {selectedCommunity.members?.map((member, idx) => (
                      <li key={idx} className="text-gray-300">{member.username || member}</li>
                    )) || <li>No members available</li>}
                  </ul>
                  <h3 className="text-lg font-medium mt-4 mb-2 text-gray-200">{t('channels')}</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => setSelectedChannel('general')}
                      className={`w-full bg-gray-600 text-gray-200 p-2 rounded hover:bg-gray-500 ${selectedChannel === 'general' ? 'bg-blue-600 text-white' : ''}`}
                    >
                      General Chat
                    </button>
                    <button
                      onClick={() => setSelectedChannel('emergencies')}
                      className={`w-full bg-gray-600 text-gray-200 p-2 rounded hover:bg-gray-500 ${selectedChannel === 'emergencies' ? 'bg-red-600 text-white' : ''}`}
                    >
                      Emergencies
                    </button>
                  </div>
                </div>
                <div className="w-3/4 p-4 bg-gray-800 rounded-r-lg">
                  <h3 className="text-lg font-medium mb-2 text-gray-200">{selectedChannel === 'general' ? 'General Chat' : 'Emergencies'}</h3>
                  <div className="h-64 overflow-y-auto bg-gray-700 p-2 rounded mb-2 text-gray-200">
                    {Array.isArray(communityMessages[`${selectedCommunity?.type || 'Global'}${selectedCommunity?.location ? `_${selectedCommunity.location}` : ''}`]?.[selectedChannel]) ? (
                      communityMessages[`${selectedCommunity?.type || 'Global'}${selectedCommunity?.location ? `_${selectedCommunity.location}` : ''}`]?.[selectedChannel]?.map((message) => (
                        <div key={message.id} className="mb-2">
                          <strong>{message.author}</strong>: {message.content} <span className="text-gray-400 text-sm">{new Date(message.timestamp).toLocaleTimeString()}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-400">No messages yet.</p>
                    )}
                  </div>
                  <div className="flex">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={t('typeMessage')}
                      className="input input-bordered w-full bg-gray-600 text-gray-200 border-gray-500 rounded-l text-sm"
                    />
                    <button
                      onClick={() => handleSendMessage(`${selectedCommunity?.type || 'Global'}${selectedCommunity?.location ? `_${selectedCommunity.location}` : ''}`, selectedChannel)}
                      className={`btn btn-blue px-3 py-1 text-white hover:bg-blue-700 rounded-r text-sm ${isLoading ? 'loading' : ''}`}
                      disabled={isLoading || !newMessage.trim()}
                    >
                      {t('send')}
                    </button>
                  </div>
                  <h3 className="text-lg font-medium mt-4 mb-2 text-gray-200">{t('posts')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedCommunity?.posts?.map((post) => (
                      <div key={post.id} className="bg-gray-700 p-4 rounded-lg shadow-md border border-gray-600">
                        <p className="text-gray-200 font-medium"><strong>{post.author}</strong>: {post.content}</p>
                        {post.imageUrl && <img src={post.imageUrl} alt={post.content} className="mt-2 w-full rounded-lg h-48 object-cover" onError={(e) => { e.target.src = 'http://localhost:3000/images/default-post.jpg'; }} />}
                        <div className="mt-2 flex justify-between text-gray-400">
                          <button 
                            onClick={() => handleLikePost(post.id)} 
                            className={`btn btn-sm ${likedPosts[post.id] ? 'btn-success' : 'btn-blue'} text-white hover:${likedPosts[post.id] ? 'bg-green-700' : 'bg-blue-700'}`}
                            disabled={likedPosts[post.id]}
                          >
                            {likedPosts[post.id] ? 'Liked' : t('like')} ({Object.values(post.likes).filter(Boolean).length})
                          </button>
                          <div className="flex space-x-2">
                            <input
                              type="text"
                              placeholder={t('addComment')}
                              onKeyPress={(e) => e.key === 'Enter' && handleCommentPost(post.id, e.target.value)}
                              className="input input-sm w-3/4 bg-gray-600 text-gray-200 border-gray-500 rounded"
                            />
                            <button
                              onClick={() => handleAddComment(post.id)}
                              className="btn btn-sm btn-blue text-white hover:bg-blue-700"
                            >
                              {t('comment')}
                            </button>
                          </div>
                        </div>
                        <ul className="mt-2 list-disc pl-5 text-gray-400">
                          {post.comments.map((comment, idx) => (
                            <li key={idx}>{comment}</li>
                          ))}
                        </ul>
                        <div className="mt-2">
                          <button className="btn btn-sm btn-gray mr-2">{t('share')}</button>
                          <select
                            onChange={(e) => handleSharePost(post.id, e.target.value)}
                            className="select select-bordered max-w-xs bg-gray-600 text-gray-200 border-gray-500 rounded text-sm"
                          >
                            <option value="" disabled selected>{t('selectCommunity')}</option>
                            <option value="Global">{t('globalCommunityServer')}</option>
                            <option value="Local">{t('privateCommunityServer')}</option>
                          </select>
                        </div>
                        <p className="text-sm text-gray-400 mt-2">{new Date(post.timestamp).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {selectedCommunity === 'topDoctors' && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(topDoctors).map(([region, doctors]) => (
                  (Array.isArray(doctors) ? doctors : []).map((doctor, idx) => (
                    <div key={`${region}-${idx}`} className="card bg-gray-700 p-4 rounded-lg shadow-md border border-gray-600 flex flex-col items-center">
                      <img src={doctor.image} alt={doctor.username} className="w-24 h-24 rounded-full mb-2 object-cover" onError={(e) => { e.target.src = 'http://localhost:3000/images/default-doctor.jpg'; }} />
                      <h3 className="text-lg font-medium text-white mb-2">{doctor.username}</h3>
                      <p className="text-gray-300 mb-1">{doctor.experienceYears} {t('yearsExperience')}</p>
                      <p className="text-gray-300 mb-1">Specialties: {doctor.specialties.join(', ')}</p>
                      <p className="text-gray-300 mb-1">Rating: {doctor.rating || 'N/A'}</p>
                      <div className="mt-2 flex space-x-2">
                        <button
                          onClick={() => handleConnectDoctor(doctor.username)}
                          className={`btn btn-sm btn-blue text-white hover:bg-blue-700 ${doctor.status === 'Connected' ? 'hidden' : ''}`}
                        >
                          {t('connect')}
                        </button>
                        <button
                          onClick={() => handleDisconnectDoctor(doctor.username)}
                          className={`btn btn-sm btn-red text-white hover:bg-red-700 ${doctor.status !== 'Connected' ? 'hidden' : ''}`}
                        >
                          {t('disconnect')}
                        </button>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">{doctor.status || 'Disconnected'}</p>
                    </div>
                  ))
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="card bg-gray-800 p-4 rounded-lg shadow-2xl border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">{t('patients')}</h2>
              <button
                onClick={handleLogout}
                className="btn btn-red px-3 py-1 text-white hover:bg-red-700 rounded text-sm"
              >
                {t('logout')}
              </button>
            </div>
            {selectedPatient ? (
              <div className="card bg-gray-700 p-4 rounded-lg shadow-md border border-gray-600">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-white">{t('vitalsFor')} {selectedPatient}</h3>
                  <button
                    onClick={handleBack}
                    className="btn btn-gray px-3 py-1 text-white hover:bg-gray-600 rounded text-sm"
                  >
                    {t('back')}
                  </button>
                </div>
                <div className="h-60 mb-2 rounded-lg overflow-hidden bg-gray-900">
                  {renderChart(selectedPatient, patientsData[selectedPatient] || [])}
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-400">{t('condition')}:</span>
                    <span className={`px-2 py-1 rounded-full text-sm text-white ${getConditionColor(latestVitalsForSelected.prediction, latestVitalsForSelected.isVerySerious)}`}>
                      {latestVitalsForSelected.prediction || t('normal')}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-400">{t('heartRate')}: {latestVitalsForSelected.heartRate || 'N/A'} bpm</p>
                  <p className="text-sm font-medium text-gray-400">{t('spO2')}: {latestVitalsForSelected.spO2 || 'N/A'}%</p>
                  <p className="text-sm font-medium text-gray-400">{t('activityLevel')}: {latestVitalsForSelected.activityLevel || t('unknown')}</p>
                  <button
                    onClick={() => handleDetails(selectedPatient)}
                    className="btn btn-blue px-3 py-1 text-white hover:bg-blue-700 rounded text-sm"
                    disabled={isLoading}
                  >
                    {t('viewDetails')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {['patient1', 'patient2', 'patient3'].map(patientId => (
                  <div key={patientId} className="card bg-gray-700 p-4 rounded-lg shadow-md border border-gray-600">
                    <h3 className="text-lg font-medium text-white mb-2">{t('vitalsFor')} {patientId}</h3>
                    <div className="h-40 mb-2 rounded-lg overflow-hidden bg-gray-900">
                      {renderChart(patientId, patientsData[patientId] || [])}
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-400">{t('condition')}:</span>
                        <span className={`px-2 py-1 rounded-full text-sm text-white ${getConditionColor(patientsData[patientId]?.[patientsData[patientId].length - 1]?.prediction, patientsData[patientId]?.[patientsData[patientId].length - 1]?.isVerySerious)}`}>
                          {patientsData[patientId]?.[patientsData[patientId].length - 1]?.prediction || t('normal')}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-400">{t('heartRate')}: {patientsData[patientId]?.[patientsData[patientId].length - 1]?.heartRate || 'N/A'} bpm</p>
                      <p className="text-sm font-medium text-gray-400">{t('spO2')}: {patientsData[patientId]?.[patientsData[patientId].length - 1]?.spO2 || 'N/A'}%</p>
                      <p className="text-sm font-medium text-gray-400">{t('activityLevel')}: {patientsData[patientId]?.[patientsData[patientId].length - 1]?.activityLevel || t('unknown')}</p>
                      <button
                        onClick={() => handleDetails(patientId)}
                        className="btn btn-blue px-3 py-1 text-white hover:bg-blue-700 rounded text-sm"
                        disabled={isLoading}
                      >
                        {t('viewDetails')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Alerts Section */}
            {(alerts.length > 0 || seriousAlerts.length > 0) && (
              <div className="mt-4">
                {alerts.length > 0 && (
                  <div className="alert alert-warning p-3 rounded-lg shadow-md mb-2 bg-yellow-900 text-yellow-300">
                    <span className="font-medium">{t('alerts')}: {alerts.join(' | ')}</span>
                  </div>
                )}
                {seriousAlerts.length > 0 && (
                  <div className="alert alert-error p-3 rounded-lg shadow-md bg-red-900 text-red-300">
                    <span className="font-medium">{t('urgent')}: {seriousAlerts.join(' | ')}</span>
                  </div>
                )}
              </div>
            )}

            {/* Advanced Analytics */}
            <div className="mt-4">
              <h2 className="text-xl font-semibold mb-2 text-white">{t('advancedAnalytics')}</h2>
              <div className="h-40 rounded-lg overflow-hidden bg-gray-900">
                <D3Chart data={Object.values(patientsData).flat().slice(-10)} />
              </div>
              <div ref={plotlyChartRef} id="plotlyChart" className="mt-2 h-40 rounded-lg overflow-hidden bg-gray-900"></div>
            </div>

            {/* Leaderboard */}
            <div className="mt-4 w-full max-w-4xl">
              <h2 className="text-xl font-semibold mb-2 text-white">{t('leaderboard')}</h2>
              <ul className="list-disc pl-5 bg-gray-700 p-3 rounded-lg text-gray-300">
                {leaderboard.slice(0, 5).map((user, idx) => (
                  <li key={idx} className="text-gray-200">{user.username} - {user.score} {t('points')}</li>
                ))}
              </ul>
            </div>

            {/* Add Patient Form */}
            <div className="mt-4">
              <input
                type="text"
                value={newPatientId}
                onChange={(e) => setNewPatientId(e.target.value)}
                placeholder={t('newPatientId')}
                className="input input-bordered w-full mb-2 bg-gray-700 text-gray-200 border-gray-600 rounded text-sm"
              />
              <button
                onClick={handleAddPatient}
                className={`btn btn-blue w-full ${isLoading ? 'loading' : ''} text-white text-sm`}
                disabled={isLoading || !newPatientId.trim()}
              >
                {t('addPatient')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Chatbot Trigger */}
      <button
        className="fixed bottom-6 right-6 btn btn-blue btn-circle text-2xl drop-shadow-md"
        onClick={() => setIsChatOpen(true)}
        disabled={isLoading}
      >
        💬
      </button>
      <Chatbot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} token={token} />

      {/* Telehealth Modal */}
      <Modal
        isOpen={isTelehealthOpen}
        onRequestClose={() => setIsTelehealthOpen(false)}
        className="modal-box bg-gray-800 p-4 rounded-lg shadow-2xl max-w-2xl mx-auto mt-20 max-h-[80vh] border border-gray-700 animate__animated animate__fadeIn"
        overlayClassName="modal-overlay bg-black bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center"
      >
        <h3 className="font-bold text-lg mb-2 text-white">{t('telehealthFor')} {selectedPatient}</h3>
        <div className="flex flex-col space-y-3">
          <video ref={localVideoRef} autoPlay muted className="w-full h-48 rounded-lg border border-gray-700" />
          <video ref={remoteVideoRef} autoPlay className="w-full h-48 rounded-lg border border-gray-700" />
          <button onClick={() => setIsTelehealthOpen(false)} className="btn btn-red px-3 py-1 text-white hover:bg-red-700 rounded text-sm">
            {t('close')}
          </button>
        </div>
      </Modal>

      {/* Voice Control Button */}
      <button
        onClick={() => browserSupportsSpeechRecognition && SpeechRecognition.startListening({ continuous: true })}
        className={`fixed bottom-20 right-6 btn btn-gray btn-circle text-2xl drop-shadow-md ${listening ? 'bg-red-500' : 'bg-green-500'} text-white hover:${listening ? 'bg-red-600' : 'bg-green-600'} rounded-full`}
      >
        {listening ? t('stopVoice') : t('voiceControl')}
      </button>
    </div>
  );
}

export default Dashboard;