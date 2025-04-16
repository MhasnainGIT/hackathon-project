const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  const { type, location } = req.query;
  try {
    let communityData = {};

    if (type === 'Global') {
      communityData = {
        type: 'Global',
        name: 'Global Health Community',
        members: ['doc1', 'doc2', 'doc3'], // Example members
      };
    } else if (type === 'Local' && location === 'India') {
      communityData = {
        type: 'Local',
        name: 'India Health Community',
        members: ['doc4', 'doc5', 'doc6'], // Example members
        location: 'India',
      };
    } else {
      return res.status(400).json({ message: 'Invalid community type or location' });
    }

    res.json(communityData);
  } catch (error) {
    console.error('Error fetching community:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/top-doctors', async (req, res) => {
  const { limit } = req.query;
  try {
    const topDoctors = {
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
    };

    const limitNum = parseInt(limit) || 15;
    const filteredDoctors = Object.fromEntries(
      Object.entries(topDoctors).map(([region, doctors]) => [region, doctors.slice(0, limitNum)])
    );

    res.json(filteredDoctors);
  } catch (error) {
    console.error('Error fetching top doctors:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/posts', async (req, res) => {
  const { communityId, limit } = req.query;
  try {
    const posts = [
      { id: 'post1', author: 'Dr. Rajesh Kumar', content: 'New insights on heart health management', imageUrl: 'https://via.placeholder.com/300x200?text=Heart+Health', likes: 15, comments: ['Great post!', 'Very informative'], timestamp: new Date().toISOString() },
      { id: 'post2', author: 'Dr. Emily Davis', content: 'Pediatric care tips for flu season', imageUrl: 'https://via.placeholder.com/300x200?text=Pediatric+Care', likes: 12, comments: ['Helpful!', 'Thanks for sharing'], timestamp: new Date().toISOString() },
      { id: 'post3', author: 'Dr. Alice Turner', content: 'Latest advancements in neurology', likes: 20, comments: ['Excellent research!', 'Very detailed'], timestamp: new Date().toISOString() },
      { id: 'post4', author: 'Dr. Priya Sharma', content: 'Nutritional advice for chronic diseases', imageUrl: 'https://via.placeholder.com/300x200?text=Nutrition+Tips', likes: 18, comments: ['Useful tips!', 'Great content'], timestamp: new Date().toISOString() },
    ];

    const limitNum = parseInt(limit) || 10;
    res.json(posts.slice(0, limitNum));
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
