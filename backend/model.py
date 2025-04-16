from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from pymongo import MongoClient
import json
import random
from datetime import datetime, timedelta
import time
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
# Specify exact origin for CORS, and allow credentials explicitly
socketio = SocketIO(app, cors_allowed_origins=["http://localhost:3000"], cors_credentials=True)

# MongoDB Connection
client = MongoClient('mongodb://localhost:27017/')
db = client['healthsync_db']
posts_collection = db['posts']
community_collection = db['communities']
doctors_collection = db['doctors']
patients_collection = db['patients']

# Decorator for error handling
def handle_error(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    return wrapper

# Initialize sample data if not exists
def initialize_data():
    if not posts_collection.find_one():
        initial_posts = [
            {"id": "post1", "author": "Dr. Rajesh Kumar", "content": "New insights on heart health management", "imageUrl": "http://localhost:3000/images/1-heart-health.jpg", "likes": {}, "comments": ["Great post!", "Very informative"], "timestamp": datetime.now().isoformat(), "sharedTo": ["Global"]},
            {"id": "post2", "author": "Dr. Emily Davis", "content": "Pediatric care tips for flu season", "imageUrl": "http://localhost:3000/images/4-pediatric-care.jpg", "likes": {}, "comments": ["Helpful!", "Thanks for sharing"], "timestamp": datetime.now().isoformat(), "sharedTo": ["Global"]},
            {"id": "post3", "author": "Dr. Kumar", "content": "Neurology updates for stroke prevention", "imageUrl": "http://localhost:3000/images/2-neurology.jpg", "likes": {}, "comments": ["Useful info!", "Great work"], "timestamp": datetime.now().isoformat(), "sharedTo": ["Local_India"]},
            {"id": "post4", "author": "Dr. Patel", "content": "Nutrition tips for better health", "imageUrl": "http://localhost:3000/images/3-nutrition-tips.jpg", "likes": {}, "comments": ["Very helpful!", "Thanks"], "timestamp": datetime.now().isoformat(), "sharedTo": ["Local_India"]},
        ]
        posts_collection.insert_many(initial_posts)

    if not community_collection.find_one():
        initial_communities = [
            {"type": "Global", "location": None, "name": "Global Community", "members": ["Dr. Rajesh", "Dr. Emily", "Dr. Alice", "doc1"], "posts": [], "channels": {"general": [], "emergencies": []}, "messages": {"general": [], "emergencies": []}},
            {"type": "Local", "location": "India", "name": "India Community", "members": ["Dr. Kumar", "Dr. Patel", "Dr. Sharma", "doc1"], "posts": [], "channels": {"general": [], "emergencies": []}, "messages": {"general": [], "emergencies": []}},
        ]
        community_collection.insert_many(initial_communities)

        # Populate community posts based on sharedTo
        for post in posts_collection.find():
            for community_id in post['sharedTo']:
                if community_id == 'Global':
                    community_collection.update_one({"type": "Global", "location": None}, {"$push": {"posts": post}}, upsert=True)
                elif community_id == 'Local_India':
                    community_collection.update_one({"type": "Local", "location": "India"}, {"$push": {"posts": post}}, upsert=True)

    if not doctors_collection.find_one():
        initial_doctors = {
            "India": [
                {"username": "Dr. Kumar", "experienceYears": 15, "specialties": ["Cardiology"], "rating": 4.8, "image": "http://localhost:3000/images/1-heart-health.jpg", "status": "Disconnected"},
                {"username": "Dr. Patel", "experienceYears": 12, "specialties": ["Neurology"], "rating": 4.6, "image": "http://localhost:3000/images/2-neurology.jpg", "status": "Disconnected"},
            ],
            "USA": [
                {"username": "Dr. Smith", "experienceYears": 18, "specialties": ["Oncology"], "rating": 4.9, "image": "https://via.placeholder.com/100.png?text=Dr.+Smith", "status": "Disconnected"},
            ],
            "UK": [
                {"username": "Dr. Brown", "experienceYears": 14, "specialties": ["Pediatrics"], "rating": 4.7, "image": "https://via.placeholder.com/100.png?text=Dr.+Brown", "status": "Disconnected"},
            ],
        }
        doctors_collection.insert_many([{"region": region, "doctors": doctors} for region, doctors in initial_doctors.items()])

    if not patients_collection.find_one():
        initial_patients = {
            "patient1": [],
            "patient2": [],
            "patient3": [],
        }
        for patient_id, vitals in initial_patients.items():
            patients_collection.insert_one({"patientId": patient_id, "vitals": vitals})

initialize_data()

# API Endpoints with CORS headers
@app.route('/api/patients', methods=['GET'])
@handle_error
def get_patients():
    response = jsonify(list(patients_collection.find()))
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

@app.route('/api/patients/<patient_id>/vitals', methods=['GET'])
@handle_error
def get_patient_vitals(patient_id):
    patient = patients_collection.find_one({"patientId": patient_id})
    response = jsonify(patient['vitals'] if patient else [])
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

@app.route('/api/patients/<patient_id>/forecast', methods=['GET'])
@handle_error
def get_patient_forecast(patient_id):
    response = jsonify({"riskScore": "Low", "suggestion": "Maintain health", "days": 30})
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

@app.route('/api/patients/<patient_id>/schemes', methods=['GET'])
@handle_error
def get_patient_schemes(patient_id):
    response = jsonify({"name": "Health Plan", "description": "Basic health insurance", "eligibility": "All patients"})
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

@app.route('/api/community', methods=['GET'])
@handle_error
def get_community():
    type = request.args.get('type')
    location = request.args.get('location')
    query = {"type": type}
    if location:
        query["location"] = location
    community = community_collection.find_one(query)
    response = jsonify(community if community else {})
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

@app.route('/api/community/<community_id>/posts', methods=['GET'])
@handle_error
def get_community_posts(community_id):
    if community_id == 'Global':
        community = community_collection.find_one({"type": "Global", "location": None})
    elif community_id == 'Local_India':
        community = community_collection.find_one({"type": "Local", "location": "India"})
    else:
        response = jsonify([])
    response = jsonify(community['posts'] if community and 'posts' in community else [])
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

@app.route('/api/community/<community_id>/messages/<channel>', methods=['GET'])
@handle_error
def get_community_messages(community_id, channel):
    if channel not in ['general', 'emergencies']:
        return jsonify({"error": "Invalid channel"}), 400
    if community_id == 'Global':
        community = community_collection.find_one({"type": "Global", "location": None})
    elif community_id == 'Local_India':
        community = community_collection.find_one({"type": "Local", "location": "India"})
    else:
        response = jsonify([])
    if not community or 'messages' not in community or channel not in community['messages']:
        response = jsonify([])
    else:
        response = jsonify(community['messages'][channel])
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

@app.route('/api/community/top-doctors', methods=['GET'])
@handle_error
def get_top_doctors():
    doctors = list(doctors_collection.find())
    result = {}
    for doc in doctors:
        result[doc['region']] = doc['doctors']
    response = jsonify(result if result else {})
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

# SocketIO Events
@socketio.on('connect')
def handle_connect():
    print(f'New client connected: {request.sid}')
    emit('connected', {'message': 'Connected to server'}, room=request.sid)
    # Send initial data to new client
    global_posts = list(posts_collection.find({"sharedTo": "Global"}))
    local_posts = list(posts_collection.find({"sharedTo": "Local_India"}))
    global_community = community_collection.find_one({"type": "Global", "location": None})
    local_community = community_collection.find_one({"type": "Local", "location": "India"})
    emit('initialData', {
        'posts': global_posts + local_posts,
        'messages': {
            'Global': global_community['messages'] if global_community else {'general': [], 'emergencies': []},
            'Local_India': local_community['messages'] if local_community else {'general': [], 'emergencies': []},
        }
    }, room=request.sid)

@socketio.on('vitalsUpdate')
def handle_vitals_update(data):
    try:
        patient_id = data['patientId']
        patients_collection.update_one({"patientId": patient_id}, {"$push": {"vitals": data}})
        socketio.emit('vitalsUpdate', data, broadcast=True)
    except Exception as e:
        socketio.emit('error', {"message": str(e)}, broadcast=True)

@socketio.on('addPatient')
def handle_add_patient(data):
    try:
        patient_id = data['patientId']
        initial_vitals = {"patientId": patient_id, "heartRate": 80, "spO2": 98, "timestamp": datetime.now().isoformat(), "prediction": "Normal", "activityLevel": "Low", "recoveryRate": "85%", "anomalyScore": 0.2, "isVerySerious": False}
        patients_collection.update_one({"patientId": patient_id}, {"$set": {"vitals": [initial_vitals]}}, upsert=True)
        socketio.emit('vitalsUpdate', initial_vitals, broadcast=True)
    except Exception as e:
        socketio.emit('error', {"message": str(e)}, broadcast=True)

@socketio.on('removePatient')
def handle_remove_patient(data):
    try:
        patient_id = data['patientId']
        patients_collection.delete_one({"patientId": patient_id})
        socketio.emit('patientRemoved', {"patientId": patient_id}, broadcast=True)
    except Exception as e:
        socketio.emit('error', {"message": str(e)}, broadcast=True)

@socketio.on('createPost')
def handle_create_post(data):
    try:
        post = {
            "id": f"post{datetime.now().timestamp()}",
            "author": data['author'],
            "content": data['content'],
            "imageUrl": data['imageUrl'],
            "likes": {data['author']: False},  # Track likes per user
            "comments": [],
            "timestamp": datetime.now().isoformat(),
            "sharedTo": data.get('sharedTo', []),
        }
        posts_collection.insert_one(post)
        if data.get('communityId'):
            community_id = data['communityId']
            if community_id == 'Global':
                community_collection.update_one({"type": "Global", "location": None}, {"$push": {"posts": post}}, upsert=True)
            elif community_id == 'Local_India':
                community_collection.update_one({"type": "Local", "location": "India"}, {"$push": {"posts": post}}, upsert=True)
        socketio.emit('newPost', {"post": post}, broadcast=True)
    except Exception as e:
        socketio.emit('error', {"message": str(e)}, broadcast=True)

@socketio.on('likePost')
def handle_like_post(data):
    try:
        post_id = data['postId']
        user = data['user']
        post = posts_collection.find_one({"id": post_id})
        if post and not post['likes'].get(user, False):
            posts_collection.update_one({"id": post_id}, {"$set": {"likes": {**post['likes'], user: True}}})
            updated_post = posts_collection.find_one({"id": post_id})
            socketio.emit('postUpdated', {"postId": post_id, "likes": sum(1 for v in updated_post['likes'].values() if v), "comments": updated_post['comments']}, broadcast=True)
    except Exception as e:
        socketio.emit('error', {"message": str(e)}, broadcast=True)

@socketio.on('commentPost')
def handle_comment_post(data):
    try:
        post_id = data['postId']
        user = data['user']
        comment = f"{user}: {data['comment']}"
        post = posts_collection.find_one({"id": post_id})
        if post:
            posts_collection.update_one({"id": post_id}, {"$push": {"comments": comment}})
            updated_post = posts_collection.find_one({"id": post_id})
            socketio.emit('postUpdated', {"postId": post_id, "likes": sum(1 for v in updated_post['likes'].values() if v), "comments": updated_post['comments']}, broadcast=True)
    except Exception as e:
        socketio.emit('error', {"message": str(e)}, broadcast=True)

@socketio.on('communityMessage')
def handle_community_message(data):
    try:
        community_id = data['communityId']
        channel = data['channel']
        message = data['message']
        if channel not in ['general', 'emergencies']:
            raise ValueError("Invalid channel")
        if community_id == 'Global':
            community_collection.update_one({"type": "Global", "location": None}, {"$push": {"messages." + channel: message}}, upsert=True)
        elif community_id == 'Local_India':
            community_collection.update_one({"type": "Local", "location": "India"}, {"$push": {"messages." + channel: message}}, upsert=True)
        socketio.emit('communityMessage', {"communityId": community_id, "channel": channel, "message": message}, broadcast=True)
    except Exception as e:
        socketio.emit('error', {"message": str(e)}, broadcast=True)

@socketio.on('connectDoctor')
def handle_connect_doctor(data):
    try:
        from_user = data['from']
        to_user = data['to']
        doctors_collection.update_one({"region": {"$in": ["India", "USA", "UK"]}, "doctors.username": to_user}, {"$set": {"doctors.$.status": "Connected"}})
        socketio.emit('connectionUpdate', {"from": from_user, "to": to_user, "status": "Connected"}, broadcast=True)
        # Automatically switch to Private community for chatting
        socketio.emit('switchToPrivateCommunity', {"user": from_user, "communityId": "Local_India"}, room=from_user)
    except Exception as e:
        socketio.emit('error', {"message": str(e)}, broadcast=True)

@socketio.on('disconnectDoctor')
def handle_disconnect_doctor(data):
    try:
        from_user = data['from']
        to_user = data['to']
        doctors_collection.update_one({"region": {"$in": ["India", "USA", "UK"]}, "doctors.username": to_user}, {"$set": {"doctors.$.status": "Disconnected"}})
        socketio.emit('connectionUpdate', {"from": from_user, "to": to_user, "status": "Disconnected"}, broadcast=True)
    except Exception as e:
        socketio.emit('error', {"message": str(e)}, broadcast=True)

# Simulate live patient data (using a model-like approach)
def simulate_patient_data():
    while True:
        patient_ids = ['patient1', 'patient2', 'patient3']
        for patient_id in patient_ids:
            vitals = {
                "patientId": patient_id,
                "heartRate": 70 + random.randint(0, 30),
                "spO2": 95 + random.randint(0, 5),
                "timestamp": datetime.now().isoformat(),
                "prediction": "Normal" if random.random() > 0.1 else "Critical",
                "activityLevel": random.choice(['Low', 'Moderate', 'High']),
                "recoveryRate": f"{80 + random.randint(0, 20)}%",
                "anomalyScore": random.random() * 0.8,
                "isVerySerious": random.random() < 0.05,
            }
            socketio.emit('vitalsUpdate', vitals, broadcast=True)
            patients_collection.update_one({"patientId": patient_id}, {"$push": {"vitals": vitals}})
        time.sleep(3)  # Update every 3 seconds

if __name__ == '__main__':
    import threading
    threading.Thread(target=simulate_patient_data, daemon=True).start()
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)