import { useEffect, useState, useRef } from 'react';
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
import { useTranslation } from 'react-i18next';
import { useSpeechRecognition } from 'react-speech-recognition';
import Modal from 'react-modal';
import { TwilioVideo } from 'twilio-video';

ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Title, Tooltip, Legend, chartjsPluginZoom);

Modal.setAppElement('#root');

const socket = io('http://localhost:5000', {
  transports: ['websocket'],
  cors: { origin: 'http://localhost:3000' },
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
  const [selectedPatient, setSelectedPatient] = useState('patient1');
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
  const [availableScheme, setAvailableScheme] = useState(null);
  const [topDoctors, setTopDoctors] = useState({
    India: [
      { username: 'Dr. Rajesh Kumar', experienceYears: 15, specialties: ['Cardiology', 'Internal Medicine'], location: 'India', rating: 4.8 },
      { username: 'Dr. Priya Sharma', experienceYears: 12, specialties: ['Pediatrics', 'Nutrition'], location: 'India', rating: 4.7 },
      { username: 'Dr. Amit Patel', experienceYears: 10, specialties: ['Neurology'], location: 'India', rating: 4.6 },
      { username: 'Dr. Neha Singh', experienceYears: 8, specialties: ['Dermatology'], location: 'India', rating: 4.5 },
      { username: 'Dr. Vikram Jain', experienceYears: 7, specialties: ['Orthopedics'], location: 'India', rating: 4.4 },
    ],
    USA: [
      { username: 'Dr. John Smith', experienceYears: 20, specialties: ['Cardiology', 'Surgery'], location: 'USA', rating: 4.9 },
      { username: 'Dr. Emily Davis', experienceYears: 18, specialties: ['Pediatrics'], location: 'USA', rating: 4.8 },
      { username: 'Dr. Michael Brown', experienceYears: 15, specialties: ['Neurology'], location: 'USA', rating: 4.7 },
      { username: 'Dr. Sarah Johnson', experienceYears: 13, specialties: ['Oncology'], location: 'USA', rating: 4.6 },
      { username: 'Dr. Robert Lee', experienceYears: 10, specialties: ['Radiology'], location: 'USA', rating: 4.5 },
    ],
    UK: [
      { username: 'Dr. Alice Turner', experienceYears: 16, specialties: ['Cardiology'], location: 'UK', rating: 4.8 },
      { username: 'Dr. James Wilson', experienceYears: 14, specialties: ['Pediatrics'], location: 'UK', rating: 4.7 },
      { username: 'Dr. Olivia Clark', experienceYears: 12, specialties: ['Neurology'], location: 'UK', rating: 4.6 },
      { username: 'Dr. Henry Moore', experienceYears: 9, specialties: ['Dermatology'], location: 'UK', rating: 4.5 },
      { username: 'Dr. Sophia Evans', experienceYears: 7, specialties: ['Orthopedics'], location: 'UK', rating: 4.4 },
    ],
  });
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [posts, setPosts] = useState([
    { id: 'post1', author: 'Dr. Rajesh Kumar', content: 'New insights on heart health management', imageUrl: 'https://via.placeholder.com/300x200?text=Heart+Health', likes: 15, comments: ['Great post!', 'Very informative'], timestamp: new Date().toISOString() },
    { id: 'post2', author: 'Dr. Emily Davis', content: 'Pediatric care tips for flu season', imageUrl: 'https://via.placeholder.com/300x200?text=Pediatric+Care', likes: 12, comments: ['Helpful!', 'Thanks for sharing'], timestamp: new Date().toISOString() },
    { id: 'post3', author: 'Dr. Alice Turner', content: 'Latest advancements in neurology', likes: 20, comments: ['Excellent research!', 'Very detailed'], timestamp: new Date().toISOString() },
    { id: 'post4', author: 'Dr. Priya Sharma', content: 'Nutritional advice for chronic diseases', imageUrl: 'https://via.placeholder.com/300x200?text=Nutrition+Tips', likes: 18, comments: ['Useful tips!', 'Great content'], timestamp: new Date().toISOString() },
  ]);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImage, setNewPostImage] = useState(null);
  const [isCommunityOpen, setIsCommunityOpen] = useState(false);
  const navigate = useNavigate();
  const alarmSound = useRef(new Audio('https://www.myinstants.com/media/sounds/alarm-clock-short-32064.mp3'));
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const { transcript, resetTranscript, listening, browserSupportsSpeechRecognition } = useSpeechRecognition();

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    let mounted = true;

    const fetchInitialData = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get('http://localhost:5000/api/patients', {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        });
        if (mounted) {
          const vitals = response.data;
          const initialData = {};
          vitals.forEach(v => {
            initialData[v.patientId] = initialData[v.patientId] || [];
            initialData[v.patientId].push(v);
          });
          setPatientsData(initialData);
          if (vitals.length > 0) setSelectedPatient(vitals[0].patientId || 'patient1');
        }
      } catch (error) {
        console.error('Error fetching initial vitals:', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    fetchInitialData();

    const fetchData = async (fn, ...args) => {
      try {
        const response = await fn(...args);
        if (mounted) return response.data;
      } catch (error) {
        console.error(`Error in ${fn.name}:`, error);
        return null;
      }
    };

    const fetchHealthForecast = async () => {
      const patientIds = ['patient1', 'patient2', 'patient3'];
      for (const patientId of patientIds) {
        const data = await fetchData(
          () => axios.get(`http://localhost:5000/api/patients/${patientId}/forecast`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000,
          })
        );
        if (mounted && data) {
          setHealthForecast(prev => ({ ...prev, [patientId]: data }));
        }
      }
    };
    fetchHealthForecast();

    const fetchAvailableScheme = async () => {
      const patientIds = ['patient1', 'patient2', 'patient3'];
      for (const patientId of patientIds) {
        const data = await fetchData(
          () => axios.get(`http://localhost:5000/api/patients/${patientId}/schemes`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000,
          })
        );
        if (mounted && data) {
          setAvailableScheme(prev => ({ ...prev, [patientId]: data }));
        }
      }
    };
    fetchAvailableScheme();

    const fetchCommunity = async (type, location) => {
      const data = await fetchData(
        () => axios.get(`http://localhost:5000/api/community?type=${type}&location=${location || ''}`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        })
      );
      if (mounted && data) {
        setSelectedCommunity(data);
        fetchPosts(data.id);
      }
    };
    fetchCommunity('Global', null);
    fetchCommunity('Local', 'India');

    const fetchPosts = async (communityId) => {
      const data = await fetchData(
        () => axios.get(`http://localhost:5000/api/community/posts?communityId=${communityId}&limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        })
      );
      if (mounted && data) setPosts(prev => [...prev, ...data].slice(0, 10));
    };

    const fetchTopDoctors = async () => {
      const data = await fetchData(
        () => axios.get('http://localhost:5000/api/community/top-doctors?limit=15', {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        })
      );
      if (mounted && data) {
        const regionDoctors = {
          India: data.filter(d => d.location === 'India').slice(0, 5),
          USA: data.filter(d => d.location === 'USA').slice(0, 5),
          UK: data.filter(d => d.location === 'UK').slice(0, 5),
        };
        setTopDoctors(regionDoctors);
      }
    };
    fetchTopDoctors();

    const handleConnect = () => console.log('Connected to backend on port 5000');
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
    const handleVitalsUpdate = async (vitals) => {
      if (mounted) {
        setPatientsData(prev => ({
          ...prev,
          [vitals.patientId]: [...(prev[vitals.patientId] || []).slice(-10), vitals],
        }));
        const patientThresholds = thresholds[vitals.patientId] || { heartRate: 120, spO2: 92 };
        if (vitals.heartRate > patientThresholds.heartRate || vitals.spO2 < patientThresholds.spO2 || vitals.anomalyScore > 0.7 || vitals.prediction === 'Critical') {
          setAlerts(prev => [...prev, `${vitals.patientId}: ${vitals.prediction} - ${new Date().toLocaleTimeString()}`].slice(-5));
          updateUserScore('doc1', -10);
        }
      }
    };

    const handleSeriousAlarm = (data) => {
      if (mounted) {
        setSeriousAlerts(prev => [...prev, `${data.patientId}: Very Serious - ${new Date().toLocaleTimeString()}`].slice(-3));
        alarmSound.current.play().catch(err => console.error('Audio play failed:', err));
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

    return () => {
      mounted = false;
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
      socket.disconnect();
    };
  }, [thresholds, token, selectedCommunity, isCommunityOpen]);

  useEffect(() => {
    return () => {
      setPatientsData({});
      setAlerts([]);
      setSeriousAlerts([]);
      setSelectedPatient(null);
      setHealthForecast({});
      setAvailableScheme(null);
      setTopDoctors({});
      setSelectedCommunity(null);
      setPosts([]);
      setNewPostContent('');
      setNewPostImage(null);
    };
  }, []);

  const renderChart = (patientId, data) => {
    if (!data || data.length === 0) return null;
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

  const handleAddPatient = (patientId = newPatientId.trim()) => {
    if (patientId) {
      setIsLoading(true);
      socket.emit('addPatient', { patientId });
      setPatientsData(prev => ({ ...prev, [patientId]: [] }));
      setThresholds(prev => ({ ...prev, [patientId]: { heartRate: 120, spO2: 92 } }));
      setPatientScores(prev => ({ ...prev, [patientId]: 100 }));
      setSelectedPatient(patientId);
      setNewPatientId('');
      setIsLoading(false);
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
      });
      alert(`${t('detailsFor')} ${patientId}:\n${JSON.stringify(response.data, null, 2)}`);
    } catch (error) {
      console.error('Error fetching vitals:', error);
      alert(`${t('errorFetching')} ${patientId}: ${error.response?.data?.message || error.message}`);
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

  const latestVitalsForSelected = selectedPatient ? patientsData[selectedPatient]?.[patientsData[selectedPatient].length - 1] || {} : {};

  const handleCreatePost = async () => {
    if (newPostContent.trim() || newPostImage) {
      setIsLoading(true);
      const community = selectedCommunity?.type === 'Global' ? 'global1' : `local_India`;
      const newPost = {
        id: `post${Date.now()}`,
        author: 'doc1',
        content: newPostContent,
        imageUrl: newPostImage ? URL.createObjectURL(newPostImage) : null,
        likes: 0,
        comments: [],
        timestamp: new Date().toISOString(),
      };
      await socket.emit('createPost', {
        author: 'doc1',
        content: newPostContent,
        imageUrl: newPostImage ? URL.createObjectURL(newPostImage) : null,
        communityId: community,
      });
      setPosts(prev => [newPost, ...prev].slice(0, 10));
      setNewPostContent('');
      setNewPostImage(null);
      setIsLoading(false);
    }
  };

  const handleLikePost = async (postId) => {
    const updatedPosts = posts.map(post => 
      post.id === postId ? { ...post, likes: post.likes + 1 } : post
    );
    setPosts(updatedPosts);
    socket.emit('likePost', { postId, user: 'doc1' });
  };

  const handleCommentPost = async (postId, comment) => {
    const updatedPosts = posts.map(post => 
      post.id === postId ? { ...post, comments: [...post.comments, `${'doc1'}: ${comment}`] } : post
    );
    setPosts(updatedPosts);
    socket.emit('commentPost', { postId, user: 'doc1', comment });
  };

  const handleConnectDoctor = async (doctorUsername) => {
    socket.emit('connectDoctor', { from: 'doc1', to: doctorUsername });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  useEffect(() => {
    if (transcript && !listening) {
      const command = transcript.toLowerCase().trim();
      if (command.includes('add patient')) {
        const patientId = command.replace('add patient', '').trim();
        handleAddPatient(patientId);
      } else if (command.includes('show')) {
        const patientId = command.split('show')[1].trim().split(' vitals')[0];
        setSelectedPatient(patientId);
        handleDetails(patientId);
      } else if (command.includes('alert for critical')) {
        setAlerts(prev => [...prev, `${t('monitoring')} ${new Date().toLocaleTimeString()}`].slice(-5));
      } else if (command.includes('remove patient')) {
        const patientId = command.replace('remove patient', '').trim();
        handleRemovePatient(patientId);
      } else if (command.includes('set threshold')) {
        const patientId = command.split('for')[1]?.trim().split(' ')[0] || selectedPatient;
        const heartRateMatch = command.match(/heart rate (\d+)/);
        const spO2Match = command.match(/spo2 (\d+)/);
        if (patientId && (heartRateMatch || spO2Match)) {
          const newThresholds = {
            heartRate: parseInt(heartRateMatch?.[1]) || thresholds[patientId]?.heartRate || 120,
            spO2: parseInt(spO2Match?.[1]) || thresholds[patientId]?.spO2 || 92,
          };
          handleSetThresholds(patientId, newThresholds);
        }
      } else if (command.includes('schemes') || command.includes('billing')) {
        const patientId = command.split('for')[1]?.trim().split(' ')[0] || selectedPatient;
        fetchAvailableScheme(patientId);
      } else if (command.includes('top doctors')) {
        fetchTopDoctors();
      } else if (command.includes('join') && (command.includes('global') || command.includes('local'))) {
        const type = command.includes('global') ? 'Global' : 'Local';
        const location = type === 'Local' ? 'India' : null;
        fetchCommunity(type, location);
      } else if (command.includes('post update')) {
        const [_, content] = command.split('post update in ');
        if (content) {
          const communityType = content.includes('Global') ? 'Global' : 'Local';
          const location = communityType === 'Local' ? 'India' : null;
          fetchCommunity(communityType, location);
          handleCreatePost();
        } else if (command.includes('logout')) {
          handleLogout();
        }
      }
      resetTranscript();
    }
  }, [transcript, listening, selectedPatient, thresholds]);

  const fetchCommunity = async (type, location) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/community?type=${type}&location=${location || ''}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      setSelectedCommunity(response.data);
      fetchPosts(response.data.id);
    } catch (error) {
      console.error('Error fetching community:', error);
    }
  };

  const fetchPosts = async (communityId) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/community/posts?communityId=${communityId}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      setPosts(prev => [...prev, ...response.data].slice(0, 10));
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  };

  const fetchAvailableScheme = async (patientId) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/patients/${patientId}/schemes`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      setAvailableScheme(response.data);
    } catch (error) {
      console.error('Error fetching scheme:', error);
    }
  };

  const fetchTopDoctors = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/community/top-doctors?limit=15', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      const regionDoctors = {
        India: response.data.filter(d => d.location === 'India').slice(0, 5),
        USA: response.data.filter(d => d.location === 'USA').slice(0, 5),
        UK: response.data.filter(d => d.location === 'UK').slice(0, 5),
      };
      setTopDoctors(regionDoctors);
    } catch (error) {
      console.error('Error fetching top doctors:', error);
    }
  };

  const setupTelehealth = async () => {
    try {
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
    }
  };

  useEffect(() => {
    if (Object.keys(patientsData).length > 0) {
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
      Plotly.newPlot('plotlyChart', [trace1, trace2], layout, { displayModeBar: false, showLegend: false });
    }
  }, [patientsData, t]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 flex font-sans">
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
            onClick={() => fetchCommunity(selectedCommunity?.type || 'Global', selectedCommunity?.location || 'India')}
            className={`w-full text-left px-3 py-2 rounded-md hover:bg-gray-700 transition-colors ${selectedCommunity && selectedCommunity.type ? 'bg-blue-600 text-white' : 'text-gray-300'} font-medium`}
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
          <div className="text-center text-gray-400 font-roboto">Loading...</div>
        ) : selectedCommunity ? (
          <div className="card bg-gray-800 p-4 rounded-lg shadow-2xl border border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-white">
              {selectedCommunity.type === 'Global' ? t('globalCommunityServer') : selectedCommunity.type === 'Local' ? t('privateCommunityServer') : t('topDoctors')} - {selectedCommunity?.name || 'Top Doctors'}
            </h2>
            {selectedCommunity.type && (
              <div className="mt-4">
                <h3 className="text-lg font-medium mb-2 text-gray-200">{t('members')} ({selectedCommunity.members.length})</h3>
                <ul className="list-disc pl-5 mb-4 text-gray-300">
                  {selectedCommunity.members.slice(0, 5).map((member, idx) => (
                    <li key={idx} className="text-gray-300">{member.username || member}</li>
                  ))}
                </ul>
                <h3 className="text-lg font-medium mb-2 text-gray-200">{t('channels')}</h3>
                <div className="space-y-3">
                  <div className="bg-gray-700 p-3 rounded-lg text-gray-200">
                    <h4 className="font-semibold">General Chat</h4>
                    <p>Discuss healthcare topics here...</p>
                  </div>
                  <div className="bg-gray-700 p-3 rounded-lg text-gray-200">
                    <h4 className="font-semibold">Emergencies</h4>
                    <p>Share urgent medical alerts...</p>
                  </div>
                </div>
                <h3 className="text-lg font-medium mt-4 mb-2 text-gray-200">{t('posts')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {posts.map((post) => (
                    <div key={post.id} className="bg-gray-700 p-4 rounded-lg shadow-md border border-gray-600">
                      <p className="text-gray-200 font-medium"><strong>{post.author}</strong>: {post.content}</p>
                      {post.imageUrl && <img src={post.imageUrl} alt={post.content} className="mt-2 w-full rounded-lg h-48 object-cover" />}
                      <div className="mt-2 flex justify-between text-gray-400">
                        <button onClick={() => handleLikePost(post.id)} className="btn btn-sm btn-blue text-white hover:bg-blue-700">
                          {t('like')} ({post.likes})
                        </button>
                        <input
                          type="text"
                          placeholder={t('addComment')}
                          onKeyPress={(e) => e.key === 'Enter' && handleCommentPost(post.id, e.target.value)}
                          className="input input-sm w-3/4 bg-gray-600 text-gray-200 border-gray-500 rounded"
                        />
                      </div>
                      <ul className="mt-2 list-disc pl-5 text-gray-400">
                        {post.comments.map((comment, idx) => (
                          <li key={idx}>{comment}</li>
                        ))}
                      </ul>
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
                    disabled={isLoading}
                  >
                    {t('post')}
                  </button>
                </div>
              </div>
            )}
            {selectedCommunity === 'topDoctors' && (
              <div className="mt-4">
                <h3 className="text-lg font-medium mb-2 text-gray-200">{t('doctorsByRegion')}</h3>
                {Object.entries(topDoctors).map(([region, doctors]) => (
                  <div key={region} className="mb-4">
                    <h4 className="font-semibold text-blue-400">{region}</h4>
                    <ul className="list-disc pl-5 text-gray-300">
                      {doctors.map((doctor, idx) => (
                        <li key={idx} className="text-gray-300">
                          <strong>{doctor.username}</strong> - {doctor.experienceYears} {t('yearsExperience')}, Specialties: {doctor.specialties.join(', ')}, Rating: {doctor.rating || 'N/A'}
                          <button
                            onClick={() => handleConnectDoctor(doctor.username)}
                            className="btn btn-sm btn-blue ml-2 text-white hover:bg-blue-700"
                          >
                            {t('connect')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
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
              <>
                <div className="h-60 mb-4 rounded-lg overflow-hidden bg-gray-900">
                  {renderChart(selectedPatient, patientsData[selectedPatient] || [])}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-400">{t('condition')}:</span>
                    <span className={`px-2 py-1 rounded-full text-sm text-white ${getConditionColor(latestVitalsForSelected.prediction, latestVitalsForSelected.isVerySerious)}`}>
                      {latestVitalsForSelected.prediction || t('normal')}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-400">{t('activityLevel')}: {latestVitalsForSelected.activityLevel || t('unknown')}</p>
                  <p className="text-sm font-medium text-gray-400">{t('score')}: <span className="font-bold text-blue-400">{patientScores[selectedPatient] || 100}</span></p>
                  <p className="text-sm font-medium text-gray-400">{t('recoveryRate')}: <span className="font-bold text-green-400">{latestVitalsForSelected.recoveryRate || 'unknown'}%</span></p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  <button
                    onClick={() => handleDetails(selectedPatient)}
                    className="btn btn-blue px-3 py-1 text-white hover:bg-blue-700 rounded text-sm"
                    disabled={isLoading}
                  >
                    {t('viewDetails')}
                  </button>
                  <button
                    onClick={() => handleMailAutomation(selectedPatient, latestVitalsForSelected)}
                    className="btn btn-green px-3 py-1 text-white hover:bg-green-700 rounded text-sm"
                    disabled={!latestVitalsForSelected.prediction || isLoading}
                  >
                    {t('notifyTeam')}
                  </button>
                  <button
                    onClick={() => handleRemovePatient(selectedPatient)}
                    className="btn btn-yellow px-3 py-1 text-white hover:bg-yellow-700 rounded text-sm"
                    disabled={isLoading}
                  >
                    {t('removePatient')}
                  </button>
                  <button
                    onClick={() => {
                      const newThresholds = {
                        heartRate: prompt(`${t('setHeartRateThreshold')} (e.g., 120)`, thresholds[selectedPatient]?.heartRate || 120),
                        spO2: prompt(`${t('setSpO2Threshold')} (e.g., 92)`, thresholds[selectedPatient]?.spO2 || 92),
                      };
                      if (newThresholds.heartRate && newThresholds.spO2) {
                        handleSetThresholds(selectedPatient, newThresholds);
                      }
                    }}
                    className="btn btn-purple px-3 py-1 text-white hover:bg-purple-700 rounded text-sm"
                    disabled={isLoading}
                  >
                    {t('setThresholds')}
                  </button>
                  <button
                    onClick={() => setIsTelehealthOpen(true)}
                    className="btn btn-blue px-3 py-1 text-white hover:bg-blue-700 rounded text-sm"
                    disabled={isLoading || !selectedPatient}
                  >
                    {t('telehealth')}
                  </button>
                  <button
                    onClick={() => fetchAvailableScheme(selectedPatient)}
                    className="btn btn-blue px-3 py-1 text-white hover:bg-blue-700 rounded text-sm"
                    disabled={isLoading || !selectedPatient}
                  >
                    {t('viewScheme')}
                  </button>
                </div>
                {healthForecast[selectedPatient] && (
                  <div className="mt-4 p-3 bg-gray-700 rounded-lg text-gray-200">
                    <h3 className="text-md font-medium text-blue-400">{t('healthForecast')}</h3>
                    <p className="text-sm">{t('riskScore')}: {healthForecast[selectedPatient].riskScore || 'Low'}</p>
                    <p className="text-sm">{t('suggestion')}: {healthForecast[selectedPatient].suggestion || t('maintainHealth')}</p>
                    <p className="text-sm">{t('days')}: {healthForecast[selectedPatient].days || 30}</p>
                  </div>
                )}
                {availableScheme && (
                  <div className="mt-4 p-3 bg-gray-700 rounded-lg text-gray-200">
                    <h3 className="text-md font-medium text-blue-400">{t('recommendedScheme')}</h3>
                    <p className="text-sm text-gray-300">
                      <strong>{availableScheme.name}</strong>: {availableScheme.description} (Eligibility: {availableScheme.eligibility})
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-gray-400">Select or Add a Patient</div>
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
                    <audio ref={alarmSound} autoPlay loop>
                      <source src="https://www.myinstants.com/media/sounds/alarm-clock-short-32064.mp3" type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
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
              <div id="plotlyChart" className="mt-2 h-40 rounded-lg overflow-hidden bg-gray-900"></div>
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
                onClick={() => handleAddPatient()}
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