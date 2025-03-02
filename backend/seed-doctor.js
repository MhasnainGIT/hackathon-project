const mongoose = require('mongoose');
const User = require('./src/models/User');
const bcrypt = require('bcryptjs');
const { mongoUri } = require('./src/config');

async function seedDoctor() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB for seeding');

    const existingDoctor = await User.findOne({ role: 'doctor' }).exec();
    if (!existingDoctor) {
      const hashedPassword = await bcrypt.hash('doctorpassword', 10);
      const doctor = new User({
        username: 'doc1',
        password: hashedPassword,
        email: 'doctor@example.com',
        role: 'doctor',
      });
      await doctor.save();
      console.log('Doctor user seeded successfully');
    } else {
      console.log('Doctor user already exists');
    }
  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
}

seedDoctor();