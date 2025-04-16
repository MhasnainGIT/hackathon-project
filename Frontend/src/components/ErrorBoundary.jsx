// src/components/ErrorBoundary.jsx
import React, { Component } from 'react';

class ErrorBoundary extends Component {
state = { hasError: false, error: null };

static getDerivedStateFromError(error) {
return { hasError: true, error };
}

componentDidCatch(error, errorInfo) {
console.error('Error caught by ErrorBoundary:', error, errorInfo);
}

render() {
if (this.state.hasError) {
    return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-200">
        <div className="card bg-gray-800 p-6 rounded-lg shadow-2xl border border-gray-700">
        <h2 className="text-2xl font-bold mb-4 text-white text-center">Something Went Wrong</h2>
        <p>{this.state.error.message}</p>
        <button
            onClick={() => window.location.reload()}
            className="btn btn-blue mt-4 w-full text-white"
        >
            Reload Page
        </button>
        </div>
    </div>
    );
}
return this.props.children;
}
}

export default ErrorBoundary;