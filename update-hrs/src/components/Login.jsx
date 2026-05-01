import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase'; // Only need auth now!

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // 1. Log the user into Firebase Authentication
      await signInWithEmailAndPassword(auth, email, password);
      
      // 💡 That's it! We don't need to look up the role or call onLoginSuccess here anymore.
      // The moment this succeeds, the onAuthStateChanged listener in App.jsx takes over automatically!

    } catch (err) {
      console.error(err);
      setError('Invalid email or password. Please try again.');
      // Only turn off loading if it fails. If it succeeds, App.jsx will unmount this component anyway!
      setIsLoading(false); 
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f2f5' }}>
      <div style={{ width: '400px', padding: '40px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <h2 style={{ textAlign: 'center', color: '#1a73e8', marginBottom: '30px', marginTop: 0 }}>Telus Rater Hub</h2>
        
        {error && <div style={{ backgroundColor: '#fdecea', color: '#d32f2f', padding: '10px', borderRadius: '4px', marginBottom: '20px', fontSize: '14px', textAlign: 'center' }}>{error}</div>}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#555', fontWeight: 'bold', fontSize: '14px' }}>Email</label>
            <input 
              type="email" 
              required 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '16px', boxSizing: 'border-box' }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#555', fontWeight: 'bold', fontSize: '14px' }}>Password</label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '16px', boxSizing: 'border-box' }}
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            style={{ marginTop: '10px', padding: '12px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '4px', fontSize: '16px', fontWeight: 'bold', cursor: isLoading ? 'not-allowed' : 'pointer' }}
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}